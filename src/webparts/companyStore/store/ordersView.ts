/*
 * The orders page, minus SharePoint: turning order rows into orders, filtering
 * and searching them, the counts at the top, the dates, and the words in the
 * box that asks about emailing the person. Nothing in here talks to the site,
 * so it can be tested on its own.
 */
import { DONE_STATUSES, ORDER_STATUSES } from '../setup/schema';
import { ONE_SIZE } from './types';
import type { DeliveryMethod, IAddress, ICartLine } from './types';
import { countText, itemCount, lineName, orderTotal, shipToText } from './orderText';
import { IHistoryEntry, parseHistory } from './orderHistory';
import { isIsoDate } from './dates';
import { matchesWords } from './shopText';
import { maybeNum, text, textLines } from './rowValues';
import type { StatusEmailKind } from './statusEmailText';

export type OrderStatus = 'New' | 'Confirmed' | 'Packed' | 'Shipped' | 'Ready for pick-up' | 'Picked up';

/** Every status the store knows. The same as the Status column's choices. */
export const STATUSES: OrderStatus[] = ORDER_STATUSES as OrderStatus[];

/* Each way's steps, in the order they happen. A step sits at the same place in both, so it can be carried across. */
const DELIVERY_STEPS: OrderStatus[] = ['New', 'Confirmed', 'Packed', 'Shipped'];
const PICK_UP_STEPS: OrderStatus[] = ['New', 'Confirmed', 'Ready for pick-up', 'Picked up'];

/** The statuses an order going this way can have, in the order they happen. */
export const statusesFor = (method: DeliveryMethod): OrderStatus[] =>
  (method === 'Delivery' ? DELIVERY_STEPS : PICK_UP_STEPS).slice();

/** Shipped or picked up: nothing left to do. */
export const isDone = (status: OrderStatus): boolean => DONE_STATUSES.indexOf(status) >= 0;

/**
 * The same step for the other way, for an order that switches between pick-up
 * and delivery: New and Confirmed stay as they are, Packed and Ready for pick-up swap, and so do
 * Shipped and Picked up. A status that already fits is left as it is, and one
 * the store doesn't know becomes New.
 */
export function statusForMethod(status: OrderStatus, method: DeliveryMethod): OrderStatus {
  const step = Math.max(DELIVERY_STEPS.indexOf(status), PICK_UP_STEPS.indexOf(status));
  return step < 0 ? 'New' : statusesFor(method)[step];
}

/** An order as the orders page shows it. */
export interface IOrder {
  /** The row in the orders list. */
  id: number;
  /** What people see, like CS-0042. */
  number: string;
  /** Who placed it, by name (or email when SharePoint has no name). */
  who: string;
  email: string;
  /** When it was placed. Missing when SharePoint's date can't be read. */
  placed?: Date;
  /** What they ordered, from the hidden order data. Empty when that can't be read. */
  lines: ICartLine[];
  /** The Items column, one entry per line, for when lines is empty. */
  itemLines: string[];
  /** How many things, counting each one. */
  items: number;
  total: number;
  method: DeliveryMethod;
  /** Where it goes, one part per line. Empty for pick-up. */
  shipTo: string[];
  /** Empty for pick-up. */
  phone: string;
  note: string;
  status: OrderStatus;
  /** When the store said it would be ready (to pick up, or to send), like 2026-10-15. Empty if not said. */
  readyBy: string;
  /** A delivery's tracking number or link. Empty if none. */
  tracking: string;
  /** The day it was picked up, like 2026-10-15. Empty until then. */
  pickedUpOn: string;
  /** The order email went out. */
  emailSent: boolean;
  /** The address as separate fields, from the order data, for editing. Missing for pick-up or when it can't be read. */
  address?: IAddress;
  /** Every change, oldest first. Only the store team sees it. */
  history: IHistoryEntry[];
}

/** A row from the orders list, as REST returns it with Author expanded. Anything can be blank. */
export interface IOrderRow {
  Id: number;
  Title?: unknown;
  OrderItems?: unknown;
  OrderTotal?: unknown;
  DeliveryMethod?: unknown;
  ShipTo?: unknown;
  ShipPhone?: unknown;
  OrderNote?: unknown;
  OrderStatus?: unknown;
  ConfirmationSent?: unknown;
  ReadyBy?: unknown;
  Tracking?: unknown;
  PickedUpOn?: unknown;
  OrderData?: unknown;
  Created?: unknown;
  /** Who placed it, like { Title: 'Megan Bowen', EMail: 'megan@…' }. */
  Author?: unknown;
  OrderHistory?: unknown;
}

