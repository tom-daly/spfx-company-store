import type { SPFI } from '../sp';
import type { IList } from '@pnp/sp/lists';
import { ListIds, PHOTO_FOLDER, SITE_ASSETS } from '../setup/schema';
import { explain } from '../setup/errors';
import { ensureFolder } from '../setup/storeState';
import { IOption, IOptionValue, ONE_SIZE } from './types';
import { Combo, comboJson, optionsJson, tidyOptions } from './variants';
import { photosJson } from './gallery';
import { PRODUCT_FIELDS } from './shopText';
import { listOf } from './lists';
import {
  IPlacedPhoto, IStockPlan, IStockRow, IStockWrite, Row, draftFromRows, placePhotos, planStock, stockRowFrom
} from './productForm';

/** One combination of a product: how many there are and, maybe, its own price. */
export interface IStockLine {
  /** Its row in the stock list, once there is one. */
  stockId?: number;
  /** "White · M", or "One size". */
  label: string;
  combo: Combo;
  inStock: number;
  /** Its own price. Undefined means the product's usual price. */
  ownPrice?: number;
  /**
   * What the stock list said when the form opened. If the number is the same
   * at Save, the list is left as it is by then, so an order placed while the
   * form was open isn't put back on the shelf.
   */
  wasInStock?: number;
}

/* A product as the owner fills it in. */
export interface IProductDraft {
  /** Its row in the products list. Undefined for a new product. */
  id?: number;
  name: string;
  productCode: string;
  shortDescription: string;
  longDescription: string;
  /** One per line, like "Fabric: organic cotton". */
  details: string;
  /** The usual price, for every combination without its own. */
  price: number;
  searchWords: string;
  showInStore: boolean;
  /**
   * The photos it already has and keeps, in order, cover first, as full
   * addresses. New ones come in with the files and slot in among these.
   */
  photos: string[];
  /** What it varies by, with each choice's kept photos. Tidied when saved. */
  options: IOption[];
  /** One per combination of the options; one "One size" line when there are none. */
  stock: IStockLine[];
}

export const blankDraft = (): IProductDraft => ({
  name: '',
  productCode: '',
  shortDescription: '',
  longDescription: '',
  details: '',
  price: 0,
  searchWords: '',
  showInStore: true,
  photos: [],
  options: [],
  stock: [{ label: ONE_SIZE, combo: {}, inStock: 0 }]
});

export interface IPhotoFile {
  name: string;
  content: Blob;
}

/** A new photo to upload, and where it goes in its list. */
export interface INewPhoto {
  /** Its place in the finished list, counting the photos kept. 0 makes it the first. */
  at: number;
  file: IPhotoFile;
  /** The form's own name for it, so a failed save can say which ones did go up. */
  key?: string;
}

/** A new photo for one choice, found by where the choice sits in the draft's options as typed. */
export interface IValuePhoto extends INewPhoto {
  option: number;
  value: number;
}

export interface IProductFiles {
  /** New photos of the product itself. */
  photos?: INewPhoto[];
  valuePhotos?: IValuePhoto[];
}

export async function countProducts(sp: SPFI, ids: ListIds): Promise<number> {
  const rows = await listOf(sp, ids, 'products').items.select('Id').top(1)();
  return rows.length;
}

export async function productNames(sp: SPFI, ids: ListIds): Promise<string[]> {
  const rows = await listOf(sp, ids, 'products').items.select('Title').top(5000)();
  return rows.map((r: { Title: string }) => r.Title);
}

async function stockRows(sp: SPFI, ids: ListIds, productId: number): Promise<IStockRow[]> {
  const rows: Row[] = await listOf(sp, ids, 'stock').items
    .filter(`StoreProductId eq ${productId}`)
    .select('Id', 'Title', 'InStock', 'VariantPrice', 'Combination')
    .top(5000)();
  return rows.map(stockRowFrom);
}

