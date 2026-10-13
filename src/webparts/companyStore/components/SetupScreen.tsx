import * as React from 'react';
import { MessageBar, MessageBarType, PrimaryButton } from '@fluentui/react';
import styles from './CompanyStore.module.scss';
import { STORE_LISTS } from '../setup/schema';
import type { IProblem } from '../setup/problems';
import { SETUP_SCREEN } from '../strings/setup';

export interface ISetupScreenProps {
  firstTime: boolean;
  problems: IProblem[];
  onRun: () => void;
}

const SetupScreen: React.FC<ISetupScreenProps> = ({ firstTime, problems, onRun }) => {
  const fixable = problems.filter(p => p.fixable);
  const needsIT = problems.filter(p => !p.fixable);

  return (
    <div className={styles.setup}>
      {firstTime ? (
        <>
          <h2>{SETUP_SCREEN.firstTitle}</h2>
          <p>{SETUP_SCREEN.firstIntro(STORE_LISTS.length)}</p>
          <dl className={styles.lists}>
            {STORE_LISTS.map(def => (
              <React.Fragment key={def.key}>
                <dt>{def.title}</dt>
                <dd>{SETUP_SCREEN.whoSees[def.key]}</dd>
              </React.Fragment>
            ))}
            <dt>{SETUP_SCREEN.managersTerm}</dt>
            <dd>{SETUP_SCREEN.managersSay}</dd>
          </dl>
          <MessageBar messageBarType={MessageBarType.warning}>{SETUP_SCREEN.addressWarning}</MessageBar>
          <PrimaryButton className={styles.go} text={SETUP_SCREEN.run} onClick={onRun} />
        </>
      ) : (
        <>
          <h2>{SETUP_SCREEN.fixTitle}</h2>
          <p>{SETUP_SCREEN.fixIntro}</p>
          <ul>{fixable.map((p, i) => <li key={i}>{p.text}</li>)}</ul>
          <PrimaryButton className={styles.go} text={SETUP_SCREEN.fix} onClick={onRun} />
        </>
      )}

      {needsIT.length > 0 && (
        <>
          <h3>{SETUP_SCREEN.needsItTitle}</h3>
          <p>{SETUP_SCREEN.needsItIntro}</p>
          <ul>{needsIT.map((p, i) => <li key={i}>{p.text}</li>)}</ul>
        </>
      )}
    </div>
  );
};

export default SetupScreen;
