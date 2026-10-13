import * as React from 'react';
import {
  DefaultButton, Icon, MessageBar, MessageBarType, PrimaryButton, Spinner, SpinnerSize, Toggle, css, getId
} from '@fluentui/react';
import styles from './Products.module.scss';
import type { SPFI } from '../../sp';
import type { ListIds } from '../../setup/schema';
import { Currency, IStoreSettings, formatMoney } from '../../store/settings';
import type { IProduct } from '../../store/types';
import type { Combo } from '../../store/variants';
import { loadCatalog, loadCatalogProduct } from '../../store/catalog';
import {
  deleteProduct, loadProductForEdit, productNames, saveProduct, saveStock, setActive
} from '../../store/products';
import {
  IProductForm, formFromDraft, hasOwnPrices, savedOptions, setLine, stockFromForm, stockTable, withStockEverywhere,
  withoutPrices
} from '../../store/productForm';
import { SAMPLES, sampleFiles } from '../../store/samples';
import { priceText } from '../../store/shopText';
import {
  ProductFilter, combinationsText, filterCounts, filterProducts, nothingText, stockLevel, summaryText, totalLeft,
  variesText
} from '../../store/productsTable';
import { countText } from '../../store/orderText';
import { explain } from '../../setup/errors';
import Photo from '../shop/Photo';
import StockEditor, { CellChange } from './StockGrid';
import LoadFailed from '../LoadFailed';
import type { INotice } from '../notice';
import { withoutKey } from '../withoutKey';

export interface IProductsPageProps {
  sp: SPFI;
  ids: ListIds;
  settings: IStoreSettings;
  /** Opens the full-page editor: a product's ID to change it, undefined to add a new one. */
  onEdit: (productId?: number) => void;
  /** Goes up whenever products change elsewhere (the editor saved), so this page loads again. */
  version: number;
  /** Something here changed products or stock, so the shop should load again. */
  onChanged: () => void;
}

let keys = 0;
const newKey = (): string => `s${++keys}`;

/** How to fill an empty store, said on the shop and here. */
export const ADDING_PRODUCTS: string = 'Add each thing the store sells, with a photo and how many you have. Or put ' +
  'in the sample products to see how the store looks — you can delete them later.';

/* ---------------------------------------------------------- delete, twice */

export interface IConfirmDeleteProps {
  /** What goes, read out on the button when there are several on the page: "Delete Reef crew tee". */
  name?: string;
  /** The button's words before it asks. */
  text?: string;
  /** The words for backing out. */
  keepText?: string;
  /** Deleting now. */
  busy: boolean;
  disabled?: boolean;
  /** As tall as Fluent's buttons, to sit beside Save and Cancel. */
  large?: boolean;
  onDelete: () => void;
}

/*
 * Delete in two steps, in place: the first press asks "Really delete?" and
 * offers a way back; only the second press deletes. Shared with the editor.
 */
export const ConfirmDelete: React.FC<IConfirmDeleteProps> = ({
  name, text = 'Delete', keepText = 'Cancel', busy, disabled, large, onDelete
}) => {
  const [asking, setAsking] = React.useState(false);
  const deleteRef = React.useRef<HTMLButtonElement>(null);

  const press = (): void => {
    if (!asking) {
      setAsking(true);
      return;
    }
    setAsking(false);
    onDelete();
  };

  const keep = (): void => {
    setAsking(false);
    // The way back goes away, so the keyboard lands on Delete again rather than at the top of the page.
    if (deleteRef.current) deleteRef.current.focus();
  };

  const label = !name ? undefined : asking ? `Really delete ${name}?` : `${text} ${name}`;
  return (
    <span className={css(styles.confirm, large && styles.large)}>
      <button
        type="button" ref={deleteRef} className={css(styles.btn, asking ? styles.btnConfirm : styles.btnDanger)}
        disabled={busy || disabled} aria-label={label} onClick={press}
      >
        {busy ? 'Deleting…' : asking ? 'Really delete?' : text}
      </button>
      {asking && <button type="button" className={styles.btn} onClick={keep}>{keepText}</button>}
    </span>
  );
};

/* ------------------------------------------------------- stock in place */

