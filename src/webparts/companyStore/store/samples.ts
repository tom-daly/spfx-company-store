import type { INewPhoto, IProductDraft, IProductFiles, IStockLine, IValuePhoto } from './products';
import { IOption, ONE_SIZE } from './types';
import { Combo, allCombos, variantLabel } from './variants';

/*
 * The eight products from the clickable mockup, for trying the store out. Most
 * crew kit is on the company, so most are free. Each gets drawn pictures — a
 * product shape on a coloured gradient, seen from the front, from the back and
 * close up — until real photography lands.
 *
 * Three show off variants: the tee comes in two colours and six sizes, the
 * hoodie in six sizes, and the bottle in three colours. Each colour gets
 * pictures of its own: the same shape, drawn in that colour.
 */

/** Which way a drawn picture looks at the product. Its name is written in the corner. */
export type View = 'Front' | 'Back' | 'Detail';

/** Every sample gets these, in this order, so the front is the cover. */
export const VIEWS: View[] = ['Front', 'Back', 'Detail'];

/** How a choice with pictures of its own is drawn: the shape in its colour, from these sides. */
export interface ILook {
  fill: string;
  views: View[];
}

export interface ISample {
  draft: IProductDraft;
  shape: keyof typeof SHAPES;
  tint: [string, string];
  /** The choices with pictures of their own, and how each is drawn. */
  looks?: Record<string, ILook>;
}

const SHAPES = {
  tee: 'M-46,-30 L-20,-42 L0,-32 L20,-42 L46,-30 L34,-8 L26,-12 L26,44 L-26,44 L-26,-12 L-34,-8 Z',
  hoodie: 'M-48,-26 L-22,-40 L0,-46 L22,-40 L48,-26 L36,-4 L27,-9 L27,46 L-27,46 L-27,-9 L-36,-4 Z',
  cap: 'M-34,10 A34,30 0 0 1 34,10 L58,19 L-34,19 Z',
  bottle: 'M-13,-46 L13,-46 L13,-30 L21,-15 L21,44 L-21,44 L-21,-15 L-13,-30 Z',
  tote: 'M-34,-8 L34,-8 L40,46 L-40,46 Z M-18,-8 A18,18 0 0 1 18,-8',
  book: 'M-31,-38 L31,-38 L31,42 L-31,42 Z M-31,-38 L-31,42',
  towel: 'M-40,-32 L40,-32 L40,42 L-40,42 Z',
  sticker: 'M0,-34 L9,-11 L34,-11 L14,4 L21,28 L0,14 L-21,28 L-14,4 L-34,-11 L-9,-11 Z'
};

/* What a product varies by, and how many of each combination there are. */
interface IVaries {
  options: IOption[];
  /** How many of each combination, in the order allCombos lists them. */
  counts: number[];
  /** A combination's own price, when it has one. */
  ownPrice?: (combo: Combo) => number | undefined;
  looks?: Record<string, ILook>;
}

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

const WHITE = '#f4f4f1';
const CHARCOAL = '#2d3035';

const option = (name: string, values: string[]): IOption => ({ name, values: values.map(value => ({ value })) });

const look = (fill: string, views: View[]): ILook => ({ fill, views });

function stockLines(v: IVaries): IStockLine[] {
  return allCombos(v.options).map((combo, i): IStockLine => {
    const line: IStockLine = { label: variantLabel(v.options, combo), combo, inStock: v.counts[i] || 0 };
    const own = v.ownPrice ? v.ownPrice(combo) : undefined;
    if (own !== undefined) line.ownPrice = own;
    return line;
  });
}

const sample = (
  shape: ISample['shape'], tint: ISample['tint'],
  name: string, productCode: string, price: number, stock: number | IVaries,
  shortDescription: string, longDescription: string, details: string[], searchWords: string[]
): ISample => ({
  shape,
  tint,
  looks: typeof stock === 'number' ? undefined : stock.looks,
  draft: {
    name, productCode, price, shortDescription, longDescription,
    details: details.join('\n'),
    searchWords: searchWords.join(', '),
    showInStore: true,
    // Its pictures are drawn and uploaded as new files when it is added.
    photos: [],
    options: typeof stock === 'number' ? [] : stock.options,
    stock: typeof stock === 'number' ? [{ label: ONE_SIZE, combo: {}, inStock: stock }] : stockLines(stock)
  }
});

