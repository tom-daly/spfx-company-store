/*
 * Days the store promises or records — ready by, picked up on — kept as plain
 * text like 2026-10-15. A day picked in one time zone stays the same day for
 * everyone, which a date and time would not.
 */

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const twoDigits = (n: number): string => (n < 10 ? `0${n}` : String(n));

/** "4 Oct 2026", in the viewer's own time zone. */
export const dateText = (d: Date): string => `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

/** "3:30 PM", in the viewer's own time zone. Noon is 12:00 PM and midnight 12:00 AM. */
export function timeText(d: Date): string {
  const hours = d.getHours();
  return `${hours % 12 || 12}:${twoDigits(d.getMinutes())} ${hours < 12 ? 'AM' : 'PM'}`;
}

/** "4 Oct 2026 at 3:30 PM". */
export const whenText = (d: Date): string => `${dateText(d)} at ${timeText(d)}`;

/** The day as text, like 2026-10-15, in the viewer's own time zone. */
export const isoDate = (d: Date): string =>
  `${d.getFullYear()}-${twoDigits(d.getMonth() + 1)}-${twoDigits(d.getDate())}`;

/** Today, like 2026-10-15. */
export const today = (now: Date = new Date()): string => isoDate(now);

/** The day as a date at midnight where the viewer is, or undefined if it isn't a real day like 2026-10-15. */
export function fromIsoDate(text: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((text || '').trim());
  if (!m) return undefined;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  // 2026-02-31 would roll over into March; that isn't a real day.
  return isoDate(d) === m[0] ? d : undefined;
}

export const isIsoDate = (text: string): boolean => !!fromIsoDate(text);

/** "Thu 15 Oct 2026", or empty if it isn't a real day. */
export function dayText(text: string): string {
  const d = fromIsoDate(text);
  return d ? `${DAYS[d.getDay()]} ${dateText(d)}` : '';
}
