import type { SPFI } from '../sp';
import type { IList } from '@pnp/sp/lists';
import type { ListIds } from '../setup/schema';
import { explain, isConflict } from '../setup/errors';
import type { IStoreSettings } from './settings';
import type { IBuyer, ICartLine, IOrderRequest, IPlacedOrder } from './types';
import { listOf } from './lists';
import { saveMyAddress } from './addresses';
import {
  checkOrder, itemsText, lineName, notEnoughMessage, orderData, orderNumber, orderTotal, shipToText, tidyAddress
} from './orderText';
import { appendHistory, historyEntry } from './orderHistory';
import { NOT_SENT } from './orderEmailText';
import { displayName } from './messages';

/* What goes in the order's title until it has a number. Only ever seen if
   numbering fails and the half-saved row can't be cleaned up either. */
const NOT_PLACED_YET = 'Not placed yet';

/* When someone else keeps changing the same row at the same moment:
   the first go, then up to three more. */
const TRIES = 4;

/* Said when there aren't enough left. Marked rather than subclassed, because a
   subclass of Error loses its type once compiled for older browsers. */
const notEnough = (message: string): Error => Object.assign(new Error(message), { notEnough: true });

/** Whether an error is "there aren't enough left", already in plain words for the person. */
export const isNotEnough = (e: unknown): boolean =>
  !!e && typeof e === 'object' && (e as { notEnough?: unknown }).notEnough === true;

/* ---------------------------------------------------------- guarded writes */

/** A row as read for a guarded write. */
export interface IStamped {
  id: number;
  /** SharePoint's version stamp for the row, so a write only lands if nobody got there first. */
  etag: string;
}

/* Where REST puts the stamp, depending on how much it was asked to say. */
interface IRawStamp {
  'odata.etag'?: string;
  __metadata?: { etag?: string };
}

// Without a stamp the write can't be guarded; "*" still lets it through.
const stampOf = (r: IRawStamp): string => r['odata.etag'] || (r.__metadata && r.__metadata.etag) || '*';

const pause = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

interface IWritten<R> {
  /** The row as last read. */
  row: R;
  /** What was written to it. Missing when there was nothing to write. */
  values?: Record<string, unknown>;
}

/*
 * Reads a row, works out what to write from it, and writes that with the stamp
 * the row was read with. If someone else changed the row in between,
 * SharePoint refuses the write (412), so read it again and work it out afresh.
 * Undefined when there was no row to read.
 */
async function writeGuarded<R extends IStamped>(
  list: IList, read: () => Promise<R | undefined>, write: (row: R) => Record<string, unknown> | undefined
): Promise<IWritten<R> | undefined> {
  for (let attempt = 1; ; attempt++) {
    const row = await read();
    if (!row) return undefined;
    const values = write(row);
    if (!values) return { row };
    try {
      await list.items.getById(row.id).update(values, row.etag);
      return { row, values };
    } catch (e) {
      if (!isConflict(e) || attempt >= TRIES) throw e;
      // A short, slightly random wait so two people don't collide again straight away.
      await pause(150 + Math.floor(Math.random() * 250));
    }
  }
}

/* ------------------------------------------------------------------ stock */

interface IStockRow extends IStamped {
  inStock: number;
}

interface IRawStockRow extends IRawStamp {
  Id: number;
  // eslint-disable-next-line @rushstack/no-new-null -- SharePoint sends null for an empty column
  InStock: number | null;
}

const toStockRow = (r: IRawStockRow): IStockRow => ({ id: r.Id, inStock: r.InStock || 0, etag: stampOf(r) });

const quote = (s: string): string => `'${s.replace(/'/g, "''")}'`;

async function findStock(list: IList, line: ICartLine): Promise<IStockRow | undefined> {
  const rows = await list.items
    .select('Id', 'InStock')
    .filter(`StoreProductId eq ${line.productId} and Title eq ${quote(line.variant)}`)
    .top(1)();
  return rows.length ? toStockRow(rows[0] as IRawStockRow) : undefined;
}

async function readStock(list: IList, id: number): Promise<IStockRow> {
  return toStockRow(await list.items.getById(id).select('Id', 'InStock')() as IRawStockRow);
}

