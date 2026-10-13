/*
 * An order's history: one line per change, oldest first, in the hidden
 * History column. Each line says when, who and what, so it still reads
 * sensibly if anyone opens the column in SharePoint:
 *
 *   2026-10-12T12:05:33Z | Thomas Daly | Status changed from New to Packed
 *
 * The time is kept in UTC so owners in different countries agree on it; the
 * page shows it in each owner's own time.
 */
import { textLines } from './rowValues';

export interface IHistoryEntry {
  /** When, as an ISO date in UTC. */
  when: string;
  who: string;
  what: string;
}

const SEP = ' | ';

/* A bar or a line break inside what was typed would split one entry into two. */
const tidy = (text: string): string => text.replace(/\s*\|\s*/g, ' / ').replace(/\s*[\r\n]+\s*/g, '; ').trim();

export function historyEntry(who: string, what: string, now: Date = new Date()): IHistoryEntry {
  return { when: now.toISOString(), who: tidy(who) || 'Someone', what: tidy(what) };
}

export const historyLine = (e: IHistoryEntry): string => [e.when, tidy(e.who), tidy(e.what)].join(SEP);

/** The History column, read back. A line that doesn't split three ways is kept whole as "what". */
export function parseHistory(text: string | undefined): IHistoryEntry[] {
  return textLines(text).map((line): IHistoryEntry => {
    const parts = line.split(SEP);
    if (parts.length < 3 || isNaN(Date.parse(parts[0]))) return { when: '', who: '', what: line };
    return { when: parts[0], who: parts[1], what: parts.slice(2).join(SEP) };
  });
}

/** The column with one more line on the end. */
export function appendHistory(text: string | undefined, entry: IHistoryEntry): string {
  const before = (text || '').replace(/\s+$/, '');
  return (before ? `${before}\n` : '') + historyLine(entry);
}
