import type { IProductDraft, IStockLine } from './products';
import type { IOption } from './types';
import {
  Combo, MAX_VARIANTS, allCombos, checkOptions, comboJson, parseCombo, sameCombo, tidyOptions, variantLabel
} from './variants';
import { optionsFrom, ownPriceFrom, photosFrom, stockLeft } from './shopText';
import { cents } from './orderText';
import { num } from './rowValues';

/*
 * The product form's rules, kept apart from SharePoint so they can be tested:
 * reading a product back for editing, keeping the stock numbers in step as the
 * options change, keeping photos in the order the owner sets, checking what was
 * typed, and working out which stock rows to change, add or take away when it
 * is saved.
 */

/* What REST hands back is trusted no further than this. */
export type Row = Record<string, unknown>;

/* Text as typed, spaces and all: the form shows it the way it was saved. */
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

const sameText = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();

const isEmpty = (combo: Combo): boolean => !Object.keys(combo).length;

/**
 * The same combination of exactly these options. A line left over from an
 * option since taken away has one value too many, so it doesn't count.
 */
export const fits = (options: IOption[], a: Combo, b: Combo): boolean =>
  Object.keys(a).length === options.length && Object.keys(b).length === options.length && sameCombo(options, a, b);

/* ------------------------------------------------------- the stock list */

/** A row as the stock list has it now. */
export interface IStockRow extends IStockLine {
  stockId: number;
}

export function stockRowFrom(r: Row): IStockRow {
  // An empty price means "the usual price", so it must not be read as 0 (free).
  const own = ownPriceFrom(r.VariantPrice);
  const row: IStockRow = {
    stockId: num(r.Id),
    label: str(r.Title).trim(),
    combo: parseCombo(str(r.Combination) || undefined),
    inStock: stockLeft(num(r.InStock))
  };
  if (own !== undefined) row.ownPrice = own;
  return row;
}

/*
 * Pairs each combination with its stock row: first the row the form says it
 * came from, then the row saved with that combination, then one titled with its
 * label (a row added or renamed by hand, or one from before an option was
 * renamed). A product that comes one way only takes its only row whatever it's
 * called, as the shop does. Each row is used once.
 */
function pairRows<T extends IStockLine>(
  options: IOption[], combos: Combo[], rows: T[], stockIds: Array<number | undefined> = []
): Array<T | undefined> {
  const taken: T[] = [];
  const paired: Array<T | undefined> = combos.map(() => undefined);
  const pass = (pick: (combo: Combo, i: number, free: T[]) => T | undefined): void => {
    combos.forEach((combo, i) => {
      if (paired[i]) return;
      const row = pick(combo, i, rows.filter(r => taken.indexOf(r) < 0));
      if (row) {
        paired[i] = row;
        taken.push(row);
      }
    });
  };
  pass((combo, i, free) => (stockIds[i] === undefined ? undefined : free.filter(r => r.stockId === stockIds[i])[0]));
  pass((combo, i, free) => free.filter(r => !isEmpty(r.combo) && fits(options, r.combo, combo))[0]);
  pass((combo, i, free) => free.filter(r => sameText(r.label, variantLabel(options, combo)))[0]);
  if (!options.length) pass((combo, i, free) => (rows.length === 1 ? free[0] : undefined));
  return paired;
}

/** One line per combination of the options, each with the numbers from its stock row. */
export function linesFor(options: IOption[], rows: IStockRow[]): IStockLine[] {
  const combos = allCombos(options);
  const paired = pairRows(options, combos, rows);
  return combos.map((combo, i): IStockLine => {
    const row = paired[i];
    const line: IStockLine = { label: variantLabel(options, combo), combo, inStock: row ? row.inStock : 0 };
    if (row) {
      line.stockId = row.stockId;
      line.wasInStock = row.inStock;
      if (row.ownPrice !== undefined) line.ownPrice = row.ownPrice;
    }
    return line;
  });
}

