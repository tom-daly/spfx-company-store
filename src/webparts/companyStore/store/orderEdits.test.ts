import {
  checkEdit, describeEdit, editedLines, editedOrder, editedStatus, emailFailedText, emailWarningText, emailedText,
  movedOrder, orderColumns, quantityChanges, statusChangeText, statusDetailsProblem, statusMove, statusProblem,
  stockMoves, tooFewMessage
} from './orderEdits';
import type { IOrderEdit, IQuantityChange } from './orderEdits';
import { orderFromRow } from './ordersView';
import type { IOrder, IOrderRow, OrderStatus } from './ordersView';
import { orderData } from './orderText';
import { ONE_SIZE } from './types';
import type { ICartLine } from './types';
import { THURSDAY, TODAY, megan } from './__fixtures__/orders';

const hoodie: ICartLine = { productId: 1, name: 'Crew hoodie', price: 22, qty: 2, variant: 'M' };
const cap: ICartLine = { productId: 2, name: 'Dive cap', price: 4, qty: 1, variant: ONE_SIZE };
const mug: ICartLine = { productId: 3, name: 'Mug', price: 5, qty: 1, variant: ONE_SIZE };

/* A pick-up of two hoodies and a cap as checkout writes it, with whatever a test wants changed. */
const row = (changes: Partial<IOrderRow> = {}): IOrderRow => ({
  Id: 42,
  Title: 'CS-0042',
  OrderItems: '2 × Crew hoodie (M)\n1 × Dive cap',
  OrderTotal: 48,
  DeliveryMethod: 'Pick up',
  ShipTo: '',
  ShipPhone: '',
  OrderNote: '',
  OrderStatus: 'New',
  ConfirmationSent: true,
  OrderData: orderData([hoodie, cap], 'Pick up'),
  Created: '2026-10-04T13:30:00Z',
  Author: { Title: 'Megan Bowen', EMail: 'megan@example.com' },
  ...changes
});

const pickUp = orderFromRow(row());

const delivery = orderFromRow(row({
  DeliveryMethod: 'Delivery',
  ShipTo: 'Megan Bowen\nKeizersgracht 1\n1015 CJ Amsterdam\nNetherlands',
  ShipPhone: '+31 6 1234 5678',
  OrderData: orderData([hoodie, cap], 'Delivery', megan)
}));

const packedDelivery: IOrder = { ...delivery, status: 'Packed' };

/* An order whose order data was damaged, so only the Items column says what was in it. */
const unreadable = orderFromRow(row({ OrderData: '{not json' }));

/* The edit form as it opens: everything as the order has it. */
const asIs = (o: IOrder): IOrderEdit => ({
  status: o.status, lines: o.lines, method: o.method, address: o.address, note: o.note,
  readyBy: o.readyBy, tracking: o.tracking, pickedUpOn: o.pickedUpOn
});

/* The order's lines at new quantities, in the same order. */
const quantities = (o: IOrder, ...qty: number[]): ICartLine[] => o.lines.map((l, i) => ({ ...l, qty: qty[i] }));

