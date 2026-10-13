import * as React from 'react';
import {
  DefaultButton, Dropdown, Icon, Link, MessageBar, MessageBarType, Spinner, SpinnerSize, getId
} from '@fluentui/react';
import styles from './Orders.module.scss';
import type { SPFI } from '../../sp';
import type { ListIds } from '../../setup/schema';
import { ISiteInfo, ordersListUrl } from '../../setup/problems';
import { explain } from '../../setup/errors';
import { Currency, IStoreSettings, formatMoney } from '../../store/settings';
import { lineName, lineTotal } from '../../store/orderText';
import { MOST_ORDERS, emailStatus, loadOrders, setOrderStatus } from '../../store/ordersAdmin';
import {
  FILTERS, IOrder, OrderFilter, OrderStatus, countOrders, emptyText, itemCountText, summaryText, visibleOrders,
  withStatus
} from '../../store/ordersView';
import { placedText } from '../../store/myOrdersView';
import { dateText, dayText, timeText } from '../../store/dates';
import { IStatusDetails, emailWarningText } from '../../store/orderEdits';
import { historyNewestFirst, withSavedOrder } from '../../store/orderForm';
import type { GetGraph } from '../../store/orderEmail';
import { trackingFor } from '../../store/tracking';
import { StatusEmailKind, emailFor } from '../../store/statusEmailText';
import OrderEditor from './OrderEditor';
import StatusDialog from './StatusDialog';
import { STATUS_OPTIONS } from './statusOptions';
import { withoutKey } from '../withoutKey';

export interface IOrdersPageProps {
  sp: SPFI;
  ids: ListIds;
  site: ISiteInfo;
  settings: IStoreSettings;
  /** For the emails to the person who ordered, sent from the mailbox of whoever moves the order on. */
  getGraph: GetGraph;
}

/* How many columns the table has, for the rows that span all of them. */
const COLUMNS = 8;

/* Long enough to read, short enough not to linger once it's old news. */
const SAVED_NOTE_MS = 5000;

interface ISavedNote {
  id: number;
  text: string;
}

/* Said under an order's row when something went wrong with it. */
interface IRowProblem {
  text: string;
  /** The change was saved, but the email after it didn't go. */
  warning?: boolean;
}

/* An order waiting on the box that asks about the email before it moves on. */
interface IAsking {
  order: IOrder;
  status: OrderStatus;
  kind: StatusEmailKind;
}

/*
 * The tracking as a link, opening in a new tab: a web address as typed, or a
 * number from a carrier the store knows, linked to that carrier's page and
 * named. Anything else as it was typed.
 */
const Tracking: React.FC<{ tracking: string }> = ({ tracking }) => {
  const t = trackingFor(tracking);
  if (!t || !t.href) return <>{tracking}</>;
  return (
    <>
      {t.carrier && <>{t.carrier} </>}
      <Link href={t.href} target="_blank" rel="noopener noreferrer">{t.text}</Link>
    </>
  );
};

/* The dot between who, when and what. Read out as a pause rather than "dot". */
const Dot: React.FC = () => (
  <>
    <span className={styles.historyDot} aria-hidden="true"> · </span>
    <span className={styles.srOnly}>, </span>
  </>
);

