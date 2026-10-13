import {
  addButtonText, addToCart, cartFromStorage, catalogFromRows, chooseText, detailLines, fitCart,
  lineVariant, matchesSearch, photoUrlFrom, pickNote, priceText, removeFromCart, searchWordsFrom, setCartQty,
  splitDetail, stockLabel, IAddState, IProductRow, IStockRow
} from './shopText';
import { ICartLine, IOption, IProduct, IVariant, ONE_SIZE } from './types';
import { ORIGIN, makeProduct, oneSize } from './__fixtures__/products';

const product = makeProduct(['hat', 'baseball cap'], 5);

const line = (over: Partial<ICartLine> = {}): ICartLine => ({
  productId: 1, name: 'Dive cap', price: 18, qty: 1, variant: ONE_SIZE, ...over
});

/* A tee in two colours (White has photos of its own) and two sizes. Black costs more. */
const COLOUR: IOption = {
  name: 'Colour',
  values: [{ value: 'White', photoUrls: ['https://x/white.png', 'https://x/white-back.png'] }, { value: 'Black' }]
};
const SIZE: IOption = { name: 'Size', values: [{ value: 'M' }, { value: 'L' }] };

const teeVariant = (colour: string, size: string, inStock: number, price: number = 22): IVariant =>
  ({ label: `${colour} · ${size}`, combo: { Colour: colour, Size: size }, inStock, price });

const tee = (over: Partial<IProduct> = {}): IProduct => product({
  id: 2,
  name: 'Reef tee',
  price: 22,
  photoUrl: 'https://x/tee.png',
  photos: ['https://x/tee.png', 'https://x/tee-detail.png'],
  inStock: 6,
  options: [COLOUR, SIZE],
  variants: [teeVariant('White', 'M', 3), teeVariant('White', 'L', 0), teeVariant('Black', 'M', 2, 26), teeVariant('Black', 'L', 1, 26)],
  ...over
});

const teeLine = (over: Partial<ICartLine> = {}): ICartLine =>
  line({ productId: 2, name: 'Reef tee', price: 22, photoUrl: 'https://x/white.png', variant: 'White · M', ...over });

describe('photo addresses', () => {
  it('builds the full address from what the picture column holds', () => {
    const value = JSON.stringify({
      type: 'thumbnail', fileName: '1-a.png', serverUrl: 'https://tenant.sharepoint.com',
      serverRelativeUrl: '/sites/x/SiteAssets/CompanyStore/1-a.png'
    });
    expect(photoUrlFrom(value, ORIGIN)).toBe('https://tenant.sharepoint.com/sites/x/SiteAssets/CompanyStore/1-a.png');
  });

  it('uses the site\'s own address when the server is left out', () => {
    const value = '{"type":"thumbnail","serverRelativeUrl":"/sites/x/SiteAssets/CompanyStore/2-b.png"}';
    expect(photoUrlFrom(value, ORIGIN)).toBe(`${ORIGIN}/sites/x/SiteAssets/CompanyStore/2-b.png`);
  });

  it('does not double up the slash between server and path', () => {
    const value = { serverUrl: 'https://tenant.sharepoint.com/', serverRelativeUrl: '/a.png' };
    expect(photoUrlFrom(value, ORIGIN)).toBe('https://tenant.sharepoint.com/a.png');
  });

  it('has no photo when the column is blank', () => {
    expect(photoUrlFrom(null, ORIGIN)).toBeUndefined();
    expect(photoUrlFrom(undefined, ORIGIN)).toBeUndefined();
    expect(photoUrlFrom('', ORIGIN)).toBeUndefined();
    expect(photoUrlFrom('   ', ORIGIN)).toBeUndefined();
  });

  it('has no photo when the value is broken or says nothing useful', () => {
    expect(photoUrlFrom('{"serverRelativeUrl": ', ORIGIN)).toBeUndefined();
    expect(photoUrlFrom('{"type":"thumbnail"}', ORIGIN)).toBeUndefined();
    expect(photoUrlFrom('just some words', ORIGIN)).toBeUndefined();
    expect(photoUrlFrom(42, ORIGIN)).toBeUndefined();
  });

  it('takes a plain web address as it is', () => {
    expect(photoUrlFrom('https://cdn.example.com/cap.png', ORIGIN)).toBe('https://cdn.example.com/cap.png');
  });
});

