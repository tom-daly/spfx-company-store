/*
 * Words on the store's home: the screens before there are any products, the
 * notes after saving, the IT bar, the bar asking about unsaved changes and the
 * bar saying something didn't load.
 */
import { PRODUCTS_PAGE } from './manageProducts';
import { COMMON } from './common';

// The store home: the empty-store screens, the notes after saving and the IT bar.
export const HOME = {
  // Owners, before there are any products. Starts with the Products & stock page's own words on adding them.
  nextTitle: 'Next: add your products',
  nextBody: `${PRODUCTS_PAGE.howToAdd} Both are on the ${PRODUCTS_PAGE.title} page.`,
  // "Prices are in US dollar ($). [Change that in Settings] before you add any." is split around the link:
  pricesIn: (currency: string): string => `Prices are in ${currency}.`,
  changeInSettings: 'Change that in Settings',
  beforeYouAdd: 'before you add any.',
  goToProducts: `Go to ${PRODUCTS_PAGE.title}`,
  // Staff, before there are any products.
  emptyTitle: 'Nothing in the store yet',
  checkBackSoon: COMMON.checkBackSoon,
  seeMyOrders: 'See my orders',
  // Notes after the product editor and Customize.
  productAdded: (name: string): string => `${name} added.`,
  productSaved: (name: string): string => `${name} saved.`,
  productDeleted: (name: string): string => `${name} deleted.`,
  messagesSaved: 'Messages saved.',
  // "Needs IT. Ask a site collection administrator…" with the first sentence in bold, then a list of problems:
  needsItLead: 'Needs IT.',
  needsItAsk: 'Ask a site collection administrator to open this page and fix:'
};

// The bar asked on the way out of something with changes not saved yet.
export const UNSAVED = {
  message: "Your changes aren't saved yet.",
  discard: 'Throw them away',
  keep: 'Keep editing'
};

// The bar saying something didn't load, like "The shop could not load." and why.
export const LOAD_FAILED = {
  message: (lead: string, why: string): string => `${lead} ${why}`
};
