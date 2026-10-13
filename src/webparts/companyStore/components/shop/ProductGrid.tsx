import * as React from 'react';
import { css } from '@fluentui/react';
import styles from './Shop.module.scss';
import type { IProduct } from '../../store/types';
import type { Currency } from '../../store/settings';
import { matchesSearch, priceText, stockLabel } from '../../store/shopText';
import { countText } from '../../store/orderText';
import Photo from './Photo';

export interface IProductGridProps {
  products: IProduct[];
  query: string;
  currency: Currency;
  /** Site owners and store managers: they get hints on putting things right. */
  canRun: boolean;
  /** The card to put focus back on, coming back from its product page. */
  returnTo?: number;
  onOpen: (id: number) => void;
  onClearSearch: () => void;
}

const ProductCard: React.FC<{ product: IProduct; currency: Currency; onOpen: (id: number) => void }> = (
  { product: p, currency, onOpen }
) => {
  const stock = stockLabel(p.inStock);
  return (
    <button type="button" className={styles.card} data-product={p.id} onClick={() => onOpen(p.id)}>
      <Photo url={p.photoUrl} alt="" className={styles.cardPhoto} />
      <span className={styles.cardBody}>
        <span className={styles.cardName}>{p.name}</span>
        {p.shortDescription && <span className={styles.cardDesc}>{p.shortDescription}</span>}
        <span className={styles.cardFoot}>
          <span className={styles.price}>{priceText(p, currency)}</span>
          <span className={css(
            styles.stock, stock.level === 'low' && styles.stockLow, stock.level === 'out' && styles.stockOut
          )}>
            {stock.text}
          </span>
        </span>
      </span>
    </button>
  );
};

const ProductGrid: React.FC<IProductGridProps> = (
  { products, query, currency, canRun, returnTo, onOpen, onClearSearch }
) => {
  const listRef = React.useRef<HTMLUListElement>(null);
  const found = React.useMemo(() => products.filter(p => matchesSearch(p, query)), [products, query]);
  const searching = query.trim().length > 0;

  // Only on arriving back at the grid, not every time the search changes.
  React.useEffect(() => {
    if (returnTo === undefined || !listRef.current) return;
    const card = listRef.current.querySelector(`[data-product="${returnTo}"]`) as HTMLElement | null;
    if (card) card.focus();
  }, []);

  if (!products.length) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyTitle}>There&apos;s nothing in the shop right now</span>
        {canRun
          ? 'Products show up here once they are Active. Turn that on in Products & stock.'
          : 'Check back soon.'}
      </div>
    );
  }

  return (
    <>
      <p className={styles.srOnly} aria-live="polite">
        {searching ? `${countText(found.length, 'product')} found` : ''}
      </p>
      {found.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyTitle}>Nothing matches that</span>
          Try a shorter search, or{' '}
          <button type="button" className={styles.linkButton} onClick={onClearSearch}>clear it</button>
          {' '}to see everything.
        </div>
      ) : (
        <ul className={styles.grid} ref={listRef} aria-label="Products">
          {found.map(p => (
            <li key={p.id}>
              <ProductCard product={p} currency={currency} onOpen={onOpen} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
};

export default ProductGrid;
