import {
  IFormPhoto, IProductForm, IStockRow, draftFromForm, draftFromRows, formFromDraft, hasOwnPrices, linesFor, makeCover,
  movePhoto, photosToUpload, placePhotos, planStock, readCount, readPrice, setLine, stockFromForm, stockRowFrom,
  stockTable, totalStock, withOptionName, withStockEverywhere, withTypedValue, withUploaded, withValue, withoutPhoto,
  withoutPrices
} from './productForm';
import type { IProductDraft, IStockLine } from './products';
import { IOption, ONE_SIZE } from './types';

const ORIGIN = 'https://tenant.sharepoint.com';
const COLOUR: IOption = { name: 'Colour', values: [{ value: 'White' }, { value: 'Black' }] };
const SIZE: IOption = { name: 'Size', values: [{ value: 'S' }, { value: 'M' }] };
const OPTIONS = [COLOUR, SIZE];

const row = (
  stockId: number, label: string, combo: Record<string, string>, inStock: number, ownPrice?: number
): IStockRow => {
  const r: IStockRow = { stockId, label, combo, inStock };
  if (ownPrice !== undefined) r.ownPrice = ownPrice;
  return r;
};

/* White · S, White · M, Black · S, Black · M, as the store saves them. */
const ROWS = (): IStockRow[] => [
  row(1, 'White · S', { Colour: 'White', Size: 'S' }, 5),
  row(2, 'White · M', { Colour: 'White', Size: 'M' }, 4, 24),
  row(3, 'Black · S', { Colour: 'Black', Size: 'S' }, 0),
  row(4, 'Black · M', { Colour: 'Black', Size: 'M' }, 1)
];

let made = 0;
const key = (): string => `k${++made}`;

const draft = (change: Partial<IProductDraft> = {}): IProductDraft => ({
  name: 'Reef crew tee',
  productCode: '',
  shortDescription: '',
  longDescription: '',
  details: '',
  price: 22,
  searchWords: '',
  showInStore: true,
  photos: [],
  options: [],
  stock: [{ label: ONE_SIZE, combo: {}, inStock: 3 }],
  ...change
});

const sizes = (): IProductForm => formFromDraft(draft({
  options: [SIZE],
  stock: [{ label: 'S', combo: { Size: 'S' }, inStock: 2 }, { label: 'M', combo: { Size: 'M' }, inStock: 3 }]
}), key);

const tee = (): IProductForm => formFromDraft(draft({ options: OPTIONS, stock: linesFor(OPTIONS, ROWS()) }), key);

const addChoice = (f: IProductForm, optionIndex: number, value: string): IProductForm => ({
  ...f,
  options: f.options.map((o, i) => (i === optionIndex ? { ...o, values: o.values.concat([{ key: key(), value, photos: [] }]) } : o))
});

const setRow = (f: IProductForm, label: string, change: { inStock?: string; price?: string }): IProductForm => {
  const table = stockTable(f);
  const target = table.rows.filter(r => r.label === label)[0];
  return { ...f, lines: setLine(f.lines, table.options, target.combo, change) };
};

const counts = (f: IProductForm): string[] => stockTable(f).rows.map(r => `${r.label}: ${r.inStock}`);