/** A stock change that can be undone: how many were taken off a stock line. Negative when some were put back. */
export interface ITaken {
  stockId: number;
  qty: number;
}

/**
 * Undoes stock changes. Best effort: by now something has already gone wrong,
 * and that is what the person needs to hear.
 */
export async function putBack(list: IList, taken: ITaken[]): Promise<void> {
  for (const t of taken) {
    try {
      // Never below 0: if some of what was put back has been bought since, there's no taking that back.
      await writeGuarded(list, () => readStock(list, t.stockId),
        row => ({ InStock: Math.max(0, row.inStock + t.qty) }));
    } catch {
      // Nothing more to do; the stock list can be corrected by hand.
    }
  }
}

/**
 * Changes one variant's stock by `by`: below 0 takes that many off, above 0
 * puts that many back. The number is read fresh and written guarded, so two
 * people at once can't both have the last one. Taking more than is left throws
 * an error marked as not enough, in tooFew's words for how many are left.
 * Returns the change so it can be undone, or undefined when putting back to a
 * variant that no longer has a stock line.
 */
export async function changeStockBy(
  stock: IList, line: ICartLine, by: number, tooFew: (left: number) => string
): Promise<ITaken | undefined> {
  const done = await writeGuarded(stock, () => findStock(stock, line), row => {
    if (row.inStock + by < 0) throw notEnough(tooFew(row.inStock));
    return { InStock: row.inStock + by };
  });
  if (done) return { stockId: done.row.id, qty: -by };
  if (by < 0) throw notEnough(tooFew(0));
  // That variant has gone from the store since, so there's no stock line to put these back on.
  return undefined;
}

async function takeLine(list: IList, line: ICartLine): Promise<ITaken> {
  try {
    const taken = await changeStockBy(list, line, -line.qty, left => notEnoughMessage(line, left));
    // Only possible for a line of none with no stock line, which checkout never sends.
    if (!taken) throw notEnough(notEnoughMessage(line, 0));
    return taken;
  } catch (e) {
    if (isNotEnough(e)) throw e;
    if (isConflict(e)) {
      throw new Error(`Lots of people are ordering ${lineName(line)} right now. Please try again in a moment.`);
    }
    throw new Error(`We couldn't take ${lineName(line)} off the stock list, so nothing has been ordered. ` +
      `Please try again. (${explain(e)})`);
  }
}

/* One line at a time. If any line can't be had, whatever was taken for the earlier lines goes back. */
async function takeStock(list: IList, lines: ICartLine[]): Promise<ITaken[]> {
  const taken: ITaken[] = [];
  for (const line of lines) {
    try {
      taken.push(await takeLine(list, line));
    } catch (e) {
      await putBack(list, taken);
      throw e;
    }
  }
  return taken;
}

/* ---------------------------------------------------------------- history */

/** An order as it stands right now, read fresh, for working out a change to it. */
export interface IOrderNow extends IStamped {
  /** The Status column as it is: maybe empty, maybe something typed in by hand. */
  status: string;
  /** The History column as it is. */
  history: string;
}

interface IRawOrderNow extends IRawStamp {
  // eslint-disable-next-line @rushstack/no-new-null -- SharePoint sends null for an empty column
  OrderStatus?: string | null;
  // eslint-disable-next-line @rushstack/no-new-null -- SharePoint sends null for an empty column
  OrderHistory?: string | null;
}

async function readOrderNow(orders: IList, id: number): Promise<IOrderNow> {
  const r = await orders.items.getById(id).select('OrderStatus', 'OrderHistory')() as IRawOrderNow;
  return { id, etag: stampOf(r), status: (r.OrderStatus || '').trim(), history: r.OrderHistory || '' };
}

/** A change to an order: the line for its history, and anything else to save with it. */
export interface IOrderChange {
  what: string;
  values?: Record<string, unknown>;
}

/**
 * Saves a change to an order together with one more line in its history, in a
 * single write. The order is read fresh and written with the stamp it was read
 * with; if someone else saved it in between, it's read again and the change
 * worked out afresh, so a history line they just added is never lost.
 * `change` returns undefined when, as the order now stands, there's nothing to
 * do. Returns the History column as it now is.
 */
