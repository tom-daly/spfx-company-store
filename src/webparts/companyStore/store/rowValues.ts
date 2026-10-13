/*
 * Reading a list row's columns as REST hands them back. A column can hold
 * anything, or nothing, so what comes back is trusted no further than this.
 * Nothing in here talks to the site.
 */

/** The column's text, trimmed. Empty when it holds anything other than text. */
export const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** A number, or undefined when the column is empty or holds something else. */
export function maybeNum(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return isFinite(n) ? n : undefined;
}

/** A number, or 0 when the column is empty or holds something else. */
export function num(v: unknown): number {
  const n = maybeNum(v);
  return n === undefined ? 0 : n;
}

/** The column's text split into lines, each trimmed, blank ones dropped. */
export const textLines = (v: unknown): string[] =>
  text(v).split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
