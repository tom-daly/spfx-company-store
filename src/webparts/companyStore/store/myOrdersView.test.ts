import {
  MY_ORDERS_HASH, itemTexts, opensMyOrders, orderSteps, pickUpNoteFor, placedText, stepLabel, stepStateText,
  whereItsAt, withoutHash
} from './myOrdersView';
import type { IOrder } from './ordersView';
import { DEFAULT_SETTINGS } from './settings';
import { hoodie, tee } from './__fixtures__/orders';

/* A delivery just placed, with whatever a test wants changed. */
const order = (changes: Partial<IOrder> = {}): IOrder => ({
  id: 42,
  number: 'CS-0042',
  who: 'Megan Bowen',
  email: 'megan@example.com',
  placed: new Date(2026, 9, 4, 15, 30),
  lines: [hoodie, tee],
  itemLines: ['1 × Crew hoodie', '2 × T-shirt (M)'],
  items: 3,
  total: 47,
  method: 'Delivery',
  shipTo: ['Megan Bowen', 'Keizersgracht 1', '1015 CJ Amsterdam', 'Netherlands'],
  phone: '',
  note: '',
  status: 'New',
  readyBy: '',
  tracking: '',
  pickedUpOn: '',
  emailSent: true,
  history: [],
  ...changes
});

const megan = { name: 'Megan Bowen', email: 'megan@example.com' };

describe('opening My orders from a link', () => {
  it('opens for #my-orders, whatever the capitals', () => {
    expect(opensMyOrders(MY_ORDERS_HASH)).toBe(true);
    expect(opensMyOrders('#My-Orders')).toBe(true);
  });

  it('does not open for anything else', () => {
    expect(opensMyOrders('')).toBe(false);
    expect(opensMyOrders('#')).toBe(false);
    expect(opensMyOrders('#orders')).toBe(false);
    expect(opensMyOrders('#my-orders-old')).toBe(false);
  });

  it('takes the #part off an address and keeps the rest', () => {
    expect(withoutHash('https://contoso.sharepoint.com/sites/hr/SitePages/Store.aspx?x=1#my-orders'))
      .toBe('https://contoso.sharepoint.com/sites/hr/SitePages/Store.aspx?x=1');
    expect(withoutHash('https://contoso.sharepoint.com/Store.aspx')).toBe('https://contoso.sharepoint.com/Store.aspx');
  });
});

describe('the steps', () => {
  it('calls New "Placed" and every other step by its status', () => {
    expect(stepLabel('New')).toBe('Placed');
    expect(stepLabel('Confirmed')).toBe('Confirmed');
    expect(stepLabel('Ready for pick-up')).toBe('Ready for pick-up');
  });

  it("follows a delivery's steps, marking where it is", () => {
    expect(orderSteps(order({ status: 'Packed' }))).toEqual([
      { status: 'New', label: 'Placed', state: 'done' },
      { status: 'Confirmed', label: 'Confirmed', state: 'done' },
      { status: 'Packed', label: 'Packed', state: 'current' },
      { status: 'Shipped', label: 'Shipped', state: 'todo' }
    ]);
  });

  it("follows a pick-up's steps", () => {
    expect(orderSteps(order({ method: 'Pick up', status: 'Confirmed' })).map(s => `${s.status}:${s.state}`))
      .toEqual(['New:done', 'Confirmed:current', 'Ready for pick-up:todo', 'Picked up:todo']);
  });

  it('starts a new order on its first step', () => {
    expect(orderSteps(order()).map(s => s.state)).toEqual(['current', 'todo', 'todo', 'todo']);
  });

  it('has a finished order on its last step, with everything before it done', () => {
    expect(orderSteps(order({ status: 'Shipped' })).map(s => s.state)).toEqual(['done', 'done', 'done', 'current']);
    expect(orderSteps(order({ method: 'Pick up', status: 'Picked up' })).map(s => s.state))
      .toEqual(['done', 'done', 'done', 'current']);
  });

  it('treats a status from the other way as the first step', () => {
    expect(orderSteps(order({ method: 'Pick up', status: 'Shipped' })).map(s => s.state))
      .toEqual(['current', 'todo', 'todo', 'todo']);
  });

  it('says what each step is for a screen reader, leaving the current one to the page', () => {
    expect(stepStateText('done')).toBe('done');
    expect(stepStateText('todo')).toBe('still to come');
    expect(stepStateText('current')).toBe('');
  });
});

