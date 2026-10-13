/*
 * Changing an order, minus SharePoint: checking the store team's changes,
 * working out how the stock has to move, moving an order on from the orders
 * table, and saying in plain words what changed for the order's history.
 * Nothing in here talks to the site, so it can be tested on its own.
 */
import { formatMoney } from './settings';
import type { Currency } from './settings';
import type { DeliveryMethod, IAddress, ICartLine } from './types';
import {
  checkAddress, inWords, itemCount, itemText, itemsText, lineName, orderData, orderTotal, shipToText, tidyAddress
} from './orderText';
import type { IAddressWords } from './orderText';
import { STATUSES, firstNameOf, statusForMethod, statusesFor } from './ordersView';
import type { IOrder, OrderStatus } from './ordersView';
import { dayText, isIsoDate } from './dates';
import { EMAIL_NOT_SENT, NOT_SENT } from './orderEmailText';
import type { StatusEmailKind } from './statusEmailText';
import {
  EDIT_ADDRESS_PARTS, ORDER_EDIT_CHECKS, ORDER_HISTORY, ORDER_WARNINGS
} from '../strings/orderWords';

/** The store team's changes to an order, as the edit form sends them. */
export interface IOrderEdit {
  status: OrderStatus;
  /** The order's lines with their new quantities. A line at 0 comes off the order. */
  lines: ICartLine[];
  method: DeliveryMethod;
  /** Required for Delivery. */
  address?: IAddress;
  note: string;
  /** When it should be ready, like 2026-10-15. Empty for none. */
  readyBy: string;
  /** The tracking number or link. Only a delivery keeps it. */
  tracking: string;
  /** The day it was picked up, like 2026-10-15. Only kept while the order is Picked up. */
  pickedUpOn: string;
}

/** The longest tracking number or link the Tracking column holds. */
export const MOST_TRACKING = 255;

/* One variant of one product. The label is also the stock row's title, so this is what stock is matched on. */
const keyOf = (l: ICartLine): string => `${l.productId}|${l.variant}`;

/* How many of each variant, adding up a variant that is listed twice. */
function quantities(lines: ICartLine[]): Record<string, number> {
  const q: Record<string, number> = {};
  lines.forEach(l => {
    const key = keyOf(l);
    q[key] = (q[key] || 0) + l.qty;
  });
  return q;
}

/**
 * The order's lines as they will be: one per variant, in the order's own
 * order, at the new quantities, with any at 0 taken off. Names and prices stay
 * as they were when it was ordered. A line the edit leaves out altogether
 * comes off too, the same as one at 0.
 */
export function editedLines(order: IOrder, edit: IOrderEdit): ICartLine[] {
  const wanted = quantities(edit.lines);
  const seen: Record<string, boolean> = {};
  const lines: ICartLine[] = [];
  order.lines.forEach(l => {
    const key = keyOf(l);
    if (seen[key]) return;
    seen[key] = true;
    const qty = wanted[key] || 0;
    if (qty > 0) lines.push({ ...l, qty });
  });
  return lines;
}

/** One variant whose quantity changed. */
export interface IQuantityChange {
  /** Which variant: its product, name and label. */
  line: ICartLine;
  /** How many were on the order. */
  from: number;
  /** How many are on it now; 0 when it came off. */
  to: number;
}

/** Each variant whose quantity changed, in the order's own order. */
export function quantityChanges(before: ICartLine[], after: ICartLine[]): IQuantityChange[] {
  const was = quantities(before);
  const now = quantities(after);
  const seen: Record<string, boolean> = {};
  const changes: IQuantityChange[] = [];
  before.concat(after).forEach(l => {
    const key = keyOf(l);
    if (seen[key]) return;
    seen[key] = true;
    const from = was[key] || 0;
    const to = now[key] || 0;
    if (from !== to) changes.push({ line: l, from, to });
  });
  return changes;
}

/**
 * The same changes, in the order the stock should move: raised quantities
 * first, so that if there isn't enough of something, nothing has been put back
 * yet that would then have to be taken again.
 */
