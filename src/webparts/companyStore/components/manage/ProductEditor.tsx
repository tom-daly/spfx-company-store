import * as React from 'react';
import {
  DefaultButton, Icon, MessageBar, MessageBarType, PrimaryButton, Spinner, SpinnerSize, TextField, Toggle, css
} from '@fluentui/react';
import styles from './ProductEditor.module.scss';
import type { SPFI } from '../../sp';
import type { ListIds } from '../../setup/schema';
import {
  INewPhoto, IValuePhoto, blankDraft, deleteProduct, loadProductForEdit, partlySavedId, saveProduct, uploadedPhotos
} from '../../store/products';
import {
  IFormOption, IFormPhoto, IFormValue, IProductForm, draftFromForm, formFromDraft, hasOwnPrices, makeCover,
  movePhoto, photosToUpload, readPrice, savedOptions, setLine, stockTable, typedOptions, withOptionName,
  withStockEverywhere, withTypedValue, withUploaded, withoutPhoto, withoutPrices
} from '../../store/productForm';
import { Combo, MAX_OPTIONS, checkOptions } from '../../store/variants';
import { Currency, currencySymbol, formatMoney } from '../../store/settings';
import { countText } from '../../store/orderText';
import { explain } from '../../setup/errors';
import StockEditor, { CellChange } from './StockGrid';
import { ConfirmDelete } from './ProductsPage';
import BackArrow from '../BackArrow';

export interface IProductEditorProps {
  sp: SPFI;
  ids: ListIds;
  currency: Currency;
  /** The product to change, or undefined to add a new one. */
  productId?: number;
  /** Saved in full. added is true when it was a new product. The store page goes back to Products. */
  onSaved: (name: string, added: boolean) => void;
  /** Left without saving. */
  onCancel: () => void;
  /** The product went in but something after it didn't. Products and the shop should load again. */
  onPartlySaved: () => void;
  /** The product was deleted from the editor. */
  onDeleted: (name: string) => void;
}

let keys = 0;
const newKey = (): string => `k${++keys}`;

/* ---------------------------------------------------------------- photos */

/* The pictures among some chosen or dropped files. Anything else is left out. */
// eslint-disable-next-line @rushstack/no-new-null -- the browser gives null when no files were chosen
function imagesIn(list: FileList | null): File[] {
  const out: File[] = [];
  if (!list) return out;
  for (let i = 0; i < list.length; i++) {
    if (list[i].type.indexOf('image/') === 0) out.push(list[i]);
  }
  return out;
}

const draggingFiles = (e: React.DragEvent<HTMLElement>): boolean =>
  Array.prototype.indexOf.call(e.dataTransfer.types, 'Files') >= 0;

/* A file dropped beside a drop zone would open in the browser, and the form and everything typed would go with it. */
const refuseDrop = (e: React.DragEvent<HTMLElement>): void => {
  if (!draggingFiles(e)) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'none';
};

interface IDropZone {
  /** Files are being dragged over it. */
  over: boolean;
  handlers: {
    onDragEnter: React.DragEventHandler<HTMLElement>;
    onDragOver: React.DragEventHandler<HTMLElement>;
    onDragLeave: React.DragEventHandler<HTMLElement>;
    onDrop: React.DragEventHandler<HTMLElement>;
  };
}

/* Lets files be dropped onto an element, handing over the pictures among them. */
function useDropZone(onAdd: (files: File[]) => void): IDropZone {
  const [over, setOver] = React.useState(false);
  const accept = (e: React.DragEvent<HTMLElement>): void => {
    if (!draggingFiles(e)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    setOver(true);
  };
  return {
    over,
    handlers: {
      onDragEnter: accept,
      onDragOver: accept,
      // Leaving for one of its own children isn't leaving.
      onDragLeave: e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false); },
      onDrop: e => {
        if (!draggingFiles(e)) return;
        e.preventDefault();
        e.stopPropagation();
        setOver(false);
        onAdd(imagesIn(e.dataTransfer.files));
      }
    }
  };
}

