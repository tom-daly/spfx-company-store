import type { IOption, IProduct } from './types';
import { StockLevel, matchesSearch, stockLabel, stockLeft } from './shopText';
import { countText } from './orderText';

/*
 * The owners' Products & stock page, kept apart from SharePoint so it can be
 * tested: which products each quick filter shows, the summary line, and the
 * short words in each row of the table.
 */

/** The quick filters over the table. */
export type ProductFilter = 'all' | 'low' | 'out' | 'off';

/** How a product's stock looks at a glance, across every combination. No stock rows counts as none. */
export const stockLevel = (p: Pick<IProduct, 'inStock'>): StockLevel => stockLabel(p.inStock).level;

/** How many are left across every combination. */
export const totalLeft = (p: Pick<IProduct, 'inStock'>): number => stockLeft(p.inStock);

export function inFilter(p: IProduct, filter: ProductFilter): boolean {
  if (filter === 'low') return stockLevel(p) === 'low';
  if (filter === 'out') return stockLevel(p) === 'out';
  if (filter === 'off') return !p.active;
  return true;
}

/** The products a search and a quick filter leave, in the order given. */
export const filterProducts = (products: IProduct[], query: string, filter: ProductFilter): IProduct[] =>
  products.filter(p => inFilter(p, filter) && matchesSearch(p, query));

export type FilterCounts = Record<ProductFilter, number>;

/** How many products each quick filter would show. */
export function filterCounts(products: IProduct[]): FilterCounts {
  const count = (filter: ProductFilter): number => products.filter(p => inFilter(p, filter)).length;
  return { all: products.length, low: count('low'), out: count('out'), off: count('off') };
}

/** "12 products · 3 running low · 2 out of stock · 1 off". Anything there's none of is left out. */
export function summaryText(products: IProduct[]): string {
  const c = filterCounts(products);
  const parts = [countText(c.all, 'product')];
  if (c.low) parts.push(`${c.low} running low`);
  if (c.out) parts.push(`${c.out} out of stock`);
  if (c.off) parts.push(`${c.off} off`);
  return parts.join(' · ');
}

/** What a product varies by, with how many choices each has: "Colour (2), Size (6)". A dash for nothing. */
export const variesText = (options: IOption[]): string =>
  options.length ? options.map(o => `${o.name} (${o.values.length})`).join(', ') : '—';

/**
 * The small line under the stock number: "12 combinations, 3 out". Nothing for
 * a product that comes one way only, where the number says it all.
 */
export function combinationsText(p: Pick<IProduct, 'options' | 'variants'>): string | undefined {
  if (!p.options.length) return undefined;
  const all = p.variants.length;
  const out = p.variants.filter(v => stockLeft(v.inStock) === 0).length;
  const text = countText(all, 'combination');
  // Every one out shows as 0 already.
  return out > 0 && out < all ? `${text}, ${out} out` : text;
}

/** What the table says when a search or a quick filter leaves nothing to show. */
export function nothingText(query: string, filter: ProductFilter): string {
  if (query.trim()) return 'Nothing matches that search.';
  if (filter === 'low') return 'Nothing is running low.';
  if (filter === 'out') return 'Nothing is out of stock.';
  if (filter === 'off') return 'Every product is in the shop.';
  return 'There are no products yet.';
}
