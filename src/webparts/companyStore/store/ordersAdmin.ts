import type { SPFI } from '../sp';
import type { IList } from '@pnp/sp/lists';
import type { ListIds } from '../setup/schema';
import { explain } from '../setup/errors';
import type { IStoreSettings } from './settings';
import { IOrder, IOrderRow, OrderStatus, orderFields, ordersFromRows } from './ordersView';
import { parseHistory } from './orderHistory';
import { lineName } from './orderText';
import { today } from './dates';
import { listOf } from './lists';
import { ITaken, changeOrder, changeStockBy, isNotEnough, putBack } from './orders';
import {
  IOrderEdit, IQuantityChange, IStatusDetails, IStatusMove, checkEdit, describeEdit, editedOrder, emailFailedText,
  emailedText, orderColumns, statusDetailsProblem, statusMove, statusProblem, stockMoves, tooFewMessage
} from './orderEdits';
import type { GetGraph } from './orderEmail';
import { sendStatusEmail } from './statusEmail';
import type { StatusEmailKind } from './statusEmailText';

/* Plenty for a company store's working orders. Anything older is still in the orders list itself. */
export const MOST_ORDERS = 500;

/**
 * The newest orders, everyone's: site owners and store managers can see every
 * row in the orders list, so this is only for them. Staff would get back just
 * their own.
 */
export async function loadOrders(sp: SPFI, ids: ListIds): Promise<IOrder[]> {
  const rows = await listOf(sp, ids, 'orders').items
    .select(...orderFields(true))
    .expand('Author')
    .orderBy('Id', false)
    .top(MOST_ORDERS)();
  return ordersFromRows(rows as IOrderRow[]);
}

/**
 * Moves an order on to another of its steps (New, Confirmed, Packed, Shipped
 * for a delivery; New, Confirmed, Ready for pick-up, Picked up for a pick-up)
 * with what goes with it: the ready-by day when it's confirmed, the tracking
 * when it's shipped, and today as the day it was picked up. All of that and a
 * line in the history, as done by `who`, go in the same write. Returns the
 * order as saved, history included. If someone else already moved it there,
 * nothing is written. Throws with a plain-words message, and writes nothing,
 * for a status that doesn't fit the way the order is going.
 */
export async function setOrderStatus(
  sp: SPFI, ids: ListIds, order: IOrder, status: OrderStatus, who: string, details: IStatusDetails = {}
): Promise<IOrder> {
  const wrong = statusProblem(status, order.method) || statusDetailsProblem(details);
  if (wrong) throw new Error(wrong);
  const day = today();
  // Worked out from the order as it is in the list, each time it's read.
  const done: { move?: IStatusMove } = {};
  const history = await changeOrder(listOf(sp, ids, 'orders'), order.id, who, now => {
    // From what it is now, which may not be what the page showed if someone else just changed it.
    done.move = now.status === status ? undefined : statusMove(order, now.status, status, details, day);
    return done.move && { what: done.move.what, values: done.move.values };
  });
  // Nothing written means nothing of ours went in, only the status someone else gave it.
  const after = done.move ? done.move.after : { ...order, status };
  return { ...after, history: parseHistory(history) };
}

/** How the email about an order moving on went. */
export interface IStatusEmailResult {
  /** The order with a line in its history saying whether the email went. */
  order: IOrder;
  /** Why it didn't go, in plain words. Missing when it went. */
  failed?: string;
}

/**
 * Emails the person who placed the order to say it moved on, from the mailbox
 * of whoever moved it, then says in the order's history whether it went, as
 * done by `who`. Never throws: a failed email undoes nothing, so it comes back
 * as `failed` for the page to show. `storeUrl` is the store page, for the link
 * in the email.
 */
export async function emailStatus(
  sp: SPFI, ids: ListIds, getGraph: GetGraph, settings: IStoreSettings, kind: StatusEmailKind, order: IOrder,
  who: string, storeUrl: string
): Promise<IStatusEmailResult> {
  const failed = await sendStatusEmail(getGraph, settings, kind, order, storeUrl)
    .then((): string | undefined => undefined, (e: unknown) => explain(e));
  const what = failed === undefined ? emailedText(order.who, kind) : emailFailedText(order.who, failed);
  try {
    const history = await changeOrder(listOf(sp, ids, 'orders'), order.id, who, () => ({ what }));
    return { order: { ...order, history: parseHistory(history) }, failed };
  } catch {
    // The page still says whether the email went; only the history misses the line.
    return { order, failed };
  }
}

/*
 * Moves the stock for each changed line, one at a time: a raised quantity
 * takes the difference, a lowered one puts it back. If any can't be done,
 * whatever was already moved goes back, so the stock is as it was.
 */
async function moveStock(stock: IList, changes: IQuantityChange[]): Promise<ITaken[]> {
  const moved: ITaken[] = [];
  for (const c of changes) {
    try {
      const done = await changeStockBy(stock, c.line, c.from - c.to, left => tooFewMessage(c.line, c.to, left));
      if (done) moved.push(done);
    } catch (e) {
      await putBack(stock, moved);
      if (isNotEnough(e)) throw e;
      throw new Error(`The stock for ${lineName(c.line)} couldn't be changed, so the order is as it was. ` +
        `Please try again. (${explain(e)})`);
    }
  }
  return moved;
}

/**
 * Saves an owner's changes. Stock moves to match the new quantities (more
 * taken, or some put back), the total and the order's text are rewritten,
 * and one line saying what changed goes in the history as done by `who`.
 * Throws with a plain-words message — and changes nothing — if the changes
 * don't make sense or there isn't enough stock for a raised quantity. Returns
 * the order as saved; when nothing changed, nothing is saved and it comes back
 * as it was.
 */
export async function updateOrder(
  sp: SPFI, ids: ListIds, settings: IStoreSettings, order: IOrder, edit: IOrderEdit, who: string
): Promise<IOrder> {
  const wrong = checkEdit(order, edit);
  if (wrong) throw new Error(wrong);
  const what = describeEdit(order, edit, settings.currency);
  if (!what) return order;

  const after = editedOrder(order, edit);
  const changes = stockMoves(order.lines, after.lines);
  const stock = listOf(sp, ids, 'stock');
  const orders = listOf(sp, ids, 'orders');

  // Stock first, so the order never says more than was taken for it.
  const moved = changes.length ? await moveStock(stock, changes) : [];

  let history: string;
  try {
    history = await changeOrder(orders, order.id, who, () => ({ what, values: orderColumns(order, after) }));
  } catch (e) {
    await putBack(stock, moved);
    throw new Error(`The changes couldn't be saved, so the order is as it was. Please try again. (${explain(e)})`);
  }
  return { ...after, history: parseHistory(history) };
}
