import * as React from 'react';
import { MessageBar, MessageBarType, Spinner, SpinnerSize } from '@fluentui/react';
import styles from './CompanyStore.module.scss';
import type { ICompanyStoreProps } from './ICompanyStoreProps';
import { STORE_LISTS, ListIds } from '../setup/schema';
import { IProblem, allListsExist, findProblems, listIds } from '../setup/problems';
import type { IStep } from '../setup/plan';
import { canRunStore, readStoreState } from '../setup/storeState';
import { runSetup } from '../setup/installStore';
import { explain } from '../setup/errors';
import SetupScreen from './SetupScreen';
import SetupProgress from './SetupProgress';
import StoreHome from './StoreHome';

type Status =
  | { kind: 'checking' }
  | { kind: 'failed'; message: string }
  | { kind: 'notOpen' }
  | { kind: 'setup'; firstTime: boolean; problems: IProblem[] }
  | { kind: 'installing'; steps?: IStep[]; finished: boolean }
  | { kind: 'ready'; ids: ListIds; canRun: boolean; needsIT: IProblem[]; notice?: string };

/*
 * Checks the site every time the page opens. Staff only need to know the lists
 * are there; site owners get the full check, so anything missing or changed by
 * hand shows up as something they can fix with one click.
 */
const CompanyStore: React.FC<ICompanyStoreProps> = ({ sp, site, getGraph }) => {
  const [status, setStatus] = React.useState<Status>({ kind: 'checking' });

  const check = React.useCallback(async (notice?: string): Promise<void> => {
    setStatus({ kind: 'checking' });
    try {
      const state = await readStoreState(sp, site, site.isOwner);
      if (!site.isOwner) {
        if (!allListsExist(state)) {
          setStatus({ kind: 'notOpen' });
          return;
        }
        // Store managers get the pages for running the store; everyone else gets the shop.
        const canRun = await canRunStore(sp, state.orders.id || '').catch(() => false);
        setStatus({ kind: 'ready', ids: listIds(state), canRun, needsIT: [] });
        return;
      }
      const problems = findProblems(state, site.everyoneLogin);
      if (problems.some(p => p.fixable)) {
        const firstTime = !STORE_LISTS.some(def => state[def.key].exists);
        setStatus({ kind: 'setup', firstTime, problems });
      } else {
        setStatus({ kind: 'ready', ids: listIds(state), canRun: true, needsIT: problems, notice });
      }
    } catch (e) {
      setStatus({ kind: 'failed', message: explain(e) });
    }
  }, [sp, site]);

  React.useEffect(() => { check().catch(() => undefined); }, [check]);

  const setUp = async (): Promise<void> => {
    setStatus({ kind: 'installing', finished: false });
    try {
      const steps = await runSetup(sp, site, s => setStatus({ kind: 'installing', steps: s, finished: false }));
      if (steps.every(s => s.state === 'done')) {
        // A moment to see the last tick, then back to the store.
        await new Promise(resolve => setTimeout(resolve, 900));
        await check('The store is set up. Next, add your products.');
        return;
      }
      setStatus({ kind: 'installing', steps, finished: true });
    } catch (e) {
      setStatus({ kind: 'failed', message: explain(e) });
    }
  };

  return (
    <section className={styles.companyStore}>
      {status.kind === 'checking' && <Spinner size={SpinnerSize.large} label="Opening the store…" />}

      {status.kind === 'failed' && (
        <MessageBar messageBarType={MessageBarType.error}>
          The store could not open. {status.message}
        </MessageBar>
      )}

      {status.kind === 'notOpen' && (
        <div className={styles.notice}>
          <h2>The store isn&apos;t open yet</h2>
          <p>Check back soon.</p>
        </div>
      )}

      {status.kind === 'setup' && (
        <SetupScreen
          firstTime={status.firstTime}
          problems={status.problems}
          onRun={() => { setUp().catch(() => undefined); }}
        />
      )}

      {status.kind === 'installing' && (
        <SetupProgress
          steps={status.steps}
          finished={status.finished}
          onDone={() => { check().catch(() => undefined); }}
          onRetry={() => { setUp().catch(() => undefined); }}
        />
      )}

      {status.kind === 'ready' && (
        <StoreHome
          sp={sp} site={site} getGraph={getGraph}
          ids={status.ids} canRun={status.canRun} needsIT={status.needsIT} notice={status.notice}
        />
      )}
    </section>
  );
};

export default CompanyStore;