describe('what changed, for the history', () => {
  it('says nothing when nothing changed', () => {
    expect(describeEdit(pickUp, asIs(pickUp), 'USD')).toBe('');
    expect(describeEdit(pickUp, { ...asIs(pickUp), note: '   ' }, 'USD')).toBe('');
  });

  it('words a status change on its own the same as one made from the list', () => {
    expect(describeEdit(pickUp, { ...asIs(pickUp), status: 'Ready for pick-up' }, 'USD'))
      .toBe('Status changed from New to Ready for pick-up');
    expect(describeEdit(delivery, { ...asIs(delivery), status: 'Packed' }, 'USD')).toBe('Status changed from New to Packed');
    expect(statusChangeText('Packed', 'Shipped')).toBe('Status changed from Packed to Shipped');
  });

  it('puts everything else on one line, in plain words', () => {
    const edit: IOrderEdit = {
      ...asIs(pickUp),
      status: 'New',
      lines: quantities(pickUp, 1, 0),
      method: 'Delivery',
      address: megan,
      note: 'Leave it at reception'
    };
    expect(describeEdit(pickUp, edit, 'USD')).toBe('Changed: Crew hoodie (M) 2 → 1; Dive cap taken off; ' +
      'note added; now Delivery instead of Pick up; total $48.00 → $22.00');
  });

  it('leads with the status when it changed along with something else', () => {
    expect(describeEdit(pickUp, { ...asIs(pickUp), status: 'Ready for pick-up', note: 'Gift wrap' }, 'USD'))
      .toBe('Changed: status New → Ready for pick-up; note added');
  });

  it('says the status moved across when the order switched way', () => {
    expect(describeEdit(packedDelivery, { ...asIs(packedDelivery), method: 'Pick up' }, 'USD'))
      .toBe('Changed: status Packed → Ready for pick-up; now Pick up instead of Delivery');
  });

  it('says when the address changed, or just the phone number', () => {
    expect(describeEdit(delivery, { ...asIs(delivery), address: { ...megan, line1: 'Prinsengracht 2' } }, 'USD'))
      .toBe('Changed: address changed');
    expect(describeEdit(delivery, { ...asIs(delivery), address: { ...megan, phone: '+31 6 0000 0000' } }, 'USD'))
      .toBe('Changed: phone number changed');
  });

  it("doesn't count stray spaces around the address as a change", () => {
    expect(describeEdit(delivery, { ...asIs(delivery), address: { ...megan, city: ' Amsterdam ' } }, 'USD')).toBe('');
  });

  it('says when it goes back to pick-up', () => {
    expect(describeEdit(delivery, { ...asIs(delivery), method: 'Pick up' }, 'USD'))
      .toBe('Changed: now Pick up instead of Delivery');
  });

  it('says whether the note was changed or removed', () => {
    const withNote = orderFromRow(row({ OrderNote: 'Leave it at reception' }));
    expect(describeEdit(withNote, { ...asIs(withNote), note: 'Ring twice' }, 'USD')).toBe('Changed: note changed');
    expect(describeEdit(withNote, { ...asIs(withNote), note: '' }, 'USD')).toBe('Changed: note removed');
  });

  it('says when an item went up', () => {
    expect(describeEdit(pickUp, { ...asIs(pickUp), lines: quantities(pickUp, 2, 3) }, 'USD'))
      .toBe('Changed: Dive cap 1 → 3; total $48.00 → $56.00');
  });
});

describe('the days and tracking, for the history', () => {
  const shipped: IOrder = { ...delivery, status: 'Shipped', readyBy: TODAY, tracking: '1Z999AA10123456784' };
  const pickedUp: IOrder = { ...pickUp, status: 'Picked up', pickedUpOn: TODAY };

  it('says a change to the ready-by day on its own, as a sentence', () => {
    expect(describeEdit(pickUp, { ...asIs(pickUp), readyBy: THURSDAY }, 'USD'))
      .toBe('Ready by changed to Thu 15 Oct 2026');
    expect(describeEdit(shipped, { ...asIs(shipped), readyBy: THURSDAY }, 'USD'))
      .toBe('Ready by changed to Thu 15 Oct 2026');
    expect(describeEdit(shipped, { ...asIs(shipped), readyBy: '' }, 'USD')).toBe('Ready by cleared');
  });

  it('says when the tracking was set or cleared', () => {
    expect(describeEdit(delivery, { ...asIs(delivery), tracking: ' 1Z999AA10123456784 ' }, 'USD'))
      .toBe('Tracking set to 1Z999AA10123456784');
    expect(describeEdit(shipped, { ...asIs(shipped), tracking: 'https://track.example.com/1Z' }, 'USD'))
      .toBe('Tracking set to https://track.example.com/1Z');
    expect(describeEdit(shipped, { ...asIs(shipped), tracking: '  ' }, 'USD')).toBe('Tracking cleared');
  });

  it('says when the day it was picked up changed', () => {
    expect(describeEdit(pickedUp, { ...asIs(pickedUp), pickedUpOn: THURSDAY }, 'USD'))
      .toBe('Picked up on changed to Thu 15 Oct 2026');
    expect(describeEdit(pickedUp, { ...asIs(pickedUp), pickedUpOn: '' }, 'USD')).toBe('Picked up on cleared');
  });

  it('puts them with the other changes when there are any', () => {
    expect(describeEdit(pickUp, { ...asIs(pickUp), status: 'Confirmed', readyBy: THURSDAY }, 'USD'))
      .toBe('Changed: status New → Confirmed; ready by changed to Thu 15 Oct 2026');
    expect(describeEdit(shipped, { ...asIs(shipped), note: 'Ring twice', tracking: '' }, 'USD'))
      .toBe('Changed: note added; tracking cleared');
  });

  it('gives the day it was picked up when the status moves to Picked up', () => {
    const ready: IOrder = { ...pickUp, status: 'Ready for pick-up' };
    expect(describeEdit(ready, { ...asIs(ready), status: 'Picked up', pickedUpOn: TODAY }, 'USD'))
      .toBe('Changed: status Ready for pick-up → Picked up; picked up on changed to Mon 12 Oct 2026');
  });

  it("doesn't mention the day it was picked up going when the status moves away from Picked up", () => {
    expect(describeEdit(pickedUp, { ...asIs(pickedUp), status: 'Ready for pick-up' }, 'USD'))
      .toBe('Status changed from Picked up to Ready for pick-up');
  });

  it('says the tracking went when a delivery switched to pick-up, but only if there was some', () => {
    expect(describeEdit(shipped, { ...asIs(shipped), method: 'Pick up' }, 'USD'))
      .toBe('Changed: status Shipped → Picked up; now Pick up instead of Delivery; tracking cleared');
    expect(describeEdit(delivery, { ...asIs(delivery), method: 'Pick up' }, 'USD'))
      .toBe('Changed: now Pick up instead of Delivery');
  });
});