describe('reading a product back for the form', () => {
  it('reads a stock row, taking an empty price as "the usual price" rather than free', () => {
    expect(stockRowFrom({
      Id: 7, Title: 'White · M ', InStock: 4, VariantPrice: null, Combination: '{"Colour":"White","Size":"M"}'
    })).toEqual({ stockId: 7, label: 'White · M', combo: { Colour: 'White', Size: 'M' }, inStock: 4 });
    expect(stockRowFrom({ Id: 8, Title: 'Black · M', InStock: 2, VariantPrice: 24 }).ownPrice).toBe(24);
  });

  it('gives the form a line per combination, with the numbers from the rows and nothing where there is no row', () => {
    const lines = linesFor(OPTIONS, ROWS().slice(0, 2));
    expect(lines.map(l => [l.label, l.inStock, l.ownPrice, l.stockId, l.wasInStock])).toEqual([
      ['White · S', 5, undefined, 1, 5],
      ['White · M', 4, 24, 2, 4],
      ['Black · S', 0, undefined, undefined, undefined],
      ['Black · M', 0, undefined, undefined, undefined]
    ]);
  });

  it('finds a row added by hand in the list by its title', () => {
    expect(linesFor(OPTIONS, [row(9, 'Black · M', {}, 6)])[3].inStock).toBe(6);
  });

  it('gives a product with no options its "One size" row, even an old one saved without a combination', () => {
    expect(linesFor([], [row(3, 'One size', {}, 9)])).toEqual([
      { label: ONE_SIZE, combo: {}, inStock: 9, stockId: 3, wasInStock: 9 }
    ]);
    // Its only row counts whatever it is called, as the shop does.
    expect(linesFor([], [row(4, 'Default', {}, 2)])[0].inStock).toBe(2);
  });

  it('reads the product, its photos in order and each colour\'s photos', () => {
    const d = draftFromRows({
      Id: 12,
      Title: 'Insulated bottle',
      ProductCode: 'CS-BTL-004',
      ShortDescription: null,
      Details: 'Capacity: 500 ml',
      Price: 0,
      Photo: JSON.stringify({ serverRelativeUrl: '/sites/x/SiteAssets/CompanyStore/12-a.png' }),
      Photos: JSON.stringify([`${ORIGIN}/sites/x/SiteAssets/CompanyStore/12-a.png`, `${ORIGIN}/b.png`, '/sites/x/c.png']),
      SearchWords: 'flask',
      ShowInStore: false,
      VariantOptions: JSON.stringify({
        version: 1,
        options: [{
          name: 'Colour',
          values: [{ value: 'Forest', photoUrls: [`${ORIGIN}/f1.png`, '/sites/x/f2.png'] }, { value: 'Black' }]
        }]
      })
    }, [row(5, 'Forest', { Colour: 'Forest' }, 2)], ORIGIN);
    expect(d.id).toBe(12);
    expect(d.shortDescription).toBe('');
    expect(d.showInStore).toBe(false);
    expect(d.photos).toEqual([
      `${ORIGIN}/sites/x/SiteAssets/CompanyStore/12-a.png`, `${ORIGIN}/b.png`, `${ORIGIN}/sites/x/c.png`
    ]);
    expect(d.options).toEqual([{
      name: 'Colour',
      values: [{ value: 'Forest', photoUrls: [`${ORIGIN}/f1.png`, `${ORIGIN}/sites/x/f2.png`] }, { value: 'Black' }]
    }]);
    expect(d.stock.map(l => [l.label, l.inStock])).toEqual([['Forest', 2], ['Black', 0]]);
  });

  it('reads a product saved before it could have several photos: its one photo, and one per colour', () => {
    const d = draftFromRows({
      Id: 3,
      Title: 'Reef crew tee',
      Photo: JSON.stringify({ serverRelativeUrl: '/sites/x/SiteAssets/CompanyStore/3-a.png' }),
      VariantOptions: JSON.stringify({
        version: 1,
        options: [{ name: 'Colour', values: [{ value: 'White', photoUrl: '/sites/x/w.png' }, { value: 'Black' }] }]
      })
    }, [], ORIGIN);
    expect(d.photos).toEqual([`${ORIGIN}/sites/x/SiteAssets/CompanyStore/3-a.png`]);
    expect(d.options[0].values).toEqual([{ value: 'White', photoUrls: [`${ORIGIN}/sites/x/w.png`] }, { value: 'Black' }]);
  });

  it('reads a product with no photos at all as an empty list', () => {
    expect(draftFromRows({ Id: 4, Title: 'Sticker pack', Photo: null, Photos: '' }, [], ORIGIN).photos).toEqual([]);
  });
});

