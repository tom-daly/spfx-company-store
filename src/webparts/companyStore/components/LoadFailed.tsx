import * as React from 'react';
import { DefaultButton, MessageBar, MessageBarType } from '@fluentui/react';

export interface ILoadFailedProps {
  /** What didn't load, like "The shop could not load." */
  lead: string;
  /** Why, in plain words. */
  error: string;
  onRetry: () => void;
  /** The class for the line Try again sits on, from the page it's on. */
  retryClassName?: string;
}

/* Something didn't load: what, why, and a Try again button. */
const LoadFailed: React.FC<ILoadFailedProps> = ({ lead, error, onRetry, retryClassName }) => (
  <MessageBar messageBarType={MessageBarType.error} isMultiline>
    {lead} {error}
    <div className={retryClassName}>
      <DefaultButton text="Try again" onClick={onRetry} />
    </div>
  </MessageBar>
);

export default LoadFailed;
