import * as React from 'react';
import {
  Checkbox, Link, MessageBar, MessageBarType, PrimaryButton, Spinner, SpinnerSize, TextField, getId
} from '@fluentui/react';
import styles from './Checkout.module.scss';
import type { SPFI } from '../../sp';
import type { ListIds } from '../../setup/schema';
import { ISiteInfo, ordersListUrl } from '../../setup/problems';
import { explain } from '../../setup/errors';
import { IStoreSettings, formatMoney, sendsOrderEmails } from '../../store/settings';
import { sendOrderEmail } from '../../store/orderEmail';
import type { GetGraph } from '../../store/orderEmail';
import type { DeliveryMethod, IAddress, ICartLine, IPlacedOrder } from '../../store/types';
import { markEmailSent, noteEmailFailed, placeOrder } from '../../store/orders';
import { forgetMyAddress, loadMyAddress } from '../../store/addresses';
import MethodChoices, { methodOptions } from './MethodChoices';
import {
  blankAddress, checkAddress, itemCount, lineName, lineTotal, missingFromAddress, orderTotal
} from '../../store/orderText';
import { itemCountText } from '../../store/ordersView';
import type { INotice } from '../notice';
import BackArrow from '../BackArrow';
import AddressFields from './AddressFields';

export interface ICheckoutProps {
  sp: SPFI;
  ids: ListIds;
  site: ISiteInfo;
  settings: IStoreSettings;
  getGraph: GetGraph;
  /** What is in the cart. Checkout never changes it; the shop empties it after onPlaced. */
  lines: ICartLine[];
  /** Back to the shop, cart kept. */
  onBack: () => void;
  /** The order is saved. emailSent says whether the order email went. */
  onPlaced: (order: IPlacedOrder, emailSent: boolean) => void;
}

