import * as React from 'react';
import { DefaultButton, IButton, MessageBar, MessageBarType, PrimaryButton } from '@fluentui/react';

export interface IUnsavedBarProps {
  /** Throw them away. */
  onDiscard: () => void;
  /** Keep editing. */
  onKeep: () => void;
  /** For putting the keyboard on Keep editing. */
  keepRef?: React.RefObject<IButton>;
  /** The class for the row of buttons, from the page it sits on. */
  className?: string;
}

/* Asked on the way out of something with changes typed: throw them away, or keep editing. */
const UnsavedBar: React.FC<IUnsavedBarProps> = ({ onDiscard, onKeep, keepRef, className }) => (
  <MessageBar
    messageBarType={MessageBarType.warning}
    isMultiline
    actions={
      <div className={className}>
        <PrimaryButton text="Throw them away" onClick={onDiscard} />
        <DefaultButton componentRef={keepRef} text="Keep editing" onClick={onKeep} />
      </div>
    }
  >
    Your changes aren&apos;t saved yet.
  </MessageBar>
);

export default UnsavedBar;