interface IAddPhotosProps {
  /** What the photos are of, for the label read out: the product's name, or a choice like "White". */
  of: string;
  onAdd: (files: File[]) => void;
}

type FilePicked = (e: React.ChangeEvent<HTMLInputElement>) => void;

const pickedFiles = (onAdd: IAddPhotosProps['onAdd']): FilePicked => e => {
  onAdd(imagesIn(e.target.files));
  // So choosing the same file again still counts as a change.
  e.target.value = '';
};

interface IPhotoTileProps extends IAddPhotosProps {
  photos: IFormPhoto[];
  previews: Record<string, string>;
  /** Its photos are showing underneath. */
  open: boolean;
  onToggle: () => void;
}

/*
 * The small square at the start of a choice's line. Empty, it picks photos;
 * with photos, it shows the first (and how many) and opens them underneath.
 * Files can be dropped on it either way.
 */
const PhotoTile: React.FC<IPhotoTileProps> = ({ photos, previews, of, open, onAdd, onToggle }) => {
  const drop = useDropZone(onAdd);
  if (!photos.length) {
    return (
      <label
        className={css(styles.tile, styles.tileEmpty, drop.over && styles.tileOver)}
        title={`Add photos of ${of}`} {...drop.handlers}
      >
        <Icon iconName="Add" aria-hidden="true" />
        <input
          type="file" accept="image/*" multiple className={styles.fileInput} aria-label={`Add photos of ${of}`}
          onChange={pickedFiles(onAdd)}
        />
      </label>
    );
  }
  const first = photos[0];
  const src = first.url || previews[first.key];
  const many = countText(photos.length, 'photo');
  const verb = open ? 'Hide' : 'Show';
  return (
    <button
      type="button" className={css(styles.tile, open && styles.tileOpen, drop.over && styles.tileOver)}
      aria-expanded={open} title={`${verb} the photos of ${of}`}
      aria-label={`${many} of ${of}. ${verb} them.`} onClick={onToggle} {...drop.handlers}
    >
      {src && <img className={styles.tileImg} src={src} alt="" />}
      {photos.length > 1 && <span className={styles.tileCount} aria-hidden="true">{photos.length}</span>}
    </button>
  );
};

interface IPhotoStripProps extends IAddPhotosProps {
  photos: IFormPhoto[];
  /** Where to see each new photo before it is saved, by its key. */
  previews: Record<string, string>;
  /** The product's own photos: bigger, and the first is the cover. A choice's are smaller. */
  big?: boolean;
  onChange: (change: (photos: IFormPhoto[]) => IFormPhoto[]) => void;
  onRemove: (photo: IFormPhoto) => void;
}

