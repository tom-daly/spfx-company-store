import * as React from 'react';
import type { ISiteInfo } from '../../setup/problems';
import type { ICartLine, IProduct, IVariant } from '../../store/types';
import {
  addToCart, cartFromStorage, fitCart, removeFromCart, setCartQty
} from '../../store/shopText';
import { itemCount, orderTotal } from '../../store/orderText';

export interface ICart {
  lines: ICartLine[];
  /** How many things, counting each one. */
  count: number;
  total: number;
  /** Adds qty of one variant; more of a variant already in the cart raises its quantity. */
  add: (product: IProduct, variant: IVariant, qty: number) => void;
  /** max is how many are left of that line's variant. */
  setQty: (line: ICartLine, qty: number, max: number) => void;
  remove: (line: ICartLine) => void;
  clear: () => void;
  /**
   * Brings the cart in line with the shop as just loaded, variant by variant.
   * True when something had to change.
   */
  fit: (products: IProduct[]) => boolean;
}

/* One cart per site and per person, so two people sharing a browser don't share a cart. */
const storageKey = (site: ISiteInfo): string =>
  `companyStore.cart|${site.webUrl.toLowerCase()}|${(site.user.email || '').toLowerCase()}`;

/* Storage can be missing or locked down (private windows, strict settings).
   The cart works without it; it just won't survive a refresh. */
function readSaved(key: string): ICartLine[] {
  try {
    return cartFromStorage(window.sessionStorage.getItem(key) || undefined);
  } catch {
    return [];
  }
}

function save(key: string, lines: ICartLine[]): void {
  try {
    if (lines.length) window.sessionStorage.setItem(key, JSON.stringify(lines));
    else window.sessionStorage.removeItem(key);
  } catch {
    // See above: carry on without it.
  }
}

/** The cart, kept for the browser tab so a refresh doesn't empty it. */
export function useCart(site: ISiteInfo): ICart {
  const key = storageKey(site);
  const [lines, setLines] = React.useState<ICartLine[]>(() => readSaved(key));
  // The very latest lines, so two changes in a row build on each other.
  const latest = React.useRef<ICartLine[]>(lines);

  const update = React.useCallback((next: ICartLine[]): void => {
    latest.current = next;
    setLines(next);
    save(key, next);
  }, [key]);

  const add = React.useCallback((product: IProduct, variant: IVariant, qty: number): void => {
    update(addToCart(latest.current, product, variant, qty));
  }, [update]);

  const setQty = React.useCallback((line: ICartLine, qty: number, max: number): void => {
    update(setCartQty(latest.current, line.productId, line.variant, qty, max));
  }, [update]);

  const remove = React.useCallback((line: ICartLine): void => {
    update(removeFromCart(latest.current, line.productId, line.variant));
  }, [update]);

  const clear = React.useCallback((): void => update([]), [update]);

  const fit = React.useCallback((products: IProduct[]): boolean => {
    const fitted = fitCart(latest.current, products);
    update(fitted.lines);
    return fitted.changed;
  }, [update]);

  return React.useMemo((): ICart => ({
    lines,
    count: itemCount(lines),
    total: orderTotal(lines),
    add, setQty, remove, clear, fit
  }), [lines, add, setQty, remove, clear, fit]);
}
