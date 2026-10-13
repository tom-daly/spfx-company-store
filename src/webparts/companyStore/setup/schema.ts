/*
 * The lists the store keeps its data in, written down once. Setup builds
 * them from this; the health check compares the site against it.
 *
 * Lists are found by their web address (Lists/CompanyStoreOrders), never by
 * their title, so the store team can rename them without breaking the store.
 *
 * Column internal names never change once shipped. Titles, descriptions and
 * views are only applied when a list is first created, so anything the client
 * adjusts by hand afterwards is left alone.
 */

export type ListKey = 'settings' | 'products' | 'stock' | 'orders' | 'addresses';

/**
 * Who can do what in a list.
 *  site        - follows the site: staff read, owners edit.
 *  everyoneEdits - any staff member can change any row (the stock numbers, so
 *                  checkout can take items off).
 *  ownRows     - staff add rows and only ever see their own; site owners see all.
 *  ownRowsOnly - as ownRows, and nobody else at all, site owners included.
 *                Only site collection admins (IT) can still get in.
 *
 * On top of that, a list marked `managers` lets the Store managers group change
 * every row, so the people a site owner picks can run the store.
 */
export type Access = 'site' | 'everyoneEdits' | 'ownRows' | 'ownRowsOnly';

export type ListIds = Partial<Record<ListKey, string>>;

export interface IFieldDef {
  name: string;
  title: string;
  inDefaultView: boolean;
  xml: (ids: ListIds) => string;
  /** A choice column's choices, so setup can add any a newer version brings. */
  choices?: string[];
  /** A money column, which shows the store's currency symbol in SharePoint. */
  currency?: boolean;
}

export interface IViewDef {
  title: string;
  fields: string[];
  query: string;
  rowLimit: number;
}

export interface IListDef {
  key: ListKey;
  urlName: string;
  title: string;
  description: string;
  titleColumn: string;
  hidden: boolean;
  searchable: boolean;
  keepVersions: boolean;
  access: Access;
  /** Store managers can change every row (Edit), so they can run the store without being site owners. */
  managers: boolean;
  fields: IFieldDef[];
  /** The first view is applied to the list's own default view. */
  views: IViewDef[];
}

/* ------------------------------------------------------------ column XML */

export const xmlEscape = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

interface IFieldOptions {
  hint?: string;
  required?: boolean;
  inDefaultView?: boolean;
  hidden?: boolean;
}

function field(
  name: string, title: string, type: string, extra: string, inner: string, o: IFieldOptions
): IFieldDef {
  const attrs =
    `Type="${type}" Name="${name}" StaticName="${name}" DisplayName="${xmlEscape(title)}"` +
    (o.hint ? ` Description="${xmlEscape(o.hint)}"` : '') +
    (o.required ? ' Required="TRUE"' : '') +
    (o.hidden ? ' Hidden="TRUE"' : '') +
    extra;
  const xml = `<Field ${attrs}${inner ? `>${inner}</Field>` : ' />'}`;
  return { name, title, inDefaultView: o.inDefaultView !== false && !o.hidden, xml: () => xml };
}

const text = (name: string, title: string, maxLength: number, o: IFieldOptions = {}): IFieldDef =>
  field(name, title, 'Text', ` MaxLength="${maxLength}"`, '', o);

const note = (name: string, title: string, lines: number, o: IFieldOptions = {}): IFieldDef =>
  field(name, title, 'Note', ` NumLines="${lines}" RichText="FALSE"`, '', o);

const money = (name: string, title: string, o: IFieldOptions = {}): IFieldDef =>
  ({ ...field(name, title, 'Currency', ' Decimals="2" Min="0"', '<Default>0</Default>', o), currency: true });

/* A price that can be left empty, meaning "use the product's price". */
const optionalMoney = (name: string, title: string, o: IFieldOptions = {}): IFieldDef =>
  ({ ...field(name, title, 'Currency', ' Decimals="2" Min="0"', '', o), currency: true });

const count = (name: string, title: string, o: IFieldOptions = {}): IFieldDef =>
  field(name, title, 'Number', ' Decimals="0" Min="0"', '<Default>0</Default>', o);

const yesNo = (name: string, title: string, byDefault: boolean, o: IFieldOptions = {}): IFieldDef =>
  field(name, title, 'Boolean', '', `<Default>${byDefault ? 1 : 0}</Default>`, o);

const picture = (name: string, title: string, o: IFieldOptions = {}): IFieldDef =>
  field(name, title, 'Thumbnail', '', '', o);

