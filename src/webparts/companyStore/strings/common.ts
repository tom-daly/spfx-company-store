/*
 * Words used on more than one screen. Words used on one screen only live in
 * that screen's own strings file beside this one.
 */
import type { IPlural } from './plural';

export const COMMON = {
  save: 'Save',
  saving: 'Saving…',
  cancel: 'Cancel',
  close: 'Close',
  tryAgain: 'Try again',
  total: 'Total',
  price: 'Price'
};

export const ITEMS: IPlural = { one: 'item', other: 'items' };
export const PRODUCTS: IPlural = { one: 'product', other: 'products' };
export const PHOTOS: IPlural = { one: 'photo', other: 'photos' };
export const COMBINATIONS: IPlural = { one: 'combination', other: 'combinations' };
