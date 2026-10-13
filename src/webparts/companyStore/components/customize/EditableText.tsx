import * as React from 'react';
import styles from './Customize.module.scss';
import { FILL_INS, MessageKey } from '../../store/messages';

/**
 * How a screen shows a message an owner can change. Normally it's just the text;
 * in Customize it's an EditableText. Screens call it with the text already
 * filled in for the order on show.
 */
export type Say = (key: MessageKey, shown: string) => React.ReactNode;

export interface IEditableTextProps {
  /** What the owner types, fill-ins and all. */
  value: string;
  /** The same, filled in for the sample order. */
  shown: string;
  /** The standard wording, for "Use the standard wording". */
  standard: string;
  onChange: (value: string) => void;
  /** Read out to screen readers, like "Order placed message". */
  label: string;
  /** Shown while empty. */
  emptyText: string;
  multiline?: boolean;
  /** Offer the fill-ins. Off for words shown before there is an order. */
  fillIns?: boolean;
}

/*
 * Outlined words that turn into a text box when clicked, in the same place and
 * the same type, so the owner sees exactly where the words will sit. Typing
 * changes the preview straight away; Escape puts back what was there.
 */
const EditableText: React.FC<IEditableTextProps> = props => {
  const { value, shown, standard, onChange, label, emptyText, multiline, fillIns } = props;
  const [editing, setEditing] = React.useState(false);
  const before = React.useRef(value);
  const box = React.useRef<HTMLTextAreaElement & HTMLInputElement>(null);

  React.useEffect(() => {
    if (editing && box.current) {
      box.current.focus();
      box.current.select();
    }
  }, [editing]);

  const start = (): void => {
    before.current = value;
    setEditing(true);
  };

  const insert = (fill: string): void => {
    const el = box.current;
    if (!el) {
      onChange(value + fill);
      return;
    }
    const at = el.selectionStart === null ? value.length : el.selectionStart;
    const to = el.selectionEnd === null ? at : el.selectionEnd;
    onChange(value.slice(0, at) + fill + value.slice(to));
    // Put the cursor after what was just added, once React has drawn it.
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(at + fill.length, at + fill.length);
    }, 0);
  };

  if (!editing) {
    return (
      <button
        type="button" className={styles.editable} onClick={start}
        aria-label={`${label}: ${shown || 'empty'}. Click to change.`}
      >
        <span className={shown ? styles.shown : styles.empty}>{shown || emptyText}</span>
        <span className={styles.editBadge} aria-hidden="true">Edit</span>
      </button>
    );
  }

  const keys = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') {
      onChange(before.current);
      setEditing(false);
    }
    if (e.key === 'Enter' && !multiline) setEditing(false);
  };

  return (
    <span className={styles.editing}>
      {multiline ? (
        <textarea
          ref={box} className={styles.box} value={value} aria-label={label}
          rows={Math.max(2, value.split('\n').length)}
          onChange={e => onChange(e.target.value)} onKeyDown={keys}
        />
      ) : (
        <input
          ref={box} className={styles.box} value={value} aria-label={label}
          onChange={e => onChange(e.target.value)} onKeyDown={keys}
        />
      )}
      <span className={styles.tools}>
        {fillIns && (
          <span className={styles.fillIns}>
            Add:
            {FILL_INS.map(f => (
              // onMouseDown keeps the cursor in the box, so the fill-in lands where it was.
              <button key={f} type="button" className={styles.chip}
                onMouseDown={e => e.preventDefault()} onClick={() => insert(f)}>{f}</button>
            ))}
          </span>
        )}
        {value !== standard && (
          <button type="button" className={styles.linkish} onClick={() => onChange(standard)}>
            Use the standard wording
          </button>
        )}
        <button type="button" className={styles.done} onClick={() => setEditing(false)}>Done</button>
      </span>
    </span>
  );
};

export default EditableText;
