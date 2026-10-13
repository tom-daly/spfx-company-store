import * as React from 'react';
import {
  DefaultButton, Link, MessageBar, MessageBarType, PrimaryButton, Spinner, SpinnerSize
} from '@fluentui/react';
import styles from './CompanyStore.module.scss';
import manageStyles from './manage/Manage.module.scss';
import type { SPFI } from '../sp';
import type { ListIds } from '../setup/schema';
import type { ISiteInfo, IProblem } from '../setup/problems';
import { countProducts } from '../store/products';
import { IStoreSettings, currencyInfo } from '../store/settings';
import { loadSettings } from '../store/settingsStore';
import { explain } from '../setup/errors';
import type { GetGraph } from '../store/orderEmail';
import { opensMyOrders, withoutHash } from '../store/myOrdersView';
import Shop from './shop/Shop';
import MyOrders from './shop/MyOrders';
import CustomizeMessages from './customize/CustomizeMessages';
import ManageNav, { ManageTab } from './manage/ManageNav';
import ProductsPage, { ADDING_PRODUCTS } from './manage/ProductsPage';
import ProductEditor from './manage/ProductEditor';
import OrdersPage from './manage/OrdersPage';
import SettingsPage from './manage/SettingsPage';
import UnsavedBar from './UnsavedBar';
import type { INotice } from './notice';
import { scrollToTopIfPast } from './scrollToTopIfPast';

export interface IStoreHomeProps {
  sp: SPFI;
  site: ISiteInfo;
  /** For the order email; passed on to checkout. */
  getGraph: GetGraph;
  ids: ListIds;
  /** Site owners and store managers: they get the pages for running the store. */
  canRun: boolean;
  /** Only ever has anything for site owners. */
  needsIT: IProblem[];
  /** Shown once, straight after setup. */
  notice?: string;
}

/* The pages of the store. Staff only ever get the shop and their own orders. */
type View =
  | { page: 'shop' | 'products' | 'orders' | 'settings' }
  | { page: 'myOrders' }
  | { page: 'editor'; productId?: number }
  | { page: 'customize'; back: View };

/* A page somebody asked to go to while something on this one wasn't saved. */
interface ILeave {
  view: View;
  fromNav: boolean;
}

/* The editor belongs under Products & stock, and My orders under the shop, so those stay picked. */
const tabOf = (view: View): ManageTab =>
  view.page === 'editor' ? 'products' : view.page === 'myOrders' ? 'shop' : view.page;

const samePage = (a: View, b: View): boolean =>
  a.page === b.page && (a.page !== 'editor' || b.page !== 'editor' || a.productId === b.productId);

/* Changes whenever a different page shows, for the effect that brings it into view. */
const pageKey = (view: View): string => (view.page === 'editor' ? `editor-${String(view.productId)}` : view.page);

/*
 * The store itself. Staff get the shop and their own orders. Site owners and
 * store managers also get a row of pages along the top: the shop, products
 * and stock, orders, settings and the wording people see.
 */
