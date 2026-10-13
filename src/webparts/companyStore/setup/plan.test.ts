import { IStep, Unmade, mergeChoices, planSetup, skipReason } from './plan';
import {
  EVERYONE, LIMITED_MANAGERS, OWNERS, STAFF, healthy, empty, change, lastVersion, oldStatusColumn
} from './__fixtures__/states';

describe('planSetup', () => {
  it('spells out every step on a fresh site, in the order they run', () => {
    expect(planSetup(empty(), EVERYONE).map(s => s.label)).toEqual([
      'Make the Store settings list',
      'Add the Value column to Store settings',
      'Set up the "All settings" view',
      'Store settings: hide it from the site contents and keep it out of search',

      'Make the Store products list',
      'Add 10 columns to Store products',
      'Set up the "All products" view',

      'Make the Store stock list',
      'Add 4 columns to Store stock',
      'Set up the "All stock" view',
      'Store stock: hide it from the site contents and keep it out of search',
      'Let staff update the numbers in Store stock',

      'Make the Store orders list',
      'Add 13 columns to Store orders',
      'Set up the "All orders" and "Open" views',
      'Store orders: keep it out of search and let each person see only their own rows',
      'Let staff add their own rows to Store orders',

      'Make the Store addresses list',
      'Add 6 columns to Store addresses',
      'Set up the "All addresses" view',
      'Store addresses: hide it from the site contents, keep it out of search, ' +
        'stop keeping old copies and let each person see only their own rows',
      'Let staff add their own rows to Store addresses',
      'Lock Store addresses so site owners can\'t open it',

      // Only once the address list is locked, so the group never gets near it.
      'Make the Store managers group',
      'Let store managers change Store settings',
      'Let store managers change Store products',
      'Let store managers change Store stock',
      'Let store managers change Store orders',
      'Let store managers add product photos'
    ]);
  });

  it('starts every step as waiting, with an id the page can key on', () => {
    const steps = planSetup(empty(), EVERYONE);
    expect(steps.every(s => s.state === 'waiting')).toBe(true);
    expect(new Set(steps.map(s => s.id)).size).toBe(steps.length);
  });

  it('has nothing to do on a site exactly as setup leaves it', () => {
    expect(planSetup(healthy(), EVERYONE)).toEqual([]);
  });

  it('adds only the one missing column, by the name people see', () => {
    const fields = healthy().orders.fields?.filter(f => f !== 'ShipTo');
    const steps = planSetup(change(healthy(), 'orders', { fields }), EVERYONE);
    expect(steps.map(s => s.label)).toEqual(['Add the Ship to column to Store orders']);
    expect(steps[0].fields).toEqual(['ShipTo']);
  });

  it('leaves views alone on a list that already exists', () => {
    const steps = planSetup(change(healthy(), 'stock', { hidden: false }), EVERYONE);
    expect(steps.map(s => s.kind)).toEqual(['settings']);
    expect(steps[0].settings).toEqual({ Hidden: true });
  });

  it('plans nothing for a locked address list, even if it has drifted — that is IT\'s job', () => {
    expect(planSetup(change(healthy(), 'addresses', { fields: ['Title'] }), EVERYONE)).toEqual([]);
  });

  it('finishes locking an address list that was left half done', () => {
    const halfDone = change(healthy(), 'addresses', { canManage: true, access: [OWNERS, STAFF] });
    expect(planSetup(halfDone, EVERYONE).map(s => s.kind)).toEqual(['lockOut']);
  });

  it('never lets store managers into the address list, even when its permissions brought them along', () => {
    const halfDone = change(healthy(), 'addresses', { canManage: true, access: [OWNERS, STAFF, LIMITED_MANAGERS] });
    expect(planSetup(halfDone, EVERYONE).map(s => s.kind)).toEqual(['lockOut']);
  });

  it('lets staff back into a list that lost its own permissions', () => {
    const steps = planSetup(change(healthy(), 'orders', { uniquePermissions: false }), EVERYONE);
    expect(steps.map(s => s.kind)).toEqual(['staffAccess']);
  });

  it('adds the pick-up statuses to a Status column made before they existed, keeping what it had', () => {
    const steps = planSetup(oldStatusColumn(), EVERYONE);
    expect(steps.map(s => s.label)).toEqual([
      'Add Confirmed, Ready for pick-up and Picked up to the Status column in Store orders'
    ]);
    expect(steps[0].choices).toEqual({
      field: 'OrderStatus',
      all: ['New', 'Confirmed', 'Packed', 'Shipped', 'Ready for pick-up', 'Picked up', 'On hold']
    });
  });

  it('brings a site the last version set up up to date', () => {
    const steps = planSetup(lastVersion(), EVERYONE);
    expect(steps.map(s => s.label)).toEqual([
      'Add 3 columns to Store orders',
      'Add Confirmed to the Status column in Store orders',
      'Make the Store managers group',
      'Let store managers change Store settings',
      'Let store managers change Store products',
      'Let store managers change Store stock',
      'Let store managers change Store orders',
      'Let store managers add product photos'
    ]);
    expect(steps[0].fields).toEqual(['ReadyBy', 'Tracking', 'PickedUpOn']);
    expect(steps[1].choices).toEqual({
      field: 'OrderStatus',
      all: ['New', 'Confirmed', 'Packed', 'Shipped', 'Ready for pick-up', 'Picked up']
    });
  });

  it('lets store managers into a list they only have Limited Access to', () => {
    const state = change(healthy(), 'products', { access: [OWNERS, LIMITED_MANAGERS] });
    const steps = planSetup(state, EVERYONE);
    expect(steps.map(s => s.label)).toEqual(['Let store managers change Store products']);
    expect(steps[0].list).toBe('products');
  });

  it('gets the photo folder ready when it isn\'t there', () => {
    const steps = planSetup({ ...healthy(), photos: { exists: false } }, EVERYONE);
    expect(steps.map(s => s.kind)).toEqual(['managersPhotos']);
    expect(steps[0].list).toBeUndefined();
  });

  it('leaves the store managers alone when the full check didn\'t look at them', () => {
    const steps = planSetup({ ...lastVersion(), managers: undefined, photos: undefined }, EVERYONE);
    expect(steps.map(s => s.kind)).toEqual(['addColumns', 'addChoices']);
  });
});