describe('product details', () => {
  it('gives one entry per line and drops blank lines', () => {
    expect(detailLines('Fabric: organic cotton\r\n\n  Fit: Regular  \n')).toEqual(['Fabric: organic cotton', 'Fit: Regular']);
  });

  it('has no details when the column is blank', () => {
    expect(detailLines(null)).toEqual([]);
    expect(detailLines('')).toEqual([]);
  });

  it('splits a line into label and value on the first colon only', () => {
    expect(splitDetail('Fabric: organic cotton')).toEqual({ label: 'Fabric', value: 'organic cotton' });
    expect(splitDetail('Ratio: 1:2')).toEqual({ label: 'Ratio', value: '1:2' });
  });

  it('shows a line without a label whole', () => {
    expect(splitDetail('Machine washable')).toEqual({ value: 'Machine washable' });
    expect(splitDetail(': nothing before')).toEqual({ value: ': nothing before' });
    expect(splitDetail('Note:')).toEqual({ value: 'Note:' });
  });

  it('does not mistake a web address for a label', () => {
    expect(splitDetail('https://example.com/care')).toEqual({ value: 'https://example.com/care' });
  });

  it('reads search words separated by commas', () => {
    expect(searchWordsFrom('hat, baseball cap,,  sun ')).toEqual(['hat', 'baseball cap', 'sun']);
    expect(searchWordsFrom(null)).toEqual([]);
  });
});

describe('searching the shop', () => {
  const cap = product();

  it('finds everything when the search is blank', () => {
    expect(matchesSearch(cap, '')).toBe(true);
    expect(matchesSearch(cap, '   ')).toBe(true);
  });

  it('looks in the name, short description, product code and search words, ignoring case', () => {
    expect(matchesSearch(cap, 'DIVE')).toBe(true);
    expect(matchesSearch(cap, 'adjustable')).toBe(true);
    expect(matchesSearch(cap, 'cs-cap')).toBe(true);
    expect(matchesSearch(cap, 'baseball')).toBe(true);
  });

  it('needs every word typed to turn up somewhere', () => {
    expect(matchesSearch(cap, 'hat strap')).toBe(true);
    expect(matchesSearch(cap, 'hat hoodie')).toBe(false);
  });

  it('does not find words that are only in the full description', () => {
    expect(matchesSearch(product({ longDescription: 'Brass buckle' }), 'brass')).toBe(false);
  });

  it('does not join the end of one field to the start of the next', () => {
    expect(matchesSearch(product({ name: 'Cap', shortDescription: 'Red' }), 'capred')).toBe(false);
  });
});

describe('the stock line', () => {
  it('says out of stock when there are none, or no stock line at all', () => {
    expect(stockLabel(undefined)).toEqual({ text: 'Out of stock', level: 'out' });
    expect(stockLabel(0)).toEqual({ text: 'Out of stock', level: 'out' });
    expect(stockLabel(-2)).toEqual({ text: 'Out of stock', level: 'out' });
  });

  it('warns when ten or fewer are left', () => {
    expect(stockLabel(1)).toEqual({ text: '1 left', level: 'low' });
    expect(stockLabel(10)).toEqual({ text: '10 left', level: 'low' });
  });

  it('just says how many when there are plenty', () => {
    expect(stockLabel(11)).toEqual({ text: '11 in stock', level: 'good' });
  });
});