/** A product row and its stock rows, as the form edits them. */
export function draftFromRows(row: Row, stock: IStockRow[], origin: string): IProductDraft {
  const options = optionsFrom(row.VariantOptions, origin);
  return {
    id: num(row.Id),
    name: str(row.Title),
    productCode: str(row.ProductCode),
    shortDescription: str(row.ShortDescription),
    longDescription: str(row.LongDescription),
    details: str(row.Details),
    price: Math.max(0, num(row.Price)),
    searchWords: str(row.SearchWords),
    showInStore: row.ShowInStore !== false,
    // A product saved before it could have several photos has none listed: its Photo is its one photo.
    photos: photosFrom(row.Photos, row.Photo, origin),
    options,
    stock: linesFor(options, stock)
  };
}

/** A stock row to write. inStock undefined means leave the number the list has. */
export interface IStockWrite {
  stockId?: number;
  label: string;
  combo: Combo;
  inStock?: number;
  ownPrice?: number;
}

export interface IStockPlan {
  update: Array<IStockWrite & { stockId: number }>;
  add: IStockWrite[];
  /** Rows for combinations that no longer exist. */
  remove: number[];
}

/**
 * What to do to the stock list so a product has one row per combination of its
 * (tidied) options and nothing else. A row that is already right is left alone,
 * and so is a number nobody changed in the form — the list may have moved on
 * since the form opened, because checkout takes items off as orders come in.
 */
export function planStock(options: IOption[], rows: IStockRow[], lines: IStockLine[]): IStockPlan {
  const combos = allCombos(options);
  const wanted = combos.map(combo => lines.filter(l => fits(options, l.combo, combo))[0]);
  const paired = pairRows(options, combos, rows, wanted.map(l => (l ? l.stockId : undefined)));
  const plan: IStockPlan = { update: [], add: [], remove: [] };

  combos.forEach((combo, i) => {
    const line = wanted[i];
    const row = paired[i];
    const label = variantLabel(options, combo);
    const inStock = line ? line.inStock : 0;
    // A product that comes one way only has just the one price.
    const ownPrice = line && options.length ? line.ownPrice : undefined;
    if (!row) {
      plan.add.push({ label, combo, inStock, ownPrice });
      return;
    }
    const untouched = !!line && line.wasInStock !== undefined && line.inStock === line.wasInStock;
    const changed = row.label !== label || comboJson(row.combo) !== comboJson(combo) ||
      row.ownPrice !== ownPrice || (!untouched && row.inStock !== inStock);
    if (changed) {
      plan.update.push({ stockId: row.stockId, label, combo, inStock: untouched ? undefined : inStock, ownPrice });
    }
  });

  plan.remove = rows.filter(r => paired.indexOf(r) < 0).map(r => r.stockId);
  return plan;
}

/* --------------------------------------------------------------- photos */

/** A photo as the form holds it: one already saved, or one just chosen and waiting for Save. */
export interface IFormPhoto {
  /** Stays the same as photos move about: for React, and to find a new photo's file. */
  key: string;
  /** Its full address, once saved. Undefined for a new one. */
  url?: string;
}

/** A new photo that has gone up, and its place in the list as the form had it. */
export interface IPlacedPhoto {
  at: number;
  url: string;
}

/** A new photo waiting in the form: where it goes in its list, and which choice it is for, if any. */
export interface IPhotoToUpload {
  key: string;
  at: number;
  /** The choice, by where it sits in the options as typed. Both undefined for the product's own photos. */
  option?: number;
  value?: number;
}

const savedPhotos = (urls: string[] | undefined, newKey: () => string): IFormPhoto[] =>
  (urls || []).map(url => ({ key: newKey(), url }));

/* The addresses of the photos already saved, in the order the form has them. */
const keptUrls = (photos: IFormPhoto[]): string[] =>
  photos.filter(p => !!p.url).map(p => p.url as string);

/**
 * A saved list with the new photos slotted in at the places they had in the
 * form, so the order the owner set comes back. One that didn't go up leaves no gap.
 */
export function placePhotos(kept: string[], placed: IPlacedPhoto[]): string[] {
  const out = kept.slice();
  placed.slice().sort((a, b) => a.at - b.at)
    .forEach(p => out.splice(Math.max(0, Math.min(p.at, out.length)), 0, p.url));
  return out;
}

