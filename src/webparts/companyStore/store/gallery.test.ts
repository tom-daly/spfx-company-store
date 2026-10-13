import { coverFor, galleryFor, parsePhotos, photosJson, startAt } from './gallery';
import type { IOption } from './types';

const COLOUR: IOption = {
  name: 'Colour',
  values: [
    { value: 'White', photoUrls: ['white-front', 'white-back'] },
    { value: 'Black', photoUrls: ['black-front'] },
    { value: 'Navy' }
  ]
};
const SIZE: IOption = { name: 'Size', values: [{ value: 'S' }, { value: 'M' }] };
const TEE = { options: [SIZE, COLOUR], photos: ['tee-front', 'tee-detail'], photoUrl: 'tee-front' };

const urls = (pics: { url: string }[]): string[] => pics.map(p => p.url);

describe('the product gallery', () => {
  it('shows the product photos, then one per choice that has photos, before anything is picked', () => {
    const pics = galleryFor(TEE, {});
    expect(urls(pics)).toEqual(['tee-front', 'tee-detail', 'white-front', 'black-front']);
    expect(pics[2]).toEqual({ url: 'white-front', option: 'Colour', value: 'White' });
  });

  it('keeps the product photos on the left and adds all of a picked colour\'s photos after them', () => {
    expect(urls(galleryFor(TEE, { Colour: 'White', Size: 'M' })))
      .toEqual(['tee-front', 'tee-detail', 'white-front', 'white-back']);
  });

  it('opens on the picked colour\'s first photo, or the cover when nothing is picked', () => {
    const picked: Record<string, string> = { Colour: 'White' };
    const isPicked = (pic: { option?: string; value?: string }): boolean =>
      !!pic.option && picked[pic.option] === pic.value;
    expect(startAt(galleryFor(TEE, picked), isPicked)).toBe(2);
    expect(startAt(galleryFor(TEE, {}), () => false)).toBe(0);
  });

  it('falls back to the browsing view for a colour with no photos of its own', () => {
    expect(urls(galleryFor(TEE, { Colour: 'Navy' }))).toEqual(urls(galleryFor(TEE, {})));
  });

  it('just shows the product photos when no choice has any', () => {
    expect(urls(galleryFor({ options: [SIZE], photos: ['a', 'b'] }, { Size: 'S' }))).toEqual(['a', 'b']);
  });

  it('uses the cover alone for a product saved before it could have several photos', () => {
    expect(urls(galleryFor({ options: [], photos: [], photoUrl: 'old' }, {}))).toEqual(['old']);
  });

  it('shows the same photo once', () => {
    const twice = { options: [], photos: ['a', 'a', 'b'] };
    expect(urls(galleryFor(twice, {}))).toEqual(['a', 'b']);
  });

  it('pictures a cart line with the picked colour, or else the cover', () => {
    expect(coverFor(TEE, { Colour: 'Black', Size: 'S' })).toBe('black-front');
    expect(coverFor(TEE, { Colour: 'Navy', Size: 'S' })).toBe('tee-front');
    expect(coverFor({ options: [], photos: [] }, {})).toBeUndefined();
  });

  it('reads back the photo list it writes, and falls back to the cover', () => {
    expect(parsePhotos(photosJson(['a', 'b']))).toEqual(['a', 'b']);
    expect(parsePhotos('', 'cover')).toEqual(['cover']);
    expect(parsePhotos('nonsense', undefined)).toEqual([]);
    expect(photosJson([])).toBe('');
  });
});