describe('reading the products list', () => {
  const row = (over: Partial<IProductRow>): IProductRow => ({
    Id: 1, Title: 'Dive cap', ProductCode: 'CS-CAP-003', ShortDescription: 'Six-panel.', LongDescription: null,
    Details: 'Fit: One size', Price: 18, Photo: null, SearchWords: 'hat, sun', ShowInStore: true, ...over
  });
  const stock = (
    productId: number, inStock: number, variant: string = ONE_SIZE, over: Partial<IStockRow> = {}
  ): IStockRow => ({ Title: variant, StoreProductId: productId, InStock: inStock, ...over });

  it('joins each product to its stock and sorts by name', () => {
    const products = catalogFromRows(
      [row({ Id: 1, Title: 'Tote' }), row({ Id: 2, Title: 'apron' })],
      [stock(1, 7), stock(2, 0)],
      ORIGIN
    );
    expect(products.map(p => [p.name, p.inStock])).toEqual([['apron', 0], ['Tote', 7]]);
  });

  it('leaves out products that are not active', () => {
    const products = catalogFromRows([row({ Id: 1 }), row({ Id: 2, ShowInStore: false })], [], ORIGIN);
    expect(products.map(p => p.id)).toEqual([1]);
  });

  it('has no stock number for a product without a stock line', () => {
    const p = catalogFromRows([row({})], [stock(9, 4)], ORIGIN)[0];
    expect(p.inStock).toBeUndefined();
    expect(p.variants).toEqual([oneSize(0)]);
  });

  it('takes the One size line when a product has more than one', () => {
    const products = catalogFromRows([row({})], [stock(1, 3, 'Large'), stock(1, 8)], ORIGIN);
    expect(products[0].inStock).toBe(8);
  });

  it('takes the only stock line of a product with no options, whatever it is called', () => {
    expect(catalogFromRows([row({})], [stock(1, 4, 'Large', { Id: 7 })], ORIGIN)[0].variants)
      .toEqual([{ ...oneSize(4), stockId: 7 }]);
  });

  it('fills in every field, with blanks as empty rather than missing', () => {
    expect(catalogFromRows([row({ Photo: '{"serverRelativeUrl":"/p.png"}' })], [stock(1, 2)], ORIGIN)[0]).toEqual({
      id: 1,
      name: 'Dive cap',
      productCode: 'CS-CAP-003',
      shortDescription: 'Six-panel.',
      longDescription: '',
      details: ['Fit: One size'],
      price: 18,
      photoUrl: `${ORIGIN}/p.png`,
      photos: [`${ORIGIN}/p.png`],
      searchWords: ['hat', 'sun'],
      active: true,
      inStock: 2,
      options: [],
      variants: [oneSize(2)]
    });
  });

  it('treats a blank price as free', () => {
    expect(catalogFromRows([row({ Price: null })], [], ORIGIN)[0].price).toBe(0);
  });

  it('reads every photo in order, cover first, each as a full address', () => {
    const p = catalogFromRows([row({
      Photo: '{"serverRelativeUrl":"/sites/x/a.png"}',
      Photos: JSON.stringify(['/sites/x/a.png', 'https://cdn.example.com/b.png', 'not an address'])
    })], [], ORIGIN)[0];
    expect(p.photos).toEqual([`${ORIGIN}/sites/x/a.png`, 'https://cdn.example.com/b.png']);
    expect(p.photoUrl).toBe(`${ORIGIN}/sites/x/a.png`);
  });

  it('counts the one photo of a product saved before it could have several', () => {
    const p = catalogFromRows([row({ Photo: '{"serverRelativeUrl":"/old.png"}', Photos: null })], [], ORIGIN)[0];
    expect([p.photos, p.photoUrl]).toEqual([[`${ORIGIN}/old.png`], `${ORIGIN}/old.png`]);
  });

  it('has no photos when neither column has any', () => {
    const p = catalogFromRows([row({ Photos: '' })], [], ORIGIN)[0];
    expect([p.photos, p.photoUrl]).toEqual([[], undefined]);
  });

  describe('a product with options', () => {
    const OPTIONS = JSON.stringify({
      version: 1,
      options: [
        {
          name: 'Colour',
          values: [{ value: 'White', photoUrls: ['/sites/x/white.png', '/sites/x/white-back.png'] }, { value: 'Black' }]
        },
        { name: 'Size', values: [{ value: 'M' }, { value: 'L' }] }
      ]
    });

    it('makes a variant for every combination, each joined to its own stock line', () => {
      const lines = [
        stock(1, 3, 'White · M', { Id: 11, Combination: '{"Colour":"White","Size":"M"}', VariantPrice: null }),
        // Renamed by hand: still found by what it was saved as.
        stock(1, 2, 'Black medium', { Id: 12, Combination: '{"Size":"M","Colour":"Black"}', VariantPrice: 26 }),
        // Added by hand with no combination: found by its title.
        stock(1, 1, 'Black · L', { Id: 13 }),
        stock(2, 50, 'White · L', { Combination: '{"Colour":"White","Size":"L"}' })
      ];
      const p = catalogFromRows([row({ VariantOptions: OPTIONS })], lines, ORIGIN)[0];
      expect(p.variants).toEqual([
        { stockId: 11, label: 'White · M', combo: { Colour: 'White', Size: 'M' }, inStock: 3, price: 18 },
        { label: 'White · L', combo: { Colour: 'White', Size: 'L' }, inStock: 0, price: 18 },
        { stockId: 12, label: 'Black · M', combo: { Colour: 'Black', Size: 'M' }, inStock: 2, price: 26, ownPrice: 26 },
        { stockId: 13, label: 'Black · L', combo: { Colour: 'Black', Size: 'L' }, inStock: 1, price: 18 }
      ]);
      expect(p.inStock).toBe(6);
    });

    it('lets a variant be free when the product is not', () => {
      const lines = [stock(1, 3, 'White · M', { VariantPrice: 0 })];
      const p = catalogFromRows([row({ VariantOptions: OPTIONS })], lines, ORIGIN)[0];
      expect([p.variants[0].price, p.variants[0].ownPrice, p.variants[1].price]).toEqual([0, 0, 18]);
    });

    it('makes each value photo a full address', () => {
      const p = catalogFromRows([row({ VariantOptions: OPTIONS })], [], ORIGIN)[0];
      expect(p.options[0].values).toEqual([
        { value: 'White', photoUrls: [`${ORIGIN}/sites/x/white.png`, `${ORIGIN}/sites/x/white-back.png`] },
        { value: 'Black' }
      ]);
    });

    it('reads a value saved when choices had just one photo', () => {
      const old = JSON.stringify({ version: 1, options: [{ name: 'Colour', values: [{ value: 'White', photoUrl: '/w.png' }] }] });
      const p = catalogFromRows([row({ VariantOptions: old })], [], ORIGIN)[0];
      expect(p.options[0].values).toEqual([{ value: 'White', photoUrls: [`${ORIGIN}/w.png`] }]);
    });

    it('leaves a value with no photos when none of its photos make sense', () => {
      const odd = JSON.stringify({ version: 1, options: [{ name: 'Colour', values: [{ value: 'White', photoUrls: ['nonsense'] }] }] });
      const p = catalogFromRows([row({ VariantOptions: odd })], [], ORIGIN)[0];
      expect(p.options[0].values).toEqual([{ value: 'White' }]);
    });

    it('counts a negative stock number as none left', () => {
      const p = catalogFromRows([row({ VariantOptions: OPTIONS })], [stock(1, -3, 'White · M'), stock(1, 2, 'Black · L')], ORIGIN)[0];
      expect([p.variants[0].inStock, p.inStock]).toEqual([0, 2]);
    });

    it('treats options it cannot read as none', () => {
      expect(catalogFromRows([row({ VariantOptions: 'not json' })], [stock(1, 4)], ORIGIN)[0].variants).toEqual([oneSize(4)]);
    });
  });
});

