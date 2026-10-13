import { MONEY_COLUMNS, STORE_LISTS, ORDER_STATUSES, keepsOwnRows, xmlEscape, listDef } from './schema';

const IDS = { products: '11111111-2222-3333-4444-555555555555' };
const BUILT_IN = ['LinkTitle', 'Title', 'Author', 'Created', 'ID'];

describe('the list definitions', () => {
  it('give every column XML SharePoint can read, under the name the store expects', () => {
    for (const def of STORE_LISTS) {
      for (const f of def.fields) {
        const doc = new DOMParser().parseFromString(f.xml(IDS), 'application/xml');
        expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
        const el = doc.documentElement;
        expect(el.getAttribute('Name')).toBe(f.name);
        expect(el.getAttribute('StaticName')).toBe(f.name);
        expect(el.getAttribute('DisplayName')).toBe(f.title);
      }
    }
  });

  it('never repeat a column name within a list', () => {
    for (const def of STORE_LISTS) {
      const names = def.fields.map(f => f.name);
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it('only show columns in views that exist', () => {
    for (const def of STORE_LISTS) {
      const known = [...BUILT_IN, ...def.fields.map(f => f.name)];
      for (const v of def.views) {
        for (const f of v.fields) expect(known).toContain(f);
      }
    }
  });

  it('point the stock list at the products list by its ID', () => {
    const product = listDef('stock').fields.find(f => f.name === 'StoreProduct');
    expect(product?.xml(IDS)).toContain(`List="{${IDS.products}}"`);
    expect(() => product?.xml({})).toThrow();
  });

  it('keep the order data out of sight', () => {
    const data = listDef('orders').fields.find(f => f.name === 'OrderData');
    expect(data?.xml(IDS)).toContain('Hidden="TRUE"');
    expect(data?.inDefaultView).toBe(false);
  });

  it('give orders the days, the tracking and every status, Confirmed straight after New', () => {
    const orders = listDef('orders');
    expect(orders.fields).toHaveLength(13);
    expect(orders.fields.map(f => f.name)).toEqual(expect.arrayContaining(['ReadyBy', 'Tracking', 'PickedUpOn']));
    const status = orders.fields.find(f => f.name === 'OrderStatus');
    expect(status?.choices).toEqual(ORDER_STATUSES);
    expect(ORDER_STATUSES.slice(0, 2)).toEqual(['New', 'Confirmed']);
  });

  it('let store managers into every list but the addresses', () => {
    expect(STORE_LISTS.filter(def => def.managers).map(def => def.key)).toEqual(['settings', 'products', 'stock', 'orders']);
    expect(listDef('addresses').managers).toBe(false);
  });

  it('know every money column, so a change of currency reaches them all', () => {
    expect(MONEY_COLUMNS).toEqual([
      { list: 'products', field: 'Price' },
      { list: 'stock', field: 'VariantPrice' },
      { list: 'orders', field: 'OrderTotal' }
    ]);
  });

  it('keep each person to their own rows in the orders and the addresses', () => {
    expect(STORE_LISTS.filter(keepsOwnRows).map(def => def.key)).toEqual(['orders', 'addresses']);
  });

  it('escape characters that would break the XML', () => {
    expect(xmlEscape('Fish & "chips" <hot>')).toBe('Fish &amp; &quot;chips&quot; &lt;hot&gt;');
  });
});
