import * as React from 'react';
import { DefaultButton, Icon, PrimaryButton, ProgressIndicator, Spinner, SpinnerSize } from '@fluentui/react';
import styles from './CompanyStore.module.scss';
import type { IStep, StepState } from '../setup/plan';
import { COMMON } from '../strings/common';
import { SETUP_PROGRESS } from '../strings/setup';

/* The Fluent icon in each step's coloured circle. */
const MARK: Record<StepState, string> = {
  waiting: '',
  running: '',
  done: 'CheckMark',
  failed: 'Important',
  skipped: 'Remove'
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
  if (!steps) return <Spinner size={SpinnerSize.large} label={SETUP_PROGRESS.checking} />;

  const total = steps.length;
  const doneCount = steps.filter(settled).length;
  const notDone = steps.filter(s => s.state === 'failed' || s.state === 'skipped');
  const current = steps.filter(s => s.state === 'running')[0];

  const heading = !finished ? SETUP_PROGRESS.workingTitle
    : notDone.length ? SETUP_PROGRESS.notFinishedTitle
    : SETUP_PROGRESS.doneTitle;

  return (
    <div className={styles.setup}>
      <h2>{heading}</h2>

      {!finished && (
        <ProgressIndicator
          percentComplete={total ? doneCount / total : 0}
          description={SETUP_PROGRESS.stepOf(Math.min(doneCount + 1, total), total)}
        />
      )}
      {finished && notDone.length === 0 && (
        <p>{total ? SETUP_PROGRESS.allDone(total) : SETUP_PROGRESS.nothingToDo}</p>
      )}
      {finished && notDone.length > 0 && <p>{SETUP_PROGRESS.someFailed(notDone.length, total)}</p>}

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
              <span className={styles.srOnly}>{SETUP_PROGRESS.stepState(s.state)}</span>
              {s.error && <span className={styles.stepError}>{s.error}</span>}
            </span>
          </li>
        ))}
      </ol>

      {finished && (
        <div className={styles.actions}>
          {notDone.length > 0 ? (
            <>
              <PrimaryButton text={COMMON.tryAgain} onClick={onRetry} />
              <DefaultButton text={COMMON.close} onClick={onDone} />
            </>
          ) : (
            <PrimaryButton text={SETUP_PROGRESS.openStore} onClick={onDone} />
          )}
        </div>
      )}
    </div>
  );
};

export default SetupProgress;