describe('how the stock moves', () => {
  const said = (changes: IQuantityChange[]): string[] =>
    changes.map(c => `${c.line.name} (${c.line.variant}): ${c.from} → ${c.to}`);

  it('works out each variant that went up or down, and how far', () => {
    expect(said(quantityChanges(pickUp.lines, [{ ...hoodie, qty: 3 }])))
      .toEqual(['Crew hoodie (M): 2 → 3', 'Dive cap (One size): 1 → 0']);
  });

  it('leaves out variants that stayed the same', () => {
    expect(quantityChanges(pickUp.lines, quantities(pickUp, 2, 1))).toEqual([]);
  });

  it('adds up a variant that is listed twice', () => {
    expect(quantityChanges([hoodie, { ...hoodie, qty: 1 }], [{ ...hoodie, qty: 3 }])).toEqual([]);
  });

  it('tells sizes of the same product apart', () => {
    expect(said(quantityChanges([hoodie], [{ ...hoodie, variant: 'L' }])))
      .toEqual(['Crew hoodie (M): 2 → 0', 'Crew hoodie (L): 0 → 2']);
  });

  it('takes the raised ones first, so nothing is put back before a refusal', () => {
    expect(said(stockMoves(pickUp.lines, quantities(pickUp, 1, 3))))
      .toEqual(['Dive cap (One size): 1 → 3', 'Crew hoodie (M): 2 → 1']);
  });

  it('says plainly when there are not enough to go up', () => {
    expect(tooFewMessage(hoodie, 4, 2)).toBe("Only 2 Crew hoodie (M) left, so it can't go up to 4.");
    expect(tooFewMessage(cap, 3, 0)).toBe("Dive cap is sold out, so it can't go up to 3.");
  });
});