interface IStockDrawerProps {
  sp: SPFI;
  ids: ListIds;
  currency: Currency;
  product: IProduct;
  /** Its element ID, for the Stock button that opens it. */
  id: string;
  /** Numbers went in, some or all: the row should show them, and the shop load again. */
  onSaved: () => void;
  onClose: () => void;
}

/*
 * A product's stock, opened under its row: the same sheets as the product
 * editor. Saving writes the numbers (and the prices of their own, when those
 * boxes show) and nothing else about the product.
 */
const StockDrawer: React.FC<IStockDrawerProps> = ({ sp, ids, currency, product, id, onSaved, onClose }) => {
  const [form, setForm] = React.useState<IProductForm | undefined>();
  const [loadError, setLoadError] = React.useState<string | undefined>();
  // "Some combinations cost more or less": ticked, or there's a price typed already.
  const [pricesOn, setPricesOn] = React.useState(false);
  // Something typed since it opened or was last saved.
  const [changed, setChanged] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>();
  const [saved, setSaved] = React.useState(false);
  const alive = React.useRef(true);
  const productId = product.id;

  React.useEffect(() => () => { alive.current = false; }, []);

  /* The numbers as the list has them now, so a save starts from what is really there. */
  const load = React.useCallback(async (): Promise<void> => {
    const draft = await loadProductForEdit(sp, ids, productId);
    if (!alive.current) return;
    setForm(formFromDraft(draft, newKey));
    setPricesOn(false);
    setChanged(false);
  }, [sp, ids, productId]);

  React.useEffect(() => {
    load().catch(e => { if (alive.current) setLoadError(explain(e)); });
  }, [load]);

  const change = (next: (f: IProductForm) => IProductForm): void => {
    setForm(f => (f ? next(f) : f));
    setChanged(true);
    setSaved(false);
  };

  const setCell = (combo: Combo, cell: CellChange): void =>
    change(f => ({ ...f, lines: setLine(f.lines, savedOptions(f), combo, cell) }));

  /* Unticking clears the prices typed, so none are saved without being seen. */
  const choosePrices = (on: boolean): void => {
    setPricesOn(on);
    if (!on) change(withoutPrices);
  };

  const save = async (): Promise<void> => {
    if (!form) return;
    const lines = stockFromForm(form);
    if (typeof lines === 'string') {
      setError(lines);
      return;
    }
    setSaving(true);
    setError(undefined);
    setSaved(false);
    try {
      await saveStock(sp, ids, productId, savedOptions(form), lines);
    } catch (e) {
      // Some numbers may have gone in before the one that failed, so the row is read again either way.
      onSaved();
      if (!alive.current) return;
      setError(`The stock didn't all save. ${explain(e)} Press Save stock to try again.`);
      setSaving(false);
      return;
    }
    onSaved();
    try {
      await load();
      if (alive.current) setSaved(true);
    } catch (e) {
      if (alive.current) setError(`The stock saved, but it didn't load again to show you. ${explain(e)}`);
    } finally {
      if (alive.current) setSaving(false);
    }
  };

  const table = form ? stockTable(form) : undefined;

  return (
    <div id={id} className={styles.drawer} role="region" aria-label={`Stock of ${product.name}`}>
      {!form && !loadError && (
        <Spinner size={SpinnerSize.small} label="Opening the stock…" labelPosition="right" />
      )}
      {loadError && (
        <>
          <MessageBar messageBarType={MessageBarType.error} isMultiline>
            The stock didn&apos;t open. {loadError}
          </MessageBar>
          <div className={styles.drawerActions}>
            <DefaultButton text="Close" onClick={onClose} />
          </div>
        </>
      )}
      {form && table && (
        <>
          {table.tooMany !== undefined ? (
            <p className={styles.drawerNote}>
              {product.name} has {table.tooMany} combinations, too many to list here. Take some choices away in
              the editor.
            </p>
          ) : (
            <StockEditor
              table={table} usual={formatMoney(product.price, currency)} prices={pricesOn || hasOwnPrices(table)}
              onPrices={choosePrices} onChange={setCell} onFill={n => change(f => withStockEverywhere(f, n))}
              of={product.name}
            />
          )}
          {error && <MessageBar messageBarType={MessageBarType.error} isMultiline>{error}</MessageBar>}
          <div className={styles.drawerActions}>
            <PrimaryButton
              text="Save stock" disabled={saving || !changed}
              onClick={() => { save().catch(() => undefined); }}
            />
            {/* Cancel leaves what was typed behind: the stock opens with the saved numbers next time. */}
            <DefaultButton text={changed ? 'Cancel' : 'Close'} disabled={saving} onClick={onClose} />
            {saving && <Spinner size={SpinnerSize.small} label="Saving…" labelPosition="right" />}
            <span className={styles.savedNote} role="status">{saved && !changed ? 'Stock saved.' : ''}</span>
          </div>
        </>
      )}
    </div>
  );
};

