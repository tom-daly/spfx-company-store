/*
 * Words in the emails the store sends: the order email to the store team (with
 * the buyer copied in) and the status emails to the person who ordered. The
 * owners' own subjects and opening words are settings, edited in Customize.
 *
 * These go into the email as they are, next to the HTML around them.
 */
import { METHOD_TITLES } from './common';

// What to tell people when an email can't go.
export const EMAIL_PROBLEMS = {
  orderNotSent: "The order email couldn't be sent.",
  notSent: "The email couldn't be sent.",
  noOneToEmail: 'No one is set to get order emails yet.',
  notApproved: "IT hasn't approved the store sending email yet, so no email went.",
  // `notSent` says the email couldn't be sent; `reason` is the first sentence of what went wrong.
  notSentBecause: (notSent: string, reason: string): string => `${notSent} ${reason}`,
  noAddress: (name: string): string => `There's no email address for ${name}, so no email went.`,
  noAddressNoName: "There's no email address for whoever placed it, so no email went."
};

// Words both emails share: the items table and the pick-up heading. Price and Total come from COMMON.
export const EMAIL_WORDS = {
  qty: 'Qty',
  item: 'Item',
  // Under the table when everything was free.
  nothingToPay: 'Nothing to pay.',
  pickUpHeading: METHOD_TITLES['Pick up']
};

// The order email to the store team.
export const ORDER_EMAIL = {
  deliveryHeading: METHOD_TITLES.Delivery,
  phone: (phone: string): string => `Phone: ${phone}`,
  noteFrom: (name: string): string => `Note from ${name}`,
  noteFromNoName: 'Note from the buyer',
  seeOrder: 'See the order in the orders list',
  footer: 'Sent by the company store.',
  footerFor: (name: string): string => `Sent by the company store on behalf of ${name}.`
};

// The emails to the person who ordered, as their order moves on.
export const STATUS_EMAIL = {
  // `label` is like "USPS tracking", `tracking` the number or its link.
  tracking: (label: string, tracking: string): string => `${label}: ${tracking}`,
  sentTo: 'Sent to',
  whatYouOrdered: 'What you ordered',
  // Under the items when only the Items column could be read.
  total: (amount: string): string => `Total: ${amount}`,
  seeYourOrders: 'See your orders',
  footer: 'Sent by the company store. Reply to this email if you have any questions.'
};
