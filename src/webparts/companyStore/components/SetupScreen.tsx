import * as React from 'react';
import { MessageBar, MessageBarType, PrimaryButton } from '@fluentui/react';
import styles from './CompanyStore.module.scss';
import { STORE_LISTS, ListKey } from '../setup/schema';
import type { IProblem } from '../setup/problems';

/* What each list is for and who can see it, in the words a site owner needs. */
const WHO_SEES: Record<ListKey, string> = {
  settings: 'Currency, order numbers, pick-up and delivery. Site owners and store managers change them from ' +
    'the store page. Hidden from the site contents.',
  products: 'What the store sells. Staff can look; site owners and store managers edit it.',
  stock: 'How many of each are left. Staff can change the numbers, so checkout can take items off. ' +
    'Hidden from the site contents.',
  orders: 'One row per order. Staff see only their own; site owners and store managers see them all.',
  addresses: 'Where to send orders. Each person sees only their own. Site owners and store managers can\'t ' +
    'open it either — only IT can. Hidden from the site contents.'
};

/* The group setup makes, said the same way as the lists. */
const MANAGERS_SAY = 'The people who run the store day to day: products, stock, orders and settings. ' +
  'They can add product photos too. You add them on the store\'s Settings page once it\'s set up.';

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
          <h2>Set up the store</h2>
          <p>
            This makes {STORE_LISTS.length} lists and a Store managers group on this site, and decides who can see
            what. It only needs doing once.
          </p>
          <dl className={styles.lists}>
            {STORE_LISTS.map(def => (
              <React.Fragment key={def.key}>
                <dt>{def.title}</dt>
                <dd>{WHO_SEES[def.key]}</dd>
              </React.Fragment>
            ))}
            <dt>Store managers</dt>
            <dd>{MANAGERS_SAY}</dd>
          </dl>
          <MessageBar messageBarType={MessageBarType.warning}>
            Once this runs, site owners can&apos;t open the address list, and only IT can change it.
          </MessageBar>
          <PrimaryButton className={styles.go} text="Set up the store" onClick={onRun} />
        </>
      ) : (
        <>
          <h2>The store needs a fix</h2>
          <p>Something is missing or has been changed by hand. Staff may not be able to order until it is put right.</p>
          <ul>{fixable.map((p, i) => <li key={i}>{p.text}</li>)}</ul>
          <PrimaryButton className={styles.go} text="Fix it" onClick={onRun} />
        </>
      )}

      {needsIT.length > 0 && (
        <>
          <h3>Needs IT</h3>
          <p>
            You don&apos;t have the rights to change these. Ask IT (a site collection administrator) to open
            this page — they&apos;ll see the same button and it will put these right too.
          </p>
          <ul>{needsIT.map((p, i) => <li key={i}>{p.text}</li>)}</ul>
        </>
      )}
    </div>
  );
};

export default SetupScreen;
