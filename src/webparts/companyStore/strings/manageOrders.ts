/*
 * Words on the owners' Orders page: the table, an order opened out under its
 * row, the panel for changing an order, the box that asks about the email
 * before an order moves on, and the day picker they share.
 *
 * The status choices in the dropdowns are the statuses themselves (New,
 * Confirmed and so on), as saved on each order, so they aren't here.
 */
import { IPlural, countText } from './plural';
import { COMMON } from './common';

// Counting orders, as in "the newest 200 orders".
export const ORDERS: IPlural = { one: 'order', other: 'orders' };

// The Orders page: heading, search, filters and the notes around the table.
export const ORDERS_PAGE = {
  title: 'Orders',
  // Beside Refresh while the list loads again.
  loadingAgain: 'Loading…',
  refresh: 'Refresh',
  // The first time the list loads.
  loading: 'Loading orders…',
  loadFailed: (error: string): string => `The orders couldn't be loaded. Try Refresh in a moment. (${error})`,
  // Read out for the row of filter buttons.
  filtersLabel: 'Show orders',
  searchPlaceholder: 'Search orders',
  searchLabel: 'Search by order number, name or item',
  // "Showing the newest 200 orders. Older ones are in the [orders list]." is split around the link:
  olderBeforeLink: (count: number): string =>
    `Showing the newest ${countText(count, ORDERS)}. Older ones are in the `,
  olderLink: 'orders list',
  olderAfterLink: '.',
  // Read out at the top of the table.
  tableCaption: 'Orders, newest first. Open an order to see its details.',
  // Just after the edit panel saves, like "CS-0042 saved."
  saved: (order: string): string => `${order} saved.`
};

// The column headings of the orders table. "Total" is COMMON.total.
export const ORDER_COLUMNS = {
  order: 'Order',
  who: 'Who',
  placed: 'Placed',
  items: 'Items',
  how: 'How',
  status: 'Status',
  emailSent: 'Email sent'
};

// One order's row in the table, and the problem shown under it when a change didn't go.
export const ORDER_ROW = {
  // Read out for the arrow that opens and closes the row.
  detailsLabel: (order: string): string => `Details of ${order}`,
  statusLabel: (order: string): string => `Status of ${order}`,
  savingLabel: (order: string): string => `Saving ${order}`,
  // In the "Email sent" column when the email after the order didn't go.
  emailNotSent: 'No',
  emailNotSentTip: "The order email didn't go out. You may want to let them know.",
  // Clears the problem under the row.
  dismissProblem: 'OK',
  // The status names are the statuses as saved, like "Shipped".
  statusFailed: (order: string, status: string, was: string, error: string): string =>
    `${order} couldn't be changed to ${status}, so it's still ${was}. (${error})`
};

// An order opened out under its row.
export const ORDER_DETAIL = {
  edit: 'Edit order',
  editLabel: (order: string): string => `Edit order ${order}`,
  where: COMMON.whereItGoes,
  collecting: 'Collecting at the office.',
  noAddress: COMMON.noAddress,
  phone: (phone: string): string => `Phone: ${phone}`,
  readyBy: 'Ready by',
  tracking: 'Tracking',
  pickedUpOn: 'Picked up on',
  who: 'Who',
  items: 'What they ordered',
  // One thing ordered, like "2 × Crew hoodie".
  line: (qty: number, item: string): string => `${qty} × ${item}`,
  noItems: COMMON.nothingListed,
  note: 'Their note',
  noNote: 'No note.',
  openInList: 'Open in the orders list',
  history: 'History',
  historyEmpty: 'Nothing recorded yet.',
  // Read out between who, when and what in a history line, where the screen shows a dot.
  historyPause: ', '
};

// The panel for changing an order.
export const ORDER_EDITOR = {
  title: (order: string): string => `Edit ${order}`,
  status: 'Status',
  readyBy: 'Ready by',
  pickedUpOn: 'Picked up on',
  tracking: 'Tracking number or link',
  noEmailHint: "Saving here doesn't email anyone. To let them know, change the status in the orders table.",
  items: 'Items',
  noItems: COMMON.nothingListed,
  itemsUnreadable: "The quantities can't be changed here: this order's item details couldn't be read.",
  // The price of something that costs nothing.
  free: COMMON.free,
  priceEach: (price: string): string => `${price} each`,
  // Under a line whose quantity has been changed.
  comesOff: (was: number): string => `Comes off the order (was ${was})`,
  was: (qty: number): string => `Was ${qty}`,
  qtyLabel: (item: string): string => `Quantity of ${item}`,
  qtyInvalid: 'A whole number, 0 or more',
  qtyHint: 'Set a quantity to 0 to take it off the order. Stock is put back or taken to match.',
  // In place of "Total" once the quantities change it, with the old total beside it.
  newTotal: 'New total',
  wasTotal: (amount: string): string => `was ${amount}`,
  method: 'How they want it',
  address: COMMON.whereItGoes,
  // Followed by the address as it was written, in its own style.
  addressUnreadable: "This order's address couldn't be read into the boxes. It was written as:",
  note: 'Note'
};

// The box that asks about the email before an order is confirmed, ready for pick-up or shipped.
export const STATUS_DIALOG = {
  // Names the button on the opened order.
  readyByHint: `Not sure yet? Leave it empty and add it later in ${ORDER_DETAIL.edit}.`,
  tracking: 'Tracking number or link',
  sentFrom: 'Sent from your mailbox.'
};

// The day picker with a Clear button beside it, like "Ready by".
export const DAY_FIELD = {
  clear: 'Clear',
  // Read out for Clear, like "Clear Ready by".
  clearLabel: (label: string): string => `Clear ${label}`
};
