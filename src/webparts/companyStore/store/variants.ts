import { IOption, IVariant, ONE_SIZE } from './types';

/*
 * The rules for variants, shared by the product form and the shop. Nothing in
 * here talks to SharePoint, so it can all be tested.
 *
 * A product has up to three options (Size, Colour, anything); every
 * combination of their values is a variant with its own stock line. The
 * stock line's title is the variant's label, like "White · M".
 */

export type Combo = Record<string, string>;

export const MAX_OPTIONS = 3;
export const MAX_VARIANTS = 100;
const SEPARATOR = ' · ';

export function variantLabel(options: IOption[], combo: Combo): string {
  if (!options.length) return ONE_SIZE;
  return options.map(o => combo[o.name] || '—').join(SEPARATOR);
}

/** Every combination of every option's values, in the order the options and values are listed. */
export function allCombos(options: IOption[]): Combo[] {
  return options.reduce<Combo[]>((sofar, o) => {
    const next: Combo[] = [];
    sofar.forEach(c => o.values.forEach(v => next.push({ ...c, [o.name]: v.value })));
    return next;
  }, [{}]);
}

export const sameCombo = (options: IOption[], a: Combo, b: Combo): boolean =>
  options.every(o => a[o.name] === b[o.name]);

/** The variants that fit what has been picked so far. An option not picked yet matches anything. */
export function matching<T extends { combo: Combo }>(variants: T[], picked: Partial<Combo>): T[] {
  return variants.filter(v => Object.keys(picked).every(k => !picked[k] || v.combo[k] === picked[k]));
}

export const stockWhere = (variants: IVariant[], picked: Partial<Combo>): number =>
  matching(variants, picked).reduce((n, v) => n + v.inStock, 0);

/** The one variant every option has been picked for, if all have. */
export function findVariant(options: IOption[], variants: IVariant[], picked: Partial<Combo>): IVariant | undefined {
  if (options.some(o => !picked[o.name])) return undefined;
  return variants.filter(v => sameCombo(options, v.combo, picked as Combo))[0];
}

/**
 * How many are left of a value, judged only against the options above it. If
 * every option judged every other, picking a size could cross out every
 * colour and leave nowhere to go.
 */
export function leftFor(
  options: IOption[], variants: IVariant[], picked: Partial<Combo>, optionIndex: number, value: string
): number {
  const above: Partial<Combo> = {};
  options.slice(0, optionIndex).forEach(o => { if (picked[o.name]) above[o.name] = picked[o.name]; });
  return stockWhere(variants, { ...above, [options[optionIndex].name]: value });
}

/**
 * After picking a value higher up, drop any lower pick that is now sold out,
 * so the page never sits on a combination that can't be bought.
 */
export function dropSoldOut(options: IOption[], variants: IVariant[], picked: Partial<Combo>): Partial<Combo> {
  const next: Partial<Combo> = { ...picked };
  options.forEach((o, i) => {
    const v = next[o.name];
    if (v && leftFor(options, variants, next, i, v) === 0) delete next[o.name];
  });
  return next;
}

export function priceRange(variants: IVariant[], fallback: number): { min: number; max: number } {
  if (!variants.length) return { min: fallback, max: fallback };
  const prices = variants.map(v => v.price);
  return { min: Math.min.apply(null, prices), max: Math.max.apply(null, prices) };
}

/* ------------------------------------------------------- stored as JSON */

/** The VariantOptions column. Anything unreadable counts as no options. */
export function parseOptions(json: string | undefined): IOption[] {
  if (!json) return [];
  try {
    const raw = JSON.parse(json);
    const list: unknown[] = Array.isArray(raw) ? raw : raw && Array.isArray(raw.options) ? raw.options : [];
    return tidyOptions(list.map((o): IOption => {
      const opt = (o || {}) as { name?: unknown; values?: unknown };
      const values = Array.isArray(opt.values) ? opt.values : [];
      return {
        name: String(opt.name || ''),
        values: values.map(v => {
          if (typeof v === 'string') return { value: v };
          const val = (v || {}) as { value?: unknown; photoUrl?: unknown; photoUrls?: unknown };
          // Options saved before choices could have several photos kept just one, as photoUrl.
          const photos = Array.isArray(val.photoUrls)
            ? val.photoUrls.filter((u): u is string => typeof u === 'string' && !!u)
            : typeof val.photoUrl === 'string' && val.photoUrl ? [val.photoUrl] : [];
          return photos.length ? { value: String(val.value || ''), photoUrls: photos } : { value: String(val.value || '') };
        })
      };
    }));
  } catch {
    return [];
  }
}

export const optionsJson = (options: IOption[]): string =>
  options.length ? JSON.stringify({ version: 1, options }) : '';

/** The Combination column on a stock line. */
export function parseCombo(json: string | undefined): Combo {
  if (!json) return {};
  try {
    const raw = JSON.parse(json);
    const combo: Combo = {};
    if (raw && typeof raw === 'object') {
      Object.keys(raw).forEach(k => { if (typeof raw[k] === 'string') combo[k] = raw[k]; });
    }
    return combo;
  } catch {
    return {};
  }
}

export const comboJson = (combo: Combo): string => (Object.keys(combo).length ? JSON.stringify(combo) : '');

/* ------------------------------------------------------------ the form */

const same = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

/** Trims everything, drops blanks and repeats (first one wins), keeps the order given. */
export function tidyOptions(options: IOption[]): IOption[] {
  const out: IOption[] = [];
  options.forEach(o => {
    const name = o.name.trim();
    if (!name || out.some(x => same(x.name, name))) return;
    const values: IOption['values'] = [];
    o.values.forEach(v => {
      const value = v.value.trim();
      if (value && !values.some(x => same(x.value, value))) values.push({ ...v, value });
    });
    if (values.length) out.push({ name, values });
  });
  return out;
}

/** What is wrong with a product's options, in plain words, or undefined if nothing. */
export function checkOptions(options: IOption[]): string | undefined {
  const named = options.filter(o => o.name.trim() || o.values.some(v => v.value.trim()));
  if (named.some(o => !o.name.trim())) return 'Give each option a name, like Size or Colour.';
  if (named.some(o => !o.values.some(v => v.value.trim()))) return 'Give each option at least one choice.';
  const tidy = tidyOptions(options);
  if (tidy.length < named.length) return 'Two options have the same name. Give each its own.';
  if (tidy.length > MAX_OPTIONS) return `A product can vary by up to ${MAX_OPTIONS} things.`;
  const count = allCombos(tidy).length;
  if (tidy.length && count > MAX_VARIANTS) {
    return `That makes ${count} combinations. Keep it to ${MAX_VARIANTS} or fewer.`;
  }
  return undefined;
}
