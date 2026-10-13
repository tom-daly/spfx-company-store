import {
  IOrderForm, addressProblem, editFromForm, formChanged, formFromOrder, formTotal, historyNewestFirst, historyTime,
  quantitiesChanged, withFormMethod, withFormStatus, withSavedOrder
} from './orderForm';
import type { IOrder } from './ordersView';
import { ONE_SIZE } from './types';
import type { ICartLine } from './types';
import { THURSDAY, TODAY, megan } from './__fixtures__/orders';

const hoodie: ICartLine = { productId: 1, name: 'Crew hoodie', price: 22, qty: 1, variant: 'M' };
const tee: ICartLine = { productId: 3, name: 'T-shirt', price: 12.5, qty: 2, variant: ONE_SIZE };

/* A delivery order as the orders page reads it, with whatever a test wants changed. */
const order = (changes: Partial<IOrder> = {}): IOrder => ({
  id: 42,
  number: 'CS-0042',
  who: 'Megan Bowen',
  email: 'megan@example.com',
  lines: [hoodie, tee],
  itemLines: ['1 × Crew hoodie (M)', '2 × T-shirt'],
  items: 3,
  total: 47,
  method: 'Delivery',
  shipTo: ['Megan Bowen', 'Keizersgracht 1', '1015 CJ Amsterdam', 'Netherlands'],
  phone: '+31 6 1234 5678',
  note: 'Leave it at reception, please.',
  status: 'New',
  readyBy: '',
  tracking: '',
  pickedUpOn: '',
  emailSent: true,
  address: megan,
  history: [],
  ...changes
});

const pickUp = (changes: Partial<IOrder> = {}): IOrder =>
  order({ method: 'Pick up', shipTo: [], phone: '', address: undefined, ...changes });

/* The form for an order, with the quantities typed as given. */
const typed = (o: IOrder, qtys: string[], changes: Partial<IOrderForm> = {}): IOrderForm => {
  const form = formFromOrder(o);
  return { ...form, items: form.items.map((item, i) => ({ ...item, qty: qtys[i] })), ...changes };
};

describe('opening an order to edit', () => {
  it('fills the form with the order as it is', () => {
    const form = formFromOrder(order());
    expect(form.status).toBe('New');
    expect(form.items.map(i => i.qty)).toEqual(['1', '2']);
    expect(form.items.map(i => i.line)).toEqual([hoodie, tee]);
    expect(form.method).toBe('Delivery');
    expect(form.address).toEqual(megan);
    expect(form.note).toBe('Leave it at reception, please.');
  });

  it('gives a pick-up order an empty address with the person\'s name, ready for switching to delivery', () => {
    expect(formFromOrder(pickUp()).address).toEqual({
      name: 'Megan Bowen', line1: '', line2: '', postcode: '', city: '', country: '', phone: ''
    });
  });

  it('leaves the name empty when all the order has is an email', () => {
    expect(formFromOrder(pickUp({ who: 'megan@example.com' })).address.name).toBe('');
  });

  it('keeps the phone of a delivery whose address couldn\'t be read', () => {
    const form = formFromOrder(order({ address: undefined }));
    expect(form.address.name).toBe('Megan Bowen');
    expect(form.address.line1).toBe('');
    expect(form.address.phone).toBe('+31 6 1234 5678');
  });

  it('has no items to change when the order\'s lines couldn\'t be read', () => {
    expect(formFromOrder(order({ lines: [] })).items).toEqual([]);
  });

  it('copies the address, so typing in the form leaves the order alone', () => {
    const o = order();
    const form = formFromOrder(o);
    form.address.city = 'Utrecht';
    expect(o.address && o.address.city).toBe('Amsterdam');
  });

  it('fills in the days and the tracking the order has', () => {
    const form = formFromOrder(order({ readyBy: THURSDAY, tracking: '1Z999', pickedUpOn: TODAY }));
    expect([form.readyBy, form.tracking, form.pickedUpOn]).toEqual([THURSDAY, '1Z999', TODAY]);
  });
});

describe('choosing a status or a way in the form', () => {
  it('fills in today as the day it was picked up when Picked up is chosen', () => {
    const form = withFormStatus(formFromOrder(pickUp({ status: 'Ready for pick-up' })), 'Picked up', TODAY);
    expect(form.status).toBe('Picked up');
    expect(form.pickedUpOn).toBe(TODAY);
  });

  it('keeps a day that is there already', () => {
    const form = withFormStatus(formFromOrder(pickUp({ pickedUpOn: THURSDAY })), 'Picked up', TODAY);
    expect(form.pickedUpOn).toBe(THURSDAY);
  });

  it('leaves the day alone for any other status', () => {
    expect(withFormStatus(formFromOrder(pickUp()), 'Confirmed', TODAY).pickedUpOn).toBe('');
  });

  it('moves the status across when the way changes, filling in the day if it becomes Picked up', () => {
    const shipped = withFormMethod(formFromOrder(order({ status: 'Shipped' })), 'Pick up', TODAY);
    expect(shipped.method).toBe('Pick up');
    expect(shipped.status).toBe('Picked up');
    expect(shipped.pickedUpOn).toBe(TODAY);
    const packed = withFormMethod(formFromOrder(order({ status: 'Packed' })), 'Pick up', TODAY);
    expect([packed.status, packed.pickedUpOn]).toEqual(['Ready for pick-up', '']);
  });
});


