/*
 * Settings for the whole store, kept as one row per setting in the hidden
 * Store settings list. Rows are named in plain words so the list makes sense if
 * anyone opens it. A setting with no row yet uses its default, so new settings
 * can be added later without touching the list.
 */

import { CURRENCY_NAMES, EMAIL_NAMES, MONEY_WORDS, SETTINGS_CHECKS } from '../strings/settingsWords';

export type Currency = 'USD' | 'EUR' | 'GBP';

export interface ICurrency {
  code: Currency;
  label: string;
  /** How amounts are written in the store. */
  locale: string;
  /** The same, as the number SharePoint's currency columns use. */
  lcid: number;
}

export const CURRENCIES: ICurrency[] = [
  { code: 'USD', label: CURRENCY_NAMES.usd, locale: 'en-US', lcid: 1033 },
  { code: 'EUR', label: CURRENCY_NAMES.eur, locale: 'en-IE', lcid: 6153 },
  { code: 'GBP', label: CURRENCY_NAMES.gbp, locale: 'en-GB', lcid: 2057 }
];

export const currencyInfo = (code: Currency): ICurrency =>
  CURRENCIES.filter(c => c.code === code)[0] || CURRENCIES[0];

export interface IStoreSettings {
  currency: Currency;
  orderPrefix: string;
  /** Addresses separated by commas. Empty until emails are set up. */
  orderEmails: string;
  pickUp: boolean;
  pickUpNote: string;
  delivery: boolean;
  deliveryNote: string;
  /** Wording edited in Customize; may hold fill-ins like {first name}. */
  placedMessage: string;
  emailSubject: string;
  emailMessage: string;
  /* The emails to the person who ordered, sent as the store moves their order on. */
  confirmedSubject: string;
  confirmedMessage: string;
  readySubject: string;
  readyMessage: string;
  shippedSubject: string;
  shippedMessage: string;
}

export const DEFAULT_SETTINGS: IStoreSettings = {
  currency: 'USD',
  orderPrefix: 'ORD-',
  orderEmails: '',
  pickUp: true,
  pickUpNote: 'Pick it up at the front desk.',
  delivery: true,
  deliveryNote: 'Five to seven working days.',
  placedMessage: 'Thanks, {first name}. Your order is in.',
  emailSubject: 'Store order {order} from {name}',
  emailMessage: '{name} placed order {order}.',
  confirmedSubject: 'Your order {order} is confirmed',
  confirmedMessage: "Hi {first name}, thanks for your order. We have it and we're getting it ready.",
  readySubject: 'Your order {order} is ready for pick-up',
  readyMessage: 'Hi {first name}, your order is ready. Come and pick it up whenever suits you.',
  shippedSubject: 'Your order {order} is on its way',
  shippedMessage: 'Hi {first name}, your order is on its way.'
};

/* The row name each setting is stored under. Never change these once shipped. */
const ROW: Record<keyof IStoreSettings, string> = {
  currency: 'Currency',
  orderPrefix: 'Order numbers start with',
  orderEmails: 'Who gets order emails',
  pickUp: 'Pick up at the office',
  pickUpNote: 'Pick-up instructions',
  delivery: 'Delivery',
  deliveryNote: 'Delivery note',
  placedMessage: 'Order placed message',
  emailSubject: 'Order email subject',
  emailMessage: 'Order email message',
  confirmedSubject: 'Confirmed email subject',
  confirmedMessage: 'Confirmed email message',
  readySubject: 'Ready email subject',
  readyMessage: 'Ready email message',
  shippedSubject: 'Shipped email subject',
  shippedMessage: 'Shipped email message'
};

export interface ISettingRow {
  Title: string;
  // eslint-disable-next-line @rushstack/no-new-null -- SharePoint sends null for an empty column
  SettingValue: string | null;
}

/* Every setting, in the order its row is written. */
const KEYS = Object.keys(ROW) as (keyof IStoreSettings)[];

/* The two settings that are on or off, kept as Yes or No. */
const isSwitch = (key: keyof IStoreSettings): key is 'pickUp' | 'delivery' => key === 'pickUp' || key === 'delivery';

const yes = (v: boolean): string => (v ? 'Yes' : 'No');

export function settingsFromRows(rows: ISettingRow[]): IStoreSettings {
  const s: IStoreSettings = { ...DEFAULT_SETTINGS };
  KEYS.forEach(key => {
    const row = rows.filter(r => r.Title === ROW[key])[0];
    const v = row ? row.SettingValue : undefined;
    if (v === null || v === undefined) return;
    // Yes or No for the two switches, text for the rest; a currency the store doesn't know keeps the default.
    if (isSwitch(key)) s[key] = v.trim().toLowerCase() === 'yes';
    else if (key !== 'currency') s[key] = v;
    else if (CURRENCIES.some(c => c.code === v)) s.currency = v as Currency;
  });
  return s;
}

export function rowsFromSettings(s: IStoreSettings): ISettingRow[] {
  return KEYS.map(key => ({ Title: ROW[key], SettingValue: isSwitch(key) ? yes(s[key]) : s[key] }));
}

export const splitEmails = (list: string): string[] =>
  list.split(/[,;\s]+/).map(e => e.trim()).filter(Boolean);

/** Whether placed orders are emailed to anyone: someone is set to get order emails. */
export const sendsOrderEmails = (settings: IStoreSettings): boolean => splitEmails(settings.orderEmails).length > 0;

/* Each email's subject, and the email as Customize names it. */
const SUBJECTS: ['emailSubject' | 'confirmedSubject' | 'readySubject' | 'shippedSubject', string][] = [
  ['emailSubject', EMAIL_NAMES.order],
  ['confirmedSubject', EMAIL_NAMES.confirmed],
  ['readySubject', EMAIL_NAMES.ready],
  ['shippedSubject', EMAIL_NAMES.shipped]
];

/* The longest an email's subject can be. */
const MOST_SUBJECT = 200;

/** Whether a setting is an email's subject, which an email can't go without. */
export const isSubject = (key: keyof IStoreSettings): boolean => SUBJECTS.some(([subject]) => subject === key);

/** What is wrong with these settings, in plain words, or undefined if nothing. */
export function checkSettings(s: IStoreSettings): string | undefined {
  if (!/^[A-Za-z0-9-]{0,10}$/.test(s.orderPrefix)) return SETTINGS_CHECKS.orderPrefix;
  const bad = splitEmails(s.orderEmails).filter(e => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
  if (bad.length) return SETTINGS_CHECKS.badEmails(bad);
  if (!s.pickUp && !s.delivery) return SETTINGS_CHECKS.noMethod;
  const long = SUBJECTS.filter(([key]) => s[key].length > MOST_SUBJECT)[0];
  if (long) return SETTINGS_CHECKS.subjectTooLong(long[1], MOST_SUBJECT);
  return undefined;
}

/* ---------------------------------------------------------------- money */

export function formatMoney(amount: number, currency: Currency): string {
  if (amount === 0) return MONEY_WORDS.free;
  return new Intl.NumberFormat(currencyInfo(currency).locale, { style: 'currency', currency }).format(amount);
}

export const currencySymbol = (currency: Currency): string =>
  ({ USD: '$', EUR: '€', GBP: '£' } as Record<Currency, string>)[currency];
