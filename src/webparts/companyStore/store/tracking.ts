/*
 * A delivery's tracking, as the store typed it in. A web address pasted in
 * stays a link, with or without its https:// in front. A tracking number from
 * USPS, UPS, FedEx, DHL or OnTrac becomes a link to that carrier's own tracking
 * page, worked out from the shape of the number and its check digit. Anything
 * else stays plain text, so nothing typed in can become a harmful link.
 *
 * Shapes overlap: an ordinary 10-digit number can pass DHL's check, a 12-digit
 * one FedEx's. So wherever tracking is typed in, the store says what it took
 * the number for (trackingHint), and a wrong guess is put right by pasting the
 * carrier's own tracking link instead.
 */
import { allCouriers, getTracking } from 'ts-tracking-number';
import type { TrackingNumber } from 'ts-tracking-number';

export interface ITracking {
  /** What to show: the number or address as typed, or only the tracking number of a label scanned in full. */
  readonly text: string;
  /** Where it goes. Only for a web address, or a number whose carrier was found. */
  readonly href?: string;
  /** The carrier, like USPS, when the number was recognised. */
  readonly carrier?: string;
}

/*
 * The carriers linked to, with what people call them and their current tracking
 * pages. DHL's page covers every DHL service, not only Express. Numbers the
 * library knows but that have no one page to link to (Amazon, international
 * post) aren't looked for at all.
 */
const CARRIERS: Record<string, { name: string; url: string }> = {
  usps: { name: 'USPS', url: 'https://tools.usps.com/go/TrackConfirmAction?tLabels=%s' },
  ups: { name: 'UPS', url: 'https://www.ups.com/track?tracknum=%s' },
  fedex: { name: 'FedEx', url: 'https://www.fedex.com/fedextrack/?trknbr=%s' },
  dhl: { name: 'DHL', url: 'https://www.dhl.com/global-en/home/tracking.html?tracking-id=%s&submit=1' },
  ontrac: { name: 'OnTrac', url: 'https://www.ontrac.com/tracking/?number=%s' }
};

const LOOKED_FOR = allCouriers.filter(c => !!CARRIERS[c.courier_code]);

const isWebAddress = (text: string): boolean => /^https?:\/\/\S/i.test(text);

/* A link pasted without its https://, like www.ups.com/track?… Tracking numbers never have a dot in them. */
const isBareWebAddress = (text: string): boolean => /^(?:[a-z0-9-]+\.)+[a-z]{2,}(?:[/?#]\S*)?$/i.test(text);

/*
 * A USPS or FedEx SmartPost label scanned in full starts with 420 and the ZIP
 * code, for the sorting machines. The carrier's page wants only the tracking
 * number after it. Where the ZIP code ends is taken from the same reading of
 * the number that found its carrier, as ZIP codes come in 5 or 9 digits.
 */
function withoutRouting(found: TrackingNumber, number: string): string {
  const courier = LOOKED_FOR.filter(c => c.courier_code === found.courier.code)[0];
  const shape = courier && courier.tracking_numbers.filter(t => t.name === found.name)[0];
  if (!shape) return number;
  const rule = typeof shape.regex === 'string' ? shape.regex : shape.regex.join('');
  // The library's own rule for this shape of number, not anything typed in.
  // eslint-disable-next-line @rushstack/security/no-unsafe-regexp
  const m = new RegExp(`^(?:${rule})$`).exec(number) as
    (RegExpExecArray & { groups?: Record<string, string | undefined> }) | null;
  const parts = m && m.groups;
  if (!parts || !parts.RoutingApplicationId) return number;
  const routing = parts.RoutingApplicationId + (parts.DestinationZip || '') + (parts.RoutingNumber || '');
  return number.slice(routing.length);
}

function work(text: string): ITracking {
  if (isWebAddress(text)) return { text, href: text };
  if (isBareWebAddress(text)) return { text, href: `https://${text}` };
  // Carriers print numbers in groups, like 9400 1112 9837…; the check works on the number alone.
  const number = text.replace(/[\s-]/g, '').toUpperCase();
  if (!/^[A-Z0-9]{8,40}$/.test(number)) return { text };
  const found = getTracking(number, LOOKED_FOR);
  const carrier = found && CARRIERS[found.courier.code];
  if (!found || !carrier) return { text };
  const tracked = withoutRouting(found, number);
  return {
    // A scanned label shows as just its tracking number, the one the carrier's page shows.
    text: tracked === number ? text : tracked,
    href: carrier.url.replace('%s', encodeURIComponent(tracked)),
    carrier: carrier.name
  };
}

/*
 * Worked out once per tracking; pages showing many orders ask again on every
 * redraw. Emptied once it gets long, as the box tracking is typed in asks on
 * every key pressed.
 */
const MOST_KNOWN = 200;
const known = new Map<string, ITracking>();

/** The tracking to show, with its link when there is one. Undefined when nothing was typed. */
export function trackingFor(tracking: string): ITracking | undefined {
  const text = (tracking || '').trim();
  if (!text) return undefined;
  let t = known.get(text);
  if (!t) {
    if (known.size >= MOST_KNOWN) known.clear();
    t = work(text);
    known.set(text, t);
  }
  return t;
}

/** "USPS tracking" when the carrier is known, "Tracking" otherwise. */
export const trackingLabel = (t: ITracking): string => (t.carrier ? `${t.carrier} tracking` : 'Tracking');

/**
 * Under the box tracking is typed in: what the store took it for, so a wrong
 * guess can be seen and put right. Empty when nothing has been typed.
 */
export function trackingHint(tracking: string): string {
  const t = trackingFor(tracking);
  if (!t) return '';
  if (t.carrier) return `Links to the ${t.carrier} tracking page. Wrong carrier? Paste their tracking link instead.`;
  if (t.href) return 'Shows as a link.';
  return "Not a number the store recognises, so it shows as text. Paste the carrier's tracking link to make it a link.";
}