const StoreHome: React.FC<IStoreHomeProps> = ({ sp, site, getGraph, ids, canRun, needsIT, notice }) => {
  // A link ending in #my-orders, like the one in the status emails, opens on My orders.
  const [view, setView] = React.useState<View>(
    (): View => (opensMyOrders(window.location.hash) ? { page: 'myOrders' } : { page: 'shop' }));
  const [count, setCount] = React.useState<number | undefined>();
  // Missing until loaded, so nothing can save over the real settings with the defaults.
  const [settings, setSettings] = React.useState<IStoreSettings | undefined>();
  const [failed, setFailed] = React.useState(false);
  const [shopVersion, setShopVersion] = React.useState(0);
  const [productsVersion, setProductsVersion] = React.useState(0);
  const [unsaved, setUnsaved] = React.useState(false);
  const [leaving, setLeaving] = React.useState<ILeave | undefined>();
  const [message, setMessage] = React.useState<INotice | undefined>(
    notice ? { type: MessageBarType.success, text: notice } : undefined);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const focusContent = React.useRef(false);

  const load = React.useCallback(async (): Promise<void> => {
    setFailed(false);
    try {
      const [n, saved] = await Promise.all([countProducts(sp, ids), loadSettings(sp, ids)]);
      setSettings(saved);
      setCount(n);
    } catch (e) {
      setFailed(true);
      setMessage({ type: MessageBarType.error, text: explain(e) });
    }
  }, [sp, ids]);

  React.useEffect(() => { load().catch(() => undefined); }, [load]);

  // The #my-orders has done its job. Taken off the address, so a refresh later opens the shop as usual.
  React.useEffect(() => {
    if (!opensMyOrders(window.location.hash)) return;
    try {
      window.history.replaceState(window.history.state, '', withoutHash(window.location.href));
    } catch {
      // Left on the address, it does no harm.
    }
  }, []);

  const recount = async (): Promise<void> => {
    try {
      setCount(await countProducts(sp, ids));
    } catch (e) {
      setMessage({ type: MessageBarType.error, text: explain(e) });
    }
  };

  /* Products or stock changed somewhere, so everything that shows them loads again. */
  const productsChanged = (): void => {
    setShopVersion(v => v + 1);
    setProductsVersion(v => v + 1);
    recount().catch(() => undefined);
  };

  // Saved after all, so there's nothing left to ask about.
  React.useEffect(() => { if (!unsaved) setLeaving(undefined); }, [unsaved]);

  /* A new page starts at its top if the page had been scrolled past it. When it
     opened from anywhere but the row of pages, the button pressed has gone, so
     focus moves to the new page instead of getting lost. */
  const key = pageKey(view);
  React.useEffect(() => {
    const root = rootRef.current;
    const content = contentRef.current;
    if (!root || !content) return;
    scrollToTopIfPast(root);
    if (!focusContent.current) return;
    focusContent.current = false;
    // Unless the new page already put focus somewhere of its own, like its first box.
    const active = document.activeElement;
    const placed = active instanceof HTMLElement && active !== content && content.contains(active) &&
      active.offsetParent !== null;
    if (!placed) content.focus({ preventScroll: true });
  }, [key]);

  /* Straight to a page, with nothing to ask. */
  const show = (next: View, fromNav: boolean): void => {
    focusContent.current = !fromNav;
    setLeaving(undefined);
    setMessage(undefined);
    setView(next);
  };

  /* To a page because somebody asked to go there; checks first if something isn't saved. */
  const go = (next: View, fromNav = false): void => {
    if (samePage(next, view)) return;
    if (unsaved) setLeaving({ view: next, fromNav });
    else show(next, fromNav);
  };

  const goTab = (tab: ManageTab): void => {
    if (tab === 'customize') go({ page: 'customize', back: view.page === 'customize' ? view.back : view }, true);
    else go({ page: tab }, true);
  };

  const toProducts = (): void => show({ page: 'products' }, false);

  const toMyOrders = (): void => go({ page: 'myOrders' });

  const shopPage = (s: IStoreSettings): JSX.Element => {
    if (count === undefined) return <Spinner size={SpinnerSize.medium} />;
    if (count === 0 && canRun) {
      return (
        <div className={styles.nextStep}>
          <h2>Next: add your products</h2>
          <p>{ADDING_PRODUCTS} Both are on the Products &amp; stock page.</p>
          <p>
            Prices are in {currencyInfo(s.currency).label}.{' '}
            <Link onClick={() => go({ page: 'settings' })}>Change that in Settings</Link> before you add any.
          </p>
          <div className={styles.actions}>
            <PrimaryButton text="Go to Products & stock" onClick={() => go({ page: 'products' })} />
          </div>
        </div>
      );
    }
    if (count === 0) {
      return (
        <div className={styles.notice}>
          <h2>Nothing in the store yet</h2>
          <p>Check back soon.</p>
          {/* Anything they ordered before can still be followed. */}
          <div className={styles.go}><Link onClick={toMyOrders}>See my orders</Link></div>
        </div>
      );
    }
    return (
      // A new key after products change, so the shop loads again and shows them.
      <Shop
        key={shopVersion} sp={sp} ids={ids} site={site} settings={s} getGraph={getGraph}
        canRun={canRun}
        onMyOrders={toMyOrders}
        onEditProduct={canRun ? productId => go({ page: 'editor', productId }) : undefined}
      />
    );
  };

  const page = (s: IStoreSettings): JSX.Element => (
    <>
      {view.page === 'shop' && shopPage(s)}

      {view.page === 'myOrders' && (
        <MyOrders sp={sp} ids={ids} site={site} settings={s} onShop={() => go({ page: 'shop' })} />
      )}

      {/* Kept open behind the editor, so coming back finds the list as it was left. */}
      {(view.page === 'products' || view.page === 'editor') && (
        <div hidden={view.page === 'editor'}>
          <ProductsPage
            sp={sp} ids={ids} settings={s} version={productsVersion}
            onEdit={productId => go({ page: 'editor', productId })}
            onChanged={() => {
              setShopVersion(v => v + 1);
              recount().catch(() => undefined);
            }}
          />
        </div>
      )}

      {view.page === 'editor' && (
        <ProductEditor
          key={String(view.productId)}
          sp={sp} ids={ids} currency={s.currency} productId={view.productId}
          onSaved={(name, added) => {
            productsChanged();
            toProducts();
            setMessage({ type: MessageBarType.success, text: added ? `${name} added.` : `${name} saved.` });
          }}
          onCancel={toProducts}
          onPartlySaved={productsChanged}
          onDeleted={name => {
            productsChanged();
            toProducts();
            setMessage({ type: MessageBarType.success, text: `${name} deleted.` });
          }}
        />
      )}

      {view.page === 'orders' && <OrdersPage sp={sp} ids={ids} site={site} settings={s} getGraph={getGraph} />}

      {view.page === 'settings' && (
        <SettingsPage
          sp={sp} ids={ids} site={site} settings={s}
          onSaved={setSettings}
          onCustomize={() => go({ page: 'customize', back: { page: 'settings' } })}
          onUnsavedChange={setUnsaved}
        />
      )}

      {view.page === 'customize' && (
        <CustomizeMessages
          sp={sp} ids={ids} site={site} settings={s}
          onClose={() => show(view.back, false)}
          onSaved={saved => {
            setSettings(saved);
            show(view.back, false);
            setMessage({ type: MessageBarType.success, text: 'Messages saved.' });
          }}
        />
      )}
    </>
  );

  return (
    <div ref={rootRef}>
      {canRun && <ManageNav current={tabOf(view)} onGo={goTab} />}

      {site.isOwner && needsIT.length > 0 && (
        <MessageBar messageBarType={MessageBarType.warning} isMultiline>
          <strong>Needs IT.</strong> Ask a site collection administrator to open this page and fix:
          <ul>{needsIT.map((p, i) => <li key={i}>{p.text}</li>)}</ul>
        </MessageBar>
      )}

      {leaving && (
        <UnsavedBar
          onDiscard={() => {
            setUnsaved(false);
            show(leaving.view, leaving.fromNav);
          }}
          onKeep={() => setLeaving(undefined)}
          className={manageStyles.barActions}
        />
      )}

      {message && (
        <MessageBar messageBarType={message.type} isMultiline onDismiss={() => setMessage(undefined)}>
          {message.text}
        </MessageBar>
      )}

      <div ref={contentRef} tabIndex={-1} className={manageStyles.content}>
        {settings && page(settings)}
        {!settings && !failed && <Spinner size={SpinnerSize.medium} />}
        {!settings && failed && (
          <div className={styles.actions}>
            <DefaultButton
              text="Try again"
              onClick={() => {
                setMessage(undefined);
                load().catch(() => undefined);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default StoreHome;