describe('the new total', () => {
  it('is the order\'s own total until a quantity changes', () => {
    const o = order({ total: 50 });
    expect(formTotal(formFromOrder(o), o)).toBe(50);
    expect(formTotal(typed(o, ['1', '02']), o)).toBe(50);
  });

  it('adds up the new quantities, with a line at 0 counting for nothing', () => {
    const o = order();
    expect(formTotal(typed(o, ['2', '2']), o)).toBe(69);
    expect(formTotal(typed(o, ['0', '1']), o)).toBe(12.5);
  });

  it('counts a quantity that isn\'t a number as 0 until it is fixed', () => {
    const o = order();
    expect(formTotal(typed(o, ['x', '2']), o)).toBe(25);
  });

  it('tells when a quantity has changed', () => {
    const o = order();
    expect(quantitiesChanged(formFromOrder(o))).toBe(false);
    expect(quantitiesChanged(typed(o, ['1', '3']))).toBe(true);
    expect(quantitiesChanged(typed(o, ['1', '']))).toBe(true);
  });
});

describe('saving the form', () => {
  it('sends every line with its new quantity, a line at 0 included so it comes off', () => {
    const edit = editFromForm(typed(order(), ['0', '3'], { status: 'Packed', note: '  Ring first.  ' }));
    expect(edit).toEqual({
      status: 'Packed',
      lines: [{ ...hoodie, qty: 0 }, { ...tee, qty: 3 }],
      method: 'Delivery',
      address: megan,
      note: 'Ring first.',
      readyBy: '',
      tracking: '',
      pickedUpOn: ''
    });
  });

  it('sends the ready-by day and the tracking, tidied', () => {
    const edit = editFromForm({ ...formFromOrder(order()), readyBy: THURSDAY, tracking: ' 1Z999 ' });
    expect(typeof edit !== 'string' && [edit.readyBy, edit.tracking]).toEqual([THURSDAY, '1Z999']);
  });

  it('sends no tracking for pick-up, even some typed in before switching', () => {
    const edit = editFromForm({ ...formFromOrder(order({ tracking: '1Z999' })), method: 'Pick up' });
    expect(typeof edit !== 'string' && edit.tracking).toBe('');
  });

  it('sends the day it was picked up only while the status is Picked up', () => {
    const picked = formFromOrder(pickUp({ status: 'Picked up', pickedUpOn: TODAY }));
    const kept = editFromForm(picked);
    expect(typeof kept !== 'string' && kept.pickedUpOn).toBe(TODAY);
    const back = editFromForm({ ...picked, status: 'Ready for pick-up' });
    expect(typeof back !== 'string' && back.pickedUpOn).toBe('');
  });

  it('tidies the address it sends', () => {
    const form = formFromOrder(order());
    const edit = editFromForm({ ...form, address: { ...megan, city: '  Utrecht ', line2: ' ' } });
    expect(typeof edit !== 'string' && edit.address).toEqual({ ...megan, city: 'Utrecht', line2: '' });
  });

  it('sends no address for pick-up, even one typed in before switching', () => {
    const form = formFromOrder(order());
    const edit = editFromForm({ ...form, method: 'Pick up' });
    expect(typeof edit !== 'string' && edit.method).toBe('Pick up');
    expect(typeof edit !== 'string' && 'address' in edit).toBe(false);
  });

  it('says which lines need a proper quantity', () => {
    expect(editFromForm(typed(order(), ['1.5', '']))).toBe(
      'Quantities need to be whole numbers, 0 or more. Check Crew hoodie (M) and T-shirt.'
    );
  });

  it('won\'t take every line off the order', () => {
    expect(editFromForm(typed(order(), ['0', '0']))).toBe(
      'Every quantity is 0, which would leave nothing on the order. Keep at least one item on it.'
    );
  });

  it('asks for what a delivery address is missing', () => {
    const form = formFromOrder(pickUp());
    expect(editFromForm({ ...form, method: 'Delivery' })).toBe(
      'For delivery, add address line 1, the postcode, the city and the country.'
    );
    expect(addressProblem(megan)).toBeUndefined();
    expect(addressProblem({ ...megan, name: ' ' })).toBe('For delivery, add the full name.');
  });

  it('leaves the items alone on an order whose lines couldn\'t be read', () => {
    const edit = editFromForm(formFromOrder(pickUp({ lines: [] })));
    expect(edit).toEqual({
      status: 'New', lines: [], method: 'Pick up', note: 'Leave it at reception, please.',
      readyBy: '', tracking: '', pickedUpOn: ''
    });
  });
});

