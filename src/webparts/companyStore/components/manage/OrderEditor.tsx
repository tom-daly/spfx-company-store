import * as React from 'react';
import {
  ChoiceGroup, DefaultButton, Dropdown, IButton, IChoiceGroupOption, MessageBar, MessageBarType, Panel, PanelType,
  PrimaryButton, Spinner, SpinnerSize, TextField, css, getId
} from '@fluentui/react';
import styles from './OrderEditor.module.scss';
import type { SPFI } from '../../sp';
import type { ListIds } from '../../setup/schema';
import { explain } from '../../setup/errors';
import { IStoreSettings, formatMoney } from '../../store/settings';
import { ONE_SIZE } from '../../store/types';
import type { DeliveryMethod, IAddress } from '../../store/types';
import { lineName, lineTotal, missingFromAddress } from '../../store/orderText';
import { updateOrder } from '../../store/ordersAdmin';
import type { IOrder, OrderStatus } from '../../store/ordersView';
import { MOST_TRACKING } from '../../store/orderEdits';
import { today } from '../../store/dates';
import {
  IOrderForm, editFromForm, formChanged, formFromOrder, formTotal, withFormMethod, withFormStatus
} from '../../store/orderForm';
import { readCount } from '../../store/productForm';
import { trackingHint } from '../../store/tracking';
import DayField from './DayField';
import { STATUS_OPTIONS } from './statusOptions';
import AddressFields from '../checkout/AddressFields';
import { METHOD_TITLES } from '../checkout/MethodChoices';
import UnsavedBar from '../UnsavedBar';

export interface IOrderEditorProps {
  sp: SPFI;
  ids: ListIds;
  settings: IStoreSettings;
  /** The order to change, as the list has it now. */
  order: IOrder;
  /** Who is making the change, for the order's history. */
  who: string;
  /** Saved. The panel is on its way out. */
  onSaved: (saved: IOrder) => void;
  /** The panel has closed, saved or not. */
  onClose: () => void;
}

/* Owners can choose either way, even one turned off in Settings: they may have agreed it with the person. */
const METHOD_OPTIONS: IChoiceGroupOption[] = [
  { key: 'Pick up', text: METHOD_TITLES['Pick up'] },
  { key: 'Delivery', text: METHOD_TITLES.Delivery }
];

/*
 * Changing an order, in a panel over the orders page: its status and the days
 * and tracking that go with it, how many of each thing, pick-up or delivery
 * and where to, and the note. Nobody is emailed from here. Closing with
 * changes typed asks first, so nothing is lost to a stray click or Esc.
 */
