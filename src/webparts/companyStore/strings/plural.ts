/*
 * Counting words: "1 item", "3 items". Both forms are written out, so every
 * word sits with the other wording and nothing guesses at English spelling.
 */
export interface IPlural {
  /** For exactly 1, like "item". */
  one: string;
  /** For any other number, 0 included, like "items". */
  other: string;
}

/** The right form for the number: plural(3, ITEMS) is "items". */
export const plural = (n: number, forms: IPlural): string => (n === 1 ? forms.one : forms.other);

/** The number and its word: countText(3, ITEMS) is "3 items". */
export const countText = (n: number, forms: IPlural): string => `${n} ${plural(n, forms)}`;
