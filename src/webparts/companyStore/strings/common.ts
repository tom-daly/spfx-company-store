/*
 * Words used on more than one screen. Words used on one screen only live in
 * that screen's own strings file beside this one.
 */
import type { IPlural } from './plural';
import type { DeliveryMethod } from '../store/types';

export const COMMON = {
  save: 'Save',
  saving: 'Saving…',
  cancel: 'Cancel',
  close: 'Close',
  tryAgain: 'Try again',
  total: 'Total',
  price: 'Price',
  // A price or total of 0.
  free: 'Free',
  on: 'On',
  off: 'Off',
  checkBackSoon: 'Check back soon.',
  // Over the address on an order.
  whereItGoes: 'Where it goes',
  // An order with no items, or no address, to show.
  nothingListed: 'Nothing is listed.',
  noAddress: 'No address was given.'
};

// What each way to get an order is called: at checkout, in the order editor, in Settings and in the emails.
export const METHOD_TITLES: Record<DeliveryMethod, string> = {
  'Pick up': 'Pick up at the office',
  Delivery: 'Delivery'
};

export const ITEMS: IPlural = { one: 'item', other: 'items' };
export const PRODUCTS: IPlural = { one: 'product', other: 'products' };
export const PHOTOS: IPlural = { one: 'photo', other: 'photos' };
export const COMBINATIONS: IPlural = { one: 'combination', other: 'combinations' };