export const SAMPLES: ISample[] = [
  sample('tee', ['#2a6ea6', '#8fd3e8'], 'Reef crew tee', 'CS-TEE-001', 22, {
    options: [option('Colour', ['White', 'Black']), option('Size', SIZES)],
    /* XS to XXL. The zeros are on purpose, so the shop has sizes to cross out
       and they move as the colour changes: White has no XS; Black has run out
       of L and XXL. */
    counts: [
      0, 5, 8, 7, 4, 1,
      2, 4, 6, 0, 3, 0
    ],
    // The bigger size takes more cloth.
    ownPrice: c => (c.Size === 'XXL' ? 24 : undefined),
    looks: { White: look(WHITE, ['Front', 'Back']), Black: look(CHARCOAL, ['Front', 'Back']) }
  },
  'Organic cotton, printed reef graphic.',
  'Heavy enough for deck work, soft enough to sleep in. The reef print is screen-printed, not transfer, ' +
    'so it survives the salt and the boat wash.',
  ['Fabric: 180 gsm organic cotton', 'Fit: Regular, unisex', 'Care: Cold wash, line dry'],
  ['t-shirt', 'tshirt', 'shirt', 'top', 'cotton', 'reef']),
  sample('hoodie', ['#1f4e6b', '#7fbcd6'], 'Crew hoodie', 'CS-HOD-002', 48, {
    options: [option('Size', SIZES)],
    counts: [0, 2, 4, 3, 3, 0]
  },
  'Heavyweight, embroidered logo.',
  'The one everyone borrows. Brushed inside, double-stitched at the cuffs, with the flag embroidered ' +
    'rather than printed so it does not crack.',
  ['Fabric: 320 gsm cotton blend', 'Fit: Relaxed, unisex', 'Care: Cold wash, do not tumble'],
  ['sweatshirt', 'jumper', 'sweater', 'hood', 'fleece', 'warm']),
  sample('cap', ['#2f6b4f', '#9ad9b6'], 'Dive cap', 'CS-CAP-003', 0, 60,
    'Six-panel, adjustable strap.',
    'Low crown so it sits under a hood. Brass buckle rather than plastic, because plastic snaps in the cold.',
    ['Fabric: Washed cotton twill', 'Fit: One size, adjustable', 'Care: Hand wash'],
    ['hat', 'baseball cap', 'snapback', 'sun', 'peak']),
  sample('bottle', ['#3a5a8a', '#a6c4e8'], 'Insulated bottle', 'CS-BTL-004', 0, {
    options: [option('Colour', ['Forest', 'White', 'Black'])],
    counts: [2, 2, 1],
    looks: {
      Forest: look('#2f6b45', ['Front', 'Back']),
      White: look(WHITE, ['Front']),
      Black: look(CHARCOAL, ['Front', 'Detail'])
    }
  },
  '500 ml, keeps cold 24 hours.',
  'Double-walled steel with a powder coat that does not slip in a wet hand. Fits the cup holders on the RIBs.',
  ['Capacity: 500 ml', 'Material: 18/8 stainless steel', 'Care: Hand wash only'],
  ['water', 'water bottle', 'flask', 'thermos', 'drink', 'hydration', 'steel']),
  sample('tote', ['#8a6a3a', '#e8d7b4'], 'Canvas tote', 'CS-TOT-005', 0, 75,
    'Heavy canvas, long handles.',
    'Long enough handles to go over a shoulder in a wetsuit. Flat base so it stands up on the dock.',
    ['Fabric: 12 oz cotton canvas', 'Size: 38 x 42 cm', 'Care: Cold wash'],
    ['bag', 'shopper', 'canvas', 'carry', 'shopping bag']),
  sample('book', ['#4a3a6b', '#c3b4e8'], 'Dive logbook', 'CS-LOG-006', 0, 33,
    'Waterproof cover, 100 dives.',
    'Ruled for a hundred dives with room for depth, time, gas and a sketch. The cover shrugs off spray; ' +
    'the paper takes pencil when wet.',
    ['Pages: 100 dive entries', 'Cover: Waterproof board', 'Size: A6, pocketable'],
    ['log book', 'notebook', 'journal', 'diary', 'dive log', 'paper']),
  sample('towel', ['#b0603a', '#f2c9a8'], 'Beach towel', 'CS-TWL-007', 24, 21,
    'Quick-dry microfibre, 160 x 80 cm.',
    'Packs down to the size of a paperback and dries between dives rather than after them.',
    ['Fabric: Microfibre, 220 gsm', 'Size: 160 x 80 cm', 'Care: Machine wash warm'],
    ['beach towel', 'microfibre', 'microfiber', 'quick dry', 'swim']),
  sample('sticker', ['#7a2f5e', '#eab4d6'], 'Sticker pack', 'CS-STK-008', 0, 0,
    'Eight vinyl stickers, waterproof.',
    'For tanks, laptops and the fridge in the galley. UV-stable vinyl, so they do not go pink by August.',
    ['Count: 8 stickers', 'Material: UV-stable vinyl', 'Size: 5 to 9 cm'],
    ['stickers', 'decals', 'vinyl', 'laptop', 'labels'])
];

