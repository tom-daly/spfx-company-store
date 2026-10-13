import {
  blankAddress, checkAddress, checkOrder, inWords, itemCount, itemText, itemsText, lineName, lineTotal,
  missingFromAddress, missingWords, notEnoughMessage, orderData, orderNumber, orderTotal, shipToText
} from './orderText';
import { DEFAULT_SETTINGS } from './settings';
import { ONE_SIZE } from './types';
import type { ICartLine } from './types';
import { hoodie, megan, tee } from './__fixtures__/orders';

const mug: ICartLine = { productId: 2, name: 'Mug', price: 0.1, qty: 3, variant: ONE_SIZE };

describe('orderNumber', () => {
  it('pads the row number to four digits after the prefix', () => {
    expect(orderNumber('CS-', 42)).toBe('CS-0042');
    expect(orderNumber('CS-', 1)).toBe('CS-0001');
    expect(orderNumber('CS-', 9999)).toBe('CS-9999');
  });

  it('lets bigger numbers grow rather than cutting them off', () => {
    expect(orderNumber('CS-', 12345)).toBe('CS-12345');
  });

  it('works with no prefix at all', () => {
    expect(orderNumber('', 7)).toBe('0007');
  });
});

describe('order totals', () => {
  it('adds up every line, quantity included', () => {
    expect(orderTotal([hoodie, tee])).toBe(47);
    expect(lineTotal(tee)).toBe(25);
  });

  it('rounds away the tiny leftovers from adding up prices', () => {
    expect(orderTotal([mug])).toBe(0.3);
    expect(orderTotal([mug, { ...mug, price: 0.2, qty: 1 }])).toBe(0.5);
  });

  it('is nothing for free items and an empty cart', () => {
    expect(orderTotal([{ ...hoodie, price: 0, qty: 4 }])).toBe(0);
    expect(orderTotal([])).toBe(0);
  });

  it('counts items, not lines', () => {
    expect(itemCount([hoodie, mug, tee])).toBe(6);
  });
});

describe('itemsText', () => {
  it('writes one product per line with its quantity', () => {
    expect(itemsText([hoodie, mug])).toBe('1 × Crew hoodie\n3 × Mug');
  });

  it('names the variant only when there is a choice of them', () => {
    expect(lineName(hoodie)).toBe('Crew hoodie');
    expect(itemsText([tee])).toBe('2 × T-shirt (M)');
    expect(itemText(tee)).toBe('2 × T-shirt (M)');
  });
});

describe('shipToText', () => {
  it('writes the address as it goes on the parcel, skipping an empty second line', () => {
    expect(shipToText(megan)).toBe('Megan Bowen\nKeizersgracht 1\n1015 CJ Amsterdam\nNetherlands');
  });

  it('keeps the second line when there is one, and tidies stray spaces', () => {
    expect(shipToText({ ...megan, line2: '  Third floor ', city: ' Amsterdam ' }))
      .toBe('Megan Bowen\nKeizersgracht 1\nThird floor\n1015 CJ Amsterdam\nNetherlands');
  });

  it('leaves the phone number off the parcel', () => {
    expect(shipToText(megan)).not.toContain('5678');
  });
});

describe('orderData', () => {
  it('keeps the whole order, address included, for a delivery', () => {
    expect(JSON.parse(orderData([hoodie], 'Delivery', megan))).toEqual({
      version: 1, lines: [hoodie], method: 'Delivery', address: megan
    });
  });

  it('keeps no address for a pick-up, even if one was filled in', () => {
    expect(JSON.parse(orderData([hoodie], 'Pick up', megan)).address).toBeNull();
  });
});

describe('checking the address', () => {
  it('is happy with a full address and no phone or second line', () => {
    expect(checkAddress({ ...megan, phone: '', line2: '' })).toBeUndefined();
  });

  it('names exactly what is missing, in plain words', () => {
    expect(checkAddress({ ...megan, postcode: ' ', city: '' }))
      .toBe('Please add the postcode and the city so we know where to send it.');
    expect(checkAddress({ ...megan, line1: '' }))
      .toBe('Please add the first line of the address so we know where to send it.');
  });

  it('asks for everything when nothing is filled in', () => {
    expect(checkAddress(blankAddress())).toBe('Please add your full name, the first line of the address, ' +
      'the postcode, the city and the country so we know where to send it.');
    expect(missingFromAddress(undefined)).toEqual(['name', 'line1', 'postcode', 'city', 'country']);
  });

  it('can call the parts something else', () => {
    const words = { name: 'N', line1: 'L', postcode: 'P', city: 'C', country: 'K' };
    expect(checkAddress({ ...megan, city: '' }, words)).toBe('Please add C so we know where to send it.');
    expect(missingWords({ ...megan, name: ' ', country: '' }, words)).toEqual(['N', 'K']);
  });

  it('lists things the way people say them', () => {
    expect(inWords(['a'])).toBe('a');
    expect(inWords(['a', 'b'])).toBe('a and b');
    expect(inWords(['a', 'b', 'c'])).toBe('a, b and c');
    expect(inWords(['a', 'b', 'c'], 'or')).toBe('a, b or c');
  });
});

describe('checkOrder', () => {
  const request = { lines: [hoodie], method: 'Pick up' as const, note: '', rememberAddress: false };

  it('lets a pick-up through without an address', () => {
    expect(checkOrder(request, DEFAULT_SETTINGS)).toBeUndefined();
  });

  it('refuses an empty cart', () => {
    expect(checkOrder({ ...request, lines: [] }, DEFAULT_SETTINGS)).toBe('Your cart is empty.');
  });

  it('refuses a delivery with no address or half an address', () => {
    expect(checkOrder({ ...request, method: 'Delivery' }, DEFAULT_SETTINGS)).toContain('your full name');
    expect(checkOrder({ ...request, method: 'Delivery', address: { ...megan, country: '' } }, DEFAULT_SETTINGS))
      .toBe('Please add the country so we know where to send it.');
    expect(checkOrder({ ...request, method: 'Delivery', address: megan }, DEFAULT_SETTINGS)).toBeUndefined();
  });

  it('refuses a way of getting the order that has been turned off', () => {
    expect(checkOrder(request, { ...DEFAULT_SETTINGS, pickUp: false })).toContain('choose delivery');
    expect(checkOrder({ ...request, method: 'Delivery', address: megan }, { ...DEFAULT_SETTINGS, delivery: false }))
      .toContain('choose pick-up');
  });
});

describe('notEnoughMessage', () => {
  it('says how many are left', () => {
    expect(notEnoughMessage({ ...hoodie, qty: 3 }, 2)).toBe('Only 2 Crew hoodie left. Change your cart and try again.');
  });

  it('says when there are none at all', () => {
    expect(notEnoughMessage(hoodie, 0)).toBe('Crew hoodie has just sold out. Take it out of your cart and try again.');
  });

  it('names the variant', () => {
    expect(notEnoughMessage(tee, 1)).toBe('Only 1 T-shirt (M) left. Change your cart and try again.');
  });
});
