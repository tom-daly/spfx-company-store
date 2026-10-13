/*
 * Words about orders: what the store team and the person who ordered read
 * about an order, the checks before an order or a change to one is saved, the
 * lines saved in an order's history, and the tracking words.
 *
 * Statuses and delivery methods (New, Packed, Pick up, Delivery and so on) are
 * saved on each order as they are, so where a sentence names one, it is passed
 * in rather than written here.
 */

// Joining words for a list, like "a, b and c" or "a, b or c".
export const LIST_WORDS = {
  between: ', ',
  and: (rest: string, last: string): string => `${rest} and ${last}`,
  or: (rest: string, last: string): string => `${rest} or ${last}`
};

// Small words on the orders page and in the orders list.
export const ORDER_WORDS = {
  // Shown as the person's name when SharePoint has neither their name nor their email.
  unknownPerson: 'Unknown'
};

// The quick filters over the owners' orders table.
export const ORDER_FILTERS = {
  open: 'Open',
  new: 'New',
  confirmed: 'Confirmed',
  packed: 'Packed',
  readyForPickUp: 'Ready for pick-up',
  done: 'Done',
  all: 'All'
};

// The counts at the top of the orders page, like "2 new · 1 confirmed · 24 done".
export const ORDER_SUMMARY = {
  new: (n: number): string => `${n} new`,
  confirmed: (n: number): string => `${n} confirmed`,
  packed: (n: number): string => `${n} packed`,
  readyForPickUp: (n: number): string => `${n} ready for pick-up`,
  done: (n: number): string => `${n} done`,
  // In place of the counts above when every order is done.
  nothingOpen: 'Nothing open',
  between: ' · '
};

// What the orders table says when there's nothing to show.
export const ORDERS_EMPTY = {
  noOrders: 'No orders yet.',
  open: 'Nothing open — every order is done.',
  new: 'No new orders.',
  confirmed: 'No orders are confirmed and waiting.',
  packed: 'Nothing is packed and waiting.',
  readyForPickUp: 'Nothing is waiting to be picked up.',
  done: 'Nothing has been shipped or picked up yet.',
  // A search found nothing under a filter; `orders` is one of the FILTERED_ORDERS words below.
  noMatch: (orders: string, query: string): string => `No ${orders} match "${query}".`,
  noMatchTryAll: (orders: string, query: string): string =>
    `No ${orders} match "${query}". Try All to search every order.`
};

// What each filter's orders are called, inside "No new orders match …".
export const FILTERED_ORDERS = {
  open: 'open orders',
  new: 'new orders',
  confirmed: 'confirmed orders',
  packed: 'packed orders',
  readyForPickUp: 'orders ready for pick-up',
  done: 'shipped or picked-up orders',
  all: 'orders'
};

// The box that opens before an order is confirmed, marked ready for pick-up or marked shipped.
export const STATUS_ASK = {
  // The label on the ready-by day.
  readyForPickUpBy: 'Ready for pick-up by',
  readyToSendBy: 'Ready to send by',
  confirmTitle: (order: string): string => `Confirm ${order}`,
  readyTitle: (order: string): string => `${order} is ready for pick-up`,
  shippedTitle: (order: string): string => `Mark ${order} shipped`,
  confirmButton: 'Confirm',
  readyButton: 'Mark ready',
  shippedButton: 'Mark shipped',
  // The tick box for emailing the person.
  emailConfirmed: (firstName: string): string => `Email ${firstName} to say it's confirmed`,
  emailReady: (firstName: string): string => `Email ${firstName} to come and pick it up`,
  emailShipped: (firstName: string): string => `Email ${firstName} to say it's on its way`,
  // In place of the tick box when there's no address to send to.
  noEmail: (name: string): string => `There's no email address for ${name}, so no email can go.`,
  noEmailNoName: "There's no email address for this order, so no email can go."
};

// The steps an order goes through, as My orders names them.
export const ORDER_STEPS = {
  new: 'Placed',
  confirmed: 'Confirmed',
  packed: 'Packed',
  shipped: 'Shipped',
  readyForPickUp: 'Ready for pick-up',
  pickedUp: 'Picked up',
  // Read out after a step's name.
  stepDone: 'done',
  stepToCome: 'still to come'
};

