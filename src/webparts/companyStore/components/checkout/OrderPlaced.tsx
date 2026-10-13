import * as React from 'react';
import { DefaultButton, Icon, Link } from '@fluentui/react';
import styles from './Checkout.module.scss';
import { IStoreSettings, sendsOrderEmails } from '../../store/settings';
import { fillInsFor, message } from '../../store/messages';
import type { IBuyer, IPlacedOrder } from '../../store/types';
import type { Say } from '../customize/EditableText';
import { ORDER_PLACED } from '../../strings/checkout';

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
      <h2 className={styles.title}>{ORDER_PLACED.title}</h2>
      {say
        ? <div className={styles.placedMessage}>{say('placedMessage', placed)}</div>
        : placed && <p className={styles.placedMessage}>{placed}</p>}
      <p>
        {ORDER_PLACED.numberLead}{' '}
        <span className={styles.number}>{order.number}</span>
      </p>

      <div className={styles.next}>
        <h3 className={styles.nextTitle}>{ORDER_PLACED.nextTitle}</h3>
        <p>{pickUp ? ORDER_PLACED.pickUp : ORDER_PLACED.delivery}</p>
        {say ? <div>{say(howKey, howNote)}</div> : howNote && <p>{howNote}</p>}
        {!pickUp && order.shipTo && (
          <>
            <p>{ORDER_PLACED.shipTo}</p>
            <p className={styles.shipTo}>{order.shipTo}</p>
          </>
        )}
      </div>

      {emailSent && <p>{ORDER_PLACED.emailSent}</p>}
      {!emailSent && emailsOn && <p>{ORDER_PLACED.emailFailed}</p>}

      <div className={styles.placedActions}>
        <DefaultButton text={ORDER_PLACED.back} onClick={onBackToStore} />
        <Link onClick={onMyOrders}>{ORDER_PLACED.seeMyOrders}</Link>
      </div>
    </div>
  );
};

export default OrderPlaced;
