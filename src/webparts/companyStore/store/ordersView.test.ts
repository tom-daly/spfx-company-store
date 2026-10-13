import {
  FILTERS, countFromItems, countOrders, emptyText, firstNameOf, inFilter, isDone, itemCountText,
  matchesOrder, orderFromRow, ordersFromRows, readOrderData, readyByLabel, statusAsk, statusForMethod, statusesFor,
  summaryText, visibleOrders, withStatus
} from './ordersView';
import { dateText, whenText } from './dates';
import type { IOrder, IOrderRow } from './ordersView';
import { orderData } from './orderText';
import { ONE_SIZE } from './types';
import { hoodie, megan, tee } from './__fixtures__/orders';

/* A delivery as checkout writes it, with whatever a test wants changed. */
const row = (changes: Partial<IOrderRow> = {}): IOrderRow => ({
  Id: 42,
  Title: 'CS-0042',
  OrderItems: '1 × Crew hoodie\n2 × T-shirt (M)',
  OrderTotal: 47,
  DeliveryMethod: 'Delivery',
  ShipTo: 'Megan Bowen\nKeizersgracht 1\n1015 CJ Amsterdam\nNetherlands',
  ShipPhone: '+31 6 1234 5678',
  OrderNote: 'Leave it at reception, please.',
  OrderStatus: 'Packed',
  ConfirmationSent: true,
  OrderData: orderData([hoodie, tee], 'Delivery', megan),
  Created: '2026-10-04T13:30:00Z',
  Author: { Title: 'Megan Bowen', EMail: 'megan@example.com' },
  ...changes
});

const pickUp = (changes: Partial<IOrderRow> = {}): IOrderRow => row({
  DeliveryMethod: 'Pick up',
  ShipTo: '',
  ShipPhone: '',
  OrderData: orderData([hoodie, tee], 'Pick up'),
  ...changes
});

const order = (id: number, status: string, changes: Partial<IOrderRow> = {}): IOrder =>
  orderFromRow(row({ Id: id, Title: `CS-${id}`, OrderStatus: status, ...changes }));

const pickUpOrder = (id: number, status: string): IOrder =>
  orderFromRow(pickUp({ Id: id, Title: `CS-${id}`, OrderStatus: status }));