/** A product as it is now, with its stock, ready for the form. */
export async function loadProductForEdit(sp: SPFI, ids: ListIds, productId: number): Promise<IProductDraft> {
  const [row, stock] = await Promise.all([
    listOf(sp, ids, 'products').items.getById(productId).select(...PRODUCT_FIELDS)(),
    stockRows(sp, ids, productId)
  ]);
  return { ...draftFromRows(row as Row, stock, window.location.origin), id: productId };
}

/* A save that got the product in but not everything after it. */
interface IPartlySaved extends Error {
  productId?: number;
  /** The new photos that did go up, by the form's name for them, with their addresses. */
  uploaded?: Record<string, string>;
}

/**
 * The product a failed save did get as far as saving, if it did. The form
 * carries on from there, so saving again changes it rather than adding it twice.
 */
export const partlySavedId = (e: unknown): number | undefined =>
  e instanceof Error && typeof (e as IPartlySaved).productId === 'number' ? (e as IPartlySaved).productId : undefined;

/**
 * The new photos a failed save did upload, by the key the form gave them. The
 * form treats them as saved from then on, so saving again doesn't add them twice.
 */
export const uploadedPhotos = (e: unknown): Record<string, string> =>
  (e instanceof Error && (e as IPartlySaved).uploaded) || {};

const fileSafe = (name: string): string =>
  name.toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-+|-+$/g, '') || 'photo.png';

let uploads = 0;

/* Every upload gets a name of its own, so a changed photo never shows the old one from the browser's cache. */
const uniqueName = (productId: number, name: string): string =>
  `${productId}-${Date.now().toString(36)}${uploads++}-${fileSafe(name)}`;

const stockFields = (w: IStockWrite): Record<string, unknown> => {
  const fields: Record<string, unknown> = {
    Title: w.label,
    VariantPrice: w.ownPrice === undefined ? null : w.ownPrice,
    Combination: comboJson(w.combo)
  };
  if (w.inStock !== undefined) fields.InStock = w.inStock;
  return fields;
};

/* Four at a time: quicker than one by one, without SharePoint pushing back. Stops after the first batch with a failure. */
async function fewAtATime<T>(items: T[], run: (item: T) => Promise<unknown>): Promise<void> {
  for (let i = 0; i < items.length; i += 4) {
    await Promise.all(items.slice(i, i + 4).map(run));
  }
}

/* Changes the product's stock rows the plan matched, then adds the ones it has no row for yet. */
async function writeStock(stock: IList, productId: number, plan: IStockPlan): Promise<void> {
  await fewAtATime(plan.update, w => stock.items.getById(w.stockId).update(stockFields(w)));
  await fewAtATime(plan.add, w => stock.items.add({ ...stockFields(w), StoreProductId: productId }));
}

/* Photos live in Site Assets, which every site has (or gets) and staff can read. */
async function photoFolder(sp: SPFI): Promise<string> {
  let assetsUrl: string;
  try {
    const assets = await sp.web.lists.ensureSiteAssetsLibrary();
    assetsUrl = (await assets.rootFolder.select('ServerRelativeUrl')()).ServerRelativeUrl;
  } catch {
    // Store managers may not be allowed to ask for that; setup has made the library and folder already.
    const web = await sp.web.select('ServerRelativeUrl')();
    assetsUrl = `${web.ServerRelativeUrl.replace(/\/$/, '')}/${SITE_ASSETS}`;
  }
  const folderUrl = `${assetsUrl}/${PHOTO_FOLDER}`;
  await ensureFolder(sp, folderUrl);
  return folderUrl;
}

