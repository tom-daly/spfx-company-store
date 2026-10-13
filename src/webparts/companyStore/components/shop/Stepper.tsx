import * as React from 'react';
import { Icon } from '@fluentui/react';
import styles from './Shop.module.scss';

export interface IStepperProps {
  value: number;
  min: number;
  max: number;
  /** Read out for the whole control, like "Quantity of Crew hoodie". */
  label: string;
  onChange: (value: number) => void;
  disabled?: boolean;
}

/* Minus, the number, plus. At either end the button stays focusable but does
   nothing (aria-disabled rather than disabled), so a keyboard user pressing
   plus until it stops doesn't get thrown back to the top of the page. */
const Stepper: React.FC<IStepperProps> = ({ value, min, max, label, onChange, disabled }) => {
  const canLess = !disabled && value > min;
  const canMore = !disabled && value < max;
  return (
    <div className={styles.stepper} role="group" aria-label={label}>
      <button
        type="button" aria-label="One fewer" aria-disabled={!canLess}
        onClick={() => { if (canLess) onChange(value - 1); }}
      >
        <Icon iconName="Remove" aria-hidden="true" />
      </button>
      <span className={styles.stepperValue} aria-live="polite" aria-atomic="true">{value}</span>
      <button
        type="button" aria-label="One more" aria-disabled={!canMore}
        onClick={() => { if (canMore) onChange(value + 1); }}
      >
        <Icon iconName="Add" aria-hidden="true" />
      </button>
    </div>
  );
};

export default Stepper;