describe('reading an order row', () => {
  it('reads the order number, who placed it and when', () => {
    const o = orderFromRow(row());
    expect(o.id).toBe(42);
    expect(o.number).toBe('CS-0042');
    expect(o.who).toBe('Megan Bowen');
    expect(o.email).toBe('megan@example.com');
    expect(o.placed && o.placed.getTime()).toBe(Date.parse('2026-10-04T13:30:00Z'));
  });

  it('reads what they ordered from the order data and counts each item', () => {
    const o = orderFromRow(row());
    expect(o.lines).toEqual([hoodie, tee]);
    expect(o.items).toBe(3);
    expect(o.total).toBe(47);
  });

  it('falls back to the Items column when the order data is missing or damaged', () => {
    const damaged = orderFromRow(row({ OrderData: '{not json' }));
    expect(damaged.lines).toEqual([]);
    expect(damaged.itemLines).toEqual(['1 × Crew hoodie', '2 × T-shirt (M)']);
    expect(damaged.items).toBe(3);
    expect(orderFromRow(row({ OrderData: null })).items).toBe(3);
  });

  it('counts a line in the Items column with no number in front as one item', () => {
    expect(countFromItems(['Mug', '3 × Cap', '2x Sticker'])).toBe(6);
    expect(countFromItems([])).toBe(0);
  });

  it("doesn't mistake a size like 3XL for a quantity", () => {
    expect(countFromItems(['3XL tee'])).toBe(1);
  });

  it('keeps the address, one part per line, and the phone for a delivery', () => {
    const o = orderFromRow(row());
    expect(o.method).toBe('Delivery');
    expect(o.shipTo).toEqual(['Megan Bowen', 'Keizersgracht 1', '1015 CJ Amsterdam', 'Netherlands']);
    expect(o.phone).toBe('+31 6 1234 5678');
  });

  it('takes the address from the order data when the Ship to column is empty', () => {
    const o = orderFromRow(row({ ShipTo: null, ShipPhone: null }));
    expect(o.shipTo).toEqual(['Megan Bowen', 'Keizersgracht 1', '1015 CJ Amsterdam', 'Netherlands']);
    expect(o.phone).toBe('+31 6 1234 5678');
  });

  it('has no address for a pick-up, even if one was typed in by hand', () => {
    const o = orderFromRow(pickUp({ ShipTo: 'Somewhere', ShipPhone: '123' }));
    expect(o.method).toBe('Pick up');
    expect(o.shipTo).toEqual([]);
    expect(o.phone).toBe('');
  });

  it('reads an empty or unknown status as New', () => {
    expect(orderFromRow(row({ OrderStatus: null })).status).toBe('New');
    expect(orderFromRow(row({ OrderStatus: 'Lost' })).status).toBe('New');
    expect(orderFromRow(pickUp({ OrderStatus: 'Lost' })).status).toBe('New');
    expect(orderFromRow(row({ OrderStatus: 'Shipped' })).status).toBe('Shipped');
    expect(orderFromRow(pickUp({ OrderStatus: 'Ready for pick-up' })).status).toBe('Ready for pick-up');
  });

  it("shows a status meant for the other way as this way's matching step", () => {
    expect(orderFromRow(pickUp({ OrderStatus: 'Packed' })).status).toBe('Ready for pick-up');
    expect(orderFromRow(pickUp({ OrderStatus: 'Shipped' })).status).toBe('Picked up');
    expect(orderFromRow(row({ OrderStatus: 'Ready for pick-up' })).status).toBe('Packed');
    expect(orderFromRow(row({ OrderStatus: 'Picked up' })).status).toBe('Shipped');
    expect(orderFromRow(pickUp({ OrderStatus: 'New' })).status).toBe('New');
  });

  it('reads the ready-by day, the tracking and the day it was picked up', () => {
    const o = orderFromRow(pickUp({ ReadyBy: '2026-10-15', Tracking: ' 1Z999AA10123456784 ', PickedUpOn: '2026-10-16' }));
    expect(o.readyBy).toBe('2026-10-15');
    expect(o.tracking).toBe('1Z999AA10123456784');
    expect(o.pickedUpOn).toBe('2026-10-16');
  });

  it('leaves the days and tracking empty when they are blank, or a day was typed in some other way', () => {
    const blank = orderFromRow(row());
    expect([blank.readyBy, blank.tracking, blank.pickedUpOn]).toEqual(['', '', '']);
    const typed = orderFromRow(row({ ReadyBy: '15/10/2026', Tracking: null, PickedUpOn: '2026-02-31' }));
    expect([typed.readyBy, typed.tracking, typed.pickedUpOn]).toEqual(['', '', '']);
  });

  it('knows whether the order email went', () => {
    expect(orderFromRow(row()).emailSent).toBe(true);
    expect(orderFromRow(row({ ConfirmationSent: false })).emailSent).toBe(false);
    expect(orderFromRow(row({ ConfirmationSent: null })).emailSent).toBe(false);
  });

  it('copes with a row whose columns SharePoint sends back empty', () => {
    const o = orderFromRow({
      Id: 7, Title: null, OrderItems: null, OrderTotal: null, DeliveryMethod: null, ShipTo: null, ShipPhone: null,
      OrderNote: null, OrderStatus: null, ConfirmationSent: null, OrderData: null, Created: null, Author: null
    });
    expect(o.number).toBe('#7');
    expect(o.who).toBe('Unknown');
    expect(o.email).toBe('');
    expect(o.placed).toBeUndefined();
    expect(o.items).toBe(0);
    expect(o.total).toBe(0);
    expect(o.method).toBe('Pick up');
    expect(o.note).toBe('');
    expect(o.status).toBe('New');
    expect([o.readyBy, o.tracking, o.pickedUpOn]).toEqual(['', '', '']);
  });

  it('uses the email address when the person has no name', () => {
    expect(orderFromRow(row({ Author: { Title: '', EMail: 'sam@example.com' } })).who).toBe('sam@example.com');
  });

  it('works out the total from the order data when the Total column is empty', () => {
    expect(orderFromRow(row({ OrderTotal: null })).total).toBe(47);
  });

  it('puts the newest orders first', () => {
    expect(ordersFromRows([row({ Id: 3 }), row({ Id: 10 }), row({ Id: 5 })]).map(o => o.id)).toEqual([10, 5, 3]);
  });
});

