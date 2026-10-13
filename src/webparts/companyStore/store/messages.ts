import { Currency, DEFAULT_SETTINGS, IStoreSettings, formatMoney, isSubject } from './settings';
import type { IBuyer } from './types';

/*
 * The words owners can change, edited on a preview of the real screens. Each
 * can carry fill-ins like {first name}, swapped for the real details on every
 * order.
 */

export type MessageKey = 'placedMessage' | 'pickUpNote' | 'deliveryNote' | 'emailSubject' | 'emailMessage' |
  'confirmedSubject' | 'confirmedMessage' | 'readySubject' | 'readyMessage' | 'shippedSubject' | 'shippedMessage';

export const FILL_INS: string[] = ['{first name}', '{name}', '{order}', '{total}'];

export interface IFillIns {
  firstName: string;
  name: string;
  order: string;
  total: string;
}

/** What to call the person: their name, or their email when that's all there is. */
export const displayName = (buyer: IBuyer): string => (buyer.name || '').trim() || (buyer.email || '').trim();

export function fillInsFor(order: { number: string; total: number }, buyer: IBuyer, currency: Currency): IFillIns {
  // A signed-in person always has one or the other; "someone" only covers the impossible.
  const name = displayName(buyer) || 'someone';
  return {
    name,
    firstName: name.split(/\s+/)[0],
    order: order.number,
    total: formatMoney(order.total, currency)
  };
}

/** Swaps each fill-in for its value. Spacing and capitals inside the braces don't matter. */
export function fillIn(template: string, v: IFillIns): string {
  return template.replace(/\{\s*(first\s*name|name|order|total)\s*\}/gi, (_: string, key: string): string => {
    const k = key.toLowerCase().replace(/\s+/g, '');
    return k === 'firstname' ? v.firstName : k === 'name' ? v.name : k === 'order' ? v.order : v.total;
  });
}

/**
 * The owner's wording. Left blank, a message just isn't shown — except an
 * email subject, which an email can't do without, so it falls back to the
 * standard one.
 */
export function wording(settings: IStoreSettings, key: MessageKey): string {
  const own = (settings[key] || '').trim();
  return own || (isSubject(key) ? DEFAULT_SETTINGS[key] as string : '');
}

export const message = (settings: IStoreSettings, key: MessageKey, v: IFillIns): string =>
  fillIn(wording(settings, key), v);
