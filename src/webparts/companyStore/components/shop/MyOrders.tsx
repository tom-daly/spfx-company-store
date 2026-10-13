import * as React from 'react';
import { Icon, Spinner, SpinnerSize, css } from '@fluentui/react';
import styles from './Shop.module.scss';
import type { SPFI } from '../../sp';
import type { ListIds } from '../../setup/schema';
import type { ISiteInfo } from '../../setup/problems';
import { IStoreSettings, formatMoney } from '../../store/settings';
import { IOrder, isDone } from '../../store/ordersView';
import { MOST_MINE, loadMyOrders } from '../../store/myOrders';
import {
  itemTexts, orderSteps, pickUpNoteFor, placedText, stepStateText, whereItsAt
} from '../../store/myOrdersView';
import { trackingFor, trackingLabel } from '../../store/tracking';
import BackArrow from '../BackArrow';
import LoadFailed from '../LoadFailed';
import { useLoad } from '../useLoad';

export interface IMyOrdersProps {
  sp: SPFI;
  ids: ListIds;
  site: ISiteInfo;
  settings: IStoreSettings;
  /** Back to the shop. */
  onShop: () => void;
}

/* What each part of an order's card needs. */
interface IOrderPartProps {
  order: IOrder;
  settings: IStoreSettings;
  site: ISiteInfo;
}

/* Placed, Confirmed, then on to the last step: ticks for the steps behind it, a dot for where it is now. */
const Steps: React.FC<{ order: IOrder }> = ({ order }) => {
  const finished = isDone(order.status);
  return (
    <ol className={styles.progress} aria-label="Progress">
      {orderSteps(order).map(step => {
        const now = step.state === 'current';
        // A finished order is at its last step, and that step is done too.
        const ticked = step.state === 'done' || (now && finished);
        const said = stepStateText(step.state);
        return (
          <li
            key={step.status}
            className={css(styles.progressStep, ticked && styles.stepDone, now && styles.stepNow)}
            aria-current={now ? 'step' : undefined}
          >
            <span className={styles.stepMark} aria-hidden="true">
              {ticked && <Icon iconName="CheckMark" />}
            </span>
            <span className={styles.stepName}>{step.label}</span>
            {said && <span className={styles.srOnly}>, {said}</span>}
          </li>
        );
      })}
    </ol>
  );
};

/* The line on where it's at, and what goes with it: tracking once it's sent, the pick-up instructions once it's ready. */
const WhereItsAt: React.FC<IOrderPartProps> = ({ order, settings, site }) => {
  const tracking = order.status === 'Shipped' ? trackingFor(order.tracking) : undefined;
  const pickUpNote = pickUpNoteFor(order, settings, site.user);
  return (
    <div className={styles.whereAt}>
      <p className={styles.whereAtText}>{whereItsAt(order)}</p>
      {tracking && (
        <p className={styles.whereAtMore}>
          {trackingLabel(tracking)}:{' '}
          {tracking.href
            ? <a href={tracking.href} target="_blank" rel="noopener noreferrer">{tracking.text}</a>
            : tracking.text}
        </p>
      )}
      {pickUpNote && <p className={css(styles.whereAtMore, styles.keepLines)}>{pickUpNote}</p>}
    </div>
  );
};

const OrderCard: React.FC<IOrderPartProps> = ({ order, settings, site }) => {
  const items = itemTexts(order);
  const placed = placedText(order);
  return (
    <article className={styles.orderCard}>
      <div className={styles.orderHead}>
        <div>
          <h3 className={styles.orderNumber}><span className={styles.srOnly}>Order </span>{order.number}</h3>
          {placed && <p className={styles.orderPlaced}>{placed}</p>}
        </div>
        <span className={css(styles.pill, styles.pillOut)}>{order.method}</span>
      </div>

      <Steps order={order} />
      <WhereItsAt order={order} settings={settings} site={site} />

      <div className={styles.orderInfo}>
        <section>
          <h4 className={styles.infoLabel}>What you ordered</h4>
          {items.length > 0
            ? <ul className={styles.orderItems}>{items.map((text, i) => <li key={i}>{text}</li>)}</ul>
            : <p className={styles.quiet}>Nothing is listed.</p>}
          <p className={styles.orderTotal}><span>Total</span><span>{formatMoney(order.total, settings.currency)}</span></p>
        </section>

        {order.method === 'Delivery' && (
          <section>
            <h4 className={styles.infoLabel}>Going to</h4>
            {order.shipTo.length > 0
              ? <p className={styles.shipTo}>{order.shipTo.join('\n')}</p>
              : <p className={styles.quiet}>No address was given.</p>}
          </section>
        )}
      </div>
    </article>
  );
};

/*
 * The orders the person looking has placed, newest first, each with where it
 * has got to. Only ever their own, even for the people who run the store.
 */
const MyOrders: React.FC<IMyOrdersProps> = ({ sp, ids, site, settings, onShop }) => {
  const loadMine = React.useCallback((): Promise<IOrder[]> => loadMyOrders(sp, ids, site), [sp, ids, site]);
  const { data: orders, error: loadError, reload } = useLoad(loadMine);

  return (
    <div className={css(styles.shop, styles.myOrders)}>
      <button type="button" className={styles.back} onClick={onShop}><BackArrow />Back to the shop</button>
      <h2 className={styles.pageTitle}>My orders</h2>
      <p className={styles.pageIntro}>Everything you&apos;ve ordered from the store, newest first.</p>

      {!orders && !loadError && <Spinner className={styles.loading} size={SpinnerSize.medium} label="Loading your orders…" />}

      {loadError && (
        <LoadFailed
          lead="Your orders couldn't be loaded." error={loadError} onRetry={() => { reload().catch(() => undefined); }}
        />
      )}

      {orders && orders.length === 0 && (
        <div className={styles.empty}>
          <span className={styles.emptyTitle}>You haven&apos;t ordered anything yet.</span>
          <div className={styles.emptyAction}>
            <button type="button" className={styles.btn} onClick={onShop}>Go to the shop</button>
          </div>
        </div>
      )}

      {orders && orders.length > 0 && (
        <ul className={styles.orderList} aria-label="Your orders">
          {orders.map(o => <li key={o.id}><OrderCard order={o} settings={settings} site={site} /></li>)}
        </ul>
      )}

      {orders && orders.length >= MOST_MINE && (
        <p className={styles.quiet}>Showing your newest {MOST_MINE} orders.</p>
      )}
    </div>
  );
};

export default MyOrders;