describe('the order after the edit', () => {
  it('takes lines at 0 off and keeps the prices as they were ordered', () => {
    expect(editedLines(pickUp, { ...asIs(pickUp), lines: [{ ...hoodie, qty: 1, price: 1 }, { ...cap, qty: 0 }] }))
      .toEqual([{ ...hoodie, qty: 1 }]);
  });

  it('takes off a line the edit leaves out altogether', () => {
    expect(editedLines(pickUp, { ...asIs(pickUp), lines: [hoodie] })).toEqual([hoodie]);
  });

  it('works out the items, count and total again when a quantity changes', () => {
    const after = editedOrder(pickUp, { ...asIs(pickUp), lines: quantities(pickUp, 1, 0) });
    expect(after.itemLines).toEqual(['1 × Crew hoodie (M)']);
    expect(after.items).toBe(1);
    expect(after.total).toBe(22);
  });

  it('keeps a total set by hand when no quantity changed', () => {
    const discounted = orderFromRow(row({ OrderTotal: 40 }));
    expect(editedOrder(discounted, { ...asIs(discounted), note: 'Gift wrap' }).total).toBe(40);
  });

  it('tidies the address and writes Ship to from it', () => {
    const after = editedOrder(pickUp,
      { ...asIs(pickUp), method: 'Delivery', address: { ...megan, name: ' Megan Bowen ' } });
    expect(after.address).toEqual(megan);
    expect(after.shipTo).toEqual(['Megan Bowen', 'Keizersgracht 1', '1015 CJ Amsterdam', 'Netherlands']);
    expect(after.phone).toBe('+31 6 1234 5678');
  });

  it('drops the address for pick-up, even if the form still has one', () => {
    const after = editedOrder(delivery, { ...asIs(delivery), method: 'Pick up' });
    expect(after.address).toBeUndefined();
    expect(after.shipTo).toEqual([]);
    expect(after.phone).toBe('');
  });

  it('rewrites the items, total and order data in the list', () => {
    const after = editedOrder(pickUp,
      { ...asIs(pickUp), lines: quantities(pickUp, 1, 0), status: 'Ready for pick-up' });
    const columns = orderColumns(pickUp, after);
    expect(columns.OrderItems).toBe('1 × Crew hoodie (M)');
    expect(columns.OrderTotal).toBe(22);
    expect(columns.OrderStatus).toBe('Ready for pick-up');
    expect(JSON.parse(columns.OrderData as string).lines).toEqual([{ ...hoodie, qty: 1 }]);
  });

  it("leaves the items alone when the order data couldn't be read", () => {
    const columns = orderColumns(unreadable, editedOrder(unreadable, { ...asIs(unreadable), status: 'Picked up' }));
    expect(columns.OrderStatus).toBe('Picked up');
    expect(Object.keys(columns)).not.toContain('OrderItems');
    expect(Object.keys(columns)).not.toContain('OrderTotal');
    expect(Object.keys(columns)).not.toContain('OrderData');
  });

  it('keeps the ready-by day either way, and writes the days and tracking in the list', () => {
    const after = editedOrder(delivery, { ...asIs(delivery), readyBy: THURSDAY, tracking: ' 1Z999 ' });
    expect(after.readyBy).toBe(THURSDAY);
    expect(after.tracking).toBe('1Z999');
    const columns = orderColumns(delivery, after);
    expect([columns.ReadyBy, columns.Tracking, columns.PickedUpOn]).toEqual([THURSDAY, '1Z999', '']);
    expect(editedOrder(pickUp, { ...asIs(pickUp), readyBy: THURSDAY }).readyBy).toBe(THURSDAY);
  });

  it('drops the tracking for pick-up, even if the form still has some', () => {
    const shipped: IOrder = { ...delivery, status: 'Shipped', tracking: '1Z999' };
    const after = editedOrder(shipped, { ...asIs(shipped), method: 'Pick up' });
    expect(after.tracking).toBe('');
    expect(orderColumns(shipped, after).Tracking).toBe('');
  });

  it('keeps the day it was picked up only while the order is Picked up', () => {
    const pickedUp: IOrder = { ...pickUp, status: 'Picked up', pickedUpOn: TODAY };
    expect(editedOrder(pickedUp, { ...asIs(pickedUp), note: 'Collected' }).pickedUpOn).toBe(TODAY);
    const back = editedOrder(pickedUp, { ...asIs(pickedUp), status: 'Ready for pick-up' });
    expect(back.pickedUpOn).toBe('');
    expect(orderColumns(pickedUp, back).PickedUpOn).toBe('');
  });
});