export function stockMoves(before: ICartLine[], after: ICartLine[]): IQuantityChange[] {
  const changes = quantityChanges(before, after);
  return changes.filter(c => c.to > c.from).concat(changes.filter(c => c.to < c.from));
}

/** Said when there isn't enough stock to raise a line to `wanted`. */
export function tooFewMessage(line: ICartLine, wanted: number, left: number): string {
  const name = lineName(line);
  if (left <= 0) return ORDER_EDIT_CHECKS.soldOut(name, wanted);
  return ORDER_EDIT_CHECKS.onlyLeft(left, name, wanted);
}

/* ------------------------------------------------------------- checking */

/* Worded for the store team, who are filling in someone else's address. */
const ADDRESS_WORDS: IAddressWords = EDIT_ADDRESS_PARTS;

const isWholeNumber = (n: unknown): boolean =>
  typeof n === 'number' && isFinite(n) && n >= 0 && Math.floor(n) === n;

/** Why an order going this way can't have this status, in plain words, or undefined if it can. */
export function statusProblem(status: OrderStatus, method: DeliveryMethod): string | undefined {
  const fits = statusesFor(method);
  if (fits.indexOf(status) >= 0) return undefined;
  // "New, Packed or Shipped".
  const choices = inWords(fits, 'or');
  if (STATUSES.indexOf(status) < 0) return ORDER_EDIT_CHECKS.chooseStatus(choices);
  return method === 'Delivery'
    ? ORDER_EDIT_CHECKS.onlyForPickUps(status, choices)
    : ORDER_EDIT_CHECKS.onlyForDeliveries(status, choices);
}

/**
 * The status the order ends up with. When the edit switches between pick-up
 * and delivery but leaves the status as it was, the status moves across to the
 * same step for the new way, so a packed delivery becomes ready for pick-up. A
 * status the owner chose is kept as chosen, and checkEdit refuses it if it
 * doesn't fit.
 */
export function editedStatus(order: IOrder, edit: IOrderEdit): OrderStatus {
  if (edit.method !== order.method && edit.status === order.status) return statusForMethod(edit.status, edit.method);
  return edit.status;
}

/** Why these changes can't be saved, in plain words, or undefined if they can. */
export function checkEdit(order: IOrder, edit: IOrderEdit): string | undefined {
  if (edit.method !== 'Pick up' && edit.method !== 'Delivery') return ORDER_EDIT_CHECKS.chooseMethod;
  const wrongStatus = statusProblem(editedStatus(order, edit), edit.method);
  if (wrongStatus) return wrongStatus;

  const odd = edit.lines.filter(l => !isWholeNumber(l.qty))[0];
  if (odd) return ORDER_EDIT_CHECKS.wholeNumber(lineName(odd));

  if (!order.lines.length) {
    // Without the order data there's no telling which stock lines the items came from.
    if (edit.lines.some(l => l.qty > 0)) return ORDER_EDIT_CHECKS.itemsUnreadable;
  } else {
    const ordered = quantities(order.lines);
    const added = edit.lines.filter(l => l.qty > 0 && ordered[keyOf(l)] === undefined)[0];
    if (added) return ORDER_EDIT_CHECKS.notOnOrder(lineName(added));
    if (!editedLines(order, edit).length) return ORDER_EDIT_CHECKS.keepOneItem;
  }

  if (edit.method === 'Delivery') {
    const wrongAddress = checkAddress(edit.address, ADDRESS_WORDS);
    if (wrongAddress) return wrongAddress;
  }
  const pickedUp = editedStatus(order, edit) === 'Picked up';
  return detailsProblem(edit.readyBy, edit.method === 'Delivery' ? edit.tracking : '') ||
    (pickedUp ? dayProblem(edit.pickedUpOn, ORDER_EDIT_CHECKS.pickedUpDay) : undefined);
}

/* Empty is fine: the day is optional. Anything else has to be a real day like 2026-10-15, or `problem` is said. */
function dayProblem(day: string, problem: string): string | undefined {
  const d = day.trim();
  return d && !isIsoDate(d) ? problem : undefined;
}

