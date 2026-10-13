import { IProduct, IVariant, ONE_SIZE } from '../types';

export const ORIGIN = 'https://contoso.sharepoint.com';

export const oneSize = (inStock: number, price: number = 18): IVariant => ({ label: ONE_SIZE, combo: {}, inStock, price });

/*
 * The Dive cap, in its one size, with these search words and this many in
 * stock. What it gives back makes one with whatever a test wants changed.
 */
export const makeProduct = (searchWords: string[], inStock: number): ((over?: Partial<IProduct>) => IProduct) =>
  (over: Partial<IProduct> = {}): IProduct => ({
    id: 1,
    name: 'Dive cap',
    productCode: 'CS-CAP-003',
    shortDescription: 'Six-panel, adjustable strap.',
    longDescription: '',
    details: [],
    price: 18,
    photos: [],
    searchWords: searchWords.slice(),
    active: true,
    inStock,
    options: [],
    variants: [oneSize(inStock)],
    ...over
  });