describe('checking an edit', () => {
  it('lets an unchanged order through', () => {
    expect(checkEdit(pickUp, asIs(pickUp))).toBeUndefined();
  });

  it('wants whole numbers, 0 or more', () => {
    expect(checkEdit(pickUp, { ...asIs(pickUp), lines: quantities(pickUp, 1.5, 1) }))
      .toBe('How many Crew hoodie (M) has to be a whole number: 0 or more.');
    expect(checkEdit(pickUp, { ...asIs(pickUp), lines: quantities(pickUp, 2, -1) }))
      .toBe('How many Dive cap has to be a whole number: 0 or more.');
  });

  it('wants at least one item left', () => {
    expect(checkEdit(pickUp, { ...asIs(pickUp), lines: quantities(pickUp, 0, 0) }))
      .toBe('Leave at least one item on the order.');
  });

  it("won't add something that wasn't on the order", () => {
    expect(checkEdit(pickUp, { ...asIs(pickUp), lines: pickUp.lines.concat([mug]) }))
      .toContain("Mug isn't on this order.");
  });

  it('wants a full address for delivery, and names what is missing', () => {
    expect(checkEdit(pickUp, { ...asIs(pickUp), method: 'Delivery' })).toBe('Please add the name, ' +
      'the first line of the address, the postcode, the city and the country so we know where to send it.');
    expect(checkEdit(pickUp, { ...asIs(pickUp), method: 'Delivery', address: { ...megan, postcode: ' ' } }))
      .toBe('Please add the postcode so we know where to send it.');
    expect(checkEdit(pickUp, { ...asIs(pickUp), method: 'Delivery', address: megan })).toBeUndefined();
  });

  it("lets the rest of an order be changed when its items can't be read, but not the items", () => {
    expect(checkEdit(unreadable, { ...asIs(unreadable), status: 'Picked up', note: 'Collected' })).toBeUndefined();
    expect(checkEdit(unreadable, { ...asIs(unreadable), lines: [hoodie] })).toContain("can't be changed");
  });

  it("refuses a status the store doesn't know, and lists the ones that fit", () => {
    expect(checkEdit(pickUp, { ...asIs(pickUp), status: 'Lost' as OrderStatus }))
      .toBe('Choose a status: New, Confirmed, Ready for pick-up or Picked up.');
    expect(checkEdit(delivery, { ...asIs(delivery), status: 'Lost' as OrderStatus }))
      .toBe('Choose a status: New, Confirmed, Packed or Shipped.');
  });

  it("refuses a status that doesn't fit pick-up or delivery", () => {
    expect(checkEdit(pickUp, { ...asIs(pickUp), status: 'Packed' }))
      .toBe('Packed is only for deliveries. For pick-up, choose New, Confirmed, Ready for pick-up or Picked up.');
    expect(checkEdit(delivery, { ...asIs(delivery), status: 'Picked up' }))
      .toBe('Picked up is only for pick-ups. For delivery, choose New, Confirmed, Packed or Shipped.');
  });

  it("refuses a status chosen for the old way when the order switches, rather than guessing", () => {
    expect(checkEdit(delivery, { ...asIs(delivery), method: 'Pick up', status: 'Shipped' }))
      .toBe('Shipped is only for deliveries. For pick-up, choose New, Confirmed, Ready for pick-up or Picked up.');
  });

  it('lets a switch through when the status was left as it was, moving it across', () => {
    expect(checkEdit(packedDelivery, { ...asIs(packedDelivery), method: 'Pick up' })).toBeUndefined();
  });

  it('lets Confirmed through either way', () => {
    expect(checkEdit(pickUp, { ...asIs(pickUp), status: 'Confirmed' })).toBeUndefined();
    expect(checkEdit(delivery, { ...asIs(delivery), status: 'Confirmed' })).toBeUndefined();
  });

  it('wants the days to be real days, or empty', () => {
    expect(checkEdit(pickUp, { ...asIs(pickUp), readyBy: THURSDAY })).toBeUndefined();
    expect(checkEdit(pickUp, { ...asIs(pickUp), readyBy: '15 Oct' }))
      .toBe("The ready-by day isn't a real day. Pick it again, or clear it.");
    expect(checkEdit(pickUp, { ...asIs(pickUp), status: 'Picked up', pickedUpOn: '2026-02-31' }))
      .toBe("The picked-up day isn't a real day. Pick it again, or clear it.");
  });

  it("doesn't mind the day it was picked up while the order isn't Picked up, since it isn't kept", () => {
    expect(checkEdit(pickUp, { ...asIs(pickUp), pickedUpOn: 'soon' })).toBeUndefined();
  });

  it('wants the tracking short enough for the list, but only for delivery', () => {
    const long = 'x'.repeat(256);
    expect(checkEdit(delivery, { ...asIs(delivery), tracking: long }))
      .toBe('The tracking number or link is too long. Keep it to 255 characters or fewer.');
    expect(checkEdit(delivery, { ...asIs(delivery), tracking: 'x'.repeat(255) })).toBeUndefined();
    expect(checkEdit(pickUp, { ...asIs(pickUp), tracking: long })).toBeUndefined();
  });
});

