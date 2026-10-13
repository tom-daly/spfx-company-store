import * as React from 'react';
import {
  ChoiceGroup, DefaultButton, MessageBar, MessageBarType, Pivot, PivotItem, PrimaryButton, Spinner, SpinnerSize
} from '@fluentui/react';
import styles from './Customize.module.scss';
import checkoutStyles from '../checkout/Checkout.module.scss';
import type { SPFI } from '../../sp';
import type { ListIds } from '../../setup/schema';
import { ISiteInfo, ordersListUrl } from '../../setup/problems';
import { explain } from '../../setup/errors';
import { DEFAULT_SETTINGS, IStoreSettings, checkSettings, splitEmails } from '../../store/settings';
import { saveSettings } from '../../store/settingsStore';
import { MessageKey, fillInsFor, message } from '../../store/messages';
import { orderEmailDetails, orderEmailSubject } from '../../store/orderEmailText';
import {
  STATUS_EMAIL_WORDING, StatusEmailKind, statusEmailDetails, statusEmailOpening, statusEmailSubject
} from '../../store/statusEmailText';
import type { IOrder, OrderStatus } from '../../store/ordersView';
import { isoDate } from '../../store/dates';
import { itemCount, orderNumber } from '../../store/orderText';
import { DeliveryMethod, IBuyer, IPlacedOrder, ONE_SIZE } from '../../store/types';
import EditableText, { Say } from './EditableText';
import MethodChoices, { methodOptions } from '../checkout/MethodChoices';
import OrderPlaced from '../checkout/OrderPlaced';
import UnsavedBar from '../UnsavedBar';

export interface ICustomizeMessagesProps {
  sp: SPFI;
  ids: ListIds;
  site: ISiteInfo;
  settings: IStoreSettings;
  onClose: () => void;
  onSaved: (settings: IStoreSettings) => void;
}

type Tab = 'checkout' | 'placed' | 'email';

/* The order email to the store team, or one of the emails to the person who ordered. */
type WhichEmail = 'order' | StatusEmailKind;

const EMAILS: { key: WhichEmail; text: string }[] = [
  { key: 'order', text: 'New order (to the store team)' },
  { key: 'confirmed', text: 'Order confirmed' },
  { key: 'ready', text: 'Ready for pick-up' },
  { key: 'shipped', text: 'On its way' }
];

const MESSAGE_KEYS: MessageKey[] = [
  'placedMessage', 'pickUpNote', 'deliveryNote', 'emailSubject', 'emailMessage',
  'confirmedSubject', 'confirmedMessage', 'readySubject', 'readyMessage', 'shippedSubject', 'shippedMessage'
];

const OPENING_EMPTY: string = 'Click to add an opening line';

const ABOUT: Record<MessageKey, { label: string; empty: string; multiline: boolean; fillIns: boolean }> = {
  placedMessage: { label: 'Order placed message', empty: 'Click to add a thank-you message', multiline: true, fillIns: true },
  // Shown at checkout too, before there is an order to fill anything in from.
  pickUpNote: { label: 'Pick-up instructions', empty: 'Click to add pick-up instructions', multiline: true, fillIns: false },
  deliveryNote: { label: 'Delivery note', empty: 'Click to add a delivery note', multiline: true, fillIns: false },
  emailSubject: { label: 'Email subject', empty: '', multiline: false, fillIns: true },
  emailMessage: { label: 'Email opening', empty: OPENING_EMPTY, multiline: true, fillIns: true },
  confirmedSubject: { label: 'Order confirmed email subject', empty: '', multiline: false, fillIns: true },
  confirmedMessage: { label: 'Order confirmed email opening', empty: OPENING_EMPTY, multiline: true, fillIns: true },
  readySubject: { label: 'Ready for pick-up email subject', empty: '', multiline: false, fillIns: true },
  readyMessage: { label: 'Ready for pick-up email opening', empty: OPENING_EMPTY, multiline: true, fillIns: true },
  shippedSubject: { label: 'On its way email subject', empty: '', multiline: false, fillIns: true },
  shippedMessage: { label: 'On its way email opening', empty: OPENING_EMPTY, multiline: true, fillIns: true }
};

const STATUS_OF: Record<StatusEmailKind, OrderStatus> = {
  confirmed: 'Confirmed', ready: 'Ready for pick-up', shipped: 'Shipped'
};

const SAMPLE_TRACKING: string = 'https://www.example.com/track/1Z999AA10123456784';