/** The list with one photo moved to another place. A place that isn't there changes nothing. */
export function movePhoto<T>(photos: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= photos.length || to >= photos.length) return photos;
  const out = photos.slice();
  out.splice(to, 0, out.splice(from, 1)[0]);
  return out;
}

/** The photo given moved to the front, where it is the cover. The others keep their order. */
export function makeCover<T>(photos: T[], index: number): T[] {
  return movePhoto(photos, index, 0);
}

/** The list without one photo. Only the list changes: a saved file stays where it is in Site Assets. */
export const withoutPhoto = (photos: IFormPhoto[], key: string): IFormPhoto[] => photos.filter(p => p.key !== key);

/* ------------------------------------------------------------- the form */

/** A choice as the form holds it. */
export interface IFormValue {
  /** Stays the same through renames: for React. */
  key: string;
  value: string;
  /** Its photos, in order: saved ones and new ones mixed. */
  photos: IFormPhoto[];
}

export interface IFormOption {
  key: string;
  name: string;
  values: IFormValue[];
}

/**
 * What was typed for one combination. Numbers are kept as typed until Save, so
 * a half-typed "1." is not fought over, and kept even when the combination goes
 * away, in case it comes back.
 */
export interface IFormLine {
  combo: Combo;
  inStock: string;
  /** Its own price, or empty for the usual price. */
  price: string;
  stockId?: number;
  wasInStock?: number;
}

export interface IProductForm {
  name: string;
  productCode: string;
  shortDescription: string;
  longDescription: string;
  details: string;
  searchWords: string;
  showInStore: boolean;
  price: string;
  /** The product's own photos, cover first: saved ones and new ones mixed. */
  photos: IFormPhoto[];
  options: IFormOption[];
  lines: IFormLine[];
}

export function formFromDraft(d: IProductDraft, newKey: () => string): IProductForm {
  return {
    name: d.name,
    productCode: d.productCode,
    shortDescription: d.shortDescription,
    longDescription: d.longDescription,
    details: d.details,
    searchWords: d.searchWords,
    showInStore: d.showInStore,
    price: String(d.price),
    photos: savedPhotos(d.photos, newKey),
    options: d.options.map(o => ({
      key: newKey(),
      name: o.name,
      values: o.values.map(v => ({ key: newKey(), value: v.value, photos: savedPhotos(v.photoUrls, newKey) }))
    })),
    lines: d.stock.map(l => ({
      combo: l.combo,
      inStock: String(l.inStock),
      price: l.ownPrice === undefined ? '' : String(l.ownPrice),
      stockId: l.stockId,
      wasInStock: l.wasInStock
    }))
  };
}

/** The options as typed, in the shape the variant rules take, with each choice's saved photos. */
export const typedOptions = (form: IProductForm): IOption[] =>
  form.options.map(o => ({
    name: o.name,
    values: o.values.map(v => {
      const photoUrls = keptUrls(v.photos);
      return photoUrls.length ? { value: v.value, photoUrls } : { value: v.value };
    })
  }));

/** Every new photo waiting in the form, product's first, each with its place and its choice. */
export function photosToUpload(form: IProductForm): IPhotoToUpload[] {
  const out: IPhotoToUpload[] = [];
  form.photos.forEach((p, at) => { if (!p.url) out.push({ key: p.key, at }); });
  form.options.forEach((o, option) => o.values.forEach((v, value) => v.photos.forEach((p, at) => {
    if (!p.url) out.push({ key: p.key, at, option, value });
  })));
  return out;
}

/**
 * The form with the new photos that a failed save did get up marked as saved,
 * so saving again doesn't upload them a second time.
 */
export function withUploaded(form: IProductForm, uploaded: Record<string, string>): IProductForm {
  const mark = (photos: IFormPhoto[]): IFormPhoto[] =>
    photos.map(p => (!p.url && uploaded[p.key] ? { key: p.key, url: uploaded[p.key] } : p));
  return {
    ...form,
    photos: mark(form.photos),
    options: form.options.map(o => ({ ...o, values: o.values.map(v => ({ ...v, photos: mark(v.photos) })) }))
  };
}

/** The options as they will be saved: trimmed, blanks and repeats dropped. */
export const savedOptions = (form: IProductForm): IOption[] => tidyOptions(typedOptions(form));

