import {
  allCombos, checkOptions, dropSoldOut, findVariant, leftFor, optionsJson, parseCombo, parseOptions,
  priceRange, stockWhere, tidyOptions, variantLabel
} from './variants';
import { IOption, IVariant, ONE_SIZE } from './types';

const COLOUR: IOption = { name: 'Colour', values: [{ value: 'White' }, { value: 'Black' }] };
const SIZE: IOption = { name: 'Size', values: [{ value: 'S' }, { value: 'M' }, { value: 'L' }] };
const OPTIONS = [COLOUR, SIZE];

const variant = (colour: string, size: string, inStock: number, price: number = 22): IVariant =>
  ({ label: `${colour} · ${size}`, combo: { Colour: colour, Size: size }, inStock, price });

/* White has no S; Black is gone except one L. */
const VARIANTS: IVariant[] = [
  variant('White', 'S', 0), variant('White', 'M', 4), variant('White', 'L', 2),
  variant('Black', 'S', 0), variant('Black', 'M', 0), variant('Black', 'L', 1, 26)
];

describe('variants', () => {
  it('makes every combination, options in order', () => {
    expect(allCombos(OPTIONS).map(c => variantLabel(OPTIONS, c))).toEqual([
      'White · S', 'White · M', 'White · L', 'Black · S', 'Black · M', 'Black · L'
    ]);
  });

  it('gives a product with no options one variant, "One size"', () => {
    expect(allCombos([])).toEqual([{}]);
    expect(variantLabel([], {})).toBe(ONE_SIZE);
  });

  it('adds up stock across what fits the picks so far', () => {
    expect(stockWhere(VARIANTS, {})).toBe(7);
    expect(stockWhere(VARIANTS, { Colour: 'Black' })).toBe(1);
    expect(stockWhere(VARIANTS, { Size: 'S' })).toBe(0);
  });

  it('finds the variant only once every option is picked', () => {
    expect(findVariant(OPTIONS, VARIANTS, { Colour: 'White' })).toBeUndefined();
    expect(findVariant(OPTIONS, VARIANTS, { Colour: 'White', Size: 'M' })?.inStock).toBe(4);
  });

  it('judges a value only against the options above it', () => {
    // Size S is crossed out under White, but picking S first must not cross out a colour.
    expect(leftFor(OPTIONS, VARIANTS, { Colour: 'White' }, 1, 'S')).toBe(0);
    expect(leftFor(OPTIONS, VARIANTS, { Size: 'S' }, 0, 'Black')).toBe(1);
  });

  it('drops a lower pick that the new higher pick has sold out', () => {
    expect(dropSoldOut(OPTIONS, VARIANTS, { Colour: 'Black', Size: 'M' })).toEqual({ Colour: 'Black' });
    expect(dropSoldOut(OPTIONS, VARIANTS, { Colour: 'White', Size: 'M' })).toEqual({ Colour: 'White', Size: 'M' });
  });

  it('knows the cheapest and dearest variant', () => {
    expect(priceRange(VARIANTS, 22)).toEqual({ min: 22, max: 26 });
    expect(priceRange([], 22)).toEqual({ min: 22, max: 22 });
  });

  it('reads back the options it writes, photos included', () => {
    const withPhotos: IOption[] = [{ name: 'Colour', values: [{ value: 'White', photoUrls: ['https://x/front.png', 'https://x/back.png'] }] }];
    expect(parseOptions(optionsJson(withPhotos))).toEqual(withPhotos);
    expect(optionsJson([])).toBe('');
  });

  it('reads a choice saved with one photo as a list of one', () => {
    expect(parseOptions('{"options":[{"name":"Colour","values":[{"value":"White","photoUrl":"https://x/w.png"}]}]}'))
      .toEqual([{ name: 'Colour', values: [{ value: 'White', photoUrls: ['https://x/w.png'] }] }]);
  });

  it('treats anything unreadable as no options or no combination', () => {
    expect(parseOptions('not json')).toEqual([]);
    expect(parseOptions(undefined)).toEqual([]);
    expect(parseCombo('{"Size":"M","odd":3}')).toEqual({ Size: 'M' });
    expect(parseCombo('')).toEqual({});
  });

  it('tidies the form: trims, drops blanks and repeats', () => {
    expect(tidyOptions([
      { name: ' Size ', values: [{ value: 'S' }, { value: ' s ' }, { value: '' }, { value: 'M' }] },
      { name: '', values: [{ value: 'x' }] },
      { name: 'Empty', values: [{ value: ' ' }] }
    ])).toEqual([{ name: 'Size', values: [{ value: 'S' }, { value: 'M' }] }]);
  });

  it('explains what is wrong with the options', () => {
    expect(checkOptions(OPTIONS)).toBeUndefined();
    expect(checkOptions([{ name: '', values: [{ value: 'S' }] }])).toContain('name');
    expect(checkOptions([{ name: 'Size', values: [] }, COLOUR])).toContain('at least one choice');
    expect(checkOptions([SIZE, { ...SIZE, name: 'size' }])).toContain('same name');
    expect(checkOptions([COLOUR, SIZE, { name: 'Fit', values: [{ value: 'A' }] }, { name: 'Cut', values: [{ value: 'B' }] }]))
      .toContain('up to 3');
    const many = (name: string): IOption => {
      const values: IOption['values'] = [];
      for (let i = 0; i < 11; i++) values.push({ value: `${name}${i}` });
      return { name, values };
    };
    expect(checkOptions([many('A'), many('B')])).toContain('121 combinations');
  });
});