describe('skipReason', () => {
  const step = (patch: Partial<IStep>): IStep =>
    ({ id: 'x', kind: 'managersAccess', label: 'x', state: 'waiting', ...patch });

  it('skips a list\'s steps when the list wasn\'t made, store managers\' one included', () => {
    const unmade = new Set<Unmade>(['products']);
    expect(skipReason(step({ list: 'products' }), unmade)).toBe('Skipped because Store products wasn\'t made.');
    expect(skipReason(step({ list: 'stock' }), unmade)).toBeUndefined();
  });

  it('skips every store managers step when the group couldn\'t be made', () => {
    const unmade = new Set<Unmade>(['managers']);
    const why = 'Skipped because the Store managers group couldn\'t be made.';
    expect(skipReason(step({ list: 'orders' }), unmade)).toBe(why);
    expect(skipReason(step({ kind: 'managersPhotos' }), unmade)).toBe(why);
    expect(skipReason(step({ kind: 'addColumns', list: 'orders' }), unmade)).toBeUndefined();
  });
});

describe('mergeChoices', () => {
  it('puts each new choice in after the one before it, keeping choices added by hand', () => {
    expect(mergeChoices(['New', 'Packed', 'Shipped', 'On hold'], ['New', 'Confirmed', 'Packed', 'Shipped']))
      .toEqual(['New', 'Confirmed', 'Packed', 'Shipped', 'On hold']);
  });

  it('puts a new first choice first', () => {
    expect(mergeChoices(['B'], ['A', 'B'])).toEqual(['A', 'B']);
  });
});