/* The ready-by day and the tracking, from the edit panel or the box the orders table asks with. */
function detailsProblem(readyBy: string, tracking: string): string | undefined {
  const wrongDay = dayProblem(readyBy, ORDER_EDIT_CHECKS.readyByDay);
  if (wrongDay) return wrongDay;
  if (tracking.trim().length > MOST_TRACKING) return ORDER_EDIT_CHECKS.trackingTooLong(MOST_TRACKING);
  return undefined;
}

/* -------------------------------------------------------- the new order */

/* The Ship to column's lines, the way the orders page reads them back. */
const shipToLines = (a: IAddress): string[] => shipToText(a).split('\n').filter(l => l.length > 0);

/**
 * The order as it will be once the changes are saved, history aside. The
 * total is only worked out again when a quantity changed, so a total set by
 * hand in the list isn't undone by changing the note. Going to pick-up drops
 * the tracking, and leaving Picked up drops the day it was picked up.
 */
export function editedOrder(order: IOrder, edit: IOrderEdit): IOrder {
  const lines = editedLines(order, edit);
  const itemsChanged = quantityChanges(order.lines, lines).length > 0;
  const delivery = edit.method === 'Delivery';
  const address = delivery && edit.address ? tidyAddress(edit.address) : undefined;
  const status = editedStatus(order, edit);
  const after: IOrder = {
    ...order,
    lines,
    itemLines: lines.length ? lines.map(itemText) : order.itemLines,
    items: lines.length ? itemCount(lines) : order.items,
    total: itemsChanged ? orderTotal(lines) : order.total,
    method: edit.method,
    shipTo: address ? shipToLines(address) : [],
    phone: address ? address.phone : '',
    note: edit.note.trim(),
    status,
    readyBy: edit.readyBy.trim(),
    tracking: delivery ? edit.tracking.trim() : '',
    pickedUpOn: status === 'Picked up' ? edit.pickedUpOn.trim() : ''
  };
  if (address) after.address = address;
  else delete after.address;
  return after;
}

/**
 * The orders-list columns to write for an edited order. When the order data
 * couldn't be read, the items, total and order data are left as they are:
 * there'd be nothing true to write in their place.
 */
export function orderColumns(before: IOrder, after: IOrder): Record<string, unknown> {
  const columns: Record<string, unknown> = {
    DeliveryMethod: after.method,
    ShipTo: after.shipTo.join('\n'),
    ShipPhone: after.phone,
    OrderNote: after.note,
    OrderStatus: after.status,
    ReadyBy: after.readyBy,
    Tracking: after.tracking,
    PickedUpOn: after.pickedUpOn
  };
  if (before.lines.length) {
    columns.OrderItems = itemsText(after.lines);
    columns.OrderTotal = after.total;
    columns.OrderData = orderData(after.lines, after.method, after.address);
  }
  return columns;
}

/* ---------------------------------------------------------------- words */

/** "Status changed from New to Packed". */
export const statusChangeText = (from: string, to: string): string => ORDER_HISTORY.statusChanged(from, to);

/* The parts of the address that go on the parcel. The phone is told apart. */
const PARCEL: (keyof IAddress)[] = ['name', 'line1', 'line2', 'postcode', 'city', 'country'];

/* Compared with what the edit form started from: the address the order kept, or failing that the Ship to column. */
function addressMoved(order: IOrder, after: IOrder): boolean {
  const now = after.address;
  if (!now) return false;
  if (order.address) {
    const was = tidyAddress(order.address);
    return PARCEL.some(k => was[k] !== now[k]);
  }
  return order.shipTo.join('\n') !== after.shipTo.join('\n');
}

const phoneBefore = (order: IOrder): string => (order.address ? tidyAddress(order.address).phone : order.phone);

