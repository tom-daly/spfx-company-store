/*
 * Words about the store's settings: the currencies, what each email is
 * called, the checks before settings are saved, the fill-ins owners can put
 * in their messages, and how a price of nothing is shown.
 *
 * The standard wording owners start with, and the names each setting is saved
 * under, stay with the settings in store/settings.ts.
 */
import { plural } from './plural';
import { COMMON } from './common';

// The currencies, as the Settings page lists them.
export const CURRENCY_NAMES = {
  usd: 'US dollar ($)',
  eur: 'Euro (€)',
  gbp: 'British pound (£)'
};

// What each email is called in Customize, and in the subject check below.
export const EMAIL_NAMES = {
  order: 'New order',
  confirmed: 'Order confirmed',
  ready: 'Ready for pick-up',
  shipped: 'On its way'
};

// Why the settings can't be saved yet, on the Settings and Customize pages.
export const SETTINGS_CHECKS = {
  orderPrefix: 'Order numbers can start with up to 10 letters, numbers or dashes, like CS-.',
  // The addresses that don't look right, as typed.
  badEmails: (emails: string[]): string => plural(emails.length, {
    one: `${emails.join(', ')} doesn't look like an email address.`,
    other: `${emails.join(', ')} don't look like email addresses.`
  }),
  noMethod: 'Turn on pick-up, delivery or both, or nobody can get their order.',
  // `email` is one of the EMAIL_NAMES above.
  subjectTooLong: (email: string, most: number): string =>
    `Keep the subject of the "${email}" email under ${most} characters.`
};

// The fill-ins owners can put in their messages. Renaming one means changing the pattern in store/messages.ts too.
export const FILL_IN_WORDS = {
  firstName: '{first name}',
  name: '{name}',
  order: '{order}',
  total: '{total}',
  // Put in for {name} if there's ever no name or email to use.
  nobody: 'someone'
};

// Amounts of money.
export const MONEY_WORDS = {
  // A price or total of 0.
  free: COMMON.free
};