describe('moving an order on from the table', () => {
  const confirmed: IOrder = { ...delivery, status: 'Confirmed', readyBy: TODAY };
  const packed: IOrder = { ...delivery, status: 'Packed' };
  const ready: IOrder = { ...pickUp, status: 'Ready for pick-up' };
  const pickedUp: IOrder = { ...pickUp, status: 'Picked up', pickedUpOn: TODAY };

  it('confirms with the ready-by day, saved and said in the same go', () => {
    const move = statusMove(pickUp, 'New', 'Confirmed', { readyBy: THURSDAY }, TODAY);
    expect(move.what).toBe('Status changed from New to Confirmed, ready by Thu 15 Oct 2026');
    expect(move.values).toEqual({ OrderStatus: 'Confirmed', ReadyBy: THURSDAY });
    expect(move.after.status).toBe('Confirmed');
    expect(move.after.readyBy).toBe(THURSDAY);
  });

  it('confirms without a day, and says so when that clears one', () => {
    expect(statusMove(pickUp, 'New', 'Confirmed', { readyBy: '' }, TODAY).what)
      .toBe('Status changed from New to Confirmed');
    const again = statusMove({ ...packed, readyBy: TODAY }, 'Packed', 'Confirmed', { readyBy: '' }, TODAY);
    expect(again.what).toBe('Status changed from Packed to Confirmed, ready by cleared');
    expect(again.values.ReadyBy).toBe('');
  });

  it('ships with the tracking', () => {
    const move = statusMove(packed, 'Packed', 'Shipped', { tracking: ' 1Z999AA10123456784 ' }, TODAY);
    expect(move.what).toBe('Status changed from Packed to Shipped, tracking 1Z999AA10123456784');
    expect(move.values).toEqual({ OrderStatus: 'Shipped', Tracking: '1Z999AA10123456784' });
    expect(move.after.tracking).toBe('1Z999AA10123456784');
  });

  it('ships without tracking', () => {
    const move = statusMove(packed, 'Packed', 'Shipped', { tracking: '' }, TODAY);
    expect(move.what).toBe('Status changed from Packed to Shipped');
    expect(move.values).toEqual({ OrderStatus: 'Shipped', Tracking: '' });
  });

  it('packs it, or marks it ready for pick-up, with nothing else', () => {
    const move = statusMove(confirmed, 'Confirmed', 'Packed', {}, TODAY);
    expect(move.values).toEqual({ OrderStatus: 'Packed' });
    expect(move.after.readyBy).toBe(TODAY);
    expect(statusMove(ready, 'Confirmed', 'Ready for pick-up', {}, TODAY).values)
      .toEqual({ OrderStatus: 'Ready for pick-up' });
  });

  it('sets today as the day it was picked up', () => {
    const move = statusMove(ready, 'Ready for pick-up', 'Picked up', {}, THURSDAY);
    expect(move.what).toBe('Status changed from Ready for pick-up to Picked up');
    expect(move.values).toEqual({ OrderStatus: 'Picked up', PickedUpOn: THURSDAY });
    expect(move.after.pickedUpOn).toBe(THURSDAY);
  });

  it('clears the day it was picked up when it moves away from Picked up', () => {
    const move = statusMove(pickedUp, 'Picked up', 'Ready for pick-up', {}, THURSDAY);
    expect(move.values).toEqual({ OrderStatus: 'Ready for pick-up', PickedUpOn: '' });
    expect(move.after.pickedUpOn).toBe('');
  });

  it('says what it moved from as the list has it now, which may not be what the page showed', () => {
    expect(statusMove(confirmed, 'Packed', 'Shipped', {}, TODAY).what).toBe('Status changed from Packed to Shipped');
    expect(statusMove(confirmed, '', 'Packed', {}, TODAY).what).toBe('Status changed from Confirmed to Packed');
  });

  it('only uses what fits the new status', () => {
    const move = statusMove(confirmed, 'Confirmed', 'Packed', { readyBy: THURSDAY, tracking: '1Z999' }, TODAY);
    expect(move.values).toEqual({ OrderStatus: 'Packed' });
    expect(move.after.readyBy).toBe(TODAY);
    expect(move.after.tracking).toBe('');
  });

  it('leaves the ready-by day and tracking as they were when nothing is said about them', () => {
    expect(movedOrder({ ...confirmed, status: 'New' }, 'Confirmed', {}, TODAY).readyBy).toBe(TODAY);
    expect(movedOrder({ ...packed, tracking: '1Z999' }, 'Shipped', {}, TODAY).tracking).toBe('1Z999');
  });

  it('refuses a day that is not a real day, or tracking too long for the list', () => {
    expect(statusDetailsProblem({ readyBy: THURSDAY, tracking: '1Z999' })).toBeUndefined();
    expect(statusDetailsProblem({})).toBeUndefined();
    expect(statusDetailsProblem({ readyBy: 'Thursday' }))
      .toBe("The ready-by day isn't a real day. Pick it again, or clear it.");
    expect(statusDetailsProblem({ tracking: 'x'.repeat(256) }))
      .toBe('The tracking number or link is too long. Keep it to 255 characters or fewer.');
  });
});