const lineOf = (lines: IFormLine[], options: IOption[], combo: Combo): IFormLine | undefined =>
  lines.filter(l => fits(options, l.combo, combo))[0];

/** One combination as the stock table shows it. */
export interface IFormRow {
  combo: Combo;
  label: string;
  inStock: string;
  price: string;
}

export interface IStockTable {
  /** The options as they will be saved. Empty for a product that comes one way only. */
  options: IOption[];
  rows: IFormRow[];
  /** How many combinations there would be, when that is too many to list. */
  tooMany?: number;
}

export function stockTable(form: IProductForm): IStockTable {
  const options = savedOptions(form);
  const count = options.reduce((n, o) => n * o.values.length, 1);
  if (count > MAX_VARIANTS) return { options, rows: [], tooMany: count };
  const rows = allCombos(options).map((combo): IFormRow => {
    const line = lineOf(form.lines, options, combo);
    return {
      combo,
      label: variantLabel(options, combo),
      inStock: line ? line.inStock : '0',
      price: line ? line.price : ''
    };
  });
  return { options, rows };
}

/** The lines with one combination's boxes changed. */
export function setLine(
  lines: IFormLine[], options: IOption[], combo: Combo, change: Partial<Pick<IFormLine, 'inStock' | 'price'>>
): IFormLine[] {
  let found = false;
  const next = lines.map(l => {
    if (found || !fits(options, l.combo, combo)) return l;
    found = true;
    return { ...l, ...change };
  });
  return found ? next : next.concat([{ combo, inStock: '0', price: '', ...change }]);
}

function renameKey(line: IFormLine, from: string, to: string): IFormLine {
  if (!Object.prototype.hasOwnProperty.call(line.combo, from)) return line;
  const combo: Combo = {};
  Object.keys(line.combo).forEach(k => { combo[k === from ? to : k] = line.combo[k]; });
  return { ...line, combo };
}

/**
 * Renames an option, carrying the numbers typed for its combinations across —
 * but only when no other option has the old or the new name, or that option's
 * numbers would move too.
 */
export function withOptionName(form: IProductForm, index: number, name: string): IProductForm {
  const was = form.options[index].name.trim();
  const now = name.trim();
  const others = form.options.filter((o, i) => i !== index);
  const carry = !!was && !!now && was !== now && !others.some(o => sameText(o.name, was) || sameText(o.name, now));
  return {
    ...form,
    options: form.options.map((o, i) => (i === index ? { ...o, name } : o)),
    lines: carry ? form.lines.map(l => renameKey(l, was, now)) : form.lines
  };
}

/** Renames a choice, carrying its numbers across, so fixing a typo doesn't lose them. */
export function withValue(form: IProductForm, optionIndex: number, valueIndex: number, value: string): IProductForm {
  const option = form.options[optionIndex];
  const name = option.name.trim();
  const was = option.values[valueIndex].value.trim();
  const now = value.trim();
  const others = option.values.filter((v, i) => i !== valueIndex);
  const shared = form.options.some((o, i) => i !== optionIndex && sameText(o.name, name));
  const carry = !!name && !!was && !!now && was !== now && !shared &&
    !others.some(v => sameText(v.value, was) || sameText(v.value, now));
  return {
    ...form,
    options: form.options.map((o, i) => (i !== optionIndex ? o : {
      ...o,
      values: o.values.map((v, j) => (j === valueIndex ? { ...v, value } : v))
    })),
    lines: carry
      ? form.lines.map(l => (l.combo[name] === was ? { ...l, combo: { ...l.combo, [name]: now } } : l))
      : form.lines
  };
}

/**
 * What was typed into a choice's box. Several separated by commas (or pasted
 * one per line) become several choices: the first stays in this box, the rest
 * go in new boxes straight after it.
 */
