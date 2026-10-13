import * as React from 'react';
import { Icon, Spinner, SpinnerSize } from '@fluentui/react';
import styles from './Shop.module.scss';
import type { SPFI } from '../../sp';
import type { ListIds } from '../../setup/schema';
import type { ISiteInfo } from '../../setup/problems';
import type { IStoreSettings } from '../../store/settings';
import type { GetGraph } from '../../store/orderEmail';
import type { ICartLine, IPlacedOrder, IProduct } from '../../store/types';
import { loadCatalog } from '../../store/catalog';
import { itemCountText } from '../../store/ordersView';
import Checkout from '../checkout/Checkout';
import OrderPlaced from '../checkout/OrderPlaced';
import { useCart } from './useCart';
import ProductGrid from './ProductGrid';
import ProductPage from './ProductPage';
import CartPanel from './CartPanel';
import LoadFailed from '../LoadFailed';
import { useLoad } from '../useLoad';
import { scrollToTopIfPast } from '../scrollToTopIfPast';

export interface IShopProps {
  sp: SPFI;
  ids: ListIds;
  site: ISiteInfo;
  settings: IStoreSettings;
  getGraph: GetGraph;
  /** Site owners and store managers: they get hints on putting things right. */
  canRun: boolean;
  /** Opens My orders: the orders the person looking has placed. */
  onMyOrders: () => void;
  /** Site owners and store managers only: opens the product form for this product. Absent for staff. */
  onEditProduct?: (productId: number) => void;
}

type View =
  | { kind: 'grid'; returnTo?: number }
  | { kind: 'product'; id: number }
  | { kind: 'checkout' }
  | { kind: 'placed'; order: IPlacedOrder; emailSent: boolean };

/* What staff see: the products, one product, the cart, and on into checkout. */
const Shop: React.FC<IShopProps> = ({ sp, ids, site, settings, getGraph, canRun, onMyOrders, onEditProduct }) => {
  const cart = useCart(site);
  const { fit } = cart;
  const [view, setView] = React.useState<View>({ kind: 'grid' });
  const [query, setQuery] = React.useState('');
  const [cartOpen, setCartOpen] = React.useState(false);
  const [cartChanged, setCartChanged] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  const loadProducts = React.useCallback((): Promise<IProduct[]> => loadCatalog(sp, ids), [sp, ids]);
  // A cart kept from earlier may hold things that have since sold out or changed price.
  const loaded = React.useCallback((next: IProduct[]): void => { if (fit(next)) setCartChanged(true); }, [fit]);
  const { data: products, error: loadError, reload } = useLoad(loadProducts, loaded);

  /* Each screen starts at its top if the page had been scrolled past it. Coming
     back to the grid is the exception: focus goes back to the card instead. */
  const viewKey = view.kind === 'product' ? `product-${view.id}` : view.kind;
  React.useEffect(() => {
    const el = rootRef.current;
    if (!el || (view.kind === 'grid' && view.returnTo !== undefined)) return;
    scrollToTopIfPast(el);
  }, [viewKey]);

  const toGrid = (returnTo?: number): void => setView({ kind: 'grid', returnTo });

  const placed = (order: IPlacedOrder, emailSent: boolean): void => {
    // Off the checkout screen first, so it never sees its cart go empty under it.
    setView({ kind: 'placed', order, emailSent });
    cart.clear();
    setCartChanged(false);
    // Stock has just gone down.
    reload().catch(() => undefined);
  };

  const shopping = view.kind === 'grid' || view.kind === 'product';
  const product = view.kind === 'product' && products ? products.filter(p => p.id === view.id)[0] : undefined;
  const inCart = (id: number): ICartLine[] => cart.lines.filter(l => l.productId === id);

  // A product that has gone from the shop (taken out, or reloaded away) sends you back to the grid.
  React.useEffect(() => {
    if (view.kind === 'product' && products && !product) setView({ kind: 'grid' });
  }, [view, products, product]);

  return (
    <div className={styles.shop} ref={rootRef}>
      {shopping && (
        <div className={styles.bar}>
          <div className={styles.search}>
            <Icon iconName="Search" className={styles.searchMark} aria-hidden="true" />
            <input
              type="search" placeholder="Search the store" aria-label="Search the store" value={query}
              onChange={e => {
                setQuery(e.target.value);
                if (view.kind === 'product') toGrid();
              }}
            />
          </div>
          <div className={styles.barButtons}>
            <button type="button" className={styles.ordersButton} onClick={onMyOrders}>
              <Icon iconName="Package" className={styles.buttonIcon} aria-hidden="true" />My orders
            </button>
            <button
              type="button" className={styles.cartButton} onClick={() => setCartOpen(true)}
              aria-label={`Cart, ${itemCountText(cart.count)}`}
            >
              Cart <span className={styles.count} aria-hidden="true">{cart.count}</span>
            </button>
          </div>
        </div>
      )}

      {shopping && loadError && (
        <LoadFailed
          lead="The shop could not load." error={loadError} onRetry={() => { reload().catch(() => undefined); }}
        />
      )}

      {shopping && cartChanged && (
        <div className={styles.note} role="status">
          <span>Your cart has been updated to match what&apos;s left in the store.</span>
          <button type="button" className={styles.linkButton} onClick={() => setCartChanged(false)}>OK</button>
        </div>
      )}

      {shopping && !products && !loadError && (
        <Spinner className={styles.loading} size={SpinnerSize.medium} label="Loading the shop…" />
      )}

      {view.kind === 'grid' && products && (
        <ProductGrid
          products={products}
          query={query}
          currency={settings.currency}
          canRun={canRun}
          returnTo={view.returnTo}
          onOpen={id => setView({ kind: 'product', id })}
          onClearSearch={() => setQuery('')}
        />
      )}

      {product && (
        <ProductPage
          key={product.id}
          product={product}
          currency={settings.currency}
          inCart={inCart(product.id)}
          onBack={() => toGrid(product.id)}
          onAdd={(variant, qty) => {
            cart.add(product, variant, qty);
            setCartOpen(true);
          }}
          onEdit={onEditProduct ? () => onEditProduct(product.id) : undefined}
        />
      )}

      {view.kind === 'checkout' && (
        <Checkout
          sp={sp}
          ids={ids}
          site={site}
          settings={settings}
          getGraph={getGraph}
          lines={cart.lines}
          onBack={() => toGrid()}
          onPlaced={placed}
        />
      )}

      {view.kind === 'placed' && (
        <OrderPlaced
          order={view.order}
          emailSent={view.emailSent}
          settings={settings}
          onBackToStore={() => toGrid()}
          onMyOrders={onMyOrders}
          buyer={site.user}
        />
      )}

      <CartPanel
        isOpen={cartOpen}
        lines={cart.lines}
        count={cart.count}
        total={cart.total}
        products={products}
        currency={settings.currency}
        onDismiss={() => setCartOpen(false)}
        onQty={cart.setQty}
        onRemove={cart.remove}
        onCheckout={() => {
          setCartOpen(false);
          setCartChanged(false);
          setView({ kind: 'checkout' });
        }}
      />
    </div>
  );
};

export default Shop;
