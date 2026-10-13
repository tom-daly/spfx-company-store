/*
 * The order edit form's rules, kept apart from SharePoint so they can be
 * tested: filling the form from an order, reading it back as the changes to
 * save, telling whether anything was changed, and an order's history the way
 * the orders page shows it.
 */
import type { DeliveryMethod, IAddress, ICartLine } from './types';
import { NOBODY, statusForMethod } from './ordersView';
import { dateText, timeText } from './dates';
import { readCount } from './productForm';
import type { IOrder, OrderStatus } from './ordersView';
import type { IHistoryEntry } from './orderHistory';
import type { IOrderEdit } from './orderEdits';
import { blankAddress, inWords, lineName, missingWords, orderTotal, tidyAddress } from './orderText';
import type { IAddressWords } from './orderText';

/** One line of the order in the form: the line as it was ordered, and its quantity as typed. */
export interface IFormItem {
  line: ICartLine;
  qty: string;
}

export interface IOrderForm {
  status: OrderStatus;
  /** Empty when the order's lines couldn't be read, so there is nothing to change. */
  items: IFormItem[];
  method: DeliveryMethod;
  /** Kept while Pick up is chosen too, so switching back and forth doesn't lose what was typed. */
  address: IAddress;
  note: string;
  /** Like 2026-10-15, or empty. */
  readyBy: string;
  /** Kept while Pick up is chosen too, like the address, but only saved for delivery. */
  tracking: string;
  /** Like 2026-10-15, or empty. Only saved while the status is Picked up. */
  pickedUpOn: string;
}

/* The name a new delivery address starts with: the person's, unless all the order has is an email. */
const nameFor = (order: IOrder): string =>
  order.who.indexOf('@') < 0 && order.who !== NOBODY ? order.who : '';

/** The form as it opens: the order as it is now. */
export function formFromOrder(order: IOrder): IOrderForm {
  return {
    status: order.status,
    items: order.lines.map(line => ({ line, qty: String(line.qty) })),
    method: order.method,
    address: order.address ? { ...order.address } : { ...blankAddress(nameFor(order)), phone: order.phone },
    note: order.note,
    readyBy: order.readyBy,
    tracking: order.tracking,
    pickedUpOn: order.pickedUpOn
  };
}

/**
 * The form with another status chosen. Choosing Picked up fills in today as
 * the day it was picked up, the same as the orders table does, unless a day
 * is there already. `today` is like 2026-10-15.
 */
export function withFormStatus(form: IOrderForm, status: OrderStatus, today: string): IOrderForm {
  const pickedUpOn = status === 'Picked up' && !form.pickedUpOn ? today : form.pickedUpOn;
  return { ...form, status, pickedUpOn };
}

/**
 * The form switched to the other way. The status moves to the same step for
 * it, so a packed delivery switched to pick-up is ready for pick-up.
 */
export const withFormMethod = (form: IOrderForm, method: DeliveryMethod, today: string): IOrderForm =>
  withFormStatus({ ...form, method }, statusForMethod(form.status, method), today);


/* The lines with their new quantities. One that can't be read counts as 0 here; saving refuses it first. */
const newLines = (form: IOrderForm): ICartLine[] =>
  form.items.map(item => {
    const qty = readCount(item.qty);
    return { ...item.line, qty: qty === undefined ? 0 : qty };
  });

/** Some quantity is different from what was ordered. */
export const quantitiesChanged = (form: IOrderForm): boolean =>
  form.items.some(item => readCount(item.qty) !== item.line.qty);

/**
 * The order's total with the quantities as typed. Until a quantity changes it
 * is the total the order was saved with, so the form agrees with the table.
 */
export const formTotal = (form: IOrderForm, order: IOrder): number =>
  quantitiesChanged(form) ? orderTotal(newLines(form)) : order.total;

const PART_WORDS: IAddressWords = {
  name: 'the full name',
  line1: 'address line 1',
  postcode: 'the postcode',
  city: 'the city',
  country: 'the country'
};