describe('telling whether anything was changed', () => {
  const start = formFromOrder(order());

  it('is unchanged as it opened', () => {
    expect(formChanged(formFromOrder(order()), start)).toBe(false);
  });

  it('notices the status, a quantity, the way they want it and the note', () => {
    expect(formChanged({ ...start, status: 'Shipped' }, start)).toBe(true);
    expect(formChanged(typed(order(), ['1', '5']), start)).toBe(true);
    expect(formChanged(typed(order(), ['1', '']), start)).toBe(true);
    expect(formChanged({ ...start, method: 'Pick up' }, start)).toBe(true);
    expect(formChanged({ ...start, note: 'Ring first.' }, start)).toBe(true);
  });

  it('doesn\'t count spaces at the ends, or a quantity written another way', () => {
    expect(formChanged({ ...start, note: `${start.note}  ` }, start)).toBe(false);
    expect(formChanged(typed(order(), ['01', ' 2 ']), start)).toBe(false);
  });

  it('notices the address only while it is going to be used', () => {
    const moved = { ...start.address, city: 'Utrecht' };
    expect(formChanged({ ...start, address: moved }, start)).toBe(true);
    const pick = formFromOrder(pickUp());
    expect(formChanged({ ...pick, address: { ...pick.address, line1: 'Damrak 5' } }, pick)).toBe(false);
  });

  it('notices the ready-by day, either way', () => {
    expect(formChanged({ ...start, readyBy: THURSDAY }, start)).toBe(true);
    const pick = formFromOrder(pickUp());
    expect(formChanged({ ...pick, readyBy: THURSDAY }, pick)).toBe(true);
  });

  it('notices the tracking only for delivery, and not spaces at the ends', () => {
    expect(formChanged({ ...start, tracking: '1Z999' }, start)).toBe(true);
    expect(formChanged({ ...start, tracking: '  ' }, start)).toBe(false);
    const pick = formFromOrder(pickUp());
    expect(formChanged({ ...pick, tracking: '1Z999' }, pick)).toBe(false);
  });

  it('notices the day it was picked up only while the status is Picked up', () => {
    const picked = formFromOrder(pickUp({ status: 'Picked up', pickedUpOn: TODAY }));
    expect(formChanged({ ...picked, pickedUpOn: THURSDAY }, picked)).toBe(true);
    const pick = formFromOrder(pickUp());
    expect(formChanged({ ...pick, pickedUpOn: THURSDAY }, pick)).toBe(false);
  });
});

describe('putting a saved order back in the list', () => {
  it('swaps in the saved copy and leaves the others', () => {
    const a = order({ id: 1 });
    const b = order({ id: 2 });
    const saved = order({ id: 2, status: 'Packed' });
    const list = withSavedOrder([a, b], saved);
    expect(list[0]).toBe(a);
    expect(list[1]).toBe(saved);
  });
});

describe('an order\'s history on the page', () => {
  it('shows the time in the viewer\'s own time zone', () => {
    const at = new Date(2026, 9, 12, 14, 5, 33);
    expect(historyTime(at.toISOString())).toBe('12 Oct 2026, 2:05 PM');
    expect(historyTime(new Date(2026, 0, 3, 9, 7).toISOString())).toBe('3 Jan 2026, 9:07 AM');
  });

  it('has no time for a line typed by hand or a time that can\'t be read', () => {
    expect(historyTime('')).toBe('');
    expect(historyTime('last Tuesday')).toBe('');
  });

  it('lists the newest change first, keeping a line typed by hand where it was', () => {
    const first = new Date(2026, 9, 10, 9, 0).toISOString();
    const last = new Date(2026, 9, 12, 14, 5).toISOString();
    const lines = historyNewestFirst([
      { when: first, who: 'Megan Bowen', what: 'Order placed' },
      { when: '', who: '', what: 'Called Megan about the size' },
      { when: last, who: 'Thomas Daly', what: 'Status changed from New to Packed' }
    ]);
    expect(lines).toEqual([
      { when: last, time: '12 Oct 2026, 2:05 PM', who: 'Thomas Daly', what: 'Status changed from New to Packed' },
      { when: '', time: '', who: '', what: 'Called Megan about the size' },
      { when: first, time: '10 Oct 2026, 9:00 AM', who: 'Megan Bowen', what: 'Order placed' }
    ]);
  });

  it('leaves the order\'s own history as it was', () => {
    const history = [
      { when: '', who: '', what: 'One' },
      { when: '', who: '', what: 'Two' }
    ];
    historyNewestFirst(history);
    expect(history.map(h => h.what)).toEqual(['One', 'Two']);
  });
});