describe('the product page', () => {
  it('shows one price when every variant costs the same', () => {
    expect(priceText(product(), 'USD')).toBe('$18.00');
    expect(priceText(product({ price: 0, variants: [oneSize(5, 0)] }), 'USD')).toBe('Free');
  });

  it('shows where prices start when the variants differ', () => {
    expect(priceText(tee(), 'USD')).toBe('From $22.00');
  });

  it('says "Free to" the dearest when some variants are free', () => {
    expect(priceText(tee({ variants: [teeVariant('White', 'M', 1, 0), teeVariant('Black', 'M', 1, 5)] }), 'USD'))
      .toBe('Free to $5.00');
  });

  it('asks for the options not picked yet, in plain words', () => {
    expect(chooseText(['Size'])).toBe('Choose size');
    expect(chooseText(['Size', 'Colour'])).toBe('Choose size and colour');
    expect(chooseText(['Colour', 'Size', 'Fit'])).toBe('Choose colour, size and fit');
  });

  it('explains the pickers until everything is picked, then says how many are left', () => {
    const t = tee();
    expect(pickNote([], oneSize(5))).toBeUndefined();
    expect(pickNote(t.options, undefined)).toBe('Crossed out means none left');
    expect(pickNote(t.options, t.variants[0])).toBe('3 left in White · M');
    expect(pickNote(t.options, t.variants[1])).toBe('That combination is out of stock');
  });

  it('labels the add button with what happens next', () => {
    const ready: IAddState = { totalLeft: 6, missing: [], left: 3, inCart: 0 };
    expect(addButtonText(ready)).toBe('Add to cart');
    expect(addButtonText({ ...ready, missing: ['Size', 'Colour'] })).toBe('Choose size and colour');
    expect(addButtonText({ ...ready, totalLeft: 0, missing: ['Size'] })).toBe('Out of stock');
    expect(addButtonText({ ...ready, left: 0 })).toBe('Out of stock');
    expect(addButtonText({ ...ready, inCart: 3 })).toBe('All 3 are in your cart');
    expect(addButtonText({ ...ready, left: 1, inCart: 1 })).toBe('The last one is in your cart');
  });
});