function choice(name: string, title: string, choices: string[], byDefault: string, o: IFieldOptions = {}): IFieldDef {
  const list = choices.map(c => `<CHOICE>${xmlEscape(c)}</CHOICE>`).join('');
  return {
    ...field(name, title, 'Choice', ' Format="Dropdown"',
      `<CHOICES>${list}</CHOICES><Default>${xmlEscape(byDefault)}</Default>`, o),
    choices
  };
}

/* A lookup has to name the list it points at by its ID, which only exists once
   that list has been made — so its XML is built at install time. */
function lookup(name: string, title: string, to: ListKey, o: IFieldOptions = {}): IFieldDef {
  const base = field(name, title, 'Lookup', '', '', o);
  return {
    ...base,
    xml: (ids) => {
      const id = ids[to];
      if (!id) throw new Error(`The ${to} list has to exist before ${name} can point at it.`);
      return base.xml(ids).replace(' />', ` List="{${id}}" ShowField="Title" />`);
    }
  };
}

/* ------------------------------------------------------------------ lists */

/* Deliveries go New, Confirmed, Packed, Shipped; pick-ups go New, Confirmed, Ready for pick-up, Picked up. */
export const ORDER_STATUSES = ['New', 'Confirmed', 'Packed', 'Shipped', 'Ready for pick-up', 'Picked up'];
export const DONE_STATUSES = ['Shipped', 'Picked up'];
export const DELIVERY_METHODS = ['Pick up', 'Delivery'];

/** The SharePoint group whose people run the store. Site owners add and remove them from the store's Settings. */
export const MANAGERS_GROUP = 'Company Store Managers';

/** The Site Assets library is always at this address on the site, whatever language the site is in. */
export const SITE_ASSETS = 'SiteAssets';

/** The folder in Site Assets that product photos go in. Store managers can add to it. */
export const PHOTO_FOLDER = 'CompanyStore';