/* Every change to the order, newest first: "Thomas Daly · 12 Oct 2026, 2:05 PM · Status changed from New to Packed". */
const History: React.FC<{ order: IOrder }> = ({ order }) => {
  const lines = historyNewestFirst(order.history);
  return (
    <section className={styles.history}>
      <h3 className={styles.label}>History</h3>
      {lines.length === 0 && <p className={styles.quiet}>Nothing recorded yet.</p>}
      {lines.length > 0 && (
        <ul className={styles.historyList}>
          {lines.map((h, i) => (
            <li key={i}>
              {h.who && <span className={styles.historyWho}>{h.who}</span>}
              {h.who && h.time && <Dot />}
              {h.time && <time className={styles.historyTime} dateTime={h.when}>{h.time}</time>}
              {(h.who || h.time) && <Dot />}
              <span>{h.what}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

interface IOrderDetailProps {
  order: IOrder;
  currency: Currency;
  /** The order's own page in the orders list. */
  itemUrl: string;
  /** Not while its status is saving or the list is loading again. */
  canEdit: boolean;
  /** Like "CS-0042 saved.", just after a save; empty otherwise. */
  savedText: string;
  onEdit: () => void;
}

/* An order opened out: where it goes, who, what they ordered, their note and what has happened to it since. */
const OrderDetail: React.FC<IOrderDetailProps> = ({ order, currency, itemUrl, canEdit, savedText, onEdit }) => {
  const money = (amount: number): string => formatMoney(amount, currency);
  const placed = placedText(order);

  let where: JSX.Element;
  if (order.method === 'Pick up') where = <p className={styles.text}>Collecting at the office.</p>;
  else if (order.shipTo.length) where = <p className={styles.address}>{order.shipTo.join('\n')}</p>;
  else where = <p className={styles.quiet}>No address was given.</p>;

  return (
    <>
      <div className={styles.detailBar}>
        <DefaultButton
          iconProps={{ iconName: 'Edit' }} text="Edit order" ariaLabel={`Edit order ${order.number}`}
          disabled={!canEdit} onClick={onEdit}
        />
        {/* Always here, so a screen reader is listening when the words arrive. */}
        <span className={styles.savedNote} role="status">
          {savedText && <><Icon iconName="CheckMark" aria-hidden="true" />{savedText}</>}
        </span>
      </div>

      <div className={styles.detail}>
        <section>
          <h3 className={styles.label}>Where it goes</h3>
          {where}
          {order.phone && <p className={styles.quiet}>Phone: {order.phone}</p>}
          {order.readyBy && (
            <>
              <h3 className={`${styles.label} ${styles.fact}`}>Ready by</h3>
              <p className={styles.text}>{dayText(order.readyBy)}</p>
            </>
          )}
          {order.tracking && (
            <>
              <h3 className={`${styles.label} ${styles.fact}`}>Tracking</h3>
              <p className={styles.text}><Tracking tracking={order.tracking} /></p>
            </>
          )}
          {order.pickedUpOn && (
            <>
              <h3 className={`${styles.label} ${styles.fact}`}>Picked up on</h3>
              <p className={styles.text}>{dayText(order.pickedUpOn)}</p>
            </>
          )}
        </section>

        <section>
          <h3 className={styles.label}>Who</h3>
          <p className={styles.text}>{order.who}</p>
          {order.email && (
            <p className={styles.text}><Link href={`mailto:${order.email}`}>{order.email}</Link></p>
          )}
          {placed && <p className={styles.quiet}>{placed}</p>}
        </section>

        <section>
          <h3 className={styles.label}>What they ordered</h3>
          {order.lines.length > 0 && (
            <ul className={styles.items}>
              {order.lines.map((line, i) => (
                <li key={i}>
                  <span>{line.qty} × {lineName(line)}</span>
                  <span className={styles.amount}>{money(lineTotal(line))}</span>
                </li>
              ))}
            </ul>
          )}
          {/* An order whose hidden copy can't be read still has the Items column to show. */}
          {order.lines.length === 0 && order.itemLines.length > 0 && (
            <ul className={styles.items}>
              {order.itemLines.map((text, i) => <li key={i}><span>{text}</span></li>)}
            </ul>
          )}
          {order.lines.length === 0 && order.itemLines.length === 0 && (
            <p className={styles.quiet}>Nothing is listed.</p>
          )}
          <p className={styles.total}><span>Total</span><span>{money(order.total)}</span></p>
        </section>

        <section>
          <h3 className={styles.label}>Their note</h3>
          {order.note
            ? <p className={styles.orderNote}>{order.note}</p>
            : <p className={styles.quiet}>No note.</p>}
        </section>
      </div>

      <History order={order} />

      <p className={styles.detailFoot}>
        <Link href={itemUrl} target="_blank" rel="noopener noreferrer">Open in the orders list</Link>
      </p>
    </>
  );
};

/*
 * Every order, for site owners and store managers to work through: filter,
 * search, open one up, and move it on from New to Confirmed to Packed to
 * Shipped, or for a pick-up from New to Confirmed to Ready for pick-up to
 * Picked up. Confirmed, Ready for pick-up and Shipped ask first whether to
 * email the person; the rest save straight away.
 */
const OrdersPage: React.FC<IOrdersPageProps> = ({ sp, ids, site, settings, getGraph }) => {
  const [orders, setOrders] = React.useState<IOrder[] | undefined>();
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | undefined>();
  const [filter, setFilter] = React.useState<OrderFilter>('open');
  const [query, setQuery] = React.useState('');
  const [openId, setOpenId] = React.useState<number | undefined>();
  const [saving, setSaving] = React.useState<number[]>([]);
  const [problems, setProblems] = React.useState<Record<number, IRowProblem>>({});
  // Orders changed here stay in view until the filter changes or the list loads again,
  // so marking one Shipped under "Open" doesn't whisk it away mid-click.
  const [kept, setKept] = React.useState<number[]>([]);
  // The order open in the edit panel.
  const [editingId, setEditingId] = React.useState<number | undefined>();
  const [savedNote, setSavedNote] = React.useState<ISavedNote | undefined>();
  // The order whose new status is waiting on the box that asks about the email.
  const [asking, setAsking] = React.useState<IAsking | undefined>();
  const idBase = React.useMemo(() => getId('storeOrder'), []);

  const load = React.useCallback(async (): Promise<void> => {
    setLoading(true);
    setLoadError(undefined);
    try {
      const loaded = await loadOrders(sp, ids);
      setOrders(loaded);
      setKept([]);
      setProblems({});
    } catch (e) {
      setLoadError(`The orders couldn't be loaded. Try Refresh in a moment. (${explain(e)})`);
    } finally {
      setLoading(false);
    }
  }, [sp, ids]);

  React.useEffect(() => { load().catch(() => undefined); }, [load]);

  React.useEffect(() => {
    if (!savedNote) return;
    const timer = window.setTimeout(() => setSavedNote(undefined), SAVED_NOTE_MS);
    return () => window.clearTimeout(timer);
  }, [savedNote]);

  const keep = (id: number): void => setKept(list => (list.indexOf(id) < 0 ? list.concat([id]) : list));

  /* Puts the old status back if SharePoint says no. Gives back the order as saved, or undefined if it wasn't. */
  const saveStatus = async (
    order: IOrder, status: OrderStatus, details: IStatusDetails
  ): Promise<IOrder | undefined> => {
    try {
      // The order as it was before the change, so its history can say what it changed from.
      const saved = await setOrderStatus(sp, ids, order, status, site.user.name, details);
      setOrders(list => list && withSavedOrder(list, saved));
      return saved;
    } catch (e) {
      setOrders(list => list && withStatus(list, order.id, order.status));
      const text = `${order.number} couldn't be changed to ${status}, so it's still ${order.status}. (${explain(e)})`;
      setProblems(map => ({ ...map, [order.id]: { text } }));
      return undefined;
    }
  };

  /* From the mailbox of whoever is looking. The new status is saved by now, and stays saved whatever the email does. */
  const sendEmail = async (saved: IOrder, kind: StatusEmailKind): Promise<void> => {
    const result = await emailStatus(sp, ids, getGraph, settings, kind, saved, site.user.name, site.pageUrl);
    setOrders(list => list && withSavedOrder(list, result.order));
    const failed = result.failed;
    if (failed !== undefined) {
      setProblems(map => ({ ...map, [saved.id]: { text: emailWarningText(saved, failed), warning: true } }));
    }
  };

  /* Shows the new status at once and saves it with what came with it, then emails the person if that was asked for. */
  const changeStatus = async (
    order: IOrder, status: OrderStatus, details: IStatusDetails, email: boolean
  ): Promise<void> => {
    if (status === order.status) return;
    setOrders(list => list && withStatus(list, order.id, status));
    keep(order.id);
    setProblems(map => withoutKey(map, order.id));
    // The dropdown stays off until the email is done too, so the row can't change under it.
    setSaving(list => list.concat([order.id]));
    try {
      const saved = await saveStatus(order, status, details);
      const kind = emailFor(status);
      if (saved && email && kind) await sendEmail(saved, kind);
    } finally {
      setSaving(list => list.filter(id => id !== order.id));
    }
  };

  /* Confirmed, Ready for pick-up and Shipped ask first. Until then, the dropdown shows the status as it was. */
  const pickStatus = (order: IOrder, status: OrderStatus): void => {
    if (status === order.status) return;
    const kind = emailFor(status);
    if (kind) setAsking({ order, status, kind });
    else changeStatus(order, status, {}, false).catch(() => undefined);
  };

  const answered = (details: IStatusDetails, email: boolean): void => {
    if (!asking) return;
    setAsking(undefined);
    changeStatus(asking.order, asking.status, details, email).catch(() => undefined);
  };

  /* The saved copy goes in place of the old one, stays open and in view, and says so for a moment. */
  const edited = (saved: IOrder): void => {
    setOrders(list => list && withSavedOrder(list, saved));
    keep(saved.id);
    setProblems(map => withoutKey(map, saved.id));
    setOpenId(saved.id);
    setSavedNote({ id: saved.id, text: `${saved.number} saved.` });
  };

  const toggle = (id: number): void => setOpenId(current => (current === id ? undefined : id));

  const pickFilter = (next: OrderFilter): void => {
    setFilter(next);
    setKept([]);
  };

  const listUrl = ordersListUrl(site);
  const counts = countOrders(orders || []);
  const visible = orders ? visibleOrders(orders, filter, query, kept) : [];
  const summary = summaryText(counts);
  const editing = orders && editingId !== undefined ? orders.filter(o => o.id === editingId)[0] : undefined;

  const renderOrder = (o: IOrder): JSX.Element => {
    const open = openId === o.id;
    const isSaving = saving.indexOf(o.id) >= 0;
    const detailId = `${idBase}-${o.id}`;
    const problem = problems[o.id];
    return (
      <React.Fragment key={o.id}>
        <tr className={open ? `${styles.row} ${styles.open}` : styles.row} onClick={() => toggle(o.id)}>
          <td>
            <button
              type="button"
              className={styles.caret}
              aria-expanded={open}
              aria-controls={open ? detailId : undefined}
              aria-label={`Details of ${o.number}`}
              onClick={e => {
                e.stopPropagation();
                toggle(o.id);
              }}
            >
              <Icon iconName={open ? 'ChevronDown' : 'ChevronRight'} aria-hidden="true" />
            </button>
            <span className={styles.number}>{o.number}</span>
          </td>
          <td>{o.who}</td>
          <td>
            {o.placed && (
              <>
                {dateText(o.placed)}
                <span className={styles.time}>{timeText(o.placed)}</span>
              </>
            )}
          </td>
          <td className={styles.num}>{itemCountText(o.items)}</td>
          <td>
            <span className={`${styles.pill} ${o.method === 'Delivery' ? styles.delivery : styles.pickUp}`}>
              {o.method}
            </span>
          </td>
          <td className={styles.num}>{formatMoney(o.total, settings.currency)}</td>
          {/* Picking a status mustn't open or close the row as well. */}
          <td onClick={e => e.stopPropagation()}>
            <div className={styles.statusCell}>
              <Dropdown
                // Ready for pick-up stands out: it's waiting on the person now, not on the owners.
                className={o.status === 'Ready for pick-up' ? `${styles.status} ${styles.ready}` : styles.status}
                ariaLabel={`Status of ${o.number}`}
                selectedKey={o.status}
                options={STATUS_OPTIONS[o.method]}
                // Also not while the list reloads, or the fresh copy could land on top of the change.
                disabled={isSaving || loading}
                onChange={(_, option) => { if (option) pickStatus(o, option.key as OrderStatus); }}
              />
              {isSaving && <Spinner size={SpinnerSize.xSmall} ariaLabel={`Saving ${o.number}`} />}
            </div>
          </td>
          <td>
            {!o.emailSent && (
              <span className={styles.warn} title="The order email didn't go out. You may want to let them know.">
                No
              </span>
            )}
          </td>
        </tr>
        {problem && (
          <tr className={styles.errorRow}>
            <td colSpan={COLUMNS}>
              <MessageBar
                messageBarType={problem.warning ? MessageBarType.warning : MessageBarType.error}
                isMultiline
                actions={<DefaultButton text="OK" onClick={() => setProblems(map => withoutKey(map, o.id))} />}
              >
                {problem.text}
              </MessageBar>
            </td>
          </tr>
        )}
        {open && (
          <tr className={styles.detailRow} id={detailId}>
            <td colSpan={COLUMNS}>
              <OrderDetail
                order={o} currency={settings.currency} itemUrl={`${listUrl}/DispForm.aspx?ID=${o.id}`}
                // A status still saving, or a fresh list arriving, could land on top of the edit.
                canEdit={!isSaving && !loading}
                savedText={savedNote && savedNote.id === o.id ? savedNote.text : ''}
                onEdit={() => setEditingId(o.id)}
              />
            </td>
          </tr>
        )}
      </React.Fragment>
    );
  };

  return (
    <div className={styles.orders}>
      <div className={styles.head}>
        <div>
          <h2 className={styles.title}>Orders</h2>
          {orders && summary && <p className={styles.summary}>{summary}</p>}
        </div>
        <div className={styles.headActions}>
          {loading && orders && <Spinner size={SpinnerSize.small} label="Loading…" labelPosition="right" />}
          <DefaultButton
            text="Refresh"
            // Not while a status is saving: the fresh list could undo what is on screen.
            disabled={loading || saving.length > 0}
            onClick={() => { load().catch(() => undefined); }}
          />
        </div>
      </div>

      {loadError && (
        <MessageBar className={styles.message} messageBarType={MessageBarType.error} isMultiline>
          {loadError}
        </MessageBar>
      )}

      {!orders && loading && <Spinner className={styles.loading} size={SpinnerSize.medium} label="Loading orders…" />}

      {orders && (
        <>
          <div className={styles.bar}>
            <div className={styles.filters} role="group" aria-label="Show orders">
              {FILTERS.map(f => (
                <button
                  key={f.key}
                  type="button"
                  className={filter === f.key ? `${styles.filter} ${styles.on}` : styles.filter}
                  aria-pressed={filter === f.key}
                  onClick={() => pickFilter(f.key)}
                >
                  {f.label}
                  <span className={styles.count}>{counts[f.key]}</span>
                </button>
              ))}
            </div>
            <div className={styles.search}>
              <Icon iconName="Search" className={styles.searchMark} aria-hidden="true" />
              <input
                type="search"
                placeholder="Search orders"
                aria-label="Search by order number, name or item"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>
          </div>

          {orders.length >= MOST_ORDERS && (
            <p className={styles.note}>
              Showing the newest {MOST_ORDERS} orders. Older ones are in the{' '}
              <Link href={listUrl} target="_blank" rel="noopener noreferrer">orders list</Link>.
            </p>
          )}

          {visible.length === 0 && <div className={styles.empty}>{emptyText(filter, query, counts)}</div>}

          {visible.length > 0 && (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <caption className={styles.srOnly}>Orders, newest first. Open an order to see its details.</caption>
                <thead>
                  <tr>
                    <th scope="col">Order</th>
                    <th scope="col">Who</th>
                    <th scope="col">Placed</th>
                    <th scope="col" className={styles.num}>Items</th>
                    <th scope="col">How</th>
                    <th scope="col" className={styles.num}>Total</th>
                    <th scope="col">Status</th>
                    <th scope="col">Email sent</th>
                  </tr>
                </thead>
                <tbody>{visible.map(renderOrder)}</tbody>
              </table>
            </div>
          )}
        </>
      )}

      {editing && (
        <OrderEditor
          key={editing.id} sp={sp} ids={ids} settings={settings} order={editing} who={site.user.name}
          onSaved={edited}
          onClose={() => setEditingId(undefined)}
        />
      )}

      {asking && (
        <StatusDialog
          key={asking.order.id} order={asking.order} kind={asking.kind}
          onConfirm={answered}
          onCancel={() => setAsking(undefined)}
        />
      )}
    </div>
  );
};

export default OrdersPage;