// Where someone's order has got to, on My orders and in the confirmed email.
export const ORDER_PROGRESS = {
  readyForPickUpBy: (day: string): string => `Ready for pick-up by ${day}.`,
  sendBy: (day: string): string => `We expect to send it by ${day}.`,
  // `readyBy` is one of the two sentences above.
  confirmedBy: (readyBy: string): string => `Confirmed. ${readyBy}`,
  confirmedPickUp: "Confirmed. We're working on it and will email you when it's ready.",
  confirmedDelivery: "Confirmed. We're working on it and will email you when it's on its way.",
  packed: 'Packed and waiting to be sent.',
  ready: 'Ready for pick-up.',
  shipped: 'On its way.',
  pickedUpOn: (day: string): string => `Picked up on ${day}.`,
  pickedUp: 'Picked up.',
  received: "We've got your order. We'll confirm it soon.",
  // Like "Placed 4 Oct 2026 at 3:30 PM".
  placed: (when: string): string => `Placed ${when}`
};

// Why an order can't be placed yet, as the person ordering is told at checkout.
export const ORDER_CHECKS = {
  cartEmpty: 'Your cart is empty.',
  pickUpOff: "Picking up at the office isn't available right now. Please choose delivery.",
  deliveryOff: "Delivery isn't available right now. Please choose pick-up.",
  // `missing` is a list of the parts below, like "the postcode and the city".
  addressMissing: (missing: string): string => `Please add ${missing} so we know where to send it.`,
  soldOut: (item: string): string => `${item} has just sold out. Take it out of your cart and try again.`,
  notEnough: (left: number, item: string): string => `Only ${left} ${item} left. Change your cart and try again.`
};

// What each empty part of the address is called when the person ordering is asked for it.
export const YOUR_ADDRESS_PARTS = {
  name: 'your full name',
  line1: 'the first line of the address',
  postcode: 'the postcode',
  city: 'the city',
  country: 'the country'
};

// Why the store team's changes to an order can't be saved.
export const ORDER_EDIT_CHECKS = {
  soldOut: (item: string, wanted: number): string => `${item} is sold out, so it can't go up to ${wanted}.`,
  onlyLeft: (left: number, item: string, wanted: number): string =>
    `Only ${left} ${item} left, so it can't go up to ${wanted}.`,
  // `choices` is a list of statuses, like "New, Packed or Shipped".
  chooseStatus: (choices: string): string => `Choose a status: ${choices}.`,
  onlyForPickUps: (status: string, choices: string): string =>
    `${status} is only for pick-ups. For delivery, choose ${choices}.`,
  onlyForDeliveries: (status: string, choices: string): string =>
    `${status} is only for deliveries. For pick-up, choose ${choices}.`,
  chooseMethod: 'Choose pick-up or delivery.',
  wholeNumber: (item: string): string => `How many ${item} has to be a whole number: 0 or more.`,
  itemsUnreadable: "The items on this order can't be changed, because the store can't read exactly what was " +
    'ordered. Everything else on it can still be changed.',
  notOnOrder: (item: string): string =>
    `${item} isn't on this order. Only what's already on it can be changed; anything else needs a new order.`,
  keepOneItem: 'Leave at least one item on the order.',
  pickedUpDay: "The picked-up day isn't a real day. Pick it again, or clear it.",
  readyByDay: "The ready-by day isn't a real day. Pick it again, or clear it.",
  trackingTooLong: (most: number): string =>
    `The tracking number or link is too long. Keep it to ${most} characters or fewer.`,
  // The checks in the edit panel itself, before saving. `missing` is a list of the FORM_ADDRESS_PARTS below.
  addressMissing: (missing: string): string => `For delivery, add ${missing}.`,
  // `items` is a list of the items, like "Crew hoodie (M) and Dive cap".
  quantitiesNotNumbers: (items: string): string => `Quantities need to be whole numbers, 0 or more. Check ${items}.`,
  allZero: 'Every quantity is 0, which would leave nothing on the order. Keep at least one item on it.'
};