/* ------------------------------------------------------------ reading rows */

const isMethod = (v: unknown): v is DeliveryMethod => v === 'Pick up' || v === 'Delivery';

/* SharePoint sends a yes/no column as true or false; a few older paths send 1 or "1". */
const isYes = (v: unknown): boolean => v === true || v === 1 || v === '1' || v === 'true';

function dateFrom(v: unknown): Date | undefined {
  const when = text(v);
  if (!when) return undefined;
  const d = new Date(when);
  return isNaN(d.getTime()) ? undefined : d;
}

function lineFrom(x: unknown): ICartLine | undefined {
  if (!x || typeof x !== 'object') return undefined;
  const o = x as Record<string, unknown>;
  const name = text(o.name);
  const qty = maybeNum(o.qty);
  if (!name || qty === undefined || qty < 1) return undefined;
  const price = maybeNum(o.price);
  const productId = maybeNum(o.productId);
  return {
    productId: productId === undefined ? 0 : productId,
    name,
    price: price !== undefined && price >= 0 ? price : 0,
    qty: Math.floor(qty),
    variant: text(o.variant) || ONE_SIZE
  };
}

function addressFrom(x: unknown): IAddress | undefined {
  if (!x || typeof x !== 'object') return undefined;
  const o = x as Record<string, unknown>;
  return {
    name: text(o.name),
    line1: text(o.line1),
    line2: text(o.line2),
    postcode: text(o.postcode),
    city: text(o.city),
    country: text(o.country),
    phone: text(o.phone)
  };
}

export interface IOrderData {
  lines: ICartLine[];
  method?: DeliveryMethod;
  address?: IAddress;
}

/**
 * The hidden Order data column, read back. Anything missing or damaged is left
 * out rather than trusted, so an order edited by hand can't break the page.
 */
export function readOrderData(value: unknown): IOrderData {
  const json = text(value);
  if (!json) return { lines: [] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { lines: [] };
  }
  if (!parsed || typeof parsed !== 'object') return { lines: [] };
  const o = parsed as Record<string, unknown>;
  const lines = Array.isArray(o.lines)
    ? o.lines.map((l: unknown) => lineFrom(l)).filter((l): l is ICartLine => !!l)
    : [];
  const data: IOrderData = { lines };
  const method = o.method;
  if (isMethod(method)) data.method = method;
  const address = addressFrom(o.address);
  if (address) data.address = address;
  return data;
}

/**
 * How many things an Items column lists, for orders whose order data can't be
 * read: "2 × Crew hoodie" is 2, and a line with no number in front counts as 1.
 */
export function countFromItems(lines: string[]): number {
  return lines.reduce((n, line) => {
    const m = /^(\d+)\s*[×xX]\s+/.exec(line);
    return n + (m ? parseInt(m[1], 10) : 1);
  }, 0);
}

/*
 * A status typed in by hand that the store doesn't know is treated as not dealt
 * with yet. One that belongs to the other way, like an older pick-up marked
 * Packed or Shipped, is shown as the matching step for this order.
 */
function statusFrom(v: unknown, method: DeliveryMethod): OrderStatus {
  const status = text(v) as OrderStatus;
  return STATUSES.indexOf(status) >= 0 ? statusForMethod(status, method) : 'New';
}

/* A day column, kept only if it holds a real day like 2026-10-15. */
const dayFrom = (v: unknown): string => (isIsoDate(text(v)) ? text(v) : '');

/** Who placed it, when SharePoint has neither their name nor their email. */
export const NOBODY = 'Unknown';

/* The Ship to column, or failing that the address the order data kept. */
function whereTo(row: IOrderRow, data: IOrderData): string[] {
  const shipTo = textLines(row.ShipTo);
  if (shipTo.length) return shipTo;
  return data.address ? textLines(shipToText(data.address)) : [];
}