const OrderEditor: React.FC<IOrderEditorProps> = ({ sp, ids, settings, order, who, onSaved, onClose }) => {
  // The form as it opened, to tell whether anything has been changed since.
  const [start] = React.useState<IOrderForm>(() => formFromOrder(order));
  const [form, setForm] = React.useState<IOrderForm>(start);
  const [open, setOpen] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [problem, setProblem] = React.useState<string | undefined>();
  // Save was pressed with something to fix, so the boxes that need it say so.
  const [tried, setTried] = React.useState(false);
  // Asking whether to throw the changes away.
  const [asking, setAsking] = React.useState(false);
  const [itemsId] = React.useState(() => getId('orderItems'));
  const [addressId] = React.useState(() => getId('orderAddress'));
  const keepRef = React.useRef<IButton>(null);
  const cancelRef = React.useRef<IButton>(null);
  const alive = React.useRef(true);

  React.useEffect(() => () => { alive.current = false; }, []);

  // The question appears at the foot of the panel; take the keyboard there so it's heard and answered.
  React.useEffect(() => {
    if (asking && keepRef.current) keepRef.current.focus();
  }, [asking]);

  const money = (amount: number): string => formatMoney(amount, settings.currency);
  const changed = formChanged(form, start);
  const delivering = form.method === 'Delivery';

  const close = (): void => {
    setAsking(false);
    setOpen(false);
  };

  /* Cancel, the close button and Esc all come here. With changes typed, ask first rather than lose them. */
  const leave = (ev?: { preventDefault: () => void }): void => {
    if (saving || changed) {
      // Keeps the panel open: it would otherwise close itself.
      if (ev) ev.preventDefault();
      if (!saving) setAsking(true);
      return;
    }
    close();
  };

  const keepEditing = (): void => {
    setAsking(false);
    if (cancelRef.current) cancelRef.current.focus();
  };

  const save = async (): Promise<void> => {
    setProblem(undefined);
    setAsking(false);
    // Nothing to write, and nothing for the history either.
    if (!changed) {
      close();
      return;
    }
    const edit = editFromForm(form);
    if (typeof edit === 'string') {
      setTried(true);
      setProblem(edit);
      return;
    }
    setSaving(true);
    try {
      const saved = await updateOrder(sp, ids, settings, order, edit, who);
      onSaved(saved);
      if (alive.current) close();
    } catch (e) {
      if (alive.current) setProblem(explain(e));
    } finally {
      if (alive.current) setSaving(false);
    }
  };

  const setQty = (index: number, text: string): void =>
    setForm(f => ({ ...f, items: f.items.map((item, i) => (i === index ? { ...item, qty: text } : item)) }));

  const setPart = (key: keyof IAddress, value: string): void =>
    setForm(f => ({ ...f, address: { ...f.address, [key]: value } }));

  /* Picked up fills in today as the day it was picked up, which can then be changed. */
  const setStatus = (status: OrderStatus): void => setForm(f => withFormStatus(f, status, today()));

  /* The status moves to the same step for the new way, so a packed delivery switched to pick-up is ready for pick-up. */
  const setMethod = (method: DeliveryMethod): void => setForm(f => withFormMethod(f, method, today()));

  const pickedUp = form.method === 'Pick up' && form.status === 'Picked up';

  // Only after Save was pressed, and gone again as soon as it's filled in.
  const missing = tried && delivering ? missingFromAddress(form.address) : [];

  const total = formTotal(form, order);
  // The order's own address, when it couldn't be read into the boxes, so the owner can type it in again.
  const unreadAddress = order.method === 'Delivery' && !order.address && order.shipTo.length > 0;

  const renderItems = (): JSX.Element => {
    if (!form.items.length) {
      return (
        <>
          {order.itemLines.length > 0
            ? <ul className={styles.readOnly}>{order.itemLines.map((text, i) => <li key={i}>{text}</li>)}</ul>
            : <p className={styles.quiet}>Nothing is listed.</p>}
          <p className={styles.hint}>
            The quantities can&apos;t be changed here: this order&apos;s item details couldn&apos;t be read.
          </p>
        </>
      );
    }
    return (
      <>
        <ul className={styles.items}>
          {form.items.map((item, i) => {
            const qty = readCount(item.qty);
            const name = lineName(item.line);
            const off = qty === 0;
            const differs = qty !== item.line.qty;
            // Blank is only wrong once they try to save; anything else that isn't a number is wrong straight away.
            const wrong = qty === undefined && (tried || item.qty.trim() !== '');
            return (
              <li key={i} className={css(styles.item, off && styles.off)}>
                <div className={styles.itemName}>
                  <span className={styles.product}>{item.line.name}</span>
                  <span className={styles.meta}>
                    {item.line.variant && item.line.variant !== ONE_SIZE && <>{item.line.variant} · </>}
                    {item.line.price === 0 ? 'Free' : `${money(item.line.price)} each`}
                  </span>
                  {differs && (
                    <span className={styles.was}>
                      {off ? `Comes off the order (was ${item.line.qty})` : `Was ${item.line.qty}`}
                    </span>
                  )}
                </div>
                <TextField
                  className={styles.qty} ariaLabel={`Quantity of ${name}`} inputMode="numeric" value={item.qty}
                  onChange={(_, value) => setQty(i, value || '')} disabled={saving}
                  errorMessage={wrong ? 'A whole number, 0 or more' : undefined}
                />
                <span className={styles.lineTotal}>
                  {qty !== undefined && qty > 0 ? money(lineTotal({ ...item.line, qty })) : ''}
                </span>
              </li>
            );
          })}
        </ul>
        <p className={styles.hint}>
          Set a quantity to 0 to take it off the order. Stock is put back or taken to match.
        </p>
      </>
    );
  };

  const footer = (): JSX.Element => (
    <div className={styles.footer}>
      {asking && (
        <UnsavedBar onDiscard={close} onKeep={keepEditing} keepRef={keepRef} className={styles.barActions} />
      )}
      {problem && <MessageBar messageBarType={MessageBarType.error} isMultiline>{problem}</MessageBar>}
      <div className={styles.buttons}>
        <PrimaryButton text="Save" disabled={saving} onClick={() => { save().catch(() => undefined); }} />
        <DefaultButton componentRef={cancelRef} text="Cancel" disabled={saving} onClick={() => leave()} />
        {saving && <Spinner size={SpinnerSize.small} label="Saving…" labelPosition="right" />}
      </div>
    </div>
  );

  return (
    <Panel
      isOpen={open}
      type={PanelType.medium}
      headerText={`Edit ${order.number}`}
      closeButtonAriaLabel="Close"
      onDismiss={leave}
      onDismissed={onClose}
      onRenderFooterContent={footer}
      isFooterAtBottom
    >
      <div className={styles.editor}>
        <div>
          <div className={styles.progress}>
            <Dropdown
              className={styles.status} label="Status" selectedKey={form.status} options={STATUS_OPTIONS[form.method]}
              disabled={saving}
              onChange={(_, option) => { if (option) setStatus(option.key as OrderStatus); }}
            />
            <DayField
              label="Ready by" value={form.readyBy} disabled={saving}
              onChange={day => setForm(f => ({ ...f, readyBy: day }))}
            />
            {pickedUp && (
              <DayField
                label="Picked up on" value={form.pickedUpOn} disabled={saving}
                onChange={day => setForm(f => ({ ...f, pickedUpOn: day }))}
              />
            )}
            {delivering && (
              <TextField
                className={styles.full} label="Tracking number or link" maxLength={MOST_TRACKING}
                value={form.tracking} disabled={saving} description={trackingHint(form.tracking)}
                onChange={(_, value) => setForm(f => ({ ...f, tracking: value || '' }))}
              />
            )}
          </div>
          <p className={styles.hint}>
            Saving here doesn&apos;t email anyone. To let them know, change the status in the orders table.
          </p>
        </div>

        <section className={styles.section} role="group" aria-labelledby={itemsId}>
          <h3 className={styles.heading} id={itemsId}>Items</h3>
          {renderItems()}
          <p className={styles.total}>
            <span>{total !== order.total ? 'New total' : 'Total'}</span>
            <span>
              {total !== order.total && <span className={styles.wasTotal}>was {money(order.total)}</span>}
              {money(total)}
            </span>
          </p>
        </section>

        <ChoiceGroup
          className={styles.method} label="How they want it" selectedKey={form.method} options={METHOD_OPTIONS}
          disabled={saving}
          onChange={(_, option) => { if (option) setMethod(option.key as DeliveryMethod); }}
        />

        {delivering && (
          <section className={styles.section} role="group" aria-labelledby={addressId}>
            <h3 className={styles.heading} id={addressId}>Where it goes</h3>
            {unreadAddress && (
              <p className={styles.hint}>
                This order&apos;s address couldn&apos;t be read into the boxes. It was written as:{' '}
                <span className={styles.written}>{order.shipTo.join(', ')}</span>
              </p>
            )}
            <AddressFields
              address={form.address} onChange={setPart} missing={missing} disabled={saving}
              className={styles.address} fullClassName={styles.full}
            />
          </section>
        )}

        <TextField
          label="Note" multiline rows={3} value={form.note} disabled={saving}
          onChange={(_, value) => setForm(f => ({ ...f, note: value || '' }))}
        />
      </div>
    </Panel>
  );
};

export default OrderEditor;
