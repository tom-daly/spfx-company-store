/*
 * Words on the owners' Products & stock page: the table of products, the
 * stock opened under a row, the two-step Delete button, the product editor
 * and its photos, and the stock sheets they both use.
 */
import { plural, countText } from './plural';
import { COMBINATIONS, COMMON, PHOTOS, PRODUCTS } from './common';

// The Products & stock page: heading, buttons, search and the notes around the table.
export const PRODUCTS_PAGE = {
  title: 'Products & stock',
  // How to fill an empty store. The store home says it too.
  howToAdd: 'Add each thing the store sells, with a photo and how many you have. Or put ' +
    'in the sample products to see how the store looks — you can delete them later.',
  loading: 'Loading the products…',
  // Followed by why.
  loadFailed: "The products didn't load.",
  emptyTitle: 'No products yet',
  add: '+ Add product',
  addSamples: 'Add sample products',
  // While the sample products go in, like "Adding Reef crew tee (2 of 8)…".
  addingSample: (name: string, step: number, steps: number): string => `Adding ${name} (${step} of ${steps})…`,
  samplesAdded: (count: number): string =>
    plural(count, { one: 'Added a sample product.', other: `Added ${count} sample products.` }),
  samplesAlreadyIn: 'The sample products are already in.',
  deleted: (name: string): string => `${name} deleted.`,
  deleteFailed: (name: string, error: string): string => `${name} wasn't deleted. ${error}`,
  switchOnFailed: (name: string, error: string): string => `${name} wasn't switched on. ${error}`,
  switchOffFailed: (name: string, error: string): string => `${name} wasn't switched off. ${error}`,
  searchPlaceholder: 'Search products',
  searchLabel: 'Search products',
  // Read out for the row of filter buttons.
  filtersLabel: 'Show',
  // Read out as the search or filter changes, like "3 products shown".
  shownCount: (count: number): string => `${countText(count, PRODUCTS)} shown`,
  // After the words saying nothing matches.
  showAll: 'Show every product'
};

// The filter buttons above the products table.
export const PRODUCT_FILTERS = {
  all: 'All',
  low: 'Running low',
  out: 'Out of stock',
  off: COMMON.off
};

// The column headings of the products table. "Price" is COMMON.price.
export const PRODUCT_COLUMNS = {
  // Read out only.
  photo: 'Photo',
  product: 'Product',
  variesBy: 'Varies by',
  stock: 'Stock',
  active: 'Active',
  // Read out only.
  actions: 'Change or delete'
};

// One product's row in the table.
export const PRODUCT_ROW = {
  activeLabel: (name: string): string => `Active, ${name}`,
  on: COMMON.on,
  off: COMMON.off,
  savingLabel: (name: string): string => `Saving ${name}`,
  stock: 'Stock',
  stockLabel: (name: string): string => `Stock of ${name}`,
  edit: 'Edit',
  editLabel: (name: string): string => `Edit ${name}`
};

// Delete in two steps: the first press asks, the second deletes. The way back is COMMON.cancel unless set.
export const CONFIRM_DELETE = {
  delete: 'Delete',
  // Read out on a row's Delete button, like "Delete Reef crew tee".
  deleteLabel: (name: string): string => `Delete ${name}`,
  reallyDelete: 'Really delete?',
  reallyDeleteLabel: (name: string): string => `Really delete ${name}?`,
  deleting: 'Deleting…'
};

// A product's stock, opened under its row.
export const STOCK_DRAWER = {
  label: (name: string): string => `Stock of ${name}`,
  opening: 'Opening the stock…',
  openFailed: (error: string): string => `The stock didn't open. ${error}`,
  tooMany: (name: string, count: number): string =>
    `${name} has ${countText(count, COMBINATIONS)}, too many to list here. Take some choices away in the editor.`,
  save: 'Save stock',
  saved: 'Stock saved.',
  saveFailed: (error: string): string => `The stock didn't all save. ${error} Press Save stock to try again.`,
  reloadFailed: (error: string): string => `The stock saved, but it didn't load again to show you. ${error}`
};

// The stock sheets: a box for each combination, in the editor and under a row. "Price" is COMMON.price.
export const STOCK_GRID = {
  inStock: 'In stock',
  priceIfDifferent: 'Price (if different)',
  // Read out for each box, like "In stock, Reef crew tee, White · M". The product is named when there are several.
  boxLabel: (what: string, combination: string, product?: string): string =>
    (product ? `${what}, ${product}, ${combination}` : `${what}, ${combination}`),
  // The top-left corner of a sheet, naming the option down the side and the one across, like "Size / Colour".
  corner: (down: string, across: string): string => `${down} / ${across}`,
  // Above each sheet when there's a third option, like "Fit: Relaxed", then how many in that sheet.
  sheetTitle: (option: string, choice: string): string => `${option}: ${choice}`,
  sheetTotal: (count: number): string => `${count} in stock`,
  // Read out for the one box of a product that comes one way only.
  inStockOf: (name: string): string => `In stock, ${name}`,
  intro: (count: number): string => `${countText(count, COMBINATIONS)}. Set how many of each you have.`,
  ownPrices: 'Some combinations cost more or less than the usual price',
  ownPricesOf: (name: string): string => `Some combinations of ${name} cost more or less than the usual price`,
  fillLabel: 'Same number in every box',
  fillLabelOf: (name: string): string => `Same number in every box for ${name}`,
  fill: 'Fill',
  // "Total in stock: 12. A combination with nothing left…" with the first sentence in bold:
  total: (count: number): string => `Total in stock: ${count}.`,
  soldOutNote: "A combination with nothing left stays on the page but can't be ordered."
};

