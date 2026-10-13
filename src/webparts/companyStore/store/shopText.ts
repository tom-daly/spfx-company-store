/*
 * The shop's small rules, kept apart from SharePoint so they can be tested:
 * turning list rows into products, searching, what the stock line says, the
 * words on the product page, and the cart sums. Nothing in here talks to the site.
 */
import { ICartLine, IOption, IProduct, IVariant, ONE_SIZE } from './types';
import { allCombos, parseCombo, parseOptions, priceRange, sameCombo, variantLabel } from './variants';
import { coverFor, parsePhotos } from './gallery';
import { Currency, formatMoney } from './settings';
import { inWords } from './orderText';
import { maybeNum, num, text, textLines } from './rowValues';

/* ---------------------------------------------------------------- photos */

const isWebAddress = (s: string): boolean => /^https?:\/\//i.test(s);

function joinUrl(base: string, path: string): string {
  if (isWebAddress(path)) return path;
  return base.replace(/\/+$/, '') + (path.charAt(0) === '/' ? path : `/${path}`);
}

/**
 * The full address of a product photo, from what the Photo column holds: a
 * little JSON like {"serverUrl": "https://x.sharepoint.com", "serverRelativeUrl": "/sites/x/…"}.
 * serverUrl is sometimes left out, so origin (the site's own address) stands
 * in. Undefined when there is no photo or the value makes no sense.
 */
export function photoUrlFrom(value: unknown, origin: string): string | undefined {
  let v: unknown = value;
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return undefined;
    if (s.charAt(0) !== '{') {
      // A plain address, as a hyperlink column would hold it.
      return isWebAddress(s) || s.charAt(0) === '/' ? joinUrl(origin, s) : undefined;
    }
    try {
      v = JSON.parse(s);
    } catch {
      return undefined;
    }
  }
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;

  const path = text(o.serverRelativeUrl);
  if (path) {
    const server = text(o.serverUrl);
    return joinUrl(isWebAddress(server) ? server : origin, path);
  }
  const url = text(o.Url) || text(o.url);
  return url && (isWebAddress(url) || url.charAt(0) === '/') ? joinUrl(origin, url) : undefined;
}

/* --------------------------------------------------------------- details */

/** The Details column, one entry per line, blank lines dropped. */
export const detailLines = (value: unknown): string[] => textLines(value);

export interface IDetail {
  /** "Fabric" in "Fabric: organic cotton". Missing when the line has no label. */
  label?: string;
  value: string;
}

/** Splits a details line on its first colon. A line without one is shown whole. */
export function splitDetail(line: string): IDetail {
  const at = line.indexOf(':');
  if (at > 0) {
    const label = line.slice(0, at).trim();
    const value = line.slice(at + 1).trim();
    // "See https://…" is a sentence with an address in it, not a label.
    if (label && value && value.indexOf('//') !== 0) return { label, value };
  }
  return { value: line.trim() };
}

/** The Search words column: separated by commas (semicolons and new lines work too). */
export const searchWordsFrom = (value: unknown): string[] =>
  text(value).split(/[,;\r\n]+/).map(w => w.trim()).filter(w => w.length > 0);

/* ---------------------------------------------------------------- search */

export type Searchable = Pick<IProduct, 'name' | 'shortDescription' | 'productCode' | 'searchWords'>;

/**
 * Whether something turns up for what was typed: each word typed has to appear
 * somewhere in the parts given, whatever the capitals. A blank search finds everything.
 */
export function matchesWords(parts: string[], query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  if (!words.length) return true;
  // Joined with line breaks so a word can't be made from the end of one part and the start of the next.
  const joined = parts.join('\n').toLowerCase();
  return words.every(w => joined.indexOf(w) >= 0);
}

/**
 * Whether a product turns up for what was typed. Each word typed has to appear
 * somewhere in the name, short description, product code or search words, so
 * "blue cap" finds a cap described as blue. A blank search finds everything.
 */
export function matchesSearch(p: Searchable, query: string): boolean {
  return matchesWords([p.name, p.shortDescription, p.productCode].concat(p.searchWords), query);
}

/* ----------------------------------------------------------------- stock */

export type StockLevel = 'out' | 'low' | 'good';

/** At or below this, the shop warns that stock is running low. */
export const LOW_STOCK = 10;