describe('bringing the stock list into line on save', () => {
  it('adds a row for every combination of a new product', () => {
    const lines: IStockLine[] = [{ label: 'White · M', combo: { Colour: 'White', Size: 'M' }, inStock: 4, ownPrice: 24 }];
    const plan = planStock(OPTIONS, [], lines);
    expect(plan.add.map(a => [a.label, a.inStock, a.ownPrice])).toEqual([
      ['White · S', 0, undefined], ['White · M', 4, 24], ['Black · S', 0, undefined], ['Black · M', 0, undefined]
    ]);
    expect(plan.update).toEqual([]);
    expect(plan.remove).toEqual([]);
  });

  it('changes only the rows that differ, found by the combination they were saved with', () => {
    const lines = linesFor(OPTIONS, ROWS()).map(l => (l.label === 'Black · M' ? { ...l, inStock: 3 } : l));
    expect(planStock(OPTIONS, ROWS(), lines)).toEqual({
      update: [{ stockId: 4, label: 'Black · M', combo: { Colour: 'Black', Size: 'M' }, inStock: 3, ownPrice: undefined }],
      add: [],
      remove: []
    });
  });

  it('leaves a number nobody changed as the list has it now, so an order placed meanwhile stands', () => {
    const lines = linesFor(OPTIONS, ROWS());
    const now = ROWS().map(r => (r.stockId === 2 ? { ...r, inStock: 3 } : r));
    expect(planStock(OPTIONS, now, lines).update).toEqual([]);

    const repriced = lines.map(l => (l.stockId === 2 ? { ...l, ownPrice: 25 } : l));
    expect(planStock(OPTIONS, now, repriced).update).toEqual([
      { stockId: 2, label: 'White · M', combo: { Colour: 'White', Size: 'M' }, inStock: undefined, ownPrice: 25 }
    ]);
  });

  it('takes away the rows for combinations that no longer exist', () => {
    const smallOnly: IOption[] = [COLOUR, { name: 'Size', values: [{ value: 'S' }] }];
    const plan = planStock(smallOnly, ROWS(), linesFor(OPTIONS, ROWS()));
    expect(plan.remove).toEqual([2, 4]);
    expect(plan.add).toEqual([]);
  });

  it('keeps a row through a renamed colour, changing its title and combination', () => {
    const ivory: IOption[] = [{ name: 'Colour', values: [{ value: 'Ivory' }, { value: 'Black' }] }, SIZE];
    const lines = linesFor(OPTIONS, ROWS()).map(l => (l.combo.Colour === 'White'
      ? { ...l, label: l.label.replace('White', 'Ivory'), combo: { ...l.combo, Colour: 'Ivory' } }
      : l));
    const plan = planStock(ivory, ROWS(), lines);
    expect(plan.update.map(u => [u.stockId, u.label])).toEqual([[1, 'Ivory · S'], [2, 'Ivory · M']]);
    expect(plan.add).toEqual([]);
    expect(plan.remove).toEqual([]);
  });

  it('puts a product that now comes one way only on a single "One size" row', () => {
    const plan = planStock([], ROWS(), [{ label: ONE_SIZE, combo: {}, inStock: 7 }]);
    expect(plan.add).toEqual([{ label: ONE_SIZE, combo: {}, inStock: 7, ownPrice: undefined }]);
    expect(plan.remove).toEqual([1, 2, 3, 4]);
  });

  it('keeps using an old "One size" row, and leaves it alone when nothing changed', () => {
    const old = [row(9, 'One size', {}, 3)];
    const line: IStockLine = { label: ONE_SIZE, combo: {}, inStock: 3, stockId: 9, wasInStock: 3 };
    expect(planStock([], old, [line])).toEqual({ update: [], add: [], remove: [] });
    expect(planStock([], old, [{ ...line, inStock: 5 }]).update).toEqual([
      { stockId: 9, label: ONE_SIZE, combo: {}, inStock: 5, ownPrice: undefined }
    ]);
  });

  it('clears a price of its own from a product that comes one way only, which has just the one price', () => {
    const old = [row(9, 'One size', {}, 3, 10)];
    const line: IStockLine = { label: ONE_SIZE, combo: {}, inStock: 3, stockId: 9, wasInStock: 3, ownPrice: 10 };
    expect(planStock([], old, [line]).update).toEqual([
      { stockId: 9, label: ONE_SIZE, combo: {}, inStock: undefined, ownPrice: undefined }
    ]);
  });
});

