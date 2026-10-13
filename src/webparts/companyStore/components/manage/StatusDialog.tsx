import * as React from 'react';
import { Checkbox, DefaultButton, Dialog, DialogFooter, DialogType, PrimaryButton, TextField } from '@fluentui/react';
import styles from './OrderEditor.module.scss';
import { IOrder, readyByLabel, statusAsk } from '../../store/ordersView';
import { IStatusDetails, MOST_TRACKING } from '../../store/orderEdits';
import type { StatusEmailKind } from '../../store/statusEmailText';
import { trackingHint } from '../../store/tracking';
import DayField from './DayField';

export interface IStatusDialogProps {
  /** The order as the table shows it, before the change. */
  order: IOrder;
  /** Which step it's going to: confirmed, ready for pick-up or shipped. */
  kind: StatusEmailKind;
  /** Go ahead, with what was filled in, and whether to email the person. */
  onConfirm: (details: IStatusDetails, email: boolean) => void;
  /** Leave the order as it was. */
  onCancel: () => void;
}

/*
 * Asked before an order is confirmed, marked ready for pick-up or marked
 * shipped: whatever goes with that step, and whether to email the person
 * who ordered it. The email goes from the mailbox of whoever is asked.
 */
const StatusDialog: React.FC<IStatusDialogProps> = ({ order, kind, onConfirm, onCancel }) => {
  const [readyBy, setReadyBy] = React.useState(order.readyBy);
  const [tracking, setTracking] = React.useState(order.tracking);
  const [email, setEmail] = React.useState(true);
  const ask = statusAsk(order, kind);

  const go = (): void => {
    let details: IStatusDetails = {};
    if (kind === 'confirmed') details = { readyBy };
    if (kind === 'shipped') details = { tracking: tracking.trim() };
    onConfirm(details, !!ask.emailLabel && email);
  };

  return (
    <Dialog
      hidden={false}
      onDismiss={onCancel}
      dialogContentProps={{ type: DialogType.normal, title: ask.title }}
      modalProps={{ isBlocking: false }}
      // Room for the tick box's words on one line; on a phone it keeps Fluent's narrower width.
      maxWidth={460}
    >
      <div className={styles.ask}>
        {kind === 'confirmed' && (
          // Confirmed means it's being worked on; the day often isn't known yet.
          <div>
            <DayField label={readyByLabel(order.method)} value={readyBy} onChange={setReadyBy} />
            <p className={styles.hint}>Not sure yet? Leave it empty and add it later in Edit order.</p>
          </div>
        )}
        {kind === 'shipped' && (
          <TextField
            label="Tracking number or link" value={tracking} maxLength={MOST_TRACKING}
            description={trackingHint(tracking)}
            onChange={(_, value) => setTracking(value || '')}
            onKeyDown={e => { if (e.key === 'Enter') go(); }}
          />
        )}
        {ask.emailLabel ? (
          <div>
            <Checkbox label={ask.emailLabel} checked={email} onChange={(_, checked) => setEmail(!!checked)} />
            <p className={styles.mailbox}>Sent from your mailbox.</p>
          </div>
        ) : (
          <p className={styles.quiet}>{ask.noEmail}</p>
        )}
      </div>
      <DialogFooter>
        <PrimaryButton text={ask.button} onClick={go} />
        <DefaultButton text="Cancel" onClick={onCancel} />
      </DialogFooter>
    </Dialog>
  );
};

export default StatusDialog;
