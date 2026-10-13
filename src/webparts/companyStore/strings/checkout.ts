/*
 * Words at checkout: the page itself, the ways to get an order, the address
 * boxes and the screen after an order is placed.
 */
import { HOME } from './home';
import { COMMON } from './common';

// The checkout page.
export const CHECKOUT = {
  back: 'Back to the store',
  emptyCart: 'Your cart is empty. Add something from the store first.',
  methodTitle: 'How do you want it?',
  methodHint: "Pick one. We only need an address if it's coming to you.",
  noMethods: "The store isn't taking orders right now: pick-up and delivery are both turned off.",
  addressTitle: COMMON.whereItGoes,
  savedAddressHint: "Your saved address. Change anything that's out of date.",
  addressHint: 'The address for the parcel.',
  rememberAddress: 'Remember this address for next time',
  forgetAddress: 'Forget my saved address',
  forgetting: 'Forgetting…',
  addressForgotten: "We've forgotten your saved address.",
  forgetFailed: (why: string): string => `Your saved address couldn't be removed. ${why}`,
  noteTitle: 'Anything else?',
  noteHint: 'Optional. Goes with your order.',
  notePlaceholder: 'A note for the store team',
  summaryTitle: 'Your order',
  // Under each line's name, like "Qty 2".
  quantity: (qty: number): string => `Qty ${qty}`,
  free: 'Nothing to pay — the company covers these.',
  placeOrder: 'Place order',
  placing: 'Placing your order…',
  sendingEmail: 'Sending your confirmation email…',
  emailPromise: "You'll get a confirmation email, and the store team is told straight away."
};

// The cards for choosing how to get an order.
export const METHOD_CHOICES = {
  label: CHECKOUT.methodTitle,
  // After the card's title in Customize, like "Delivery — turned off in Settings…".
  offNote: "— turned off in Settings, so staff won't see this"
};

// The boxes of a delivery address, at checkout and in the order editor.
export const ADDRESS = {
  name: 'Full name',
  line1: 'Address line 1',
  line1Placeholder: 'Street and number',
  line2: 'Address line 2',
  line2Placeholder: 'Optional',
  postcode: 'Postcode',
  city: 'City',
  country: 'Country',
  phone: 'Phone',
  phonePlaceholder: 'For the courier (optional)',
  needed: 'Needed for delivery'
};

// The screen after an order is placed.
export const ORDER_PLACED = {
  title: 'Order placed',
  // "Your order number is LA-0042", with the number styled on its own after it:
  numberLead: 'Your order number is',
  nextTitle: 'What happens next',
  pickUp: 'Pick it up at the office.',
  delivery: "We'll send it to you.",
  shipTo: "It's going to:",
  emailSent: 'A confirmation email is on its way to you.',
  emailFailed: "Your order is saved, but the confirmation email couldn't be sent.",
  back: CHECKOUT.back,
  seeMyOrders: HOME.seeMyOrders
};
