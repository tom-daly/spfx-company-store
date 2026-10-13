import type { IOption, IProduct } from './types';
import type { Combo } from './variants';

/*
 * Which pictures the product page shows, in what order. Shared by the shop and
 * the cart; nothing here talks to SharePoint.
 *
 * One option carries the choice photos — the first whose values have any,
 * usually Colour. The product's own photos always stay first, on the left;
 * picking a value adds its photos after them.
 */

export interface IGalleryPicture {
  url: string;
  /** Set when the picture belongs to a choice, so clicking its thumbnail can pick that choice. */
  option?: string;
  value?: string;
}

/** The Photos column: a JSON list of addresses, cover first. Falls back to the cover alone. */
export function parsePhotos(json: string | undefined, cover?: string): string[] {
  let list: string[] = [];
  if (json) {
    try {
      const raw = JSON.parse(json);
      if (Array.isArray(raw)) list = raw.filter((u): u is string => typeof u === 'string' && !!u);
    } catch {
      // unreadable counts as none
    }
  }
  if (!list.length && cover) list = [cover];
  return list;
}

export const photosJson = (urls: string[]): string => (urls.length ? JSON.stringify(urls) : '');

/* The option whose choices have photos, if any. */
const photoOption = (options: IOption[]): IOption | undefined =>
  options.filter(o => o.values.some(v => !!v.photoUrls && v.photoUrls.length > 0))[0];

const productPhotos = (p: Pick<IProduct, 'photos' | 'photoUrl'>): string[] =>
  p.photos && p.photos.length ? p.photos : p.photoUrl ? [p.photoUrl] : [];

/* The same photo used twice shows once. */
function once(pictures: IGalleryPicture[]): IGalleryPicture[] {
  const seen: Record<string, boolean> = {};
  return pictures.filter(pic => {
    if (seen[pic.url]) return false;
    seen[pic.url] = true;
    return true;
  });
}

/**
 * Picked choice with photos: the product's own, then all of that choice's.
 * Otherwise: the product's own, then the first photo of each choice that has
 * photos, so they can be browsed and picked from the thumbnails.
 */
export function galleryFor(p: Pick<IProduct, 'options' | 'photos' | 'photoUrl'>, picked: Partial<Combo>): IGalleryPicture[] {
  const own = productPhotos(p).map((url): IGalleryPicture => ({ url }));
  const po = photoOption(p.options);
  if (!po) return once(own);

  const value = po.values.filter(v => v.value === picked[po.name])[0];
  const pictures: IGalleryPicture[] = value && value.photoUrls && value.photoUrls.length
    ? own.concat(value.photoUrls.map((url): IGalleryPicture => ({ url, option: po.name, value: value.value })))
    : own.concat(po.values
      .filter(v => !!v.photoUrls && v.photoUrls.length > 0)
      .map((v): IGalleryPicture => ({ url: (v.photoUrls as string[])[0], option: po.name, value: v.value })));
  return once(pictures);
}

/**
 * Which picture to show big: the first photo of the picked choice, so picking a
 * colour shows that colour straight away, even though its photos sit after the
 * product's own. With nothing picked, the cover.
 */
export function startAt(pictures: IGalleryPicture[], isPicked: (picture: IGalleryPicture) => boolean): number {
  for (let i = 0; i < pictures.length; i++) {
    if (pictures[i].value && isPicked(pictures[i])) return i;
  }
  return 0;
}

/** The one picture for something in the cart: the picked choice's first photo, else the cover. */
export const coverFor = (p: Pick<IProduct, 'options' | 'photos' | 'photoUrl'>, picked: Partial<Combo>): string | undefined => {
  const po = photoOption(p.options);
  const value = po ? po.values.filter(v => v.value === picked[po.name])[0] : undefined;
  return value && value.photoUrls && value.photoUrls.length ? value.photoUrls[0] : productPhotos(p)[0];
};