describe('the product form', () => {
  it('keeps the numbers typed for combinations that are still there as choices are added', () => {
    expect(counts(addChoice(sizes(), 0, 'L'))).toEqual(['S: 2', 'M: 3', 'L: 0']);
  });

  it('starts the numbers again when an option is added, as every combination is new', () => {
    const f = sizes();
    const withColour = { ...f, options: f.options.concat([{ key: key(), name: 'Colour', values: [{ key: key(), value: 'White', photos: [] }] }]) };
    expect(counts(withColour)).toEqual(['S · White: 0', 'M · White: 0']);
  });

  it('carries the numbers across when a choice is renamed, so fixing a typo loses nothing', () => {
    expect(counts(withValue(sizes(), 0, 1, 'Medium'))).toEqual(['S: 2', 'Medium: 3']);
  });

  it('does not move the numbers when a choice is renamed to one already there', () => {
    const f = withValue(addChoice(sizes(), 0, 'L'), 0, 2, 'M');
    expect(f.lines).toEqual(sizes().lines.map(l => ({ ...l })));
  });

  it('carries the numbers across when an option is renamed', () => {
    expect(counts(withOptionName(sizes(), 0, 'Fit'))).toEqual(['S: 2', 'M: 3']);
  });

  it('changes one box, adding a line the first time a combination is typed in', () => {
    const once = setLine([], [SIZE], { Size: 'S' }, { inStock: '4' });
    expect(once).toEqual([{ combo: { Size: 'S' }, inStock: '4', price: '' }]);
    expect(setLine(once, [SIZE], { Size: 'S' }, { price: '25' })).toEqual([{ combo: { Size: 'S' }, inStock: '4', price: '25' }]);
  });

  it('lists nothing when there are too many combinations', () => {
    const many = (name: string): IOption => ({
      name, values: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k'].map(value => ({ value }))
    });
    const table = stockTable(formFromDraft(draft({ options: [many('One'), many('Two')], stock: [] }), key));
    expect(table.tooMany).toBe(121);
    expect(table.rows).toEqual([]);
  });

  it('adds up the stock, counting only what reads as a whole number', () => {
    expect(totalStock(stockTable(setRow(tee(), 'Black · S', { inStock: 'lots' })))).toBe(10);
  });

  it('turns what was typed into a product to save', () => {
    const f = setRow(setRow({ ...tee(), price: '22,50' }, 'White · S', { price: ' ' }), 'Black · M', { inStock: '7' });
    const d = draftFromForm(f, 5);
    if (typeof d === 'string') throw new Error(d);
    expect(d.id).toBe(5);
    expect(d.price).toBe(22.5);
    expect(d.options).toEqual(OPTIONS);
    expect(d.stock.map(l => [l.label, l.inStock, l.ownPrice, l.stockId, l.wasInStock])).toEqual([
      ['White · S', 5, undefined, 1, 5],
      ['White · M', 4, 24, 2, 4],
      ['Black · S', 0, undefined, 3, 0],
      ['Black · M', 7, undefined, 4, 1]
    ]);
  });

  it('says in plain words what is wrong', () => {
    expect(draftFromForm({ ...tee(), name: ' ' }, undefined)).toBe('Give the product a name.');
    expect(draftFromForm({ ...tee(), price: '-1' }, undefined)).toBe('The price has to be a number, 0 or more.');
    expect(draftFromForm(addChoice({ ...tee(), options: [{ key: key(), name: 'Size', values: [] }] }, 0, ' '),
      undefined)).toBe('Give each option at least one choice.');
    expect(draftFromForm(setRow(tee(), 'White · M', { inStock: '2.5' }), undefined))
      .toBe('In stock for White · M has to be a whole number, 0 or more.');
    expect(draftFromForm(setRow(tee(), 'White · M', { price: 'abc' }), undefined))
      .toBe('The price for White · M has to be a number, 0 or more — or leave it empty to use the usual price.');
    const oneSize = formFromDraft(draft(), key);
    expect(draftFromForm({ ...oneSize, lines: setLine(oneSize.lines, [], {}, { inStock: '' }) }, undefined))
      .toBe('In stock has to be a whole number, 0 or more.');
  });

  it('reads prices and counts as typed', () => {
    expect(readPrice('')).toBeUndefined();
    expect(readPrice('0')).toBe(0);
    expect(readPrice('1,5')).toBe(1.5);
    expect(readPrice('9.999')).toBe(10);
    expect(readPrice('-1')).toBeUndefined();
    expect(readPrice('$5')).toBeUndefined();
    expect(readCount(' 4 ')).toBe(4);
    expect(readCount('02')).toBe(2);
    ['', ' ', '1.5', '-1', 'two', '1e2', '+1'].forEach(text => expect(readCount(text)).toBeUndefined());
    expect(readCount('3.0')).toBeUndefined();
    expect(readCount('-2')).toBeUndefined();
    expect(readCount('')).toBeUndefined();
  });
});

