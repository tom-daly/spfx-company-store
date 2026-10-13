import type { SPFI } from '../sp';
import type { ListIds } from '../setup/schema';
import type { IProduct } from './types';
import { IProductRow, IStockRow, PRODUCT_FIELDS, catalogFromRows } from './shopText';
import { listOf } from './lists';

const STOCK_FIELDS = ['Id', 'Title', 'StoreProductId', 'InStock', 'VariantPrice', 'Combination'];

export interface ICatalogOptions {
  /** The switched-off products too, for the owners' Products page. The shop never shows them. */
  includeInactive?: boolean;
}

/**
 * Everything the shop shows: the active products, each with its variants and
 * how many of each are left, sorted by name. Reads both lists in full each
 * time, so stock is as fresh as the moment the shop opened (or the last order went in).
 */
export async function loadCatalog(sp: SPFI, ids: ListIds, options: ICatalogOptions = {}): Promise<IProduct[]> {
  const [rows, stock] = await Promise.all([
    listOf(sp, ids, 'products').items.select(...PRODUCT_FIELDS).top(5000)(),
    listOf(sp, ids, 'stock').items.select(...STOCK_FIELDS).top(5000)()
  ]);
  return catalogFromRows(rows as IProductRow[], stock as IStockRow[], window.location.origin, !!options.includeInactive);
}

/**
 * One product as the Products page shows it, switched off or not, read again
 * after its stock or its Active switch changed. Undefined when it has gone.
 */
export async function loadCatalogProduct(sp: SPFI, ids: ListIds, productId: number): Promise<IProduct | undefined> {
  const [rows, stock] = await Promise.all([
    listOf(sp, ids, 'products').items.filter(`Id eq ${productId}`).select(...PRODUCT_FIELDS)(),
    listOf(sp, ids, 'stock').items
      .filter(`StoreProductId eq ${productId}`).select(...STOCK_FIELDS).top(5000)()
  ]);
  return catalogFromRows(rows as IProductRow[], stock as IStockRow[], window.location.origin, true)[0];
}
