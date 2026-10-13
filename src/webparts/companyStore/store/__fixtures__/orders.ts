import { DEFAULT_SETTINGS } from '../settings';
import type { IStoreSettings } from '../settings';
import { ONE_SIZE } from '../types';
import type { IAddress, ICartLine } from '../types';

/* One hoodie in its one size, and two T-shirts in M. */
export const hoodie: ICartLine = { productId: 1, name: 'Crew hoodie', price: 22, qty: 1, variant: ONE_SIZE };
export const tee: ICartLine = { productId: 3, name: 'T-shirt', price: 12.5, qty: 2, variant: 'M' };

/* A full delivery address, with no second line. */
export const megan: IAddress = {
  name: 'Megan Bowen',
  line1: 'Keizersgracht 1',
  line2: '',
  postcode: '1015 CJ',
  city: 'Amsterdam',
  country: 'Netherlands',
  phone: '+31 6 1234 5678'
};

/* Monday 12 October 2026, and the Thursday after. */
export const TODAY = '2026-10-12';
export const THURSDAY = '2026-10-15';

/* The store the email tests send from. */
export const SETTINGS: IStoreSettings = {
  ...DEFAULT_SETTINGS, orderPrefix: 'CS-', orderEmails: 'store@contoso.com, hr@contoso.com'
};

/* An email body as a reader sees it: one entry per line or table cell, tags gone. */
export const linesOf = (html: string): string[] =>
  html
    .replace(/<br>|<\/p>|<\/td>|<\/th>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