describe('typing several choices at once', () => {
  const blank = (): IProductForm => ({
    ...formFromDraft(draft(), key),
    options: [{ key: 'o', name: 'Size', values: [{ key: 'a', value: '', photos: [] }, { key: 'b', value: 'XXL', photos: [] }] }]
  });
  const values = (f: IProductForm): string[] => f.options[0].values.map(v => v.value);

  it('splits on commas, keeping the first in the box and putting the rest straight after it', () => {
    expect(values(withTypedValue(blank(), 0, 0, 'S, M, L,XL', key))).toEqual(['S', 'M', 'L', 'XL', 'XXL']);
  });

  it('splits a pasted list, one per line', () => {
    expect(values(withTypedValue(blank(), 0, 0, 'Small\nMedium\r\nLarge\n', key))).toEqual(['Small', 'Medium', 'Large', 'XXL']);
  });

  it('leaves ordinary typing alone, spaces and all', () => {
    expect(values(withTypedValue(blank(), 0, 0, 'Extra small', key))).toEqual(['Extra small', 'XXL']);
  });
});

describe('photos in the form', () => {
  const saved = (url: string): IFormPhoto => ({ key: url, url });
  const fresh = (k: string): IFormPhoto => ({ key: k });

  /* The colours, with Black given the photos asked for. */
  const withPhotos = (photos: IFormPhoto[], black: IFormPhoto[]): IProductForm => {
    const base = formFromDraft(draft({ options: [COLOUR], stock: [] }), key);
    const [white, blk] = base.options[0].values;
    return { ...base, photos, options: [{ ...base.options[0], values: [white, { ...blk, photos: black }] }] };
  };

  it('gives each saved photo a key, the product\'s and each choice\'s, in order', () => {
    const f = formFromDraft(draft({
      photos: ['a', 'b'],
      options: [{ name: 'Colour', values: [{ value: 'White', photoUrls: ['w1', 'w2'] }, { value: 'Black' }] }],
      stock: []
    }), key);
    expect(f.photos.map(p => p.url)).toEqual(['a', 'b']);
    expect(f.photos[0].key).not.toBe(f.photos[1].key);
    expect(f.options[0].values.map(v => v.photos.map(p => p.url))).toEqual([['w1', 'w2'], []]);
  });

  it('moves a photo earlier or later, and makes one the cover with the rest kept in order', () => {
    const list = ['a', 'b', 'c', 'd'];
    expect(movePhoto(list, 2, 1)).toEqual(['a', 'c', 'b', 'd']);
    expect(movePhoto(list, 0, 1)).toEqual(['b', 'a', 'c', 'd']);
    expect(makeCover(list, 3)).toEqual(['d', 'a', 'b', 'c']);
    // Nowhere to go: the list is left as it is.
    expect(movePhoto(list, 0, -1)).toBe(list);
    expect(movePhoto(list, 3, 4)).toBe(list);
    expect(list).toEqual(['a', 'b', 'c', 'd']);
  });

  it('takes a photo off the list by its key', () => {
    expect(withoutPhoto([saved('a'), fresh('n1'), saved('b')], 'n1').map(p => p.key)).toEqual(['a', 'b']);
  });

  it('saves only the photos already saved, and lists each new one with its place and its choice', () => {
    const f = withPhotos([fresh('n1'), saved('a'), fresh('n2'), saved('b')], [saved('k1'), fresh('n3')]);
    const d = draftFromForm(f, 1);
    if (typeof d === 'string') throw new Error(d);
    expect(d.photos).toEqual(['a', 'b']);
    expect(d.options).toEqual([{ name: 'Colour', values: [{ value: 'White' }, { value: 'Black', photoUrls: ['k1'] }] }]);
    expect(photosToUpload(f)).toEqual([
      { key: 'n1', at: 0 },
      { key: 'n2', at: 2 },
      { key: 'n3', at: 1, option: 0, value: 1 }
    ]);
  });

  it('puts new photos back where they were in the form once they have gone up', () => {
    // New, a, new, b — as in the form above.
    expect(placePhotos(['a', 'b'], [{ at: 2, url: 'n2' }, { at: 0, url: 'n1' }])).toEqual(['n1', 'a', 'n2', 'b']);
    expect(placePhotos([], [{ at: 1, url: 'y' }, { at: 0, url: 'x' }])).toEqual(['x', 'y']);
    expect(placePhotos(['a'], [])).toEqual(['a']);
  });

  it('leaves no gap where a new photo didn\'t go up', () => {
    expect(placePhotos(['a', 'b'], [{ at: 3, url: 'n3' }])).toEqual(['a', 'b', 'n3']);
    expect(placePhotos(['a', 'b'], [{ at: 5, url: 'n5' }, { at: 1, url: 'n1' }])).toEqual(['a', 'n1', 'b', 'n5']);
  });

  it('treats new photos a failed save did get up as saved, so saving again doesn\'t add them twice', () => {
    const f = withPhotos([fresh('n1'), saved('a'), fresh('n2')], [fresh('n3')]);
    const after = withUploaded(f, { n1: 'https://x/n1.png', n3: 'https://x/n3.png' });
    expect(after.photos).toEqual([{ key: 'n1', url: 'https://x/n1.png' }, saved('a'), fresh('n2')]);
    expect(after.options[0].values[1].photos).toEqual([{ key: 'n3', url: 'https://x/n3.png' }]);
    expect(photosToUpload(after)).toEqual([{ key: 'n2', at: 2 }]);
  });
});