/** How many can still be bought. No stock line, or a negative number, means none. */
export const stockLeft = (inStock: number | undefined): number =>
  typeof inStock === 'number' && inStock > 0 ? Math.floor(inStock) : 0;

export interface IStockLabel {
  text: string;
  level: StockLevel;
}

export function stockLabel(inStock: number | undefined): IStockLabel {
  const n = stockLeft(inStock);
  if (n === 0) return { text: 'Out of stock', level: 'out' };
  if (n <= LOW_STOCK) return { text: `${n} left`, level: 'low' };
  return { text: `${n} in stock`, level: 'good' };
}

/* -------------------------------------------------------- rows to products */

/** A row from the products list, as REST returns it. Anything can be blank. */
/** The product columns the shop and the product form read. */
export const PRODUCT_FIELDS = ['Id', 'Title', 'ProductCode', 'ShortDescription', 'LongDescription', 'Details', 'Price',
  'Photo', 'Photos', 'SearchWords', 'ShowInStore', 'VariantOptions'];

export interface IProductRow {
  Id: number;
  Title?: unknown;
  ProductCode?: unknown;
  ShortDescription?: unknown;
  LongDescription?: unknown;
  Details?: unknown;
  Price?: unknown;
  /** The cover, for the list. */
  Photo?: unknown;
  /** Every photo, cover first, as JSON. Blank for products saved before there could be more than one. */
  Photos?: unknown;
  SearchWords?: unknown;
  ShowInStore?: unknown;
  /** What it varies by, as JSON. Blank for a product that comes one way only. */
  VariantOptions?: unknown;
}

/** A row from the stock list, one per variant. StoreProductId is the product it belongs to. */
export interface IStockRow {
  Id?: unknown;
  /** The variant's label, like "White · M" or "One size". */
  Title?: unknown;
  StoreProductId?: unknown;
  InStock?: unknown;
  /** Empty when the variant costs what the product does. */
  VariantPrice?: unknown;
  /** Which value of each option the line is for, as JSON. */
  Combination?: unknown;
}

const isOneSize = (variant: unknown): boolean => text(variant).toLowerCase() === ONE_SIZE.toLowerCase();

/**
 * A stock line's own price, or undefined when it has none. An empty price
 * means "the product's price", so it must not be read as 0 (free).
 */
export function ownPriceFrom(v: unknown): number | undefined {
  const n = maybeNum(v);
  return n !== undefined && n >= 0 ? n : undefined;
}

const stockIdOf = (row: IStockRow | undefined): number | undefined => {
  const id = row ? num(row.Id) : 0;
  return id > 0 ? id : undefined;
};

const stockOf = (row: IStockRow | undefined): number => (row ? stockLeft(num(row.InStock)) : 0);

/* Each address made full, and any that make no sense dropped. */
const fullAddresses = (urls: string[], origin: string): string[] =>
  urls.map(u => photoUrlFrom(u, origin)).filter((u): u is string => !!u);

/** The options as the product form saved them, with each value's photos made full addresses. */
export function optionsFrom(value: unknown, origin: string): IOption[] {
  return parseOptions(text(value) || undefined).map(o => ({
    name: o.name,
    values: o.values.map(v => {
      const photos = fullAddresses(v.photoUrls || [], origin);
      return photos.length ? { value: v.value, photoUrls: photos } : { value: v.value };
    })
  }));
}

/**
 * Every photo of a product, cover first, from its Photos and Photo columns.
 * One saved before it could have several has just the Photo column.
 */
export const photosFrom = (photos: unknown, photo: unknown, origin: string): string[] =>
  fullAddresses(parsePhotos(text(photos) || undefined, photoUrlFrom(photo, origin)), origin);

/*
 * One variant per combination of the options, each joined to its stock line:
 * by the combination the line was saved with, or failing that by its title, in
 * case a line was added or renamed by hand. A combination with no line has
 * none left. A product with no options gets one "One size" variant.
 */
