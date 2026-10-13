import * as React from 'react';
import { ActionButton, DatePicker, DayOfWeek, Label, getId } from '@fluentui/react';
import styles from './OrderEditor.module.scss';
import { dayText, fromIsoDate, isoDate } from '../../store/dates';

export interface IDayFieldProps {
  label: string;
  /** The day, like 2026-10-15, or empty for none. */
  value: string;
  onChange: (day: string) => void;
  disabled?: boolean;
}

/* "Thu 15 Oct 2026" in the box, the same as everywhere else in the store. */
const showDay = (d?: Date): string => (d ? dayText(isoDate(d)) : '');

/*
 * A day picked from a calendar that starts on Monday, with a Clear button
 * beside it. Picked only, never typed, so it is always a real day.
 *
 * The label sits above the box and Clear, not inside the date picker: the
 * picker leaves a little space under its box, which would otherwise push the
 * box out of line with the boxes beside it and Clear out of line with the box.
 */
const DayField: React.FC<IDayFieldProps> = ({ label, value, onChange, disabled }) => {
  // The calendar remembers the last day picked even once it's cleared, so Clear starts it afresh.
  const [fresh, setFresh] = React.useState(0);
  const labelId = React.useMemo(() => getId('dayLabel'), []);
  const date = React.useMemo(() => fromIsoDate(value), [value]);

  const clear = (): void => {
    onChange('');
    setFresh(n => n + 1);
  };

  return (
    <div>
      <Label id={labelId} disabled={disabled}>{label}</Label>
      <div className={styles.dayField}>
        <DatePicker
          key={fresh}
          className={styles.dayPicker}
          ariaLabel={label}
          textField={{ 'aria-labelledby': labelId }}
          value={date}
          firstDayOfWeek={DayOfWeek.Monday}
          formatDate={showDay}
          allowTextInput={false}
          disabled={disabled}
          onSelectDate={d => onChange(d ? isoDate(d) : '')}
        />
        {/* Stays put when there's nothing to clear, so the keyboard isn't thrown elsewhere after a Clear. */}
        <ActionButton
          className={styles.clearDay} iconProps={{ iconName: 'Cancel' }} text="Clear" ariaLabel={`Clear ${label}`}
          disabled={disabled || !value} allowDisabledFocus onClick={clear}
        />
      </div>
    </div>
  );
};

export default DayField;