describe('the stock grid on its own', () => {
  it('reads just the stock boxes, each with the row it came from and the number that row had', () => {
    const lines = stockFromForm(setRow(tee(), 'Black · M', { inStock: '7' }));
    if (typeof lines === 'string') throw new Error(lines);
    expect(lines.map(l => [l.label, l.inStock, l.ownPrice, l.stockId, l.wasInStock])).toEqual([
      ['White · S', 5, undefined, 1, 5],
      ['White · M', 4, 24, 2, 4],
      ['Black · S', 0, undefined, 3, 0],
      ['Black · M', 7, undefined, 4, 1]
    ]);
  });

  it('does not mind a name or price that would stop the whole product saving', () => {
    expect(typeof stockFromForm({ ...tee(), name: '', price: 'abc' })).not.toBe('string');
  });

  it('says in plain words which box is wrong', () => {
    expect(stockFromForm(setRow(tee(), 'Black · S', { inStock: 'some' })))
      .toBe('In stock for Black · S has to be a whole number, 0 or more.');
    expect(stockFromForm(setRow(tee(), 'Black · S', { price: '-3' })))
      .toBe('The price for Black · S has to be a number, 0 or more — or leave it empty to use the usual price.');
  });

  it('puts the same number in every box, including combinations not typed in before', () => {
    const f = withStockEverywhere(addChoice(sizes(), 0, 'L'), 6);
    expect(counts(f)).toEqual(['S: 6', 'M: 6', 'L: 6']);
  });

  it('keeps the prices typed when filling the stock', () => {
    const f = withStockEverywhere(tee(), 2);
    expect(stockTable(f).rows.map(r => r.price)).toEqual(['', '24', '', '']);
  });

  it('knows when a combination has a price of its own, and can put them all back on the usual price', () => {
    expect(hasOwnPrices(stockTable(tee()))).toBe(true);
    expect(hasOwnPrices(stockTable(sizes()))).toBe(false);
    const cleared = withoutPrices(tee());
    expect(hasOwnPrices(stockTable(cleared))).toBe(false);
    expect(counts(cleared)).toEqual(counts(tee()));
  });
});