/* Photos in order, each with a remove button, and arrows to move it so the order can change without dragging. */
const PhotoStrip: React.FC<IPhotoStripProps> = ({ photos, previews, of, big, onAdd, onChange, onRemove }) => {
  const drop = useDropZone(onAdd);
  const last = photos.length - 1;
  // A choice's photos say whose they are; the product's own are the only ones in their section.
  const called = (i: number): string => (big ? `photo ${i + 1}` : `photo ${i + 1} of ${of}`);
  const arrow = (i: number, to: number, icon: string, label: string): JSX.Element => (
    <button
      type="button" className={styles.move} title={label} aria-label={label}
      onClick={() => onChange(list => movePhoto(list, i, to))}
    >
      <Icon iconName={icon} aria-hidden="true" />
    </button>
  );
  return (
    <ul
      className={css(styles.pics, !big && styles.small)} aria-label={big ? 'Photos' : `Photos of ${of}`}
      {...drop.handlers}
    >
      {photos.map((p, i) => {
        const src = p.url || previews[p.key];
        const alt = `${big && i === 0 ? 'Cover photo' : `Photo ${i + 1}`} of ${of}`;
        return (
          <li key={p.key} className={styles.pic}>
            <span className={styles.frame}>
              {src ? <img className={styles.shot} src={src} alt={alt} /> : <span className={styles.shot} />}
              <button
                type="button" className={styles.picRemove} title={`Remove ${called(i)}`}
                aria-label={`Remove ${called(i)}`} onClick={() => onRemove(p)}
              >
                <Icon iconName="Cancel" aria-hidden="true" />
              </button>
            </span>
            {(big || last > 0) && (
              <span className={styles.picBar}>
                {i > 0 ? arrow(i, i - 1, 'ChevronLeft', `Move ${called(i)} earlier`) : <span className={styles.moveGap} />}
                {big && (i === 0
                  ? <span className={styles.cover}>Cover</span>
                  : (
                    <button
                      type="button" className={styles.makeCover} aria-label={`Make ${called(i)} the cover`}
                      onClick={() => onChange(list => makeCover(list, i))}
                    >
                      Make cover
                    </button>
                  ))}
                {i < last ? arrow(i, i + 1, 'ChevronRight', `Move ${called(i)} later`) : <span className={styles.moveGap} />}
              </span>
            )}
          </li>
        );
      })}
      <li className={styles.pic}>
        <label className={css(styles.drop, drop.over && styles.dropOver)}>
          <Icon iconName="Add" className={styles.plus} aria-hidden="true" />
          <span>Add photos</span>
          <input
            type="file" accept="image/*" multiple className={styles.fileInput} aria-label={`Add photos of ${of}`}
            onChange={pickedFiles(onAdd)}
          />
        </label>
      </li>
    </ul>
  );
};

/* ---------------------------------------------------------------- the page */

/* Which Save was pressed, so a problem shows beside it rather than out of sight at the other end of the page. */
type Where = 'top' | 'bottom';

interface IProblem {
  text: string;
  at: Where;
}

/*
 * Adding a product and changing one, as a page of its own: the details, the
 * price and the photos side by side when there's room, then what it varies by
 * and the stock, which are the parts that grow, across the full width.
 */
