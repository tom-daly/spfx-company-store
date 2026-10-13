/*
 * How an order is written down: its number, its total, the words that go in
 * the orders list. Kept apart from the SharePoint calls so it can be tested
 * on its own.
 */
import { ONE_SIZE } from './types';
import type { DeliveryMethod, IAddress, ICartLine, IOrderRequest } from './types';
import type { IStoreSettings } from './settings';
import { LIST_WORDS, ORDER_CHECKS, YOUR_ADDRESS_PARTS } from '../strings/orderWords';

/** "CS-" and 42 make CS-0042. Numbers past 9999 just get longer. */
export function orderNumber(prefix: string, id: number): string {
  let digits = String(id);
  while (digits.length < 4) digits = `0${digits}`;
  return `${prefix}${digits}`;
}

/** What a line is called: the product, plus the variant when there is a choice of them. */
export const lineName = (line: ICartLine): string =>
  line.variant && line.variant !== ONE_SIZE ? `${line.name} (${line.variant})` : line.name;

/** An amount rounded to whole cents. Adding up prices like 0.1 + 0.2 leaves tiny leftovers. */
export const cents = (amount: number): number => Math.round(amount * 100) / 100;

export const lineTotal = (line: ICartLine): number => cents(line.price * line.qty);

export const orderTotal = (lines: ICartLine[]): number =>
  cents(lines.reduce((sum, l) => sum + l.price * l.qty, 0));

export const itemCount = (lines: ICartLine[]): number =>
  lines.reduce((n, l) => n + l.qty, 0);

/** One line of what was ordered, like "2 × Crew hoodie". */
export const itemText = (line: ICartLine): string => `${line.qty} × ${lineName(line)}`;

/** The Items column: one line per product, like "2 × Crew hoodie". */
export const itemsText = (lines: ICartLine[]): string => lines.map(itemText).join('\n');

export const blankAddress = (name = ''): IAddress =>
  ({ name, line1: '', line2: '', postcode: '', city: '', country: '', phone: '' });

// eslint-disable-next-line @rushstack/no-new-null -- also takes SharePoint's null for an empty column
const trim = (s: string | undefined | null): string => (s || '').trim();

export const tidyAddress = (a: IAddress): IAddress => ({
  name: trim(a.name),
  line1: trim(a.line1),
  line2: trim(a.line2),
  postcode: trim(a.postcode),
  city: trim(a.city),
  country: trim(a.country),
  phone: trim(a.phone)
});

/** The Ship to column: the address as it goes on the parcel, one part per line. */
export function shipToText(address: IAddress): string {
  const a = tidyAddress(address);
  const town = [a.postcode, a.city].filter(Boolean).join(' ');
  return [a.name, a.line1, a.line2, town, a.country].filter(Boolean).join('\n');
}

export interface IOrderData {
  version: 1;
  lines: ICartLine[];
  method: DeliveryMethod;
  // eslint-disable-next-line @rushstack/no-new-null -- written as JSON, where null says plainly there is no address
  address: IAddress | null;
}

/** The hidden Order data column: the order as JSON, for the store to read back later. */
export function orderData(lines: ICartLine[], method: DeliveryMethod, address?: IAddress): string {
  const data: IOrderData = {
    version: 1,
    lines,
    method,
    address: method === 'Delivery' && address ? tidyAddress(address) : null
  };
  return JSON.stringify(data);
}

/** "a", "a and b", "a, b and c" (or "a, b or c"). */
export function inWords(items: string[], joiner: 'and' | 'or' = 'and'): string {
  if (items.length < 2) return items.join('');
  return LIST_WORDS[joiner](items.slice(0, -1).join(LIST_WORDS.between), items[items.length - 1]);
}

/** What to call each part a delivery address can't go without, when asking for it. */
export interface IAddressWords {
  name: string;
  line1: string;
  postcode: string;
  city: string;
  country: string;
}

const NEEDED: (keyof IAddressWords)[] = ['name', 'line1', 'postcode', 'city', 'country'];

/* Worded for the person ordering, who is filling in their own address. */
const YOUR_WORDS: IAddressWords = YOUR_ADDRESS_PARTS;

const emptyParts = (a?: IAddress): (keyof IAddressWords)[] => NEEDED.filter(key => !a || !trim(a[key]));

/** The parts of a delivery address that are still empty. */
export const missingFromAddress = (a?: IAddress): (keyof IAddress)[] => emptyParts(a);

/** The parts of a delivery address that are still empty, each called what `words` calls it. */
export const missingWords = (a: IAddress | undefined, words: IAddressWords): string[] =>
  emptyParts(a).map(key => words[key]);

/**
 * What is missing from a delivery address, in plain words, or undefined if
 * nothing. `words` says what to call each part; left out, it's the buyer's own.
 */
export function checkAddress(a?: IAddress, words: IAddressWords = YOUR_WORDS): string | undefined {
  const missing = missingWords(a, words);
  if (!missing.length) return undefined;
  return ORDER_CHECKS.addressMissing(inWords(missing));
}

/** Why this order can't be placed as it is, or undefined if it can. */
export function checkOrder(request: IOrderRequest, settings: IStoreSettings): string | undefined {
  if (!request.lines.length || itemCount(request.lines) <= 0) return ORDER_CHECKS.cartEmpty;
  if (request.method === 'Pick up' && !settings.pickUp) return ORDER_CHECKS.pickUpOff;
  if (request.method === 'Delivery' && !settings.delivery) return ORDER_CHECKS.deliveryOff;
  if (request.method === 'Delivery') return checkAddress(request.address);
  return undefined;
}

/** Said when there aren't enough left to cover a line. */
export function notEnoughMessage(line: ICartLine, left: number): string {
  if (left <= 0) return ORDER_CHECKS.soldOut(lineName(line));
  return ORDER_CHECKS.notEnough(left, lineName(line));
}