export function withTypedValue(
  form: IProductForm, optionIndex: number, valueIndex: number, text: string, newKey: () => string
): IProductForm {
  if (!/[,\n]/.test(text)) return withValue(form, optionIndex, valueIndex, text);
  const parts = text.split(/[,\r\n]+/).map(t => t.trim()).filter(Boolean);
  const first = withValue(form, optionIndex, valueIndex, parts[0] || '');
  const added = parts.slice(1).map((value): IFormValue => ({ key: newKey(), value, photos: [] }));
  return {
    ...first,
    options: first.options.map((o, i) => (i !== optionIndex ? o : {
      ...o,
      values: o.values.slice(0, valueIndex + 1).concat(added, o.values.slice(valueIndex + 1))
    }))
  };
}

/** A price as typed: a number, 0 or more, to the cent. Undefined when it isn't one. */
export function readPrice(text: string): number | undefined {
  const t = text.trim().replace(',', '.');
  if (!t) return undefined;
  const n = Number(t);
  return isFinite(n) && n >= 0 ? cents(n) : undefined;
}

/** A count as typed: a whole number, 0 or more. Undefined when it isn't one. */
export function readCount(text: string): number | undefined {
  const t = text.trim();
  return /^\d+$/.test(t) ? Number(t) : undefined;
}

/** How many there are across every combination, counting only what reads as a number. */
export const totalStock = (table: IStockTable): number =>
  table.rows.reduce((n, r) => n + (readCount(r.inStock) || 0), 0);

/** Some combination has a price of its own typed in, so the price boxes have to show. */
export const hasOwnPrices = (table: IStockTable): boolean => table.rows.some(r => r.price.trim() !== '');

/** The same stock number in every combination's box, for filling a big sheet in one go. */
export function withStockEverywhere(form: IProductForm, count: number): IProductForm {
  const options = savedOptions(form);
  let lines = form.lines;
  stockTable(form).rows.forEach(r => { lines = setLine(lines, options, r.combo, { inStock: String(count) }); });
  return { ...form, lines };
}

/** Every combination back on the usual price, so no price is saved without being seen. */
export const withoutPrices = (form: IProductForm): IProductForm =>
  ({ ...form, lines: form.lines.map(l => ({ ...l, price: '' })) });

/**
 * The stock boxes as typed, checked and ready to save — or what is wrong, in
 * plain words. Each line keeps the stock row it came from and the number that
 * row had, so a number nobody changed isn't written back over an order.
 */
export function stockFromForm(form: IProductForm): IStockLine[] | string {
  const table = stockTable(form);
  const stock: IStockLine[] = [];
  for (let i = 0; i < table.rows.length; i++) {
    const row = table.rows[i];
    const where = table.options.length ? ` for ${row.label}` : '';
    const inStock = readCount(row.inStock);
    if (inStock === undefined) return `In stock${where} has to be a whole number, 0 or more.`;
    const line: IStockLine = { label: row.label, combo: row.combo, inStock };
    if (table.options.length && row.price.trim()) {
      const own = readPrice(row.price);
      if (own === undefined) {
        return `The price${where} has to be a number, 0 or more — or leave it empty to use the usual price.`;
      }
      line.ownPrice = own;
    }
    const was = lineOf(form.lines, table.options, row.combo);
    if (was && was.stockId !== undefined) line.stockId = was.stockId;
    if (was && was.wasInStock !== undefined) line.wasInStock = was.wasInStock;
    stock.push(line);
  }
  return stock;
}

/**
 * What was typed, checked and ready to save — or what is wrong, in plain words.
 * Only photos already saved go in; new ones go up with the files (see
 * photosToUpload). The options go through as typed, so a photo waiting for a
 * choice can still find it by position; saving tidies them.
 */
export function draftFromForm(form: IProductForm, id: number | undefined): IProductDraft | string {
  if (!form.name.trim()) return 'Give the product a name.';
  const price = readPrice(form.price);
  if (price === undefined) return 'The price has to be a number, 0 or more.';
  const options = typedOptions(form);
  const problem = checkOptions(options);
  if (problem) return problem;

  const stock = stockFromForm(form);
  if (typeof stock === 'string') return stock;

  return {
    id,
    name: form.name.trim(),
    productCode: form.productCode,
    shortDescription: form.shortDescription,
    longDescription: form.longDescription,
    details: form.details,
    price,
    searchWords: form.searchWords,
    showInStore: form.showInStore,
    photos: keptUrls(form.photos),
    options,
    stock
  };
}
