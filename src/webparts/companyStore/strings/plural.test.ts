import { countText, plural } from './plural';
import { ITEMS } from './common';

describe('counting words', () => {
  it('uses the one form for exactly 1 and the other form for anything else', () => {
    expect(countText(1, ITEMS)).toBe('1 item');
    expect(countText(3, ITEMS)).toBe('3 items');
    expect(countText(0, ITEMS)).toBe('0 items');
    expect(plural(1, { one: 'box', other: 'boxes' })).toBe('box');
    expect(plural(2, { one: 'box', other: 'boxes' })).toBe('boxes');
  });
});