/* What a picture column holds: a little JSON pointing at the file, split from its full address. */
function photoValue(url: string): string {
  const parts = /^(https?:\/\/[^/]+)(\/[^?#]*)/i.exec(url);
  const serverUrl = parts ? parts[1] : window.location.origin;
  const serverRelativeUrl = parts ? parts[2] : url;
  return JSON.stringify({
    type: 'thumbnail',
    fileName: serverRelativeUrl.split('/').pop(),
    serverUrl,
    serverRelativeUrl
  });
}

/*
 * Every photo, in order, goes in the Photos column. The first also goes in the
 * Photo column, only so the list in SharePoint shows a thumbnail.
 */
const photoFields = (urls: string[]): Record<string, unknown> => ({
  Photos: photosJson(urls),
  Photo: urls.length ? photoValue(urls[0]) : null
});

/* A new photo waiting to go up, and which choice it belongs to, if any. */
interface IUpload {
  photo: INewPhoto;
  option?: number;
  value?: number;
}

const isFor = (u: IUpload, option?: number, value?: number): boolean => u.option === option && u.value === value;

/* The choice with the photos that went up for it slotted in among the ones it kept. */
function withUploads(v: IOptionValue, placed: IPlacedPhoto[]): IOptionValue {
  const photoUrls = placePhotos(v.photoUrls || [], placed);
  return photoUrls.length ? { ...v, photoUrls } : { value: v.value };
}

/**
 * Adds a product, or saves changes to one, with its photos and its stock. The
 * product row goes first: if anything after it fails, the product still exists
 * and the error says what is missing, rather than leaving nothing to show for it.
 *
 * The stock list ends up with one row per combination of the options (one
 * "One size" row when there are none): rows are matched by the combination they
 * were saved with, or failing that by title; matched rows are updated, missing
 * ones added, and rows for combinations that no longer exist go to the recycle bin.
 */
export async function saveProduct(
  sp: SPFI, ids: ListIds, draft: IProductDraft, files: IProductFiles = {}
): Promise<number> {
  const products = listOf(sp, ids, 'products');
  const stock = listOf(sp, ids, 'stock');
  const name = draft.name.trim();

  const fields: Record<string, unknown> = {
    Title: name,
    ProductCode: draft.productCode.trim(),
    ShortDescription: draft.shortDescription.trim(),
    LongDescription: draft.longDescription.trim(),
    Details: draft.details.trim(),
    Price: draft.price,
    SearchWords: draft.searchWords.trim(),
    ShowInStore: draft.showInStore,
    VariantOptions: optionsJson(tidyOptions(draft.options)),
    // The photos kept, in their new order, go in now, so that much sticks even if an upload fails.
    ...photoFields(draft.photos)
  };
  let id: number;
  if (draft.id === undefined) {
    const added = await products.items.add(fields);
    id = added.Id ?? added.ID;
  } else {
    id = draft.id;
    await products.items.getById(id).update(fields);
  }

  const problems: string[] = [];
  const toUpload: IUpload[] = (files.photos || []).map((photo): IUpload => ({ photo })).concat(
    (files.valuePhotos || [])
      // A photo for a choice left blank has nowhere to go: blank choices are dropped on save.
      .filter(p => draft.options[p.option] && draft.options[p.option].values[p.value] &&
        draft.options[p.option].values[p.value].value.trim())
      .map((p): IUpload => ({ photo: p, option: p.option, value: p.value }))
  );

  // Names are settled up front, as several go up at once.
  const named = toUpload.map(u => ({ ...u, fileName: uniqueName(id, u.photo.file.name) }));
  const done: Array<IUpload & { url: string }> = [];
  const failed: Array<{ what: string; why: string }> = [];
  if (named.length) {
    try {
      const folderUrl = await photoFolder(sp);
      await fewAtATime(named, async u => {
        try {
          const added = await sp.web.getFolderByServerRelativePath(folderUrl).files
            .addUsingPath(u.fileName, u.photo.file.content, { Overwrite: true });
          const url = window.location.origin + added.ServerRelativeUrl;
          done.push({ photo: u.photo, option: u.option, value: u.value, url });
        } catch (e) {
          const choice = u.option === undefined || u.value === undefined
            ? '' : ` for ${draft.options[u.option].values[u.value].value.trim()}`;
          failed.push({ what: `the photo ${u.photo.file.name}${choice}`, why: explain(e) });
        }
      });
    } catch (e) {
      failed.push({ what: 'the new photos', why: explain(e) });
    }
  }
  if (failed.length === 1) problems.push(`${failed[0].what} (${failed[0].why})`);
  if (failed.length > 1) problems.push(`${failed.length} of the new photos (${failed[0].why})`);

  // Each photo that went up slots into its list at the place it was given in the form.
  const placed = (option?: number, value?: number): IPlacedPhoto[] =>
    done.filter(d => isFor(d, option, value)).map(d => ({ at: d.photo.at, url: d.url }));
  const options: IOption[] = draft.options.map((o, oi) => ({
    name: o.name,
    values: o.values.map((v, vi) => withUploads(v, placed(oi, vi)))
  }));
  const tidy = tidyOptions(options);

  const uploaded: Record<string, string> = {};
  done.forEach(d => { if (d.photo.key) uploaded[d.photo.key] = d.url; });

  const after: Record<string, unknown> = {
    ...(placed().length ? photoFields(placePhotos(draft.photos, placed())) : {}),
    ...(done.some(d => d.option !== undefined) ? { VariantOptions: optionsJson(tidy) } : {})
  };
  if (Object.keys(after).length) {
    try {
      await products.items.getById(id).update(after);
    } catch (e) {
      problems.push(`the new photos (${explain(e)})`);
    }
  }

  try {
    const plan = planStock(tidy, await stockRows(sp, ids, id), draft.stock);
    await writeStock(stock, id, plan);
    // Last, so nothing is taken away unless everything else went in.
    await fewAtATime(plan.remove, rowId => stock.items.getById(rowId).recycle());
  } catch (e) {
    problems.push(`the stock numbers (${explain(e)})`);
  }

  if (problems.length) {
    const e: IPartlySaved = new Error(`${name} was saved, but ${problems.join(' and ')} didn't go in. ` +
      'Save again to try once more, or fix it in the Products or Stock list.');
    e.productId = id;
    e.uploaded = uploaded;
    throw e;
  }
  return id;
}

/** Puts a product in the shop or takes it out (the Active column), and changes nothing else about it. */
export async function setActive(sp: SPFI, ids: ListIds, productId: number, active: boolean): Promise<void> {
  await listOf(sp, ids, 'products').items.getById(productId).update({ ShowInStore: active });
}

/**
 * Saves the stock numbers of a product, and the prices of its own any
 * combination has, without touching anything else about the product. Rows are
 * found the way a full save finds them: existing ones are updated by their ID,
 * and a combination without a row gets one. A number nobody changed is left as
 * the list has it, since orders may have come in while the numbers were open.
 * Rows for combinations the product no longer has are left alone: only the
 * product form takes rows away, along with the choices they belonged to.
 */
export async function saveStock(
  sp: SPFI, ids: ListIds, productId: number, options: IOption[], lines: IStockLine[]
): Promise<void> {
  const stock = listOf(sp, ids, 'stock');
  const plan = planStock(tidyOptions(options), await stockRows(sp, ids, productId), lines);
  await writeStock(stock, productId, plan);
}

/**
 * Sends a product and its stock rows to the site's recycle bin, where they can
 * be put back from. The stock rows go first, so if anything fails the product
 * is still there to delete again. Its photos stay in Site Assets.
 */
export async function deleteProduct(sp: SPFI, ids: ListIds, productId: number): Promise<void> {
  const stock = listOf(sp, ids, 'stock');
  const rows = await stockRows(sp, ids, productId);
  await fewAtATime(rows, r => stock.items.getById(r.stockId).recycle());
  await listOf(sp, ids, 'products').items.getById(productId).recycle();
}