// The product editor: adding a product or changing one.
export const PRODUCT_EDITOR = {
  titleAdd: 'Add a product',
  titleEdit: (name: string): string => `Edit ${name}`,
  // Before the product's name has loaded.
  titleEditPlain: 'Edit product',
  // The way back to the products table.
  back: PRODUCTS_PAGE.title,
  delete: 'Delete product',
  keep: 'Keep it',
  opening: 'Opening the product…',
  openFailed: (error: string): string => `The product didn't open. ${error}`,
  deleteFailed: (name: string, error: string): string => `${name} wasn't deleted. ${error}`,
  // The product's name when none is typed yet: at the start of a sentence, and inside one.
  fallbackName: 'The product',
  fallbackNameInline: 'the product',
  details: 'Details',
  name: 'Name',
  namePlaceholder: 'Reef crew tee',
  shortDescription: 'Short description',
  shortDescriptionHint: 'One line, shown on the product card.',
  longDescription: 'Full description',
  detailsField: 'Details',
  // The shop splits each line at the colon, so the example keeps one.
  detailsHint: 'One per line, like  Fabric: organic cotton',
  productCode: 'Product code',
  searchWords: 'Search words',
  searchWordsHint: 'Words people might search for that are not in the name, separated by commas.',
  active: 'Active',
  activeOn: 'Active',
  activeOff: 'Off — saved but not in the store',
  // The price box's label once there are options. Without them it's COMMON.price.
  usualPrice: 'Usual price',
  usualPriceHint: 'Used by any combination without its own price below.',
  priceHint: 'Leave at 0 and it shows as Free.',
  photos: 'Photos',
  photosHint: 'The first one is the cover. Drop files in, or choose them.',
  options: 'What it varies by',
  optionsHint: 'Up to three things, like size and colour. Leave this empty for something that comes one way only.',
  option: (n: number): string => `Option ${n}`,
  optionNameLabel: (n: number): string => `Option ${n} name`,
  // An option with no name yet, inside a sentence like "Remove option 2".
  optionFallback: (n: number): string => `option ${n}`,
  remove: 'Remove',
  // Read out for a remove button, like "Remove Colour" or "Remove White".
  removeLabel: (what: string): string => `Remove ${what}`,
  // "Choices (type several at once, with commas between)" with the second part as a hint:
  choices: 'Choices',
  choicesHint: '(type several at once, with commas between)',
  // A choice with nothing typed yet, inside a sentence like "Remove choice 2".
  choiceFallback: (n: number): string => `choice ${n}`,
  choiceLabel: (n: number, option: string): string => `Choice ${n} for ${option}`,
  addChoice: '+ Add a choice',
  addOption: '+ Add an option',
  stock: 'Stock and prices',
  stockHint: 'Type the choices above, and a stock box for each one appears here.',
  tooMany: (count: number): string =>
    `That makes ${countText(count, COMBINATIONS)}, too many to list. Take some choices away above.`
};

// The product editor's photos, the product's own and each choice's. "of" is the product's name or a choice.
export const PRODUCT_PHOTOS = {
  // Read out for the product's own photos.
  label: 'Photos',
  labelOf: (of: string): string => `Photos of ${of}`,
  add: 'Add photos',
  addOf: (of: string): string => `Add photos of ${of}`,
  // The small square beside a choice that shows its photos underneath.
  showOf: (of: string): string => `Show the photos of ${of}`,
  hideOf: (of: string): string => `Hide the photos of ${of}`,
  tileShowLabel: (count: number, of: string): string => `${countText(count, PHOTOS)} of ${of}. Show them.`,
  tileHideLabel: (count: number, of: string): string => `${countText(count, PHOTOS)} of ${of}. Hide them.`,
  coverAlt: (of: string): string => `Cover photo of ${of}`,
  photoAlt: (n: number, of: string): string => `Photo ${n} of ${of}`,
  // Read out for the buttons on each photo: "Remove photo 2", or "Remove photo 2 of White" for a choice's photos.
  remove: (n: number, of?: string): string => (of ? `Remove photo ${n} of ${of}` : `Remove photo ${n}`),
  moveEarlier: (n: number, of?: string): string =>
    (of ? `Move photo ${n} of ${of} earlier` : `Move photo ${n} earlier`),
  moveLater: (n: number, of?: string): string => (of ? `Move photo ${n} of ${of} later` : `Move photo ${n} later`),
  makeCoverLabel: (n: number): string => `Make photo ${n} the cover`,
  cover: 'Cover',
  makeCover: 'Make cover'
};
