import * as React from 'react';
import styles from './Checkout.module.scss';
import type { IStoreSettings } from '../../store/settings';
import type { DeliveryMethod } from '../../store/types';
import type { Say } from '../customize/EditableText';

export interface IMethodOption {
  key: DeliveryMethod;
  title: string;
  note: string;
  /** Turned off in Settings. Only ever shown in Customize. */
  off?: boolean;
}

/** What each way to get an order is called, here and in the order editor. */
export const METHOD_TITLES: Record<DeliveryMethod, string> = {
  'Pick up': 'Pick up at the office',
  Delivery: 'Delivery'
};

/* The ways to get an order that Settings has on, pick-up first as in the design. */
export function methodOptions(settings: IStoreSettings, includeOff: boolean = false): IMethodOption[] {
  const options: IMethodOption[] = [];
  if (settings.pickUp || includeOff) {
    options.push({ key: 'Pick up', title: METHOD_TITLES['Pick up'], note: settings.pickUpNote, off: !settings.pickUp });
  }
  if (settings.delivery || includeOff) {
    options.push({ key: 'Delivery', title: METHOD_TITLES.Delivery, note: settings.deliveryNote, off: !settings.delivery });
  }
  return options;
}

export interface IMethodChoicesProps {
  options: IMethodOption[];
  method?: DeliveryMethod;
  onPick: (method: DeliveryMethod) => void;
  disabled?: boolean;
  /** The radio group's name, unique on the page. */
  name: string;
  /** Set in Customize, where the notes can be edited. */
  say?: Say;
}

/* The "How do you want it?" cards, shared by checkout and the Customize preview. */
const MethodChoices: React.FC<IMethodChoicesProps> = ({ options, method, onPick, disabled, name, say }) => (
  <div className={styles.choices} role="radiogroup" aria-label="How do you want it?">
    {options.map(o => {
      const noteKey = o.key === 'Pick up' ? 'pickUpNote' : 'deliveryNote';
      const note = o.note.trim();
      return (
        <label key={o.key} className={`${styles.choice} ${method === o.key ? styles.chosen : ''}`}>
          <input
            type="radio" name={name} value={o.key}
            checked={method === o.key} disabled={disabled}
            onChange={() => onPick(o.key)}
          />
          <span>
            <span className={styles.choiceTitle}>
              {o.title}
              {o.off && <span className={styles.offNote}> — turned off in Settings, so staff won&apos;t see this</span>}
            </span>
            {say
              ? <span className={styles.choiceNote}>{say(noteKey, note)}</span>
              : note && <span className={styles.choiceNote}>{note}</span>}
          </span>
        </label>
      );
    })}
  </div>
);

export default MethodChoices;
