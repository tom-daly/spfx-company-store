/*
 * Words on the Customize the messages page, around the owner's own words: the
 * heading, tabs and choices, the email preview's header, and how each message
 * that can be changed is read out.
 */
import type { MessageKey } from '../store/messages';
import type { StatusEmailKind } from '../store/statusEmailText';

// The page itself: heading, tabs and the choices above the preview.
export const CUSTOMIZE = {
  title: 'Customize the messages',
  intro: 'This is what staff see, with a made-up order. Click any outlined words to change them. ' +
    'Fill-ins like {first name} and {order} are swapped for the real details on each order.',
  tabCheckout: 'Checkout',
  tabPlaced: 'Order placed',
  tabEmail: 'Email',
  showFor: 'Show it for',
  showForPickUp: 'Pick-up',
  showForDelivery: 'Delivery',
  whichEmail: 'Which email',
  orderEmailNote: 'Goes to the store team, from the mailbox of the person who ordered. They get a copy.',
  statusEmailNote: 'Goes to the person who ordered, from the mailbox of whoever moves the order on.'
};

// The emails to choose between.
export const EMAIL_NAMES: Record<'order' | StatusEmailKind, string> = {
  order: 'New order (to the store team)',
  confirmed: 'Order confirmed',
  ready: 'Ready for pick-up',
  shipped: 'On its way'
};

// The header at the top of the email preview.
export const EMAIL_HEAD = {
  from: 'From',
  to: 'To',
  copyTo: 'Copy to',
  repliesTo: 'Replies go to',
  subject: 'Subject',
  noRecipients: 'Nobody yet. Add someone under "Who gets order emails" in Settings.',
  // The person looking, sending a status email: "Alex Kim (you)", or just "You".
  fromYou: (name: string): string => `${name} (you)`,
  you: 'You',
  // Who a status email goes to: "Sam Taylor <sam.taylor@contoso.com>".
  person: (name: string, email: string): string => `${name} <${email}>`
};

// Shown in each email's opening while it's empty.
const OPENING_EMPTY: string = 'Click to add an opening line';

// How each message that can be changed is read out, and what shows while it's empty.
export const MESSAGE_WORDS: Record<MessageKey, { label: string; empty: string }> = {
  placedMessage: { label: 'Order placed message', empty: 'Click to add a thank-you message' },
  pickUpNote: { label: 'Pick-up instructions', empty: 'Click to add pick-up instructions' },
  deliveryNote: { label: 'Delivery note', empty: 'Click to add a delivery note' },
  emailSubject: { label: 'Email subject', empty: '' },
  emailMessage: { label: 'Email opening', empty: OPENING_EMPTY },
  confirmedSubject: { label: 'Order confirmed email subject', empty: '' },
  confirmedMessage: { label: 'Order confirmed email opening', empty: OPENING_EMPTY },
  readySubject: { label: 'Ready for pick-up email subject', empty: '' },
  readyMessage: { label: 'Ready for pick-up email opening', empty: OPENING_EMPTY },
  shippedSubject: { label: 'On its way email subject', empty: '' },
  shippedMessage: { label: 'On its way email opening', empty: OPENING_EMPTY }
};

// The outlined words that turn into a text box when clicked.
export const EDITABLE = {
  // Read out for the outlined words: "Order placed message: Thanks, Alex! Click to change."
  label: (label: string, shown: string): string => `${label}: ${shown}. Click to change.`,
  // Said in place of the words when there aren't any.
  empty: 'empty',
  editBadge: 'Edit',
  addFillIn: 'Add:',
  useStandard: 'Use the standard wording',
  done: 'Done'
};
