import * as React from 'react';
import { DefaultButton, Icon, PrimaryButton, ProgressIndicator, Spinner, SpinnerSize } from '@fluentui/react';
import styles from './CompanyStore.module.scss';
import type { IStep, StepState } from '../setup/plan';

/* The Fluent icon in each step's coloured circle. */
const MARK: Record<StepState, string> = {
  waiting: '',
  running: '',
  done: 'CheckMark',
  failed: 'Important',
  skipped: 'Remove'
};

/* Read out by screen readers in place of the coloured marks. */
const SAY: Record<StepState, string> = {
  waiting: 'to do',
  running: 'in progress',
  done: 'done',
  failed: 'failed',
  skipped: 'skipped'
};

const settled = (s: IStep): boolean => s.state === 'done' || s.state === 'failed' || s.state === 'skipped';

export interface ISetupProgressProps {
  /** Missing while setup is still working out what to do. */
  steps?: IStep[];
  finished: boolean;
  onDone: () => void;
  onRetry: () => void;
}

const SetupProgress: React.FC<ISetupProgressProps> = ({ steps, finished, onDone, onRetry }) => {
  if (!steps) return <Spinner size={SpinnerSize.large} label="Checking what is already there…" />;

  const total = steps.length;
  const doneCount = steps.filter(settled).length;
  const notDone = steps.filter(s => s.state === 'failed' || s.state === 'skipped');
  const current = steps.filter(s => s.state === 'running')[0];

  const heading = !finished ? 'Setting up the store'
    : notDone.length ? 'Setup didn\'t finish'
    : 'The store is set up';

  return (
    <div className={styles.setup}>
      <h2>{heading}</h2>

      {!finished && (
        <ProgressIndicator
          percentComplete={total ? doneCount / total : 0}
          description={`Step ${Math.min(doneCount + 1, total)} of ${total}`}
        />
      )}
      {finished && notDone.length === 0 && (
        <p>{total ? `All ${total} steps are done.` : 'Nothing needed doing.'}</p>
      )}
      {finished && notDone.length > 0 && (
        <p>
          {notDone.length} of {total} steps didn&apos;t work. Trying again picks up where it stopped.
        </p>
      )}

      <span className={styles.srOnly} role="status">
        {current ? current.label : finished ? heading : ''}
      </span>

      <ol className={styles.steps}>
        {steps.map(s => (
          <li key={s.id} className={styles[s.state]}>
            <span className={styles.mark} aria-hidden="true">
              {s.state === 'running' ? <Spinner size={SpinnerSize.xSmall} />
                : MARK[s.state] && <Icon iconName={MARK[s.state]} />}
            </span>
            <span className={styles.stepText}>
              {s.label}
              <span className={styles.srOnly}> — {SAY[s.state]}</span>
              {s.error && <span className={styles.stepError}>{s.error}</span>}
            </span>
          </li>
        ))}
      </ol>

      {finished && (
        <div className={styles.actions}>
          {notDone.length > 0 ? (
            <>
              <PrimaryButton text="Try again" onClick={onRetry} />
              <DefaultButton text="Close" onClick={onDone} />
            </>
          ) : (
            <PrimaryButton text="Open the store" onClick={onDone} />
          )}
        </div>
      )}
    </div>
  );
};

export default SetupProgress;
