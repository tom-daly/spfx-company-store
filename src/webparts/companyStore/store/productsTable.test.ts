import {
  combinationsText, filterCounts, filterProducts, nothingText, stockLevel, summaryText, totalLeft, variesText
} from './productsTable';
import { IProductRow, IStockRow, catalogFromRows } from './shopText';
import { IOption, IProduct, IVariant, ONE_SIZE } from './types';
import { ORIGIN, makeProduct, oneSize } from './__fixtures__/products';

const product = makeProduct(['hat'], 60);

const SIZE: IOption = { name: 'Size', values: [{ value: 'S' }, { value: 'M' }, { value: 'L' }] };
const COLOUR: IOption = { name: 'Colour', values: [{ value: 'White' }, { value: 'Black' }] };

const size = (value: string, inStock: number): IVariant =>
  ({ label: value, combo: { Size: value }, inStock, price: 48 });

/* Plenty of caps, a few hoodies, no stickers, and a towel that is switched off. */
const SHOP = (): IProduct[] => [
  product({ id: 1 }),
  product({
    id: 2, name: 'Crew hoodie', productCode: 'CS-HOD-002', searchWords: ['jumper'], inStock: 7, options: [SIZE],
    variants: [size('S', 0), size('M', 4), size('L', 3)]
  }),
  product({ id: 3, name: 'Sticker pack', productCode: 'CS-STK-008', inStock: 0, variants: [oneSize(0)] }),
  product({ id: 4, name: 'Beach towel', productCode: 'CS-TWL-007', active: false, inStock: 21 })
];

const ids = (list: IProduct[]): number[] => list.map(p => p.id);

describe('the stock number on each row', () => {
  it('reads plenty, running low at ten or fewer, and none', () => {
    expect(stockLevel({ inStock: 11 })).toBe('good');
    expect(stockLevel({ inStock: 10 })).toBe('low');
    expect(stockLevel({ inStock: 1 })).toBe('low');
    expect(stockLevel({ inStock: 0 })).toBe('out');
  });

  it('counts a product with no stock rows as none left', () => {
    expect(stockLevel({ inStock: undefined })).toBe('out');
    expect(totalLeft({ inStock: undefined })).toBe(0);
  });
});

describe('the quick filters and the search', () => {
  it('shows everything under All, switched off or not', () => {
    expect(ids(filterProducts(SHOP(), '', 'all'))).toEqual([1, 2, 3, 4]);
  });

  it('shows what is running low, what is out, and what is off', () => {
    expect(ids(filterProducts(SHOP(), '', 'low'))).toEqual([2]);
    expect(ids(filterProducts(SHOP(), '', 'out'))).toEqual([3]);
    expect(ids(filterProducts(SHOP(), '', 'off'))).toEqual([4]);
  });

  it('searches the name, the product code and the search words, within the filter chosen', () => {
    expect(ids(filterProducts(SHOP(), 'jumper', 'all'))).toEqual([2]);
    expect(ids(filterProducts(SHOP(), 'cs-stk', 'all'))).toEqual([3]);
    expect(ids(filterProducts(SHOP(), 'jumper', 'out'))).toEqual([]);
  });

  it('counts what each filter would show', () => {
    expect(filterCounts(SHOP())).toEqual({ all: 4, low: 1, out: 1, off: 1 });
  });

  it('says why the table is empty', () => {
    expect(nothingText(' tee ', 'low')).toBe('Nothing matches that search.');
    expect(nothingText('', 'low')).toBe('Nothing is running low.');
    expect(nothingText('', 'out')).toBe('Nothing is out of stock.');
    expect(nothingText('', 'off')).toBe('Every product is in the shop.');
  });
});

describe('the summary line', () => {
  it('counts the products, what is running low, what is out and what is off', () => {
    expect(summaryText(SHOP())).toBe('4 products · 1 running low · 1 out of stock · 1 off');
  });

  it('leaves out what there is none of', () => {
    expect(summaryText([product()])).toBe('1 product');
    expect(summaryText([])).toBe('0 products');
  });
});

describe('the words in each row', () => {
  it('says what a product varies by and how many choices each has', () => {
    expect(variesText([COLOUR, { ...SIZE, values: SIZE.values.concat([{ value: 'XL' }]) }])).toBe('Colour (2), Size (4)');
    expect(variesText([])).toBe('—');
  });

  it('says how many combinations there are and how many have run out', () => {
    expect(combinationsText(SHOP()[1])).toBe('3 combinations, 1 out');
    expect(combinationsText({ options: [SIZE], variants: [size('S', 2), size('M', 1), size('L', 5)] }))
      .toBe('3 combinations');
    expect(combinationsText({ options: [SIZE], variants: [size('S', 0), size('M', 0), size('L', 0)] }))
      .toBe('3 combinations');
    expect(combinationsText({ options: [{ name: 'Size', values: [{ value: 'S' }] }], variants: [size('S', 2)] }))
      .toBe('1 combination');
  });

  it('says nothing under the number for a product that comes one way only', () => {
    expect(combinationsText(product())).toBeUndefined();
  });
});

describe('loading every product for the Products page', () => {
  const row = (over: Partial<IProductRow>): IProductRow => ({
    Id: 1, Title: 'Dive cap', Price: 18, ShowInStore: true, ...over
  });
  const stock = (productId: number, inStock: number): IStockRow =>
    ({ Title: ONE_SIZE, StoreProductId: productId, InStock: inStock });
  const rows = (): IProductRow[] => [row({ Id: 1 }), row({ Id: 2, Title: 'Beach towel', ShowInStore: false })];

  it('keeps the switched-off products, marked as off', () => {
    const all = catalogFromRows(rows(), [stock(1, 3), stock(2, 21)], ORIGIN, true);
    expect(all.map(p => [p.name, p.active, p.inStock])).toEqual([['Beach towel', false, 21], ['Dive cap', true, 3]]);
  });

  it('still leaves them out of the shop', () => {
    expect(catalogFromRows(rows(), [], ORIGIN).map(p => p.id)).toEqual([1]);
  });

  it('treats a product with nothing in its Active column as off, as the shop does', () => {
    expect(catalogFromRows([row({ ShowInStore: null })], [], ORIGIN, true)[0].active).toBe(false);
  });
});