export async function changeOrder(
  orders: IList, orderId: number, who: string, change: (now: IOrderNow) => IOrderChange | undefined
): Promise<string> {
  const done = await writeGuarded(orders, () => readOrderNow(orders, orderId), now => {
    const c = change(now);
    return c && { ...c.values, OrderHistory: appendHistory(now.history, historyEntry(who, c.what)) };
  });
  if (!done) return '';
  return done.values ? String(done.values.OrderHistory) : done.row.history;
}

/* ----------------------------------------------------------------- orders */

/*
 * The number comes from the row's own ID, which only exists once the row does,
 * so the row goes in first and gets its number straight after. If that second
 * step fails, the unnumbered row is removed so it can't be mistaken for an order.
 */
async function addOrderRow(
  orders: IList, prefix: string, values: Record<string, unknown>
): Promise<{ id: number; number: string }> {
  const added = await orders.items.add({ Title: NOT_PLACED_YET, ...values });
  const id: number = added.Id ?? added.ID;
  const number = orderNumber(prefix, id);
  try {
    await orders.items.getById(id).update({ Title: number });
  } catch (e) {
    await orders.items.getById(id).delete().catch(() => undefined);
    throw e;
  }
  return { id, number };
}

/**
 * Takes the items off stock, saves the order and gives it its number. Its
 * history starts with "Order placed", by the buyer.
 * Throws with a plain-words message if anything is out of stock or the order
 * could not be saved — in which case stock is put back as it was.
 */
export async function placeOrder(
  sp: SPFI, ids: ListIds, settings: IStoreSettings, request: IOrderRequest, buyer: IBuyer
): Promise<IPlacedOrder> {
  const wrong = checkOrder(request, settings);
  if (wrong) throw new Error(wrong);

  const stock = listOf(sp, ids, 'stock');
  const orders = listOf(sp, ids, 'orders');

  const { lines, method } = request;
  const address = method === 'Delivery' && request.address ? tidyAddress(request.address) : undefined;
  const total = orderTotal(lines);
  const shipTo = address ? shipToText(address) : '';
  const phone = address ? address.phone : '';
  const note = request.note.trim();

  // Stock first, so nobody is told their order went in for something that has run out.
  const taken = await takeStock(stock, lines);

  let saved: { id: number; number: string };
  try {
    saved = await addOrderRow(orders, settings.orderPrefix.trim(), {
      OrderItems: itemsText(lines),
      OrderTotal: total,
      DeliveryMethod: method,
      ShipTo: shipTo,
      ShipPhone: phone,
      OrderNote: note,
      OrderStatus: 'New',
      ConfirmationSent: false,
      OrderData: orderData(lines, method, address),
      OrderHistory: appendHistory('', historyEntry(displayName(buyer), 'Order placed'))
    });
  } catch (e) {
    await putBack(stock, taken);
    throw new Error(`Your order couldn't be saved, so nothing has been ordered. Please try again. (${explain(e)})`);
  }

  if (request.rememberAddress && address) {
    // Handy, not essential: the order is in, so a hiccup here mustn't undo it.
    try {
      const me = await sp.web.currentUser.select('Id')();
      await saveMyAddress(sp, ids, me.Id, address);
    } catch {
      // They'll just be asked for it again next time.
    }
  }

  return { id: saved.id, number: saved.number, total, lines, method, shipTo, phone, note };
}

/** Ticks "Email sent" on the order once the email has gone, and says so in its history. */
export async function markEmailSent(sp: SPFI, ids: ListIds, orderId: number, buyer: IBuyer): Promise<void> {
  await changeOrder(listOf(sp, ids, 'orders'), orderId, displayName(buyer), () => ({
    what: 'Confirmation email sent',
    values: { ConfirmationSent: true }
  }));
}

/**
 * Says in the order's history that the confirmation email couldn't be sent,
 * and why, so the store team knows to tell the buyer themselves.
 */
export async function noteEmailFailed(
  sp: SPFI, ids: ListIds, orderId: number, reason: string, buyer: IBuyer
): Promise<void> {
  // The reason usually starts by saying it couldn't be sent, which the line already says.
  const why = reason.replace(NOT_SENT, '').trim();
  const what = `The confirmation email couldn't be sent${why ? `: ${why}` : ''}`;
  await changeOrder(listOf(sp, ids, 'orders'), orderId, displayName(buyer), () => ({ what }));
}