describe('readOrderData', () => {
  it('drops lines that make no sense rather than trusting them', () => {
    const data = readOrderData(JSON.stringify({
      version: 1,
      method: 'Delivery',
      address: null,
      lines: [hoodie, { name: '', qty: 1 }, { name: 'Mug', qty: 0 }, 'junk', { name: 'Cap', qty: 2 }]
    }));
    expect(data.lines).toEqual([hoodie, { productId: 0, name: 'Cap', price: 0, qty: 2, variant: ONE_SIZE }]);
    expect(data.method).toBe('Delivery');
    expect(data.address).toBeUndefined();
  });

  it('gives back no lines for something that is not order data', () => {
    expect(readOrderData('').lines).toEqual([]);
    expect(readOrderData('"just text"').lines).toEqual([]);
    expect(readOrderData(42).lines).toEqual([]);
  });
});

describe('dates and words', () => {
  it('writes the day it was placed the way people say it', () => {
    expect(dateText(new Date(2026, 9, 4, 15, 30))).toBe('4 Oct 2026');
    expect(dateText(new Date(2027, 0, 31))).toBe('31 Jan 2027');
  });

  it('adds the time for the order details', () => {
    expect(whenText(new Date(2026, 9, 4, 15, 30))).toBe('4 Oct 2026 at 3:30 PM');
    expect(whenText(new Date(2026, 9, 4, 9, 5))).toBe('4 Oct 2026 at 9:05 AM');
    expect(whenText(new Date(2026, 9, 4, 12, 0))).toBe('4 Oct 2026 at 12:00 PM');
    expect(whenText(new Date(2026, 9, 4, 0, 15))).toBe('4 Oct 2026 at 12:15 AM');
  });

  it('says item or items', () => {
    expect(itemCountText(1)).toBe('1 item');
    expect(itemCountText(3)).toBe('3 items');
  });
});

describe('the steps for delivery and pick-up', () => {
  it('goes New, Confirmed, Packed, Shipped for a delivery', () => {
    expect(statusesFor('Delivery')).toEqual(['New', 'Confirmed', 'Packed', 'Shipped']);
  });

  it('goes New, Confirmed, Ready for pick-up, Picked up for a pick-up', () => {
    expect(statusesFor('Pick up')).toEqual(['New', 'Confirmed', 'Ready for pick-up', 'Picked up']);
  });

  it('hands out a copy, so the steps themselves stay as they are', () => {
    statusesFor('Delivery').pop();
    expect(statusesFor('Delivery')).toEqual(['New', 'Confirmed', 'Packed', 'Shipped']);
  });

  it('counts shipped and picked up as done, and nothing else', () => {
    expect(isDone('Shipped')).toBe(true);
    expect(isDone('Picked up')).toBe(true);
    expect(isDone('New')).toBe(false);
    expect(isDone('Confirmed')).toBe(false);
    expect(isDone('Packed')).toBe(false);
    expect(isDone('Ready for pick-up')).toBe(false);
  });

  it('carries a status across to the same step when an order switches way', () => {
    expect(statusForMethod('New', 'Pick up')).toBe('New');
    expect(statusForMethod('New', 'Delivery')).toBe('New');
    expect(statusForMethod('Confirmed', 'Pick up')).toBe('Confirmed');
    expect(statusForMethod('Confirmed', 'Delivery')).toBe('Confirmed');
    expect(statusForMethod('Packed', 'Pick up')).toBe('Ready for pick-up');
    expect(statusForMethod('Ready for pick-up', 'Delivery')).toBe('Packed');
    expect(statusForMethod('Shipped', 'Pick up')).toBe('Picked up');
    expect(statusForMethod('Picked up', 'Delivery')).toBe('Shipped');
  });

  it('leaves a status that already fits as it is', () => {
    statusesFor('Delivery').forEach(s => expect(statusForMethod(s, 'Delivery')).toBe(s));
    statusesFor('Pick up').forEach(s => expect(statusForMethod(s, 'Pick up')).toBe(s));
  });

  it('reads a confirmed order back as Confirmed, whichever way it goes', () => {
    expect(orderFromRow(row({ OrderStatus: 'Confirmed' })).status).toBe('Confirmed');
    expect(orderFromRow(pickUp({ OrderStatus: 'Confirmed' })).status).toBe('Confirmed');
  });
});