function variantsFrom(options: IOption[], rows: IStockRow[], price: number): IVariant[] {
  if (!options.length) {
    // A product's only line is taken whatever it's called, so one set up by hand still sells.
    const row = rows.filter(r => isOneSize(r.Title))[0] || (rows.length === 1 ? rows[0] : undefined);
    return [{ stockId: stockIdOf(row), label: ONE_SIZE, combo: {}, inStock: stockOf(row), price }];
  }
  const lines = rows.map(r => ({ row: r, combo: parseCombo(text(r.Combination) || undefined), title: text(r.Title) }));
  return allCombos(options).map((combo): IVariant => {
    const label = variantLabel(options, combo);
    const hit = lines.filter(l => sameCombo(options, l.combo, combo))[0] || lines.filter(l => l.title === label)[0];
    const row = hit ? hit.row : undefined;
    const own = row ? ownPriceFrom(row.VariantPrice) : undefined;
    const v: IVariant = {
      stockId: stockIdOf(row), label, combo, inStock: stockOf(row), price: own === undefined ? price : own
    };
    if (own !== undefined) v.ownPrice = own;
    return v;
  });
}

/**
 * The products the shop shows: active ones only, each with its variants and
 * how many are left across them all, sorted by name. A product with no stock
 * lines at all is left with inStock undefined, which the shop treats as none left.
 * The owners' Products page asks for the switched-off ones too (includeInactive).
 */