const Checkout: React.FC<ICheckoutProps> = ({ sp, ids, site, settings, getGraph, lines, onBack, onPlaced }) => {
  const options = methodOptions(settings);

  const [picked, setPicked] = React.useState<DeliveryMethod | undefined>();
  const [address, setAddress] = React.useState<IAddress>(() => blankAddress(site.user.name));
  const [hasSaved, setHasSaved] = React.useState(false);
  const [remember, setRemember] = React.useState(true);
  const [note, setNote] = React.useState('');
  const [working, setWorking] = React.useState<string | undefined>();
  const [error, setError] = React.useState<string | undefined>();
  const [showMissing, setShowMissing] = React.useState(false);
  const [forgetting, setForgetting] = React.useState(false);
  const [addressNotice, setAddressNotice] = React.useState<INotice | undefined>();
  const [radioName] = React.useState(() => getId('howToGetIt'));
  // Once they start typing, a saved address arriving late mustn't overwrite what they typed.
  const typed = React.useRef(false);

  // Pick-up comes first and is chosen to start with, as in the design; with only one way, that one.
  const method = options.some(o => o.key === picked) ? picked : (options[0] && options[0].key);
  const delivering = method === 'Delivery';
  const emailsOn = sendsOrderEmails(settings);
  const busy = !!working;

  React.useEffect(() => {
    let current = true;
    if (settings.delivery) {
      loadMyAddress(sp, ids, site.currentUserId)
        .then(saved => {
          if (!current || !saved) return;
          setHasSaved(true);
          if (!typed.current) setAddress({ ...saved, name: saved.name || site.user.name });
        })
        // Not finding it only means typing it in again.
        .catch(() => undefined);
    }
    return () => { current = false; };
  }, [sp, ids, site.currentUserId, site.user.name, settings.delivery]);

  const setField = (key: keyof IAddress, value: string): void => {
    typed.current = true;
    setAddress(a => ({ ...a, [key]: value }));
  };

  const forget = async (): Promise<void> => {
    setForgetting(true);
    setAddressNotice(undefined);
    try {
      await forgetMyAddress(sp, ids, site.currentUserId);
      typed.current = true;
      setHasSaved(false);
      // They've just asked us not to keep it, so don't quietly save the next one either.
      setRemember(false);
      setShowMissing(false);
      setAddress(blankAddress(site.user.name));
      setAddressNotice({ type: MessageBarType.success, text: "We've forgotten your saved address." });
    } catch (e) {
      setAddressNotice({ type: MessageBarType.error, text: `Your saved address couldn't be removed. ${explain(e)}` });
    } finally {
      setForgetting(false);
    }
  };

  const place = async (): Promise<void> => {
    if (!method) return;
    setError(undefined);
    if (delivering && checkAddress(address)) {
      setShowMissing(true);
      return;
    }
    setWorking('Placing your order…');

    let order: IPlacedOrder;
    try {
      order = await placeOrder(sp, ids, settings, {
        lines,
        method,
        address: delivering ? address : undefined,
        note,
        rememberAddress: delivering && remember
      }, site.user);
    } catch (e) {
      setError(explain(e));
      setWorking(undefined);
      return;
    }

    let emailSent = false;
    if (emailsOn) {
      setWorking('Sending your confirmation email…');
      let whyNot = '';
      try {
        await sendOrderEmail(getGraph, settings, order, site.user, ordersListUrl(site));
        emailSent = true;
      } catch (e) {
        // The order is saved either way; the next screen says the email didn't go.
        whyNot = explain(e);
      }
      // Noted on the order for the store team. A note that doesn't save isn't worth holding them up for.
      if (emailSent) await markEmailSent(sp, ids, order.id, site.user).catch(() => undefined);
      else await noteEmailFailed(sp, ids, order.id, whyNot, site.user).catch(() => undefined);
    }
    onPlaced(order, emailSent);
  };

  const backLink = (
    <Link className={styles.backLink} onClick={onBack} disabled={busy}><BackArrow />Back to the store</Link>
  );

  if (!lines.length) {
    return (
      <div>
        {backLink}
        <div className={styles.empty}>
          <p>Your cart is empty. Add something from the store first.</p>
        </div>
      </div>
    );
  }

  const total = orderTotal(lines);
  const count = itemCount(lines);
  // Only after they've tried to place it, and gone again as soon as it's filled in.
  const missing = showMissing && delivering ? missingFromAddress(address) : [];
  const problem = error || (missing.length ? checkAddress(address) : undefined);

  return (
    <div>
      {backLink}
      <div className={styles.twoUp}>
        <div className={styles.main}>
          <div className={styles.box}>
            <h2 className={styles.heading}>How do you want it?</h2>
            {options.length > 1 && (
              <p className={styles.hint}>Pick one. We only need an address if it&apos;s coming to you.</p>
            )}
            {options.length === 0 ? (
              <MessageBar messageBarType={MessageBarType.warning} isMultiline>
                The store isn&apos;t taking orders right now: pick-up and delivery are both turned off.
              </MessageBar>
            ) : (
              <MethodChoices
                options={options} method={method} onPick={setPicked} disabled={busy} name={radioName}
              />
            )}
          </div>

          {delivering && (
            <div className={styles.box}>
              <h2 className={styles.heading}>Where it goes</h2>
              <p className={styles.hint}>
                {hasSaved ? "Your saved address. Change anything that's out of date." : 'The address for the parcel.'}
              </p>
              <AddressFields
                address={address} onChange={setField} missing={missing} disabled={busy} autoFill
                className={styles.form} fullClassName={styles.full}
              />
              <div className={styles.addressActions}>
                <Checkbox
                  label="Remember this address for next time" checked={remember} disabled={busy}
                  onChange={(_, checked) => setRemember(!!checked)}
                />
                {hasSaved && (
                  <Link disabled={busy || forgetting} onClick={() => { forget().catch(() => undefined); }}>
                    {forgetting ? 'Forgetting…' : 'Forget my saved address'}
                  </Link>
                )}
              </div>
              {addressNotice && (
                <MessageBar
                  className={styles.addressNotice} messageBarType={addressNotice.type} isMultiline
                  onDismiss={() => setAddressNotice(undefined)} dismissButtonAriaLabel="Close"
                >
                  {addressNotice.text}
                </MessageBar>
              )}
            </div>
          )}

          <div className={styles.box}>
            <h2 className={styles.heading}>Anything else?</h2>
            <p className={styles.hint}>Optional. Goes with your order.</p>
            <TextField
              multiline rows={2} ariaLabel="Anything else?" placeholder="A note for the store team"
              value={note} onChange={(_, v) => setNote(v || '')} disabled={busy}
            />
          </div>
        </div>

        <div className={styles.side}>
          <div className={styles.box}>
            <h2 className={styles.heading}>Your order</h2>
            <p className={styles.hint}>{itemCountText(count)}</p>
            <ul className={styles.lines}>
              {lines.map(l => (
                <li key={`${l.productId}|${l.variant}`} className={styles.line}>
                  {l.photoUrl
                    ? <img className={styles.thumb} src={l.photoUrl} alt="" />
                    : <span className={styles.thumb} aria-hidden="true" />}
                  <span className={styles.lineMid}>
                    <span className={styles.lineName}>{lineName(l)}</span>
                    <span className={styles.lineMeta}>Qty {l.qty}</span>
                  </span>
                  <span className={styles.linePrice}>{formatMoney(lineTotal(l), settings.currency)}</span>
                </li>
              ))}
            </ul>
            <div className={styles.totals}>
              <div><span>{itemCountText(count)}</span><span>{formatMoney(total, settings.currency)}</span></div>
              <div className={styles.grand}><span>Total</span><span>{formatMoney(total, settings.currency)}</span></div>
            </div>
            {total === 0 && <p className={styles.free}>Nothing to pay {'—'} the company covers these.</p>}

            {problem && (
              <MessageBar className={styles.error} messageBarType={MessageBarType.error} isMultiline>
                {problem}
              </MessageBar>
            )}

            <PrimaryButton
              className={styles.place} text="Place order" disabled={busy || !method}
              onClick={() => { place().catch(() => undefined); }}
            />
            {working && (
              <Spinner className={styles.working} size={SpinnerSize.small} label={working} labelPosition="right" />
            )}
            {emailsOn && (
              <p className={styles.after}>
                You&apos;ll get a confirmation email, and the store team is told straight away.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
