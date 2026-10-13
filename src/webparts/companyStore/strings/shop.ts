/*
 * Words in the shop: the bar along the top, the grid of products, a product's
 * page and its photos, the cart and My orders.
 */
import type { DeliveryMethod } from '../store/types';
import { countText } from './plural';
import { COMMON, ITEMS, PRODUCTS } from './common';
import { PRODUCTS_PAGE } from './manageProducts';
import { HOME } from './home';

// The search box and buttons along the top of the shop, and the notes under them.
export const SHOP = {
  search: 'Search the store',
  myOrders: 'My orders',
  // Read out for the cart button, like "Cart, 3 items".
  cartLabel: (count: number): string => `Cart, ${countText(count, ITEMS)}`,
  cart: 'Cart',
  loading: 'Loading the shop…',
  loadFailed: 'The shop could not load.',
  cartChanged: "Your cart has been updated to match what's left in the store.",
  ok: 'OK'
};

// The grid of products, and what shows when it's empty or a search finds nothing.
export const GRID = {
  label: 'Products',
  emptyTitle: "There's nothing in the shop right now",
  emptyHintManager: `Products show up here once they are Active. Turn that on in ${PRODUCTS_PAGE.title}.`,
  emptyHintStaff: HOME.checkBackSoon,
  // Read out as the search changes, like "3 products found".
  found: (count: number): string => `${countText(count, PRODUCTS)} found`,
  noMatchTitle: 'Nothing matches that',
  // "Try a shorter search, or [clear it] to see everything." is split around the button:
  noMatchBefore: 'Try a shorter search, or',
  clearSearch: 'clear it',
  noMatchAfter: 'to see everything.'
};

// The soft box shown when a product has no photo.
export const PHOTO = {
  noPhoto: 'No photo yet',
  // Read out for the box, like "Crew hoodie: no photo yet".
  noPhotoOf: (name: string): string => `${name}: no photo yet`
};

// The minus and plus buttons either side of a quantity.
export const STEPPER = {
  less: 'One fewer',
  more: 'One more'
};

// One product's page.
export const PRODUCT = {
  back: 'All products',
  edit: 'Edit product',
  // On a choice that has sold out, like "Blue — none left".
  noneLeft: (choice: string): string => `${choice} — none left`,
  quantity: 'Quantity',
  inCart: (count: number): string => `You have ${count} in your cart.`,
  inCartVariant: (count: number, variant: string): string => `You have ${count} (${variant}) in your cart.`
};

// The big photo and the row of thumbnails on a product's page.
export const GALLERY = {
  // The big photo when it shows one choice, like "Crew hoodie, Blue".
  photoOf: (name: string, choice: string): string => `${name}, ${choice}`,
  previous: 'Previous photo',
  next: 'Next photo',
  thumbs: 'Photos',
  // Read out as the big photo changes, and on each thumbnail.
  position: (n: number, count: number): string => `Photo ${n} of ${count}`,
  positionChoice: (n: number, count: number, choice: string): string => `Photo ${n} of ${count}: ${choice}`,
  thumbChoice: (choice: string, n: number, count: number): string => `${choice}, photo ${n} of ${count}`,
  thumbNoneLeft: (choice: string): string => `${choice}, none left`
};

// The cart, which slides in from the side.
export const CART = {
  title: 'Your cart',
  close: 'Close cart',
  listLabel: 'In your cart',
  emptyTitle: 'Your cart is empty',
  emptyHint: 'Pick something from the shop and it will show up here.',
  free: COMMON.free,
  each: (price: string): string => `${price} each`,
  quantityOf: (item: string): string => `Quantity of ${item}`,
  remove: 'Remove',
  removeLabel: (item: string): string => `Remove ${item}`,
  checkout: 'Checkout',
  continueShopping: 'Continue shopping'
};

// My orders: the orders the person looking has placed.
export const MY_ORDERS = {
  back: 'Back to the shop',
  title: SHOP.myOrders,
  intro: "Everything you've ordered from the store, newest first.",
  loading: 'Loading your orders…',
  loadFailed: "Your orders couldn't be loaded.",
  emptyTitle: "You haven't ordered anything yet.",
  goShop: 'Go to the shop',
  listLabel: 'Your orders',
  showingNewest: (count: number): string => `Showing your newest ${count} orders.`,
  // Read out before the order number, like "Order LA-0042".
  orderSr: 'Order ',
  progress: 'Progress',
  // Read out after each step's name, like "Confirmed, done".
  stepState: (state: string): string => `, ${state}`,
  // Before the tracking number or link, like "Tracking: 1Z999…".
  trackingLead: (label: string): string => `${label}:`,
  itemsTitle: 'What you ordered',
  noItems: COMMON.nothingListed,
  shipToTitle: 'Going to',
  noAddress: COMMON.noAddress
};

// How each order says how it's being got, on its card in My orders.
export const ORDER_METHOD: Record<DeliveryMethod, string> = {
  'Pick up': 'Pick up',
  Delivery: 'Delivery'
};