/* ---------------------------------------------------------------- the page */

const FILTERS: Array<{ key: ProductFilter; text: string }> = [
  { key: 'all', text: 'All' },
  { key: 'low', text: 'Running low' },
  { key: 'out', text: 'Out of stock' },
  { key: 'off', text: 'Off' }
];

const COLUMNS = 7;

/*
 * Every product, switched off ones too, with what it costs, what it varies by
 * and how many are left. Stock can be changed right here, under each row; the
 * rest of a product opens in the editor.
 */
const ProductsPage: React.FC<IProductsPageProps> = ({ sp, ids, settings, onEdit, version, onChanged }) => {
  const currency = settings.currency;
  const [products, setProducts] = React.useState<IProduct[] | undefined>();
  const [loadError, setLoadError] = React.useState<string | undefined>();
  const [message, setMessage] = React.useState<INotice | undefined>();
  const [query, setQuery] = React.useState('');
  const [filter, setFilter] = React.useState<ProductFilter>('all');
  const [sampleStep, setSampleStep] = React.useState<string | undefined>();
  // Whose stock is open under their row.
  const [open, setOpen] = React.useState<Record<number, boolean>>({});
  // Active switches being saved, and which way each is going.
  const [switching, setSwitching] = React.useState<Record<number, boolean>>({});
  const [deleting, setDeleting] = React.useState<Record<number, boolean>>({});
  // What went wrong on a row, shown under it.
  const [rowProblems, setRowProblems] = React.useState<Record<number, string>>({});
  // Element IDs of its own, in case the page holds the store twice.
  const [prefix] = React.useState(() => getId('products'));
  const alive = React.useRef(true);

  React.useEffect(() => () => { alive.current = false; }, []);

  const load = React.useCallback(async (): Promise<void> => {
    try {
      const next = await loadCatalog(sp, ids, { includeInactive: true });
      if (!alive.current) return;
      setProducts(next);
      setLoadError(undefined);
    } catch (e) {
      if (alive.current) setLoadError(explain(e));
    }
  }, [sp, ids]);

  // Again whenever products change elsewhere, as when the editor saves one.
  React.useEffect(() => { load().catch(() => undefined); }, [load, version]);

  /* One row read again after its stock changed, rather than the whole table. */
  const reloadProduct = async (productId: number): Promise<void> => {
    try {
      const fresh = await loadCatalogProduct(sp, ids, productId);
      if (!alive.current) return;
      setProducts(list => list && (fresh
        ? list.map(p => (p.id === productId ? fresh : p))
        : list.filter(p => p.id !== productId)));
    } catch {
      // The row keeps its old numbers until the page loads again. The stock itself is saved.
    }
  };

  const setRowProblem = (productId: number, text?: string): void =>
    setRowProblems(all => (text ? { ...all, [productId]: text } : withoutKey(all, productId)));

  const stockButtonId = (productId: number): string => `${prefix}-stock-${productId}`;

  const toggleStock = (productId: number): void =>
    setOpen(o => (o[productId] ? withoutKey(o, productId) : { ...o, [productId]: true }));

  const closeStock = (productId: number): void => {
    setOpen(o => withoutKey(o, productId));
    // The stock goes away, so the keyboard goes back to the button that opened it.
    const button = document.getElementById(stockButtonId(productId));
    if (button) button.focus();
  };

  const stockSaved = (productId: number): void => {
    reloadProduct(productId).catch(() => undefined);
    onChanged();
  };

  const switchActive = async (p: IProduct, active: boolean): Promise<void> => {
    setSwitching(s => ({ ...s, [p.id]: active }));
    setRowProblem(p.id);
    try {
      await setActive(sp, ids, p.id, active);
      onChanged();
      if (alive.current) setProducts(list => list && list.map(x => (x.id === p.id ? { ...x, active } : x)));
    } catch (e) {
      if (alive.current) setRowProblem(p.id, `${p.name} wasn't switched ${active ? 'on' : 'off'}. ${explain(e)}`);
    } finally {
      if (alive.current) setSwitching(s => withoutKey(s, p.id));
    }
  };

  const remove = async (p: IProduct): Promise<void> => {
    setDeleting(d => ({ ...d, [p.id]: true }));
    setRowProblem(p.id);
    setMessage(undefined);
    let done = false;
    try {
      await deleteProduct(sp, ids, p.id);
      done = true;
    } catch (e) {
      if (alive.current) setRowProblem(p.id, `${p.name} wasn't deleted. ${explain(e)}`);
    }
    // Some of its stock may have gone even when the product didn't.
    onChanged();
    if (!alive.current) return;
    if (done) {
      // Gone from the table straight away, rather than once the list has loaded again.
      setProducts(list => list && list.filter(x => x.id !== p.id));
      setOpen(o => withoutKey(o, p.id));
      setMessage({ type: MessageBarType.success, text: `${p.name} deleted.` });
    }
    setDeleting(d => withoutKey(d, p.id));
    await load();
  };

  /* Safe to click twice: anything already there by name is left alone. */
  const addSamples = async (): Promise<void> => {
    setMessage(undefined);
    try {
      const have = await productNames(sp, ids);
      const todo = SAMPLES.filter(s => have.indexOf(s.draft.name) < 0);
      for (let i = 0; i < todo.length; i++) {
        const s = todo[i];
        setSampleStep(`Adding ${s.draft.name} (${i + 1} of ${todo.length})…`);
        await saveProduct(sp, ids, s.draft, await sampleFiles(s));
      }
      const added = todo.length === 1 ? 'Added a sample product.' : `Added ${todo.length} sample products.`;
      setMessage({ type: MessageBarType.success, text: todo.length ? added : 'The sample products are already in.' });
    } catch (e) {
      setMessage({ type: MessageBarType.error, text: explain(e) });
    } finally {
      setSampleStep(undefined);
      onChanged();
      await load();
    }
  };

  const busy = !!sampleStep;
  const has = !!products && products.length > 0;

  const addButtons = (
    <div className={styles.headActions}>
      <PrimaryButton text="+ Add product" disabled={busy} onClick={() => onEdit(undefined)} />
      <DefaultButton
        text="Add sample products" disabled={busy}
        onClick={() => { addSamples().catch(() => undefined); }}
      />
      {busy && <Spinner size={SpinnerSize.small} label={sampleStep} labelPosition="right" />}
    </div>
  );

  const row = (p: IProduct): JSX.Element => {
    const level = stockLevel(p);
    const note = combinationsText(p);
    const isOpen = !!open[p.id];
    const pending = Object.prototype.hasOwnProperty.call(switching, p.id);
    const gone = !!deleting[p.id];
    const drawerId = `${prefix}-drawer-${p.id}`;
    const problem = rowProblems[p.id];
    return (
      <React.Fragment key={p.id}>
        <tr className={css(!p.active && styles.off, isOpen && styles.rowOpen)}>
          <td className={styles.photoCell}>
            <Photo url={p.photoUrl} alt="" className={styles.thumb} small />
          </td>
          <td className={styles.productCell}>
            <span className={styles.name}>{p.name}</span>
            {p.shortDescription && <span className={styles.desc}>{p.shortDescription}</span>}
            {p.productCode && <span className={styles.code}>{p.productCode}</span>}
          </td>
          <td className={styles.num}>{priceText(p, currency)}</td>
          <td className={styles.varies}>{variesText(p.options)}</td>
          <td>
            <span className={css(styles.badge, level === 'low' && styles.badgeLow, level === 'out' && styles.badgeOut)}>
              {totalLeft(p)}
            </span>
            {note && <span className={styles.note}>{note}</span>}
          </td>
          <td>
            <span className={styles.switch}>
              <Toggle
                checked={pending ? switching[p.id] : p.active} ariaLabel={`Active, ${p.name}`}
                onText="On" offText="Off" styles={{ root: { margin: 0 } }}
                onChange={(_, on) => { if (!pending && !gone) switchActive(p, !!on).catch(() => undefined); }}
              />
              {pending && <Spinner size={SpinnerSize.xSmall} ariaLabel={`Saving ${p.name}`} />}
            </span>
          </td>
          <td>
            <span className={styles.rowActions}>
              <button
                type="button" id={stockButtonId(p.id)} className={styles.btn} aria-expanded={isOpen}
                aria-controls={isOpen ? drawerId : undefined} aria-label={`Stock of ${p.name}`}
                disabled={gone} onClick={() => toggleStock(p.id)}
              >
                Stock <Icon iconName={isOpen ? 'ChevronUp' : 'ChevronDown'} className={styles.btnIcon} aria-hidden="true" />
              </button>
              <button
                type="button" className={styles.btn} aria-label={`Edit ${p.name}`} disabled={gone}
                onClick={() => onEdit(p.id)}
              >
                Edit
              </button>
              <ConfirmDelete name={p.name} busy={gone} onDelete={() => { remove(p).catch(() => undefined); }} />
            </span>
          </td>
        </tr>
        {problem && (
          <tr className={styles.problemRow}>
            <td colSpan={COLUMNS}>
              <div className={styles.problem} role="alert">{problem}</div>
            </td>
          </tr>
        )}
        {isOpen && (
          <tr className={styles.drawerRow}>
            <td colSpan={COLUMNS}>
              <StockDrawer
                sp={sp} ids={ids} currency={currency} product={p} id={drawerId}
                onSaved={() => stockSaved(p.id)} onClose={() => closeStock(p.id)}
              />
            </td>
          </tr>
        )}
      </React.Fragment>
    );
  };

  const counts = products ? filterCounts(products) : undefined;
  const matching = products ? filterProducts(products, query, filter) : [];
  // A product with its stock open stays put, even once its new numbers no longer fit the filter.
  const shown = products ? products.filter(p => !!open[p.id] || matching.indexOf(p) >= 0) : [];
  const narrowed = query.trim() !== '' || filter !== 'all';

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div className={styles.headText}>
          <h2 className={styles.title}>Products &amp; stock</h2>
          {has && products && <p className={styles.summary}>{summaryText(products)}</p>}
        </div>
        {has && addButtons}
      </div>

      {message && <MessageBar messageBarType={message.type} isMultiline>{message.text}</MessageBar>}

      {loadError && (
        <LoadFailed
          lead="The products didn't load." error={loadError} retryClassName={styles.retry}
          onRetry={() => { load().catch(() => undefined); }}
        />
      )}

      {!products && !loadError && (
        <Spinner className={styles.loading} size={SpinnerSize.medium} label="Loading the products…" />
      )}

      {products && !has && (
        <div className={styles.empty}>
          <h3 className={styles.emptyTitle}>No products yet</h3>
          <p>{ADDING_PRODUCTS}</p>
          {addButtons}
        </div>
      )}

      {has && counts && (
        <>
          <div className={styles.tools}>
            <div className={styles.search}>
              <Icon iconName="Search" className={styles.searchMark} aria-hidden="true" />
              <input
                type="search" placeholder="Search products" aria-label="Search products" value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>
            <div className={styles.filters} role="group" aria-label="Show">
              {FILTERS.map(f => (
                <button
                  key={f.key} type="button" aria-pressed={filter === f.key}
                  className={css(styles.filter, filter === f.key && styles.filterOn)}
                  onClick={() => setFilter(f.key)}
                >
                  {f.text} <span className={styles.filterCount}>{counts[f.key]}</span>
                </button>
              ))}
            </div>
          </div>

          <p className={styles.srOnly} aria-live="polite">
            {narrowed ? `${countText(shown.length, 'product')} shown` : ''}
          </p>

          {shown.length === 0 ? (
            <div className={styles.nothing}>
              {nothingText(query, filter)}{' '}
              <button
                type="button" className={styles.linkButton}
                onClick={() => { setQuery(''); setFilter('all'); }}
              >
                Show every product
              </button>
            </div>
          ) : (
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col"><span className={styles.srOnly}>Photo</span></th>
                    <th scope="col">Product</th>
                    <th scope="col" className={styles.num}>Price</th>
                    <th scope="col">Varies by</th>
                    <th scope="col">Stock</th>
                    <th scope="col">Active</th>
                    <th scope="col"><span className={styles.srOnly}>Change or delete</span></th>
                  </tr>
                </thead>
                <tbody>{shown.map(row)}</tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ProductsPage;