describe('the status emails, for the history and the table', () => {
  it('says the email went, and what it was about', () => {
    expect(emailedText('Megan Bowen', 'confirmed')).toBe('Emailed Megan Bowen: order confirmed');
    expect(emailedText('Megan Bowen', 'ready')).toBe('Emailed Megan Bowen: ready for pick-up');
    expect(emailedText('Megan Bowen', 'shipped')).toBe('Emailed Megan Bowen: on its way');
  });

  it("says why it couldn't be sent, without saying twice that it couldn't", () => {
    expect(emailFailedText('Megan Bowen', "The order email couldn't be sent. The mailbox is full."))
      .toBe("Email to Megan Bowen couldn't be sent: The mailbox is full.");
    expect(emailFailedText('Megan Bowen', "IT hasn't approved the store sending email yet, so no email went."))
      .toBe("Email to Megan Bowen couldn't be sent: IT hasn't approved the store sending email yet, so no email went.");
    expect(emailFailedText('Megan Bowen', "The order email couldn't be sent."))
      .toBe("Email to Megan Bowen couldn't be sent");
  });

  it('warns on the order in the table, by first name, that the status is saved but the email is not', () => {
    const confirmed: IOrder = { ...pickUp, status: 'Confirmed' };
    expect(emailWarningText(confirmed, "The order email couldn't be sent. The mailbox is full."))
      .toBe("CS-0042 is Confirmed, but the email to Megan couldn't be sent. The mailbox is full.");
    expect(emailWarningText(confirmed, ''))
      .toBe("CS-0042 is Confirmed, but the email to Megan couldn't be sent.");
  });
});

describe('the status after switching way', () => {
  const shippedDelivery: IOrder = { ...delivery, status: 'Shipped' };
  const readyPickUp: IOrder = { ...pickUp, status: 'Ready for pick-up' };

  it('moves a status left as it was to the same step for the new way', () => {
    expect(editedStatus(packedDelivery, { ...asIs(packedDelivery), method: 'Pick up' })).toBe('Ready for pick-up');
    expect(editedStatus(shippedDelivery, { ...asIs(shippedDelivery), method: 'Pick up' })).toBe('Picked up');
    expect(editedStatus(readyPickUp, { ...asIs(readyPickUp), method: 'Delivery', address: megan })).toBe('Packed');
    expect(editedStatus(delivery, { ...asIs(delivery), method: 'Pick up' })).toBe('New');
  });

  it('keeps a status the form chose for the new way', () => {
    expect(editedStatus(packedDelivery, { ...asIs(packedDelivery), method: 'Pick up', status: 'Picked up' }))
      .toBe('Picked up');
  });

  it('saves the moved status', () => {
    const after = editedOrder(shippedDelivery, { ...asIs(shippedDelivery), method: 'Pick up' });
    expect(after.status).toBe('Picked up');
    expect(orderColumns(shippedDelivery, after).OrderStatus).toBe('Picked up');
  });

  it('leaves the status alone when the way stays the same', () => {
    expect(editedStatus(packedDelivery, { ...asIs(packedDelivery), note: 'Gift wrap' })).toBe('Packed');
  });

  it('words what does not fit plainly', () => {
    expect(statusProblem('Ready for pick-up', 'Delivery'))
      .toBe('Ready for pick-up is only for pick-ups. For delivery, choose New, Confirmed, Packed or Shipped.');
    expect(statusProblem('New', 'Delivery')).toBeUndefined();
    expect(statusProblem('New', 'Pick up')).toBeUndefined();
  });
});