export function orderFromRow(row: IOrderRow): IOrder {
  const data = readOrderData(row.OrderData);
  const itemLines = textLines(row.OrderItems);
  const column = text(row.DeliveryMethod);
  const method: DeliveryMethod = isMethod(column) ? column : data.method || 'Pick up';
  const author: Record<string, unknown> =
    row.Author && typeof row.Author === 'object' ? (row.Author as Record<string, unknown>) : {};
  const email = text(author.EMail);
  const total = maybeNum(row.OrderTotal);
  const delivery = method === 'Delivery';
  const order: IOrder = {
    id: row.Id,
    number: text(row.Title) || `#${row.Id}`,
    who: text(author.Title) || email || NOBODY,
    email,
    lines: data.lines,
    itemLines,
    items: data.lines.length ? itemCount(data.lines) : countFromItems(itemLines),
    total: total !== undefined ? total : orderTotal(data.lines),
    method,
    shipTo: delivery ? whereTo(row, data) : [],
    phone: delivery ? text(row.ShipPhone) || (data.address ? data.address.phone : '') : '',
    note: text(row.OrderNote),
    status: statusFrom(row.OrderStatus, method),
    readyBy: dayFrom(row.ReadyBy),
    tracking: text(row.Tracking),
    pickedUpOn: dayFrom(row.PickedUpOn),
    emailSent: isYes(row.ConfirmationSent),
    history: parseHistory(text(row.OrderHistory))
  };
  if (delivery && data.address) order.address = data.address;
  const placed = dateFrom(row.Created);
  if (placed) order.placed = placed;
  return order;
}

/** Every order, newest first. */
export const ordersFromRows = (rows: IOrderRow[]): IOrder[] =>
  rows.map(orderFromRow).sort((a, b) => b.id - a.id);

/**
 * The order columns read from the list: everything an order shows, with its
 * history (the store team's view) or without it (the person's own orders).
 */
export const orderFields = (withHistory: boolean): string[] => [
  'Id', 'Title', 'OrderItems', 'OrderTotal', 'DeliveryMethod', 'ShipTo', 'ShipPhone', 'OrderNote',
  'OrderStatus', 'ConfirmationSent', 'ReadyBy', 'Tracking', 'PickedUpOn', 'OrderData',
  ...(withHistory ? ['OrderHistory'] : []),
  'Created', 'Author/Title', 'Author/EMail'
];

/** The same orders with one order's status changed. */
export const withStatus = (orders: IOrder[], id: number, status: OrderStatus): IOrder[] =>
  orders.map(o => (o.id === id ? { ...o, status } : o));

/* ------------------------------------------------------------------ words */

/** "1 item", "3 items". */
export const itemCountText = (n: number): string => countText(n, 'item');

/** What to call the person in a few words: their first name, or their email when that's all there is. */
export function firstNameOf(order: Pick<IOrder, 'who'>): string {
  const who = order.who.trim();
  return who.indexOf('@') >= 0 ? who : who.split(/\s+/)[0];
}

/* ------------------------------------------------- asking before an email */

/** The label on the ready-by day when an order is confirmed. */
export const readyByLabel = (method: DeliveryMethod): string =>
  method === 'Pick up' ? 'Ready for pick-up by' : 'Ready to send by';

/** The words in the box that opens before an order is confirmed, marked ready for pick-up or marked shipped. */
export interface IStatusAsk {
  title: string;
  /** The button that makes the change. */
  button: string;
  /** The tick box for emailing the person. Empty when there's no email address to send to. */
  emailLabel: string;
  /** Said in place of the tick box when there's no email address. Empty when there is one. */
  noEmail: string;
}

const ASK_WORDS: Record<StatusEmailKind, { title: (number: string) => string; button: string; email: string }> = {
  confirmed: { title: n => `Confirm ${n}`, button: 'Confirm', email: "to say it's confirmed" },
  ready: { title: n => `${n} is ready for pick-up`, button: 'Mark ready', email: 'to come and pick it up' },
  shipped: { title: n => `Mark ${n} shipped`, button: 'Mark shipped', email: "to say it's on its way" }
};

export function statusAsk(order: Pick<IOrder, 'number' | 'who' | 'email'>, kind: StatusEmailKind): IStatusAsk {
  const words = ASK_WORDS[kind];
  const canEmail = order.email.trim().length > 0;
  const name = order.who === NOBODY ? 'this order' : order.who;
  return {
    title: words.title(order.number),
    button: words.button,
    emailLabel: canEmail ? `Email ${firstNameOf(order)} ${words.email}` : '',
    noEmail: canEmail ? '' : `There's no email address for ${name}, so no email can go.`
  };
}