export const STORE_LISTS: IListDef[] = [
  {
    key: 'settings',
    urlName: 'CompanyStoreSettings',
    title: 'Store settings',
    description: 'Settings for the whole store, one row each. Change them from the store page.',
    titleColumn: 'Setting',
    hidden: true,
    searchable: false,
    keepVersions: true,
    access: 'site',
    managers: true,
    fields: [
      note('SettingValue', 'Value', 3)
    ],
    views: [{
      title: 'All settings',
      fields: ['LinkTitle', 'SettingValue'],
      query: '<OrderBy><FieldRef Name="Title" /></OrderBy>',
      rowLimit: 100
    }]
  },
  {
    key: 'products',
    urlName: 'CompanyStoreProducts',
    title: 'Store products',
    description: 'What the store sells. One row per product.',
    titleColumn: 'Product',
    hidden: false,
    searchable: true,
    keepVersions: true,
    access: 'site',
    managers: true,
    fields: [
      text('ProductCode', 'Product code', 64),
      text('ShortDescription', 'Short description', 255, { hint: 'One line, shown on the product card.' }),
      note('LongDescription', 'Full description', 6, { inDefaultView: false }),
      note('Details', 'Details', 4, {
        inDefaultView: false,
        hint: 'One per line, like  Fabric: organic cotton'
      }),
      money('Price', 'Price', { hint: 'Leave at 0 and it shows as Free.' }),
      picture('Photo', 'Photo'),
      note('SearchWords', 'Search words', 2, {
        inDefaultView: false,
        hint: 'Words people might search for that are not in the name, separated by commas.'
      }),
      yesNo('ShowInStore', 'Active', true, { hint: 'Turn off to take it out of the store without deleting it.' }),
      // What it varies by (Size, Colour…), as the store wrote it. Changed from the store's product form.
      note('VariantOptions', 'Options', 6, { hidden: true }),
      // Every photo of the product in order, cover first. The Photo column holds the cover, for the list.
      note('Photos', 'Photos', 4, { hidden: true })
    ],
    views: [{
      title: 'All products',
      fields: ['LinkTitle', 'Photo', 'ShortDescription', 'Price', 'ShowInStore'],
      query: '<OrderBy><FieldRef Name="Title" /></OrderBy>',
      rowLimit: 100
    }]
  },
  {
    key: 'stock',
    urlName: 'CompanyStoreStock',
    title: 'Store stock',
    description: 'How many of each product are left. The store takes items off at checkout.',
    titleColumn: 'Variant',
    hidden: true,
    searchable: false,
    keepVersions: true,
    access: 'everyoneEdits',
    managers: true,
    fields: [
      lookup('StoreProduct', 'Product', 'products', { required: true }),
      count('InStock', 'In stock'),
      optionalMoney('VariantPrice', 'Price (if different)', { hint: "Leave empty to use the product's price." }),
      // Which value of each option this line is, for the store to match on.
      note('Combination', 'Combination', 2, { hidden: true })
    ],
    views: [{
      title: 'All stock',
      fields: ['StoreProduct', 'LinkTitle', 'InStock', 'VariantPrice'],
      query: '<OrderBy><FieldRef Name="StoreProduct" /><FieldRef Name="Title" /></OrderBy>',
      rowLimit: 200
    }]
  },
  {
    key: 'orders',
    urlName: 'CompanyStoreOrders',
    title: 'Store orders',
    description: 'One row per order. Staff see only their own; site owners and store managers see them all.',
    titleColumn: 'Order',
    hidden: false,
    searchable: false,
    keepVersions: true,
    access: 'ownRows',
    managers: true,
    fields: [
      note('OrderItems', 'Items', 6),
      money('OrderTotal', 'Total'),
      choice('DeliveryMethod', 'How', DELIVERY_METHODS, 'Pick up'),
      note('ShipTo', 'Ship to', 5),
      text('ShipPhone', 'Phone', 40),
      note('OrderNote', 'Note', 3),
      choice('OrderStatus', 'Status', ORDER_STATUSES, 'New'),
      yesNo('ConfirmationSent', 'Email sent', false),
      // Days are kept as text like 2026-10-15, so one never moves a day for someone in another time zone.
      text('ReadyBy', 'Ready by', 10, { hint: 'When it should be ready, written like 2026-10-15.' }),
      text('Tracking', 'Tracking', 255, { hint: 'The tracking number or link, for a delivery.' }),
      text('PickedUpOn', 'Picked up on', 10, { hint: 'Written like 2026-10-15.' }),
      // The order as the store wrote it, for the store to read back. Not shown anywhere.
      note('OrderData', 'Order data', 6, { hidden: true }),
      // Every change to the order, one line each. Shown only on the owners' Orders page.
      note('OrderHistory', 'History', 6, { hidden: true })
    ],
    views: [
      {
        title: 'All orders',
        fields: ['LinkTitle', 'Author', 'Created', 'OrderItems', 'DeliveryMethod', 'ShipTo',
          'OrderTotal', 'OrderStatus', 'ReadyBy', 'Tracking', 'ConfirmationSent'],
        query: '<OrderBy><FieldRef Name="ID" Ascending="FALSE" /></OrderBy>',
        rowLimit: 100
      },
      {
        title: 'Open',
        fields: ['LinkTitle', 'Author', 'Created', 'OrderItems', 'DeliveryMethod', 'ShipTo',
          'ShipPhone', 'OrderNote', 'OrderStatus', 'ReadyBy'],
        query:
          '<Where><And>' +
          '<Neq><FieldRef Name="OrderStatus" /><Value Type="Choice">Shipped</Value></Neq>' +
          '<Neq><FieldRef Name="OrderStatus" /><Value Type="Choice">Picked up</Value></Neq>' +
          '</And></Where>' +
          '<OrderBy><FieldRef Name="ID" /></OrderBy>',
        rowLimit: 100
      }
    ]
  },
  {
    key: 'addresses',
    urlName: 'CompanyStoreAddresses',
    title: 'Store addresses',
    description: 'Where to send orders. Each person sees only their own row.',
    titleColumn: 'Name',
    hidden: true,
    searchable: false,
    // An old address has no business hanging around in the version history.
    keepVersions: false,
    access: 'ownRowsOnly',
    managers: false,
    fields: [
      text('AddressLine1', 'Address line 1', 255),
      text('AddressLine2', 'Address line 2', 255),
      text('Postcode', 'Postcode', 20),
      text('City', 'City', 100),
      text('Country', 'Country', 100),
      text('Phone', 'Phone', 40)
    ],
    views: [{
      title: 'All addresses',
      fields: ['LinkTitle', 'AddressLine1', 'AddressLine2', 'Postcode', 'City', 'Country', 'Phone'],
      query: '',
      rowLimit: 100
    }]
  }
];

export const listDef = (key: ListKey): IListDef => {
  const def = STORE_LISTS.find(l => l.key === key);
  if (!def) throw new Error(`No list called ${key}`);
  return def;
};

/** Each person sees only their own rows in this list. */
export const keepsOwnRows = (def: IListDef): boolean => def.access === 'ownRows' || def.access === 'ownRowsOnly';

/** A money column, and the list it is in. */
export interface IMoneyColumn {
  list: ListKey;
  field: string;
}

/** Every money column, list by list, so a change of currency reaches them all. */
export const MONEY_COLUMNS: IMoneyColumn[] = STORE_LISTS.reduce<IMoneyColumn[]>(
  (all, def) => all.concat(def.fields.filter(f => f.currency).map(f => ({ list: def.key, field: f.name }))), []);