/* "Crew hoodie (M) 2 → 1", "Dive cap taken off". */
function quantityText(c: IQuantityChange): string {
  const name = lineName(c.line);
  if (c.to === 0) return ORDER_HISTORY.itemTakenOff(name);
  if (c.from === 0) return ORDER_HISTORY.itemAdded(name, c.to);
  return ORDER_HISTORY.itemQty(name, c.from, c.to);
}

function noteText(was: string, now: string): string {
  if (!was) return ORDER_HISTORY.noteAdded;
  if (!now) return ORDER_HISTORY.noteRemoved;
  return ORDER_HISTORY.noteChanged;
}

/* "ready by changed to Thu 15 Oct 2026", "tracking set to 1Z999AA10123456784", "tracking cleared". */
function detailTexts(order: IOrder, after: IOrder): string[] {
  const parts: string[] = [];
  if (after.readyBy !== order.readyBy) {
    parts.push(after.readyBy ? ORDER_HISTORY.readyByChanged(dayText(after.readyBy)) : ORDER_HISTORY.readyByCleared);
  }
  if (after.tracking !== order.tracking) {
    parts.push(after.tracking ? ORDER_HISTORY.trackingSet(after.tracking) : ORDER_HISTORY.trackingCleared);
  }
  // Leaving Picked up drops the day as well; the status change already says as much.
  if (after.pickedUpOn !== order.pickedUpOn && after.status === 'Picked up') {
    parts.push(after.pickedUpOn
      ? ORDER_HISTORY.pickedUpOnChanged(dayText(after.pickedUpOn))
      : ORDER_HISTORY.pickedUpOnCleared);
  }
  return parts;
}

const capitalised = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * What the changes do, in plain words, for the order's history, or '' when
 * they change nothing. A status change on its own reads the same as one made
 * from the list, and so does a change to the days or the tracking on its own,
 * like "Ready by changed to Thu 15 Oct 2026". Anything more goes on one line,
 * like "Changed: Crew hoodie (M) 2 → 1; Dive cap taken off; note changed;
 * total $48.00 → $22.00".
 */
export function describeEdit(order: IOrder, edit: IOrderEdit, currency: Currency): string {
  const after = editedOrder(order, edit);
  const parts = quantityChanges(order.lines, after.lines).map(quantityText);

  // Going from pick-up to delivery brings an address with it; saying so twice adds nothing.
  if (order.method === 'Delivery' && after.method === 'Delivery') {
    if (addressMoved(order, after)) parts.push(ORDER_HISTORY.addressChanged);
    else if (phoneBefore(order) !== after.phone) parts.push(ORDER_HISTORY.phoneChanged);
  }
  if (after.note !== order.note) parts.push(noteText(order.note, after.note));
  if (after.method !== order.method) parts.push(ORDER_HISTORY.methodChanged(after.method, order.method));
  const details = detailTexts(order, after);
  const total = after.total !== order.total
    ? [ORDER_HISTORY.total(formatMoney(order.total, currency), formatMoney(after.total, currency))]
    : [];

  const statusChanged = after.status !== order.status;
  const others = parts.concat(total);
  if (!others.length && !details.length) return statusChanged ? statusChangeText(order.status, after.status) : '';
  if (!others.length && !statusChanged) return capitalised(details.join(ORDER_HISTORY.between));
  const status: string[] = statusChanged ? [ORDER_HISTORY.status(order.status, after.status)] : [];
  return ORDER_HISTORY.changed(status.concat(parts, details, total).join(ORDER_HISTORY.between));
}

/* ------------------------------------------------ moving on from the table */

/** What can go with moving an order on from the orders table. Only what fits the new status is used. */
export interface IStatusDetails {
  /** With Confirmed: when it should be ready, like 2026-10-15, or empty for none. Left out, it stays as it was. */
  readyBy?: string;
  /** With Shipped: the tracking number or link, or empty for none. Left out, it stays as it was. */
  tracking?: string;
}

/** Why these can't go with the move, in plain words, or undefined if they can. */
export const statusDetailsProblem = (details: IStatusDetails): string | undefined =>
  detailsProblem(details.readyBy || '', details.tracking || '');