/* A made-up order, so every screen shows the owner's words around something real-looking. */
function sampleOrder(settings: IStoreSettings, method: DeliveryMethod, buyer: IBuyer): IPlacedOrder {
  const delivery = method === 'Delivery';
  return {
    id: 42,
    number: orderNumber(settings.orderPrefix.trim(), 42),
    total: 48,
    lines: [
      { productId: 0, name: 'Reef crew tee', price: 0, qty: 1, variant: ONE_SIZE },
      { productId: 0, name: 'Crew hoodie', price: 48, qty: 1, variant: ONE_SIZE }
    ],
    method,
    shipTo: delivery ? [buyer.name || 'Your name', '12 Harbour Street', '1016 DX Amsterdam', 'Netherlands'].join('\n') : '',
    phone: delivery ? '+31 6 1234 5678' : '',
    note: 'Thank you!'
  };
}

/* Who the status emails in the preview go to: someone made up, at the viewer's own email domain. */
function samplePerson(viewer: IBuyer): IBuyer {
  const domain = (viewer.email || '').split('@')[1] || 'example.com';
  return { name: 'Sam Taylor', email: `sam.taylor@${domain}` };
}

/*
 * The sample order as the orders page holds it when the store moves it on, to
 * be ready three days from now. Ready for pick-up is only ever a pick-up and On
 * its way only ever a delivery; Order confirmed goes the way the page shows.
 */
function sampleMovedOrder(
  settings: IStoreSettings, kind: StatusEmailKind, method: DeliveryMethod, person: IBuyer
): IOrder {
  const way: DeliveryMethod = kind === 'ready' ? 'Pick up' : kind === 'shipped' ? 'Delivery' : method;
  const placed = sampleOrder(settings, way, person);
  const readyBy = new Date();
  readyBy.setDate(readyBy.getDate() + 3);
  return {
    id: placed.id,
    number: placed.number,
    who: person.name,
    email: person.email,
    lines: placed.lines,
    itemLines: [],
    items: itemCount(placed.lines),
    total: placed.total,
    method: way,
    shipTo: placed.shipTo ? placed.shipTo.split('\n') : [],
    phone: placed.phone,
    note: placed.note,
    status: STATUS_OF[kind],
    readyBy: isoDate(readyBy),
    tracking: kind === 'shipped' ? SAMPLE_TRACKING : '',
    pickedUpOn: '',
    emailSent: true,
    history: []
  };
}

const sameWords = (a: IStoreSettings, b: IStoreSettings): boolean => MESSAGE_KEYS.every(k => a[k] === b[k]);

/* Links in the preview would leave the page mid-edit, so they're switched off. */
const noLinks = (e: React.MouseEvent): void => {
  if ((e.target as HTMLElement).closest('a')) e.preventDefault();
};

/*
 * The checkout, the confirmation and the email as staff will see them, with a
 * sample order, and the owner's words outlined so they can be clicked and
 * changed in place. Nothing is saved until Save.
 */
