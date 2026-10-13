import * as React from 'react';
import { Icon, Panel, PanelType, css } from '@fluentui/react';
import styles from './Shop.module.scss';
import { ICartLine, IProduct, ONE_SIZE } from '../../store/types';
import { Currency, formatMoney } from '../../store/settings';
import { lineVariant, stockLeft } from '../../store/shopText';
import { lineName } from '../../store/orderText';
import { itemCountText } from '../../store/ordersView';
import Photo from './Photo';
import Stepper from './Stepper';

export interface ICartPanelProps {
  isOpen: boolean;
  lines: ICartLine[];
  /** How many things are in it, counting each one. */
  count: number;
  total: number;
  /** The shop as loaded, for how many of each variant are left. Undefined while it loads. */
  products?: IProduct[];
  currency: Currency;
  onDismiss: () => void;
  onQty: (line: ICartLine, qty: number, max: number) => void;
  onRemove: (line: ICartLine) => void;
  onCheckout: () => void;
}

const CartPanel: React.FC<ICartPanelProps> = (
  { isOpen, lines, count, total, products, currency, onDismiss, onQty, onRemove, onCheckout }
) => {
  const money = (n: number): string => formatMoney(n, currency);

  // Until the shop has loaded, a line can go down but not up.
  const maxFor = (l: ICartLine): number => {
    const v = products ? lineVariant(products, l) : undefined;
    return v ? stockLeft(v.inStock) : l.qty;
  };

  // Our own close button, styled to sit with the cart's heading.
  const navigation = (): JSX.Element => (
    <div className={styles.panelNav}>
      <button type="button" className={styles.closeButton} aria-label="Close cart" title="Close" onClick={onDismiss}>
        <Icon iconName="Cancel" aria-hidden="true" />
      </button>
    </div>
  );

  const footer = (): JSX.Element => (
    <div className={styles.cartFoot}>
      {lines.length > 0 && (
        <>
          <div className={styles.totals}>
            <div><span>{itemCountText(count)}</span><span>{money(total)}</span></div>
            <div className={styles.grand}><span>Total</span><span>{money(total)}</span></div>
          </div>
          <button type="button" className={css(styles.btn, styles.wide)} onClick={onCheckout}>Checkout</button>
        </>
      )}
      <button type="button" className={css(styles.btn, styles.ghost, styles.wide)} onClick={onDismiss}>
        Continue shopping
      </button>
    </div>
  );

  return (
    <Panel
      isOpen={isOpen}
      onDismiss={onDismiss}
      isLightDismiss
      type={PanelType.custom}
      customWidth="420px"
      headerText="Your cart"
      onRenderNavigationContent={navigation}
      onRenderFooterContent={footer}
      isFooterAtBottom
    >
      <div className={styles.cart}>
        {lines.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyTitle}>Your cart is empty</span>
            Pick something from the shop and it will show up here.
          </div>
        ) : (
          <ul className={styles.lines} aria-label="In your cart">
            {lines.map(l => (
              <li key={`${l.productId}|${l.variant}`} className={styles.line}>
                <Photo url={l.photoUrl} alt="" className={styles.lineShot} small />
                <div className={styles.lineMid}>
                  <span className={styles.lineName}>{l.name}</span>
                  {l.variant !== ONE_SIZE && <span className={styles.lineVariant}>{l.variant}</span>}
                  <span className={styles.lineMeta}>{l.price === 0 ? 'Free' : `${money(l.price)} each`}</span>
                  <Stepper
                    value={l.qty} min={1} max={maxFor(l)} label={`Quantity of ${lineName(l)}`}
                    onChange={q => onQty(l, q, maxFor(l))}
                  />
                </div>
                <div className={styles.lineRight}>
                  <span className={styles.linePrice}>{money(l.price * l.qty)}</span>
                  <button
                    type="button" className={css(styles.btn, styles.small, styles.remove)}
                    aria-label={`Remove ${lineName(l)}`} onClick={() => onRemove(l)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
};

export default CartPanel;