describe('the cart', () => {
  it('adds a product as one line in one size', () => {
    const cap = product();
    expect(addToCart([], cap, cap.variants[0], 2)).toEqual([line({ qty: 2 })]);
  });

  it('adds more of something already in the cart, but never more than are left', () => {
    const cap = product();
    const once = addToCart([], cap, cap.variants[0], 3);
    expect(addToCart(once, cap, cap.variants[0], 1)).toEqual([line({ qty: 4 })]);
    expect(addToCart(once, cap, cap.variants[0], 9)).toEqual([line({ qty: 5 })]);
  });

  it('adds nothing when none are left', () => {
    const cap = product({ inStock: 0, variants: [oneSize(0)] });
    expect(addToCart([], cap, cap.variants[0], 1)).toEqual([]);
  });

  it('keeps each variant on its own line, at its own price and pictured by its colour or else the cover', () => {
    const t = tee();
    const both = addToCart(addToCart([], t, t.variants[0], 1), t, t.variants[2], 2);
    expect(both).toEqual([
      teeLine(),
      teeLine({ variant: 'Black · M', price: 26, photoUrl: 'https://x/tee.png', qty: 2 })
    ]);
    expect(addToCart(both, t, t.variants[0], 1).map(l => l.qty)).toEqual([2, 2]);
  });

  it('never adds more of a variant than that variant has left', () => {
    const t = tee();
    expect(addToCart([], t, t.variants[3], 5).map(l => l.qty)).toEqual([1]);
    expect(addToCart([], t, t.variants[1], 1)).toEqual([]);
  });

  it('finds the variant a line is for', () => {
    expect(lineVariant([tee()], teeLine())).toEqual(teeVariant('White', 'M', 3));
    expect(lineVariant([tee()], teeLine({ variant: 'Navy · M' }))).toBeUndefined();
    expect(lineVariant([], teeLine())).toBeUndefined();
  });

  it('keeps a quantity between one and what is left', () => {
    const lines = [line({ qty: 2 })];
    expect(setCartQty(lines, 1, ONE_SIZE, 0, 5)[0].qty).toBe(1);
    expect(setCartQty(lines, 1, ONE_SIZE, 9, 5)[0].qty).toBe(5);
    expect(setCartQty(lines, 1, ONE_SIZE, 3, 5)[0].qty).toBe(3);
  });

  it('changes and removes just the one variant', () => {
    const lines = [teeLine(), teeLine({ variant: 'Black · M' })];
    expect(setCartQty(lines, 2, 'Black · M', 2, 5).map(l => l.qty)).toEqual([1, 2]);
    expect(removeFromCart(lines, 2, 'White · M')).toEqual([teeLine({ variant: 'Black · M' })]);
  });

  it('removes just the one line', () => {
    expect(removeFromCart([line(), line({ productId: 2 })], 1, ONE_SIZE)).toEqual([line({ productId: 2 })]);
  });

  it('brings a saved cart up to date with the shop, and says when it had to', () => {
    const saved = [line({ qty: 4 }), line({ productId: 2, name: 'Gone' }), line({ productId: 3, name: 'Old name' })];
    const shop = [product({ variants: [oneSize(2)] }), product({ id: 3, name: 'Tote', variants: [oneSize(9)] })];
    expect(fitCart(saved, shop)).toEqual({
      lines: [line({ qty: 2 }), line({ productId: 3, name: 'Tote', qty: 1 })],
      changed: true
    });
  });

  it('says nothing changed when the cart still fits the shop', () => {
    expect(fitCart([line({ qty: 2 })], [product()]).changed).toBe(false);
    expect(fitCart([teeLine({ qty: 2 })], [tee()]).changed).toBe(false);
  });

  it('takes out something that has sold out since', () => {
    expect(fitCart([line()], [product({ variants: [oneSize(0)] })])).toEqual({ lines: [], changed: true });
  });

  it('fits the cart variant by variant', () => {
    const saved = [
      teeLine({ qty: 5 }),
      teeLine({ variant: 'White · L' }),
      teeLine({ variant: 'Navy · M' }),
      teeLine({ variant: 'Black · M', photoUrl: undefined })
    ];
    expect(fitCart(saved, [tee()])).toEqual({
      // Cut to the 3 White · M left; White · L sold out; Navy gone; Black · M now costs 26.
      lines: [teeLine({ qty: 3 }), teeLine({ variant: 'Black · M', price: 26, photoUrl: 'https://x/tee.png' })],
      changed: true
    });
  });

  it('brings line photos up to date', () => {
    const t = tee({ photoUrl: 'https://x/new.png', photos: ['https://x/new.png'] });
    const fitted = fitCart([teeLine({ variant: 'Black · M', price: 26, photoUrl: 'https://x/old.png' }), teeLine()], [t]);
    expect(fitted.lines.map(l => l.photoUrl)).toEqual(['https://x/new.png', 'https://x/white.png']);
    expect(fitted.changed).toBe(false);
  });

  it('takes out a one-size line for a product that now comes in options', () => {
    expect(fitCart([line({ productId: 2 })], [tee()])).toEqual({ lines: [], changed: true });
  });

  it('reads back a saved cart and drops anything that does not look like a cart line', () => {
    const saved = JSON.stringify([line({ qty: 2 }), { productId: 'x' }, null, line({ productId: 2, qty: 0 })]);
    expect(cartFromStorage(saved)).toEqual([line({ qty: 2 })]);
  });

  it('keeps the variant of a saved line', () => {
    expect(cartFromStorage(JSON.stringify([teeLine()]))).toEqual([teeLine()]);
  });

  it('starts empty when nothing was saved, or it was not a cart', () => {
    expect(cartFromStorage(undefined)).toEqual([]);
    expect(cartFromStorage('not json')).toEqual([]);
    expect(cartFromStorage('{"productId":1}')).toEqual([]);
  });
});