/**
 * The order moved on to `status` from the orders table, with what goes with
 * it: the ready-by day when it's confirmed, the tracking when it's shipped,
 * and `today` as the day it was picked up. Leaving Picked up clears that day
 * again. Everything else stays as it was.
 */
export function movedOrder(order: IOrder, status: OrderStatus, details: IStatusDetails, today: string): IOrder {
  const after: IOrder = { ...order, status, pickedUpOn: status === 'Picked up' ? today : '' };
  if (status === 'Confirmed' && details.readyBy !== undefined) after.readyBy = details.readyBy.trim();
  if (status === 'Shipped' && details.tracking !== undefined) after.tracking = details.tracking.trim();
  return after;
}

/** Moving an order on: the order as it will be, the columns to write, and the line for its history. */
export interface IStatusMove {
  after: IOrder;
  values: Record<string, unknown>;
  what: string;
}

/**
 * Moving an order on from the orders table. `from` is its status as the list
 * has it now, which may not be what the page showed if someone else just
 * changed it; empty, it's taken to be the page's. The history line says what
 * came with it, like "Status changed from New to Confirmed, ready by Thu 15 Oct
 * 2026" or "Status changed from Packed to Shipped, tracking 1Z999AA10123456784".
 */
export function statusMove(
  order: IOrder, from: string, status: OrderStatus, details: IStatusDetails, today: string
): IStatusMove {
  const was = from || order.status;
  const after = movedOrder(order, status, details, today);
  const values: Record<string, unknown> = { OrderStatus: status };
  let what = statusChangeText(was, status);
  if (status === 'Confirmed' && details.readyBy !== undefined) {
    values.ReadyBy = after.readyBy;
    if (after.readyBy) what = ORDER_HISTORY.statusChangedReadyBy(was, status, dayText(after.readyBy));
    else if (order.readyBy) what = ORDER_HISTORY.statusChangedReadyByCleared(was, status);
  }
  if (status === 'Shipped' && details.tracking !== undefined) {
    values.Tracking = after.tracking;
    if (after.tracking) what = ORDER_HISTORY.statusChangedTracking(was, status, after.tracking);
    else if (order.tracking) what = ORDER_HISTORY.statusChangedTrackingCleared(was, status);
  }
  // Only written when it's picked up, or was: a delivery never has one.
  if (status === 'Picked up' || was === 'Picked up' || order.status === 'Picked up' || order.pickedUpOn) {
    values.PickedUpOn = after.pickedUpOn;
  }
  return { after, values, what };
}

/* ----------------------------------------------------- the status emails */

const EMAILED_WORDS: Record<StatusEmailKind, (name: string) => string> = {
  confirmed: ORDER_HISTORY.emailedConfirmed,
  ready: ORDER_HISTORY.emailedReady,
  shipped: ORDER_HISTORY.emailedShipped
};

/** "Emailed Megan Bowen: order confirmed", for the history once the email has gone. */
export const emailedText = (name: string, kind: StatusEmailKind): string => EMAILED_WORDS[kind](name);

/* The reason usually starts by saying the email couldn't be sent, which the line around it already says. */
const reasonOnly = (reason: string): string => reason.replace(NOT_SENT, '').replace(EMAIL_NOT_SENT, '').trim();

/** "Email to Megan Bowen couldn't be sent: …", for the history when the email didn't go. */
export function emailFailedText(name: string, reason: string): string {
  const why = reasonOnly(reason);
  return why ? ORDER_HISTORY.emailFailedBecause(name, why) : ORDER_HISTORY.emailFailed(name);
}

/** "CS-0042 is Confirmed, but the email to Megan couldn't be sent. …", for the orders table. */
export function emailWarningText(order: Pick<IOrder, 'number' | 'who' | 'status'>, reason: string): string {
  const why = reasonOnly(reason);
  return why
    ? ORDER_WARNINGS.emailNotSentBecause(order.number, order.status, firstNameOf(order), why)
    : ORDER_WARNINGS.emailNotSent(order.number, order.status, firstNameOf(order));
}