/* ---------------------------------------------------------------- filters */

/** Which orders to show. "Open" is everything not shipped or picked up yet; "Done" is the rest. */
export type OrderFilter = 'open' | 'New' | 'Confirmed' | 'Packed' | 'Ready for pick-up' | 'done' | 'all';

export const FILTERS: { key: OrderFilter; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'New', label: 'New' },
  { key: 'Confirmed', label: 'Confirmed' },
  { key: 'Packed', label: 'Packed' },
  { key: 'Ready for pick-up', label: 'Ready for pick-up' },
  { key: 'done', label: 'Done' },
  { key: 'all', label: 'All' }
];

export function inFilter(status: OrderStatus, filter: OrderFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'open') return !isDone(status);
  if (filter === 'done') return isDone(status);
  return status === filter;
}

/**
 * Whether an order turns up for what was typed. Each word has to appear in the
 * order number, the person's name or email, or what they ordered, so "megan
 * hoodie" finds Megan's order with a hoodie in it. A blank search finds everything.
 */
export function matchesOrder(o: IOrder, query: string): boolean {
  return matchesWords([o.number, o.who, o.email].concat(o.lines.map(l => lineName(l)), o.itemLines), query);
}

/**
 * The orders to show: those under the filter that match the search. Orders in
 * keep stay whatever their status, so one whose status was just changed doesn't
 * vanish from under the owner's mouse. They still have to match the search.
 */
export function visibleOrders(orders: IOrder[], filter: OrderFilter, query: string, keep: number[] = []): IOrder[] {
  return orders.filter(o => (inFilter(o.status, filter) || keep.indexOf(o.id) >= 0) && matchesOrder(o, query));
}

/* ----------------------------------------------------------------- counts */

/** How many orders fall under each filter. */
export type OrderCounts = Record<OrderFilter, number>;

export function countOrders(orders: Pick<IOrder, 'status'>[]): OrderCounts {
  const counts: OrderCounts = { open: 0, New: 0, Confirmed: 0, Packed: 0, 'Ready for pick-up': 0, done: 0, all: 0 };
  orders.forEach(o => {
    FILTERS.forEach(f => {
      if (inFilter(o.status, f.key)) counts[f.key] += 1;
    });
  });
  return counts;
}

/**
 * "2 new · 1 confirmed · 1 packed · 1 ready for pick-up · 24 done". Anything there are none
 * of is left out; "Nothing open" when every order is done; empty when there are
 * no orders at all.
 */
export function summaryText(c: OrderCounts): string {
  if (!c.all) return '';
  const parts: string[] = [];
  if (c.New) parts.push(`${c.New} new`);
  if (c.Confirmed) parts.push(`${c.Confirmed} confirmed`);
  if (c.Packed) parts.push(`${c.Packed} packed`);
  if (c['Ready for pick-up']) parts.push(`${c['Ready for pick-up']} ready for pick-up`);
  if (!parts.length) parts.push('Nothing open');
  if (c.done) parts.push(`${c.done} done`);
  return parts.join(' · ');
}

const FILTER_WORDS: Record<OrderFilter, string> = {
  open: 'open orders',
  New: 'new orders',
  Confirmed: 'confirmed orders',
  Packed: 'packed orders',
  'Ready for pick-up': 'orders ready for pick-up',
  done: 'shipped or picked-up orders',
  all: 'orders'
};

const NOTHING_UNDER: Record<OrderFilter, string> = {
  open: 'Nothing open — every order is done.',
  New: 'No new orders.',
  Confirmed: 'No orders are confirmed and waiting.',
  Packed: 'Nothing is packed and waiting.',
  'Ready for pick-up': 'Nothing is waiting to be picked up.',
  done: 'Nothing has been shipped or picked up yet.',
  all: 'No orders yet.'
};

/** What to say when there is nothing to show. */
export function emptyText(filter: OrderFilter, query: string, counts: OrderCounts): string {
  if (!counts.all) return 'No orders yet.';
  const q = query.trim();
  if (q) {
    return `No ${FILTER_WORDS[filter]} match "${q}".` + (filter === 'all' ? '' : ' Try All to search every order.');
  }
  return NOTHING_UNDER[filter];
}