describe("where it's at", () => {
  it('a new order', () => {
    expect(whereItsAt(order())).toBe("We've got your order. We'll confirm it soon.");
  });

  it('a confirmed pick-up, with and without a day', () => {
    const pickUp = order({ method: 'Pick up', status: 'Confirmed' });
    expect(whereItsAt({ ...pickUp, readyBy: '2026-10-15' })).toBe('Confirmed. Ready for pick-up by Thu 15 Oct 2026.');
    expect(whereItsAt(pickUp)).toBe("Confirmed. We're working on it and will email you when it's ready.");
  });

  it('a confirmed delivery, with and without a day', () => {
    const delivery = order({ status: 'Confirmed' });
    expect(whereItsAt({ ...delivery, readyBy: '2026-10-15' })).toBe('Confirmed. We expect to send it by Thu 15 Oct 2026.');
    expect(whereItsAt(delivery)).toBe("Confirmed. We're working on it and will email you when it's on its way.");
  });

  it('a day that is not a real day counts as none', () => {
    expect(whereItsAt(order({ status: 'Confirmed', readyBy: '2026-02-31' })))
      .toBe("Confirmed. We're working on it and will email you when it's on its way.");
  });

  it('packed, ready and shipped', () => {
    expect(whereItsAt(order({ status: 'Packed' }))).toBe('Packed and waiting to be sent.');
    expect(whereItsAt(order({ method: 'Pick up', status: 'Ready for pick-up' }))).toBe('Ready for pick-up.');
    expect(whereItsAt(order({ status: 'Shipped' }))).toBe('On its way.');
  });

  it('picked up, with and without the day', () => {
    const done = order({ method: 'Pick up', status: 'Picked up' });
    expect(whereItsAt({ ...done, pickedUpOn: '2026-10-15' })).toBe('Picked up on Thu 15 Oct 2026.');
    expect(whereItsAt(done)).toBe('Picked up.');
  });
});

describe('the pick-up instructions', () => {
  const settings = { ...DEFAULT_SETTINGS, pickUpNote: 'Ask for {first name}’s parcel at the front desk.' };
  const ready = order({ method: 'Pick up', status: 'Ready for pick-up' });

  it('shows them, filled in, once it is ready for pick-up', () => {
    expect(pickUpNoteFor(ready, settings, megan)).toBe('Ask for Megan’s parcel at the front desk.');
  });

  it('leaves them out before and after', () => {
    expect(pickUpNoteFor({ ...ready, status: 'Confirmed' }, settings, megan)).toBe('');
    expect(pickUpNoteFor({ ...ready, status: 'Picked up' }, settings, megan)).toBe('');
  });

  it('is empty when the store has none', () => {
    expect(pickUpNoteFor(ready, { ...settings, pickUpNote: '  ' }, megan)).toBe('');
  });
});

describe('the order', () => {
  it('lists what was ordered, with the choice in brackets', () => {
    expect(itemTexts(order())).toEqual(['1 × Crew hoodie', '2 × T-shirt (M)']);
  });

  it('falls back to the Items column when the order data could not be read', () => {
    expect(itemTexts(order({ lines: [], itemLines: ['3 × Mug'] }))).toEqual(['3 × Mug']);
  });

  it('says when it was placed', () => {
    expect(placedText(order())).toBe('Placed 4 Oct 2026 at 3:30 PM');
    expect(placedText(order({ placed: undefined }))).toBe('');
  });
});
