/*
 * Words about products: the stock and price lines in the shop, the product
 * page, the checks in the product editor, and the owners' products table.
 *
 * Variant names like "White · M" and "One size" are saved as each stock row's
 * name, so they aren't here.
 */
import { countText, plural } from './plural';
import { COMBINATIONS, PRODUCTS } from './common';

// How many are left, on the product cards and the product page.
export const STOCK_WORDS = {
  outOfStock: 'Out of stock',
  // At 10 or fewer.
  left: (n: number): string => `${n} left`,
  inStock: (n: number): string => `${n} in stock`
};

// A product's name and price, wherever it is shown.
export const PRODUCT_WORDS = {
  // When a product has no name in the list.
  untitled: 'Untitled product',
  // When some combinations cost more than others; the amounts are already written as money.
  freeTo: (most: string): string => `Free to ${most}`,
  from: (least: string): string => `From ${least}`
};

// The option pickers and the Add to cart button on the product page.
export const PRODUCT_PAGE = {
  // `options` is a list of the option names not picked yet, like "size and colour".
  choose: (options: string): string => `Choose ${options}`,
  chooseAnOption: 'Choose an option',
  // The small line under the pickers.
  crossedOut: 'Crossed out means none left',
  comboOut: 'That combination is out of stock',
  leftIn: (n: number, variant: string): string => `${n} left in ${variant}`,
  addToCart: 'Add to cart',
  // Every one left of what was picked is in the cart already.
  allInCart: (n: number): string =>
    plural(n, { one: 'The last one is in your cart', other: `All ${n} are in your cart` })
};

// Why a product can't be saved yet, in the product editor and the stock sheet.
export const PRODUCT_CHECKS = {
  needsName: 'Give the product a name.',
  priceNotNumber: 'The price has to be a number, 0 or more.',
  stockNotNumber: 'In stock has to be a whole number, 0 or more.',
  stockNotNumberFor: (variant: string): string => `In stock for ${variant} has to be a whole number, 0 or more.`,
  variantPriceNotNumber: (variant: string): string =>
    `The price for ${variant} has to be a number, 0 or more — or leave it empty to use the usual price.`,
  optionNeedsName: 'Give each option a name, like Size or Colour.',
  optionNeedsChoice: 'Give each option at least one choice.',
  optionSameName: 'Two options have the same name. Give each its own.',
  tooManyOptions: (most: number): string => `A product can vary by up to ${most} things.`,
  tooManyCombinations: (count: number, most: number): string =>
    `That makes ${countText(count, COMBINATIONS)}. Keep it to ${most} or fewer.`
};

// The owners' products table: the summary line, the small words in each row, and what it says when empty.
export const PRODUCTS_TABLE = {
  // The summary line, like "12 products · 3 running low · 2 out of stock · 1 off".
  products: (n: number): string => countText(n, PRODUCTS),
  runningLow: (n: number): string => `${n} running low`,
  outOfStock: (n: number): string => `${n} out of stock`,
  // Switched off, so not in the shop.
  off: (n: number): string => `${n} off`,
  between: ' · ',
  // What a product varies by, like "Colour (2), Size (6)", or a dash for nothing.
  variesBy: (option: string, choices: number): string => `${option} (${choices})`,
  variesBetween: ', ',
  variesByNothing: '—',
  // Under the stock number, like "12 combinations, 3 out".
  combinations: (n: number): string => countText(n, COMBINATIONS),
  combinationsOut: (n: number, out: number): string => `${countText(n, COMBINATIONS)}, ${out} out`,
  // When a search or a quick filter leaves nothing to show.
  noMatch: 'Nothing matches that search.',
  noneLow: 'Nothing is running low.',
  noneOut: 'Nothing is out of stock.',
  noneOff: 'Every product is in the shop.',
  noProducts: 'There are no products yet.'
};
