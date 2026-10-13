import * as React from 'react';
import { DefaultButton, Icon, Link } from '@fluentui/react';
import styles from './Checkout.module.scss';
import { IStoreSettings, sendsOrderEmails } from '../../store/settings';
import { fillInsFor, message } from '../../store/messages';
import type { IBuyer, IPlacedOrder } from '../../store/types';
import type { Say } from '../customize/EditableText';

export interface IOrderPlacedProps {
  order: IPlacedOrder;
  emailSent: boolean;
  settings: IStoreSettings;
  /** Undefined in Customize, where the buttons do nothing. */
  onBackToStore?: () => void;
  /** Opens My orders, where they can follow this order. Undefined in Customize. */
  onMyOrders?: () => void;
  /** Who placed it, for fill-ins like {first name} in the owner's message. */
  buyer: IBuyer;
  /** Set in Customize, where the owner's words can be edited and the buttons do nothing. */
  say?: Say;
}

const OrderPlaced: React.FC<IOrderPlacedProps> = props => {
  const { order, emailSent, settings, onBackToStore, onMyOrders, buyer, say } = props;
  const pickUp = order.method === 'Pick up';
  const fills = fillInsFor(order, buyer, settings.currency);
  const placed = message(settings, 'placedMessage', fills);
  const howKey = pickUp ? 'pickUpNote' : 'deliveryNote';
  const howNote = message(settings, howKey, fills).trim();
  const emailsOn = sendsOrderEmails(settings);

  return (
    <div className={styles.placed}>
      <div className={styles.tick} aria-hidden="true"><Icon iconName="CheckMark" /></div>
      <h2 className={styles.title}>Order placed</h2>
      {say
        ? <div className={styles.placedMessage}>{say('placedMessage', placed)}</div>
        : placed && <p className={styles.placedMessage}>{placed}</p>}
      <p>
        Your order number is{' '}
        <span className={styles.number}>{order.number}</span>
      </p>

      <div className={styles.next}>
        <h3 className={styles.nextTitle}>What happens next</h3>
        <p>{pickUp ? 'Pick it up at the office.' : "We'll send it to you."}</p>
        {say ? <div>{say(howKey, howNote)}</div> : howNote && <p>{howNote}</p>}
        {!pickUp && order.shipTo && (
          <>
            <p>It&apos;s going to:</p>
            <p className={styles.shipTo}>{order.shipTo}</p>
          </>
        )}
      </div>

      {emailSent && <p>A confirmation email is on its way to you.</p>}
      {!emailSent && emailsOn && <p>Your order is saved, but the confirmation email couldn&apos;t be sent.</p>}

      <div className={styles.placedActions}>
        <DefaultButton text="Back to the store" onClick={onBackToStore} />
        <Link onClick={onMyOrders}>See my orders</Link>
      </div>
    </div>
  );
};

export default OrderPlaced;