describe('filtering orders', () => {
  const orders = [
    order(1, 'New'), order(2, 'Packed'), order(3, 'Shipped'), order(4, 'New'),
    pickUpOrder(5, 'Ready for pick-up'), pickUpOrder(6, 'Picked up'), pickUpOrder(7, 'Confirmed')
  ];

  it('offers Open first, then each step still to do, then Done and All', () => {
    expect(FILTERS.map(f => f.label))
      .toEqual(['Open', 'New', 'Confirmed', 'Packed', 'Ready for pick-up', 'Done', 'All']);
  });

  it('counts everything not shipped or picked up yet as open', () => {
    expect(inFilter('New', 'open')).toBe(true);
    expect(inFilter('Confirmed', 'open')).toBe(true);
    expect(inFilter('Packed', 'open')).toBe(true);
    expect(inFilter('Ready for pick-up', 'open')).toBe(true);
    expect(inFilter('Shipped', 'open')).toBe(false);
    expect(inFilter('Picked up', 'open')).toBe(false);
  });

  it('counts shipped and picked-up orders as done', () => {
    expect(inFilter('Shipped', 'done')).toBe(true);
    expect(inFilter('Picked up', 'done')).toBe(true);
    expect(inFilter('New', 'done')).toBe(false);
    expect(inFilter('Ready for pick-up', 'done')).toBe(false);
  });

  it('shows only the orders under the filter', () => {
    expect(visibleOrders(orders, 'open', '').map(o => o.id)).toEqual([1, 2, 4, 5, 7]);
    expect(visibleOrders(orders, 'New', '').map(o => o.id)).toEqual([1, 4]);
    expect(visibleOrders(orders, 'Confirmed', '').map(o => o.id)).toEqual([7]);
    expect(visibleOrders(orders, 'Packed', '').map(o => o.id)).toEqual([2]);
    expect(visibleOrders(orders, 'Ready for pick-up', '').map(o => o.id)).toEqual([5]);
    expect(visibleOrders(orders, 'done', '').map(o => o.id)).toEqual([3, 6]);
    expect(visibleOrders(orders, 'all', '').map(o => o.id)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('keeps an order that was just changed in view, even when it no longer fits the filter', () => {
    const changed = withStatus(withStatus(orders, 2, 'Shipped'), 5, 'Picked up');
    expect(visibleOrders(changed, 'open', '').map(o => o.id)).toEqual([1, 4, 7]);
    expect(visibleOrders(changed, 'open', '', [2, 5]).map(o => o.id)).toEqual([1, 2, 4, 5, 7]);
  });

  it('changes only the one order', () => {
    const changed = withStatus(orders, 2, 'Shipped');
    expect(changed.map(o => o.status))
      .toEqual(['New', 'Shipped', 'Shipped', 'New', 'Ready for pick-up', 'Picked up', 'Confirmed']);
    expect(orders[1].status).toBe('Packed');
  });
});

describe('searching orders', () => {
  const megansOrder = orderFromRow(row());

  it('finds an order by its number, the person or what they ordered', () => {
    expect(matchesOrder(megansOrder, 'cs-0042')).toBe(true);
    expect(matchesOrder(megansOrder, 'megan')).toBe(true);
    expect(matchesOrder(megansOrder, 'example.com')).toBe(true);
    expect(matchesOrder(megansOrder, 'hoodie')).toBe(true);
    expect(matchesOrder(megansOrder, 'mug')).toBe(false);
  });

  it('needs every word typed to be somewhere in the order', () => {
    expect(matchesOrder(megansOrder, 'megan hoodie')).toBe(true);
    expect(matchesOrder(megansOrder, 'megan mug')).toBe(false);
  });

  it('finds everything when the search is blank', () => {
    expect(matchesOrder(megansOrder, '   ')).toBe(true);
  });

  it('searches the Items column when the order data is gone', () => {
    expect(matchesOrder(orderFromRow(row({ OrderData: null, OrderItems: '1 × Mug' })), 'mug')).toBe(true);
  });

  it('applies the filter and the search together', () => {
    const teeOnly = { OrderItems: '2 × T-shirt (M)', OrderData: orderData([tee], 'Pick up') };
    const orders = [order(1, 'New'), order(2, 'Shipped', teeOnly)];
    expect(visibleOrders(orders, 'all', 'hoodie').map(o => o.id)).toEqual([1]);
    expect(visibleOrders(orders, 'done', 'hoodie')).toEqual([]);
  });
});

describe('the summary', () => {
  const counts = countOrders([
    { status: 'New' }, { status: 'New' }, { status: 'Confirmed' }, { status: 'Packed' }, { status: 'Ready for pick-up' },
    { status: 'Shipped' }, { status: 'Shipped' }, { status: 'Picked up' }
  ]);

  it('counts each step still to do, what is open, what is done and the lot', () => {
    expect(counts).toEqual({ open: 5, New: 2, Confirmed: 1, Packed: 1, 'Ready for pick-up': 1, done: 3, all: 8 });
  });

  it('reads like a sentence', () => {
    expect(summaryText(counts)).toBe('2 new · 1 confirmed · 1 packed · 1 ready for pick-up · 3 done');
  });

  it('leaves out anything there are none of', () => {
    expect(summaryText(countOrders([{ status: 'New' }]))).toBe('1 new');
    expect(summaryText(countOrders([{ status: 'Ready for pick-up' }, { status: 'Shipped' }])))
      .toBe('1 ready for pick-up · 1 done');
  });

  it('says when nothing is open', () => {
    expect(summaryText(countOrders([{ status: 'Shipped' }, { status: 'Picked up' }]))).toBe('Nothing open · 2 done');
  });

  it('is empty when there are no orders at all', () => {
    expect(summaryText(countOrders([]))).toBe('');
  });
});

describe('when there is nothing to show', () => {
  const allDone = countOrders([{ status: 'Shipped' }, { status: 'Picked up' }]);

  it('says so plainly when there are no orders at all', () => {
    expect(emptyText('open', '', countOrders([]))).toBe('No orders yet.');
  });

  it('says every order is done when nothing is open', () => {
    expect(emptyText('open', '', allDone)).toBe('Nothing open — every order is done.');
  });

  it('names the filter when a step has no orders', () => {
    expect(emptyText('Confirmed', '', allDone)).toBe('No orders are confirmed and waiting.');
    expect(emptyText('Packed', '', allDone)).toBe('Nothing is packed and waiting.');
    expect(emptyText('Ready for pick-up', '', allDone)).toBe('Nothing is waiting to be picked up.');
    expect(emptyText('done', '', countOrders([{ status: 'New' }]))).toBe('Nothing has been shipped or picked up yet.');
  });

  it('repeats the search, and suggests All when another filter is on', () => {
    expect(emptyText('open', ' hoodie ', allDone)).toBe('No open orders match "hoodie". Try All to search every order.');
    expect(emptyText('done', 'hoodie', allDone))
      .toBe('No shipped or picked-up orders match "hoodie". Try All to search every order.');
    expect(emptyText('all', 'hoodie', allDone)).toBe('No orders match "hoodie".');
    expect(emptyText('Confirmed', 'hoodie', allDone))
      .toBe('No confirmed orders match "hoodie". Try All to search every order.');
  });
});

describe('the name to use', () => {
  it('calls the person by their first name, or by their email when that is all there is', () => {
    expect(firstNameOf({ who: 'Megan Bowen' })).toBe('Megan');
    expect(firstNameOf({ who: 'Megan' })).toBe('Megan');
    expect(firstNameOf({ who: 'megan@example.com' })).toBe('megan@example.com');
  });
});

describe('the box that asks before an email', () => {
  const megansOrder = orderFromRow(row());
  const noEmail = orderFromRow(row({ Author: { Title: 'Megan Bowen', EMail: '' } }));

  it('asks about confirming, with a tick box for the email', () => {
    expect(statusAsk(megansOrder, 'confirmed')).toEqual({
      title: 'Confirm CS-0042',
      button: 'Confirm',
      emailLabel: "Email Megan to say it's confirmed",
      noEmail: ''
    });
  });

  it('asks about ready for pick-up and shipped in their own words', () => {
    const ready = statusAsk(megansOrder, 'ready');
    expect([ready.title, ready.button, ready.emailLabel])
      .toEqual(['CS-0042 is ready for pick-up', 'Mark ready', 'Email Megan to come and pick it up']);
    const shipped = statusAsk(megansOrder, 'shipped');
    expect([shipped.title, shipped.button, shipped.emailLabel])
      .toEqual(['Mark CS-0042 shipped', 'Mark shipped', "Email Megan to say it's on its way"]);
  });

  it('says so instead of offering the email when there is no address to send it to', () => {
    const ask = statusAsk(noEmail, 'shipped');
    expect(ask.emailLabel).toBe('');
    expect(ask.noEmail).toBe("There's no email address for Megan Bowen, so no email can go.");
    expect(statusAsk(orderFromRow({ Id: 7, Author: null }), 'confirmed').noEmail)
      .toBe("There's no email address for this order, so no email can go.");
  });

  it('labels the ready-by day for the way it goes', () => {
    expect(readyByLabel('Pick up')).toBe('Ready for pick-up by');
    expect(readyByLabel('Delivery')).toBe('Ready to send by');
  });
});
