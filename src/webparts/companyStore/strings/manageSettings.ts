/*
 * Words on the owners' Settings page and its list of store managers, and on
 * the row of pages along the top of the store that owners see.
 */
import { COMMON, METHOD_TITLES } from './common';
import { PRODUCTS_PAGE } from './manageProducts';

// The row of pages along the top of the store, for site owners and store managers.
export const MANAGE_NAV = {
  // Read out for the row as a whole.
  label: 'Run the store',
  shop: 'Shop',
  products: PRODUCTS_PAGE.title,
  orders: 'Orders',
  settings: 'Settings',
  customize: 'Customize'
};

// The Settings page. Save, Saving… and the rest shared with other screens are in COMMON.
export const SETTINGS_PAGE = {
  title: 'Settings',
  intro: 'These apply to the whole store, on every page it appears.',
  currency: 'Currency',
  orderPrefix: 'Order numbers start with',
  // With the start as typed, like "Orders will be numbered CS-0001, CS-0002 and so on."
  orderPrefixHint: (prefix: string): string =>
    `Like CS- for CS-0042. Orders will be numbered ${prefix}0001, ${prefix}0002 and so on.`,
  orderEmails: 'Who gets order emails',
  // The store splits the addresses at the commas.
  orderEmailsHint: 'One or more email addresses, separated by commas. A shared mailbox works too.',
  methods: 'How people get their order',
  pickUp: METHOD_TITLES['Pick up'],
  delivery: METHOD_TITLES.Delivery,
  on: COMMON.on,
  off: COMMON.off,
  saved: 'Saved.',
  messages: 'Messages',
  messagesIntro: 'The pick-up and delivery instructions, the message after an order and the order email are ' +
    'changed on the screens themselves, so you can see them as staff will.',
  customize: 'Customize the messages',
  lists: 'SharePoint lists',
  listsIntro: "The store keeps everything in SharePoint lists. You won't need them day to day, but you can " +
    'open them to see the rows themselves.'
};

// The store managers, on the Settings page.
export const STORE_MANAGERS = {
  title: 'Store managers',
  intro: 'Store managers can run the store: add and change products, update stock, handle orders and change ' +
    'these settings. Site owners always can.',
  loading: 'Loading store managers…',
  loadFailed: (error: string): string => `The store managers couldn't be loaded. ${error}`,
  // An older site that hasn't had Fix it run since store managers came in. Names the setup screen's button.
  noGroup: 'Run Fix it to turn on store managers.',
  none: "There aren't any store managers yet.",
  removeLabel: (name: string): string => `Remove ${name}`,
  // The search box for adding someone, and what its list of suggestions says.
  addLabel: 'Add a person',
  pickerHeader: 'People',
  pickerNoResults: 'No one found',
  pickerSearching: 'Searching…',
  // For store managers, who can see the list but not change it.
  askOwner: 'Ask a site owner to add or remove store managers.',
  adding: (name: string): string => `Adding ${name}…`,
  added: (name: string): string => `${name} is a store manager now.`,
  removing: (name: string): string => `Removing ${name}…`,
  removed: (name: string): string => `${name} isn't a store manager any more.`,
  searchFailed: (error: string): string => `Searching for people didn't work. ${error}`,
  addFailed: (name: string, error: string): string => `${name} couldn't be added. ${error}`,
  removeFailed: (name: string, error: string): string => `${name} couldn't be removed. ${error}`
};