const CustomizeMessages: React.FC<ICustomizeMessagesProps> = ({ sp, ids, site, settings, onClose, onSaved }) => {
  const [draft, setDraft] = React.useState<IStoreSettings>(settings);
  const [tab, setTab] = React.useState<Tab>('placed');
  const [method, setMethod] = React.useState<DeliveryMethod>(settings.pickUp ? 'Pick up' : 'Delivery');
  const [which, setWhich] = React.useState<WhichEmail>('order');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>();
  const [leaving, setLeaving] = React.useState(false);

  const buyer = site.user;
  const order = sampleOrder(draft, method, buyer);
  const fills = fillInsFor(order, buyer, draft.currency);
  const changed = !sameWords(draft, settings);
  const ordersUrl = ordersListUrl(site);

  // Keyed by the words it edits, so switching to other words in the same spot starts afresh.
  const say: Say = (key, shown) => (
    <EditableText
      key={key}
      value={draft[key]}
      shown={shown}
      standard={DEFAULT_SETTINGS[key]}
      onChange={v => setDraft(d => ({ ...d, [key]: v }))}
      label={ABOUT[key].label}
      emptyText={ABOUT[key].empty}
      multiline={ABOUT[key].multiline}
      fillIns={ABOUT[key].fillIns}
    />
  );

  const save = async (): Promise<void> => {
    const wrong = checkSettings(draft);
    if (wrong) {
      setError(wrong);
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      await saveSettings(sp, ids, draft, settings);
      onSaved(draft);
    } catch (e) {
      setError(explain(e));
    } finally {
      setSaving(false);
    }
  };

  const close = (): void => {
    if (changed) setLeaving(true);
    else onClose();
  };

  const to = splitEmails(draft.orderEmails);
  // Ready for pick-up and On its way only ever go one way, so there's no way to choose.
  const oneWayOnly = tab === 'email' && (which === 'ready' || which === 'shipped');
  const me = buyer.name || buyer.email;

  const orderEmail = (): React.ReactNode => (
    <div className={styles.email}>
      <dl className={styles.emailHead}>
        <dt>From</dt>
        <dd>{me}</dd>
        <dt>To</dt>
        <dd>
          {to.length
            ? to.join(', ')
            : <span className={styles.muted}>Nobody yet. Add someone under &quot;Who gets order emails&quot; in Settings.</span>}
        </dd>
        {buyer.email && <><dt>Copy to</dt><dd>{buyer.email}</dd></>}
        <dt>Subject</dt>
        <dd>{say('emailSubject', orderEmailSubject(draft, order, buyer))}</dd>
      </dl>
      <div className={styles.emailBody} onClickCapture={noLinks}>
        <div className={styles.emailOpening}>{say('emailMessage', message(draft, 'emailMessage', fills))}</div>
        {/* Built by the store with everything people typed escaped, as in the real email. */}
        <div dangerouslySetInnerHTML={{ __html: orderEmailDetails(draft, order, buyer, ordersUrl) }} />
      </div>
    </div>
  );

  const statusEmail = (kind: StatusEmailKind): React.ReactNode => {
    const person = samplePerson(buyer);
    const moved = sampleMovedOrder(draft, kind, method, person);
    const words = STATUS_EMAIL_WORDING[kind];
    return (
      <div className={styles.email}>
        <dl className={styles.emailHead}>
          <dt>From</dt>
          <dd>{me ? `${me} (you)` : 'You'}</dd>
          <dt>To</dt>
          <dd>{person.name} &lt;{person.email}&gt;</dd>
          {to.length > 0 && <><dt>Replies go to</dt><dd>{to.join(', ')}</dd></>}
          <dt>Subject</dt>
          <dd>{say(words.subject, statusEmailSubject(draft, kind, moved))}</dd>
        </dl>
        <div className={styles.emailBody} onClickCapture={noLinks}>
          <div className={styles.emailOpening}>{say(words.message, statusEmailOpening(draft, kind, moved))}</div>
          {/* Built by the store with everything people typed escaped, as in the real email. */}
          <div dangerouslySetInnerHTML={{ __html: statusEmailDetails(draft, kind, moved, site.pageUrl) }} />
        </div>
      </div>
    );
  };

  return (
    <div className={styles.customize}>
      <div className={styles.top}>
        <div>
          <h2>Customize the messages</h2>
          <p className={styles.intro}>
            This is what staff see, with a made-up order. Click any outlined words to change them.
            Fill-ins like {'{first name}'} and {'{order}'} are swapped for the real details on each order.
          </p>
        </div>
        <div className={styles.topActions}>
          <PrimaryButton text="Save" disabled={!changed || saving} onClick={() => { save().catch(() => undefined); }} />
          <DefaultButton text={changed ? 'Cancel' : 'Close'} disabled={saving} onClick={close} />
          {saving && <Spinner size={SpinnerSize.small} label="Saving…" labelPosition="right" />}
        </div>
      </div>

      {error && <MessageBar messageBarType={MessageBarType.error} isMultiline>{error}</MessageBar>}
      {leaving && (
        <UnsavedBar onDiscard={onClose} onKeep={() => setLeaving(false)} className={styles.barActions} />
      )}

      <div className={styles.bar}>
        <Pivot selectedKey={tab} onLinkClick={item => { if (item && item.props.itemKey) setTab(item.props.itemKey as Tab); }}>
          <PivotItem itemKey="checkout" headerText="Checkout" />
          <PivotItem itemKey="placed" headerText="Order placed" />
          <PivotItem itemKey="email" headerText="Email" />
        </Pivot>
        {tab !== 'checkout' && !oneWayOnly && (
          <ChoiceGroup
            className={styles.showFor}
            label="Show it for"
            selectedKey={method}
            options={[{ key: 'Pick up', text: 'Pick-up' }, { key: 'Delivery', text: 'Delivery' }]}
            onChange={(_, o) => { if (o) setMethod(o.key as DeliveryMethod); }}
          />
        )}
      </div>

      <div className={styles.stage}>
        {tab === 'checkout' && (
          <div className={`${checkoutStyles.box} ${styles.narrow}`}>
            <h2 className={checkoutStyles.heading}>How do you want it?</h2>
            <MethodChoices
              options={methodOptions(draft, true)} method={method} onPick={setMethod}
              name="customizeHowToGetIt" say={say}
            />
          </div>
        )}

        {tab === 'placed' && (
          <OrderPlaced order={order} emailSent={to.length > 0} settings={draft} buyer={buyer} say={say} />
        )}

        {tab === 'email' && (
          <>
            <ChoiceGroup
              className={styles.whichEmail}
              label="Which email"
              selectedKey={which}
              options={EMAILS}
              onChange={(_, o) => { if (o) setWhich(o.key as WhichEmail); }}
            />
            <p className={styles.emailNote}>
              {which === 'order'
                ? 'Goes to the store team, from the mailbox of the person who ordered. They get a copy.'
                : 'Goes to the person who ordered, from the mailbox of whoever moves the order on.'}
            </p>
            {which === 'order' ? orderEmail() : statusEmail(which)}
          </>
        )}
      </div>
    </div>
  );
};

export default CustomizeMessages;