const ProductEditor: React.FC<IProductEditorProps> = ({
  sp, ids, currency, productId, onSaved, onCancel, onPartlySaved, onDeleted
}) => {
  const [form, setForm] = React.useState<IProductForm>(() => formFromDraft(blankDraft(), newKey));
  // The product being changed: the one asked for, or one a save that didn't finish has just added.
  const [editing, setEditing] = React.useState<number | undefined>(productId);
  const [heading, setHeading] = React.useState('');
  // New photos waiting for Save, the product's and the choices' alike, by the key the form gave them.
  const [files, setFiles] = React.useState<Record<string, File>>({});
  const [previews, setPreviews] = React.useState<Record<string, string>>({});
  const previewsMade = React.useRef<Record<string, string>>({});
  const [loading, setLoading] = React.useState(productId !== undefined);
  const [loadFailed, setLoadFailed] = React.useState(false);
  // Saving, and from which Save.
  const [saving, setSaving] = React.useState<Where | undefined>();
  const [deleting, setDeleting] = React.useState(false);
  const [problem, setProblem] = React.useState<IProblem | undefined>();
  // Which choices have their photos open underneath, by the choice's key.
  const [openPhotos, setOpenPhotos] = React.useState<Record<string, boolean>>({});
  // "Some combinations cost more or less": ticked, or there's a price typed already.
  const [pricesOn, setPricesOn] = React.useState(false);
  // Saving or deleting usually ends with the page closing; nothing is set on it after that.
  const alive = React.useRef(true);

  React.useEffect(() => () => { alive.current = false; }, []);

  // A fresh form for each product: blank, or the product as it is now.
  React.useEffect(() => {
    let current = true;
    setForm(formFromDraft(blankDraft(), newKey));
    setEditing(productId);
    setHeading('');
    setFiles({});
    setOpenPhotos({});
    setPricesOn(false);
    setProblem(undefined);
    setLoadFailed(false);
    setLoading(productId !== undefined);
    if (productId === undefined) return;

    const load = async (): Promise<void> => {
      try {
        const draft = await loadProductForEdit(sp, ids, productId);
        if (!current) return;
        setForm(formFromDraft(draft, newKey));
        setHeading(draft.name);
      } catch (e) {
        if (!current) return;
        setProblem({ text: `The product didn't open. ${explain(e)}`, at: 'top' });
        setLoadFailed(true);
      } finally {
        if (current) setLoading(false);
      }
    };
    load().catch(() => undefined);
    return () => { current = false; };
  }, [productId, sp, ids]);

  // Each new file gets one preview, kept while the file stays, so adding a photo doesn't reload the others.
  React.useEffect(() => {
    const before = previewsMade.current;
    const now: Record<string, string> = {};
    Object.keys(files).forEach(k => { now[k] = before[k] || URL.createObjectURL(files[k]); });
    Object.keys(before).forEach(k => { if (!now[k]) URL.revokeObjectURL(before[k]); });
    previewsMade.current = now;
    setPreviews(now);
  }, [files]);

  React.useEffect(() => () => {
    const left = previewsMade.current;
    Object.keys(left).forEach(k => URL.revokeObjectURL(left[k]));
  }, []);

  const set = <K extends keyof IProductForm>(key: K): ((_: unknown, value?: string | boolean) => void) =>
    (_, value) => setForm(f => ({ ...f, [key]: value }));

  /* ---- photos ---- */

  const dropFiles = (gone: string[]): void => setFiles(fs => {
    if (!gone.some(k => !!fs[k])) return fs;
    const next: Record<string, File> = {};
    Object.keys(fs).forEach(k => { if (gone.indexOf(k) < 0) next[k] = fs[k]; });
    return next;
  });

  /* New files wait for Save under keys of their own; the form lists them where they go. */
  const take = (chosen: File[]): IFormPhoto[] => {
    const added = chosen.map((): IFormPhoto => ({ key: newKey() }));
    if (added.length) {
      setFiles(fs => {
        const next = { ...fs };
        added.forEach((p, i) => { next[p.key] = chosen[i]; });
        return next;
      });
    }
    return added;
  };

  const changePhotos = (change: (photos: IFormPhoto[]) => IFormPhoto[]): void =>
    setForm(f => ({ ...f, photos: change(f.photos) }));

  const addPhotos = (chosen: File[]): void => {
    const added = take(chosen);
    if (added.length) changePhotos(list => list.concat(added));
  };

  const removePhoto = (photo: IFormPhoto): void => {
    dropFiles([photo.key]);
    changePhotos(list => withoutPhoto(list, photo.key));
  };

  /* ---- what it varies by ---- */

  const photoKeys = (values: IFormValue[]): string[] =>
    values.reduce<string[]>((all, v) => all.concat(v.photos.map(p => p.key)), []);

  const changeOption = (oi: number, change: (o: IFormOption) => IFormOption): void =>
    setForm(f => ({ ...f, options: f.options.map((o, i) => (i === oi ? change(o) : o)) }));

  const addOption = (): void => setForm(f => ({
    ...f,
    options: f.options.concat([{ key: newKey(), name: '', values: [{ key: newKey(), value: '', photos: [] }] }])
  }));

  const removeOption = (oi: number): void => {
    dropFiles(photoKeys(form.options[oi].values));
    setForm(f => ({ ...f, options: f.options.filter((o, i) => i !== oi) }));
  };

  const addValue = (oi: number): void =>
    changeOption(oi, o => ({ ...o, values: o.values.concat([{ key: newKey(), value: '', photos: [] }]) }));

  const removeValue = (oi: number, vi: number): void => {
    dropFiles(photoKeys([form.options[oi].values[vi]]));
    changeOption(oi, o => ({ ...o, values: o.values.filter((v, i) => i !== vi) }));
  };

  const changeValuePhotos = (oi: number, vi: number, change: (photos: IFormPhoto[]) => IFormPhoto[]): void =>
    changeOption(oi, o => ({
      ...o,
      values: o.values.map((v, i) => (i === vi ? { ...v, photos: change(v.photos) } : v))
    }));

  const togglePhotos = (key: string): void => setOpenPhotos(o => ({ ...o, [key]: !o[key] }));

  const addValuePhotos = (oi: number, vi: number, chosen: File[]): void => {
    const added = take(chosen);
    if (!added.length) return;
    changeValuePhotos(oi, vi, list => list.concat(added));
    // Open them, so the owner sees what went in.
    const key = form.options[oi].values[vi].key;
    setOpenPhotos(o => ({ ...o, [key]: true }));
  };

  const removeValuePhoto = (oi: number, vi: number, photo: IFormPhoto): void => {
    dropFiles([photo.key]);
    changeValuePhotos(oi, vi, list => withoutPhoto(list, photo.key));
  };

  /* ---- stock ---- */

  const setCell = (combo: Combo, change: CellChange): void =>
    setForm(f => ({ ...f, lines: setLine(f.lines, savedOptions(f), combo, change) }));

  const fillAll = (count: number): void => setForm(f => withStockEverywhere(f, count));

  /* Unticking clears the prices typed, so none are saved without being seen. */
  const choosePrices = (on: boolean): void => {
    setPricesOn(on);
    if (!on) setForm(withoutPrices);
  };

  /* ---- save and delete ---- */

  const save = async (at: Where): Promise<void> => {
    const draft = draftFromForm(form, editing);
    if (typeof draft === 'string') {
      setProblem({ text: draft, at });
      return;
    }
    const photos: INewPhoto[] = [];
    const valuePhotos: IValuePhoto[] = [];
    photosToUpload(form).forEach(p => {
      const file = files[p.key];
      if (!file) return;
      const photo: INewPhoto = { key: p.key, at: p.at, file: { name: file.name, content: file } };
      if (p.option === undefined || p.value === undefined) photos.push(photo);
      else valuePhotos.push({ ...photo, option: p.option, value: p.value });
    });
    setSaving(at);
    setProblem(undefined);
    try {
      await saveProduct(sp, ids, draft, { photos, valuePhotos });
      onSaved(draft.name, editing === undefined);
    } catch (e) {
      const savedId = partlySavedId(e);
      if (savedId !== undefined) onPartlySaved();
      if (!alive.current) return;
      if (savedId !== undefined) {
        // It's in the list now, so the next Save changes it rather than adding it again.
        setEditing(savedId);
        setHeading(draft.name);
        // The same for photos that did go up: the next Save keeps them rather than uploading them twice.
        const uploaded = uploadedPhotos(e);
        setForm(f => withUploaded(f, uploaded));
        dropFiles(Object.keys(uploaded));
      }
      setProblem({ text: explain(e), at });
    } finally {
      if (alive.current) setSaving(undefined);
    }
  };

  const remove = async (): Promise<void> => {
    if (editing === undefined) return;
    const name = heading || form.name.trim() || 'The product';
    setDeleting(true);
    setProblem(undefined);
    try {
      await deleteProduct(sp, ids, editing);
      onDeleted(name);
    } catch (e) {
      if (alive.current) setProblem({ text: `${name} wasn't deleted. ${explain(e)}`, at: 'top' });
    } finally {
      if (alive.current) setDeleting(false);
    }
  };

  const busy = saving !== undefined || deleting;
  const canSave = !busy && !loading && !loadFailed;
  const table = stockTable(form);
  const hasOptions = table.options.length > 0;
  // Options started but no choices typed yet: nothing to set stock for.
  const choicesToCome = form.options.length > 0 && !hasOptions;
  const prices = pricesOn || hasOwnPrices(table);
  const optionsProblem = checkOptions(typedOptions(form));
  const usualPrice = readPrice(form.price);
  const usual = usualPrice === undefined ? '' : formatMoney(usualPrice, currency);
  const productName = form.name.trim() || 'the product';
  const title = editing === undefined ? 'Add a product' : heading ? `Edit ${heading}` : 'Edit product';

  const problemAt = (at: Where): JSX.Element | undefined => (problem && problem.at === at ? (
    <MessageBar messageBarType={MessageBarType.error} isMultiline>{problem.text}</MessageBar>
  ) : undefined);

  const saveButtons = (at: Where): JSX.Element => (
    <>
      <PrimaryButton text="Save" disabled={!canSave} onClick={() => { save(at).catch(() => undefined); }} />
      <DefaultButton text="Cancel" disabled={busy} onClick={onCancel} />
      {saving === at && <Spinner size={SpinnerSize.small} label="Saving…" labelPosition="right" />}
    </>
  );

  return (
    <div className={styles.editor} onDragOver={refuseDrop} onDrop={refuseDrop}>
      <button type="button" className={styles.back} disabled={busy} onClick={onCancel}>
        <BackArrow />Products &amp; stock
      </button>

      <div className={styles.topBar}>
        <h2 className={styles.title}>{title}</h2>
        <div className={styles.actions}>
          {editing !== undefined && !loadFailed && (
            <ConfirmDelete
              text="Delete product" keepText="Keep it" large busy={deleting}
              disabled={saving !== undefined || loading}
              onDelete={() => { remove().catch(() => undefined); }}
            />
          )}
          {saveButtons('top')}
        </div>
      </div>

      {problemAt('top')}

      {loading && <Spinner className={styles.loading} size={SpinnerSize.medium} label="Opening the product…" />}

      {!loading && !loadFailed && (
        <div className={styles.form}>
          <div className={styles.twoUp}>
            <section className={css(styles.section, styles.main)}>
              <h3 className={styles.heading}>Details</h3>
              <TextField label="Name" required value={form.name} onChange={set('name')} placeholder="Reef crew tee" />
              <TextField
                label="Short description" value={form.shortDescription} onChange={set('shortDescription')}
                description="One line, shown on the product card."
              />
              <TextField
                label="Full description" multiline rows={4}
                value={form.longDescription} onChange={set('longDescription')}
              />
              <TextField
                label="Details" multiline rows={3} value={form.details} onChange={set('details')}
                description="One per line, like  Fabric: organic cotton"
              />
              <div className={styles.pair}>
                <TextField label="Product code" value={form.productCode} onChange={set('productCode')} />
                <TextField
                  label="Search words" value={form.searchWords} onChange={set('searchWords')}
                  description="Words people might search for that are not in the name, separated by commas."
                />
              </div>
              <Toggle
                label="Active" checked={form.showInStore} onChange={set('showInStore')}
                onText="Active" offText="Off — saved but not in the store"
              />
            </section>

            <div className={styles.side}>
              <section className={styles.section}>
                <h3 className={styles.heading}>Price</h3>
                <TextField
                  className={styles.narrow}
                  label={hasOptions ? 'Usual price' : 'Price'} value={form.price} onChange={set('price')}
                  inputMode="decimal" prefix={currencySymbol(currency)}
                  description={hasOptions
                    ? 'Used by any combination without its own price below.'
                    : 'Leave at 0 and it shows as Free.'}
                />
              </section>

              <section className={styles.section}>
                <h3 className={styles.heading}>Photos</h3>
                <p className={styles.hint}>The first one is the cover. Drop files in, or choose them.</p>
                <PhotoStrip
                  big photos={form.photos} previews={previews} of={productName}
                  onAdd={addPhotos} onChange={changePhotos} onRemove={removePhoto}
                />
              </section>
            </div>
          </div>

          <section className={styles.section}>
            <h3 className={styles.heading}>What it varies by</h3>
            <p className={styles.hint}>
              Up to three things, like size and colour. Leave this empty for something that comes one way only.
            </p>
            {form.options.length > 0 && (
              <div className={styles.options}>
                {form.options.map((o, oi) => {
                  const optionName = o.name.trim() || `option ${oi + 1}`;
                  return (
                    <div key={o.key} className={styles.option}>
                      <span className={styles.optionLabel}>Option {oi + 1}</span>
                      <div className={styles.optionBar}>
                        <TextField
                          className={styles.grow} ariaLabel={`Option ${oi + 1} name`} value={o.name}
                          onChange={(_, text) => setForm(f => withOptionName(f, oi, text || ''))}
                        />
                        <button
                          type="button" className={styles.textButton} aria-label={`Remove ${optionName}`}
                          onClick={() => removeOption(oi)}
                        >
                          Remove
                        </button>
                      </div>
                      <span className={styles.subLabel}>
                        Choices <span className={styles.subHint}>(type several at once, with commas between)</span>
                      </span>
                      <div className={styles.values}>
                        {o.values.map((v, vi) => {
                          const what = v.value.trim() || `choice ${vi + 1}`;
                          const addHere = (chosen: File[]): void => addValuePhotos(oi, vi, chosen);
                          const open = !!openPhotos[v.key] && v.photos.length > 0;
                          return (
                            <div key={v.key} className={styles.value}>
                              <div className={styles.valueRow}>
                                <PhotoTile
                                  photos={v.photos} previews={previews} of={what} open={open}
                                  onAdd={addHere} onToggle={() => togglePhotos(v.key)}
                                />
                                <TextField
                                  className={styles.grow} ariaLabel={`Choice ${vi + 1} for ${optionName}`}
                                  value={v.value}
                                  onChange={(_, text) => setForm(f => withTypedValue(f, oi, vi, text || '', newKey))}
                                  onPaste={e => {
                                    // A pasted list, one per line, would lose its line breaks in a one-line box.
                                    const pasted = e.clipboardData.getData('text');
                                    if (!/[,\n]/.test(pasted)) return;
                                    e.preventDefault();
                                    setForm(f => withTypedValue(f, oi, vi, pasted, newKey));
                                  }}
                                />
                                <button
                                  type="button" className={styles.removeValue}
                                  title={`Remove ${what}`} aria-label={`Remove ${what}`}
                                  disabled={o.values.length < 2} onClick={() => removeValue(oi, vi)}
                                >
                                  <Icon iconName="Cancel" aria-hidden="true" />
                                </button>
                              </div>
                              {open && (
                                <div className={styles.valuePhotos}>
                                  <PhotoStrip
                                    photos={v.photos} previews={previews} of={what} onAdd={addHere}
                                    onChange={change => changeValuePhotos(oi, vi, change)}
                                    onRemove={photo => removeValuePhoto(oi, vi, photo)}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <button type="button" className={styles.addChoice} onClick={() => addValue(oi)}>
                        + Add a choice
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            {form.options.length < MAX_OPTIONS && (
              <div>
                <DefaultButton text="+ Add an option" onClick={addOption} />
              </div>
            )}
            {optionsProblem && (
              <MessageBar messageBarType={MessageBarType.warning} isMultiline>{optionsProblem}</MessageBar>
            )}
          </section>

          <section className={styles.section}>
            <h3 className={styles.heading}>Stock and prices</h3>
            {choicesToCome && (
              <p className={styles.hint}>Type the choices above, and a stock box for each one appears here.</p>
            )}
            {table.tooMany !== undefined && (
              <p className={styles.hint}>
                That makes {table.tooMany} combinations, too many to list. Take some choices away above.
              </p>
            )}
            {!choicesToCome && (
              <StockEditor
                table={table} usual={usual} prices={prices} onPrices={choosePrices} onChange={setCell}
                onFill={fillAll}
              />
            )}
          </section>

          <div className={styles.bottomBar}>
            {problemAt('bottom')}
            <div className={styles.actions}>
              {saveButtons('bottom')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductEditor;
