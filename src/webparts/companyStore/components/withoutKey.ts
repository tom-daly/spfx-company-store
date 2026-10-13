/** The record without one entry, like one product's or one order's, by its ID. */
export function withoutKey<T>(record: Record<number, T>, id: number): Record<number, T> {
  const next = { ...record };
  delete next[id];
  return next;
}