/** What a delivery address still needs, in plain words, or undefined if nothing. */
export function addressProblem(address: IAddress): string | undefined {
  const missing = missingWords(address, PART_WORDS);
  if (!missing.length) return undefined;
  return `For delivery, add ${inWords(missing)}.`;
}

/** The changes to save, or what is wrong with the form in plain words. */
export function editFromForm(form: IOrderForm): IOrderEdit | string {
  const unreadable = form.items.filter(item => readCount(item.qty) === undefined);
  if (unreadable.length) {
    const names = inWords(unreadable.map(item => lineName(item.line)));
    return `Quantities need to be whole numbers, 0 or more. Check ${names}.`;
  }
  const lines = newLines(form);
  if (lines.length && lines.every(l => l.qty === 0)) {
    return 'Every quantity is 0, which would leave nothing on the order. Keep at least one item on it.';
  }
  const delivery = form.method === 'Delivery';
  if (delivery) {
    const problem = addressProblem(form.address);
    if (problem) return problem;
  }
  const edit: IOrderEdit = {
    status: form.status,
    lines,
    method: form.method,
    note: form.note.trim(),
    readyBy: form.readyBy,
    // Only a delivery has tracking, and only an order that has been picked up has a day it was.
    tracking: delivery ? form.tracking.trim() : '',
    pickedUpOn: form.status === 'Picked up' ? form.pickedUpOn : ''
  };
  if (delivery) edit.address = tidyAddress(form.address);
  return edit;
}

const ADDRESS_PARTS: (keyof IAddress)[] = ['name', 'line1', 'line2', 'postcode', 'city', 'country', 'phone'];

/* Spaces at either end don't count as a change: they aren't saved. */
const sameText = (a: string, b: string): boolean => a.trim() === b.trim();

/* "02" is the same quantity as "2"; anything that isn't a number is compared as typed. */
const qtyKey = (text: string): string => {
  const n = readCount(text);
  return n === undefined ? text.trim() : String(n);
};

/** Something in the form is different from how it opened, so closing it would lose a change. */
export function formChanged(form: IOrderForm, start: IOrderForm): boolean {
  if (form.status !== start.status || form.method !== start.method || !sameText(form.note, start.note)) return true;
  if (form.readyBy !== start.readyBy) return true;
  if (form.status === 'Picked up' && form.pickedUpOn !== start.pickedUpOn) return true;
  const qtys = form.items.some((item, i) => !start.items[i] || qtyKey(item.qty) !== qtyKey(start.items[i].qty));
  if (qtys) return true;
  // An address or tracking typed and then left behind by switching to pick-up isn't going to be saved.
  if (form.method !== 'Delivery') return false;
  return !sameText(form.tracking, start.tracking) ||
    ADDRESS_PARTS.some(key => !sameText(form.address[key], start.address[key]));
}

/** The orders with one swapped for its copy as saved. */
export const withSavedOrder = (orders: IOrder[], saved: IOrder): IOrder[] =>
  orders.map(o => (o.id === saved.id ? saved : o));

/* ---------------------------------------------------------------- history */

/** "12 Oct 2026, 2:05 PM", in the viewer's own time zone. Empty when there is no time or it can't be read. */
export function historyTime(when: string): string {
  if (!when) return '';
  const d = new Date(when);
  if (isNaN(d.getTime())) return '';
  return `${dateText(d)}, ${timeText(d)}`;
}

/** One line of an order's history, ready to show. */
export interface IHistoryLine {
  /** The time as saved, for the page's time element. Empty for a line typed by hand. */
  when: string;
  /** Like "12 Oct 2026, 14:05". Empty for a line typed by hand. */
  time: string;
  who: string;
  what: string;
}

/** The history newest first. Lines typed by hand have no time, so they keep their place among the others. */
export const historyNewestFirst = (history: IHistoryEntry[]): IHistoryLine[] =>
  history.slice().reverse().map(e => {
    const time = historyTime(e.when);
    return { when: time ? e.when : '', time, who: e.who, what: e.what };
  });