export function catalogFromRows(
  rows: IProductRow[], stock: IStockRow[], origin: string, includeInactive: boolean = false
): IProduct[] {
  const linesOf: { [productId: string]: IStockRow[] } = {};
  stock.forEach(s => {
    const productId = num(s.StoreProductId);
    if (productId <= 0) return;
    const key = String(productId);
    if (!Object.prototype.hasOwnProperty.call(linesOf, key)) linesOf[key] = [];
    linesOf[key].push(s);
  });

  return rows
    .filter(r => includeInactive || r.ShowInStore === true)
    .map((r): IProduct => {
      const key = String(r.Id);
      const lines = Object.prototype.hasOwnProperty.call(linesOf, key) ? linesOf[key] : [];
      const price = Math.max(0, num(r.Price));
      const options = optionsFrom(r.VariantOptions, origin);
      const variants = variantsFrom(options, lines, price);
      const photos = photosFrom(r.Photos, r.Photo, origin);
      return {
        id: r.Id,
        name: text(r.Title) || 'Untitled product',
        productCode: text(r.ProductCode),
        shortDescription: text(r.ShortDescription),
        longDescription: text(r.LongDescription),
        details: detailLines(r.Details),
        price,
        photoUrl: photos[0],
        photos,
        searchWords: searchWordsFrom(r.SearchWords),
        active: r.ShowInStore === true,
        inStock: lines.length ? variants.reduce((n, v) => n + v.inStock, 0) : undefined,
        options,
        variants
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) || a.id - b.id);
}

/* ---------------------------------------------------------- product page */

/** What a product costs: its price, or where the prices start when its variants differ. */
export function priceText(p: Pick<IProduct, 'price' | 'variants'>, currency: Currency): string {
  const range = priceRange(p.variants, p.price);
  if (range.min === range.max) return formatMoney(range.min, currency);
  // "From Free" would read oddly.
  return range.min === 0 ? `Free to ${formatMoney(range.max, currency)}` : `From ${formatMoney(range.min, currency)}`;
}

/** "Choose size and colour": the options not picked yet, in the order they are listed. */
export function chooseText(names: string[]): string {
  const words = names.map(n => n.toLowerCase());
  return words[words.length - 1] ? `Choose ${inWords(words)}` : 'Choose an option';
}

/**
 * The small line under the option pickers. variant is undefined until every
 * option is picked. Nothing for a product with no options.
 */
export function pickNote(options: IOption[], variant: IVariant | undefined): string | undefined {
  if (!options.length) return undefined;
  if (!variant) return 'Crossed out means none left';
  const n = stockLeft(variant.inStock);
  return n === 0 ? 'That combination is out of stock' : `${n} left in ${variant.label}`;
}

export interface IAddState {
  /** How many are left across every variant. */
  totalLeft: number;
  /** The options not picked yet. */
  missing: string[];
  /** How many are left of the picked variant. */
  left: number;
  /** How many of the picked variant are already in the cart. */
  inCart: number;
}

/** What the Add to cart button says. */
export function addButtonText(s: IAddState): string {
  if (s.totalLeft === 0) return 'Out of stock';
  if (s.missing.length) return chooseText(s.missing);
  if (s.left === 0) return 'Out of stock';
  if (s.left > s.inCart) return 'Add to cart';
  return s.left === 1 ? 'The last one is in your cart' : `All ${s.left} are in your cart`;
}

/* ------------------------------------------------------------------ cart */

const sameLine = (l: ICartLine, productId: number, variant: string): boolean =>
  l.productId === productId && l.variant === variant;

/** The variant a cart line is for, in the shop as loaded. Undefined when it has gone. */
export function lineVariant(products: IProduct[], line: ICartLine): IVariant | undefined {
  const p = products.filter(x => x.id === line.productId)[0];
  return p ? p.variants.filter(v => v.label === line.variant)[0] : undefined;
}

/**
 * Puts qty of one variant of a product in the cart. If it is already there the
 * quantity goes up instead, never past what is left of that variant. Nothing
 * changes when none are left.
 */
export function addToCart(lines: ICartLine[], p: IProduct, v: IVariant, qty: number): ICartLine[] {
  const hit = lines.filter(l => sameLine(l, p.id, v.label))[0];
  const want = Math.min(stockLeft(v.inStock), (hit ? hit.qty : 0) + Math.max(1, Math.floor(qty)));
  if (want <= 0) return lines;
  const line: ICartLine = {
    productId: p.id, name: p.name, price: v.price, photoUrl: coverFor(p, v.combo), variant: v.label, qty: want
  };
  return hit ? lines.map(l => (l === hit ? line : l)) : lines.concat([line]);
}

/** Changes how many of one line, kept between 1 and max. */
export function setCartQty(lines: ICartLine[], productId: number, variant: string, qty: number, max: number): ICartLine[] {
  const next = Math.max(1, Math.min(Math.floor(qty), max));
  return lines.map(l => (sameLine(l, productId, variant) ? { ...l, qty: next } : l));
}

export const removeFromCart = (lines: ICartLine[], productId: number, variant: string): ICartLine[] =>
  lines.filter(l => !sameLine(l, productId, variant));

export interface IFittedCart {
  lines: ICartLine[];
  /** Something was taken out, cut down or repriced, so the buyer should be told. */
  changed: boolean;
}

/**
 * Brings a cart kept from earlier in line with the shop as it is now, variant
 * by variant. Things no longer in the shop, variants it no longer has, and
 * anything sold out come out; quantities come down to what is left of that
 * variant; names, prices and photos are brought up to date.
 */
export function fitCart(lines: ICartLine[], products: IProduct[]): IFittedCart {
  let changed = false;
  const out: ICartLine[] = [];
  lines.forEach(l => {
    const p = products.filter(x => x.id === l.productId)[0];
    const v = lineVariant(products, l);
    const left = v ? stockLeft(v.inStock) : 0;
    if (!p || !v || left === 0) {
      changed = true;
      return;
    }
    const qty = Math.min(l.qty, left);
    if (qty !== l.qty || v.price !== l.price) changed = true;
    out.push({ ...l, name: p.name, price: v.price, photoUrl: coverFor(p, v.combo), qty });
  });
  return { lines: out, changed };
}

/**
 * A cart read back from the browser. Anything that isn't a sensible cart line
 * is dropped rather than trusted, so an old or damaged copy can't break the shop.
 */
export function cartFromStorage(saved: string | undefined): ICartLine[] {
  if (!saved) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(saved);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: ICartLine[] = [];
  parsed.forEach((x: unknown) => {
    if (!x || typeof x !== 'object') return;
    const o = x as Record<string, unknown>;
    const productId = o.productId, qty = o.qty, price = o.price;
    if (typeof productId !== 'number' || productId <= 0) return;
    if (typeof qty !== 'number' || !isFinite(qty) || qty < 1) return;
    if (typeof price !== 'number' || !isFinite(price) || price < 0) return;
    if (typeof o.name !== 'string') return;
    out.push({
      productId,
      name: o.name,
      price,
      qty: Math.floor(qty),
      photoUrl: typeof o.photoUrl === 'string' && o.photoUrl ? o.photoUrl : undefined,
      variant: typeof o.variant === 'string' && o.variant ? o.variant : ONE_SIZE
    });
  });
  return out;
}
