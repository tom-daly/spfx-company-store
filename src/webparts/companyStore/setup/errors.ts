/*
 * PnPjs throws an HttpRequestError carrying the HTTP status, with SharePoint's
 * own explanation tucked into the message after "::>". Read both without
 * importing the class, so this file stays free of PnP and easy to test.
 */

const statusOf = (e: unknown): number | undefined =>
  e && typeof e === 'object' && typeof (e as { status?: unknown }).status === 'number'
    ? (e as { status: number }).status
    : undefined;

export const isDenied = (e: unknown): boolean => {
  const s = statusOf(e);
  return s === 401 || s === 403;
};

/** SharePoint refused a write because someone else saved the row first (412). */
export const isConflict = (e: unknown): boolean => statusOf(e) === 412;

/** SharePoint's own sentence for what went wrong, when there is one. */
export function explain(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e);
  const at = message.indexOf('::>');
  if (at > -1) {
    try {
      const body = JSON.parse(message.slice(at + 3).trim());
      const said = body?.['odata.error']?.message?.value || body?.error?.message?.value;
      if (said) return said;
    } catch {
      // not JSON — fall through to the raw message
    }
  }
  return message;
}