// What each empty part of an address is called when the store team saves a change to an order.
export const EDIT_ADDRESS_PARTS = {
  name: 'the name',
  line1: 'the first line of the address',
  postcode: 'the postcode',
  city: 'the city',
  country: 'the country'
};

// The same, in the order edit panel's own check before saving.
export const FORM_ADDRESS_PARTS = {
  name: 'the full name',
  line1: 'address line 1',
  postcode: 'the postcode',
  city: 'the city',
  country: 'the country'
};

// The lines saved in an order's history. They are saved as written, so lines already saved keep their words.
export const ORDER_HISTORY = {
  // Who made the change, when no name is known.
  someone: 'Someone',
  statusChanged: (from: string, to: string): string => `Status changed from ${from} to ${to}`,
  statusChangedReadyBy: (from: string, to: string, day: string): string =>
    `Status changed from ${from} to ${to}, ready by ${day}`,
  statusChangedReadyByCleared: (from: string, to: string): string =>
    `Status changed from ${from} to ${to}, ready by cleared`,
  statusChangedTracking: (from: string, to: string, tracking: string): string =>
    `Status changed from ${from} to ${to}, tracking ${tracking}`,
  statusChangedTrackingCleared: (from: string, to: string): string =>
    `Status changed from ${from} to ${to}, tracking cleared`,
  // The parts of "Changed: …". They start small because they follow "Changed:"; on its own the first is capitalised.
  changed: (parts: string): string => `Changed: ${parts}`,
  between: '; ',
  status: (from: string, to: string): string => `status ${from} → ${to}`,
  itemTakenOff: (item: string): string => `${item} taken off`,
  itemAdded: (item: string, qty: number): string => `${item} added (${qty})`,
  itemQty: (item: string, from: number, to: number): string => `${item} ${from} → ${to}`,
  noteAdded: 'note added',
  noteRemoved: 'note removed',
  noteChanged: 'note changed',
  readyByChanged: (day: string): string => `ready by changed to ${day}`,
  readyByCleared: 'ready by cleared',
  trackingSet: (tracking: string): string => `tracking set to ${tracking}`,
  trackingCleared: 'tracking cleared',
  pickedUpOnChanged: (day: string): string => `picked up on changed to ${day}`,
  pickedUpOnCleared: 'picked up on cleared',
  addressChanged: 'address changed',
  phoneChanged: 'phone number changed',
  // `now` and `was` are the ways, as saved: Pick up or Delivery.
  methodChanged: (now: string, was: string): string => `now ${now} instead of ${was}`,
  total: (from: string, to: string): string => `total ${from} → ${to}`,
  // Once the status email has gone.
  emailedConfirmed: (name: string): string => `Emailed ${name}: order confirmed`,
  emailedReady: (name: string): string => `Emailed ${name}: ready for pick-up`,
  emailedShipped: (name: string): string => `Emailed ${name}: on its way`,
  // When it didn't.
  emailFailed: (name: string): string => `Email to ${name} couldn't be sent`,
  emailFailedBecause: (name: string, why: string): string => `Email to ${name} couldn't be sent: ${why}`
};

// The warning on the orders table when a status email didn't go. `status` is the status as saved.
export const ORDER_WARNINGS = {
  emailNotSent: (order: string, status: string, firstName: string): string =>
    `${order} is ${status}, but the email to ${firstName} couldn't be sent.`,
  emailNotSentBecause: (order: string, status: string, firstName: string, why: string): string =>
    `${order} is ${status}, but the email to ${firstName} couldn't be sent. ${why}`
};

// A delivery's tracking: on My orders, in the shipped email, and under the box it is typed in.
export const TRACKING_WORDS = {
  // Like "USPS tracking: 9400…"; the colon comes with the line it is used in.
  label: 'Tracking',
  carrierLabel: (carrier: string): string => `${carrier} tracking`,
  // What the store took what was typed for.
  hintCarrier: (carrier: string): string =>
    `Links to the ${carrier} tracking page. Wrong carrier? Paste their tracking link instead.`,
  hintLink: 'Shows as a link.',
  hintPlain: 'Not a number the store recognises, so it shows as text. ' +
    "Paste the carrier's tracking link to make it a link."
};