/* The light falls from a different corner for each view, so the pictures don't look like copies. */
const GRADIENT: Record<View, [number, number, number, number]> = {
  Front: [0, 0, 1, 1],
  Back: [1, 0, 0, 1],
  Detail: [0, 1, 1, 0]
};

/*
 * The same drawing the mockup uses, as SVG, with the shape in the colour given:
 * the back is the shape flipped with a label patch where the neck tag would be,
 * the detail is the shape drawn bigger.
 */
export function sampleSvg(s: ISample, view: View = 'Front', fill: string = '#ffffff'): string {
  const [c1, c2] = s.tint;
  const [x1, y1, x2, y2] = GRADIENT[view];
  const scale = view === 'Detail' ? 1.5 : 1;
  const flip = view === 'Back' ? ' scale(-1,1)' : '';
  const tag = view === 'Back' ? '<rect x="88" y="60" width="24" height="16" rx="2" fill="#0b5d63" opacity=".55"/>' : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 150" width="800" height="600">
    <defs><linearGradient id="g" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">
      <stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
    <rect width="200" height="150" fill="url(#g)"/>
    <path d="M0,112 Q50,100 100,112 T200,112 L200,150 L0,150 Z" fill="#ffffff" opacity=".12"/>
    <g transform="translate(100,72) scale(${scale})${flip}" fill="${fill}" opacity=".92"><path d="${SHAPES[s.shape]}"/></g>
    ${tag}
    <text x="10" y="142" font-family="Segoe UI, sans-serif" font-size="9" fill="#ffffff" opacity=".8">${view}</text>
  </svg>`;
}

/* Turned into a PNG in the browser, so it uploads like any photo. */
function drawSamplePhoto(s: ISample, view: View = 'Front', fill?: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 600;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('This browser cannot draw the sample pictures.'));
        return;
      }
      ctx.drawImage(img, 0, 0, 800, 600);
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error('The sample picture did not draw.'))), 'image/png');
    };
    img.onerror = () => reject(new Error('The sample picture did not draw.'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(sampleSvg(s, view, fill));
  });
}

/**
 * A sample's pictures: front, back and detail of the product, front first so it
 * is the cover; then each view of each choice that has a look of its own.
 */
export async function sampleFiles(s: ISample): Promise<IProductFiles> {
  const code = s.draft.productCode.toLowerCase();
  const photos: INewPhoto[] = [];
  for (let i = 0; i < VIEWS.length; i++) {
    const content = await drawSamplePhoto(s, VIEWS[i]);
    photos.push({ at: i, file: { name: `${code}-${VIEWS[i].toLowerCase()}.png`, content } });
  }

  const looks = s.looks || {};
  const options = s.draft.options;
  const valuePhotos: IValuePhoto[] = [];
  for (let o = 0; o < options.length; o++) {
    for (let v = 0; v < options[o].values.length; v++) {
      const value = options[o].values[v].value;
      if (!Object.prototype.hasOwnProperty.call(looks, value)) continue;
      const views = looks[value].views;
      for (let i = 0; i < views.length; i++) {
        const content = await drawSamplePhoto(s, views[i], looks[value].fill);
        const name = `${code}-${value.toLowerCase()}-${views[i].toLowerCase()}.png`;
        valuePhotos.push({ option: o, value: v, at: i, file: { name, content } });
      }
    }
  }
  return { photos, valuePhotos };
}
