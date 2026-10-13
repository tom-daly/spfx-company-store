/*
 * Words for setting the store up: the first-time and fix-it screens, the
 * progress list and its step names, the problems the check finds, and why a
 * step didn't work. The list, column and view names themselves stay with the
 * list definitions in setup/schema.ts, as SharePoint is given those.
 */
import type { ListKey } from '../setup/schema';
import type { StepState } from '../setup/plan';
import { IPlural, countText, plural } from './plural';
import { COMMON } from './common';

// Counting words for a list's columns: "1 column", "3 columns".
export const COLUMNS: IPlural = { one: 'column', other: 'columns' };

// Counting words for a column's choices: "1 choice", "3 choices".
export const CHOICES: IPlural = { one: 'choice', other: 'choices' };

// Counting words for a list's views: "view", "views".
export const LIST_VIEWS: IPlural = { one: 'view', other: 'views' };

// While the page checks the site, and what staff see before the store is set up.
export const STORE_OPENING = {
  // Spinner while the page checks the site.
  opening: 'Opening the store…',
  // The check itself failed; the reason is SharePoint's own words.
  couldNotOpen: (reason: string): string => `The store could not open. ${reason}`,
  // Staff, when the lists aren't there yet.
  notOpenTitle: 'The store isn\'t open yet',
  checkBackSoon: COMMON.checkBackSoon,
  // Shown once, back on the store, after setup has finished.
  setUpNotice: 'The store is set up. Next, add your products.'
};

// The site owner's setup screen, the first time and when something needs fixing.
export const SETUP_SCREEN = {
  // First time: heading and button.
  firstTitle: 'Set up the store',
  run: 'Set up the store',
  firstIntro: (listCount: number): string =>
    `This makes ${listCount} lists and a Store managers group on this site, and decides who can see what. ` +
    'It only needs doing once.',
  // What each list is for and who can see it, in the words a site owner needs.
  whoSees: {
    settings: 'Currency, order numbers, pick-up and delivery. Site owners and store managers change them from ' +
      'the store page. Hidden from the site contents.',
    products: 'What the store sells. Staff can look; site owners and store managers edit it.',
    stock: 'How many of each are left. Staff can change the numbers, so checkout can take items off. ' +
      'Hidden from the site contents.',
    orders: 'One row per order. Staff see only their own; site owners and store managers see them all.',
    addresses: 'Where to send orders. Each person sees only their own. Site owners and store managers can\'t ' +
      'open it either — only IT can. Hidden from the site contents.'
  } as Record<ListKey, string>,
  // The group setup makes, said the same way as the lists.
  managersTerm: 'Store managers',
  managersSay: 'The people who run the store day to day: products, stock, orders and settings. ' +
    'They can add product photos too. You add them on the store\'s Settings page once it\'s set up.',
  addressWarning: 'Once this runs, site owners can\'t open the address list, and only IT can change it.',
  // When something is missing or was changed by hand.
  fixTitle: 'The store needs a fix',
  fixIntro: 'Something is missing or has been changed by hand. Staff may not be able to order until it is put right.',
  fix: 'Fix it',
  // Problems the person looking hasn't the rights to fix.
  needsItTitle: 'Needs IT',
  needsItIntro: 'You don\'t have the rights to change these. Ask IT (a site collection administrator) to open ' +
    'this page — they\'ll see the same button and it will put these right too.'
};

// Read out by screen readers in place of each step's coloured mark.
export const STEP_STATES: Record<StepState, string> = {
  waiting: 'to do',
  running: 'in progress',
  done: 'done',
  failed: 'failed',
  skipped: 'skipped'
};

// The list of steps as setup works through them.
export const SETUP_PROGRESS = {
  // Spinner while setup works out what to do.
  checking: 'Checking what is already there…',
  // Headings: still going, finished with some not done, all done.
  workingTitle: 'Setting up the store',
  notFinishedTitle: 'Setup didn\'t finish',
  doneTitle: 'The store is set up',
  stepOf: (current: number, total: number): string => `Step ${current} of ${total}`,
  allDone: (total: number): string => (total === 1 ? 'The step is done.' : `All ${total} steps are done.`),
  nothingToDo: 'Nothing needed doing.',
  someFailed: (failed: number, total: number): string =>
    `${failed} of ${total} steps didn't work. Trying again picks up where it stopped.`,
  // After each step's name, for screen readers, like " — done".
  stepState: (state: StepState): string => ` — ${STEP_STATES[state]}`,
  openStore: 'Open the store'
};

// The name of each setup step, as the progress list shows it.
export const SETUP_STEPS = {
  makeList: (list: string): string => `Make the ${list} list`,
  addColumn: (column: string, list: string): string => `Add the ${column} column to ${list}`,
  addColumns: (count: number, list: string): string => `Add ${countText(count, COLUMNS)} to ${list}`,
  // `choices` already in words, like "Confirmed, Packed and Shipped".
  addChoices: (choices: string, column: string, list: string): string =>
    `Add ${choices} to the ${column} column in ${list}`,
  setUpViews: (views: string[]): string =>
    `Set up the ${views.map(v => `"${v}"`).join(' and ')} ${plural(views.length, LIST_VIEWS)}`,
  // A list's settings: "Store stock: hide it from the site contents and keep it out of search".
  settings: (list: string, changes: string): string => `${list}: ${changes}`,
  // The pieces of that, lower case, as they sit in the middle of it.
  hide: 'hide it from the site contents',
  show: 'show it in the site contents',
  noSearch: 'keep it out of search',
  noVersions: 'stop keeping old copies',
  ownRows: 'let each person see only their own rows',
  staffEdits: (list: string): string => `Let staff update the numbers in ${list}`,
  staffAddOwn: (list: string): string => `Let staff add their own rows to ${list}`,
  lockOut: (list: string): string => `Lock ${list} so site owners can't open it`,
  makeGroup: 'Make the Store managers group',
  managersAccess: (list: string): string => `Let store managers change ${list}`,
  managersPhotos: 'Let store managers add product photos'
};

// What the check finds wrong with the site, on the setup and fix-it screens.
export const SETUP_PROBLEMS = {
  listMissing: (list: string): string => `${list} hasn't been made yet.`,
  columnsMissing: (list: string, columns: string[]): string =>
    `${list} is missing ${countText(columns.length, COLUMNS)}: ${columns.join(', ')}.`,
  choicesMissing: (column: string, list: string, choices: string[]): string =>
    `The ${column} column in ${list} is missing ${countText(choices.length, CHOICES)}: ${choices.join(', ')}.`,
  stillShows: (list: string): string => `${list} still shows in the site contents.`,
  hidden: (list: string): string => `${list} is hidden from the site contents.`,
  inSearch: (list: string): string => `${list} still shows up in search.`,
  keepsVersions: (list: string): string => `${list} keeps old copies of every change.`,
  staffCantAdd: (list: string): string => `Staff can't add to ${list} yet.`,
  staffSeeOthers: (list: string): string => `Staff could see each other's rows in ${list}.`,
  ownersCanOpen: (list: string): string => `Site owners can still open ${list}.`,
  noManagersGroup: 'The Store managers group hasn\'t been made yet.',
  managersCantChange: (list: string): string => `Store managers can't change ${list} yet.`,
  managersCantAddPhotos: 'Store managers can\'t add product photos yet.'
};

// Why a setup step didn't happen, shown under it on the progress list.
export const SETUP_ERRORS = {
  // Skipped, because an earlier step failed to make what it needs.
  skippedNoList: (list: string): string => `Skipped because ${list} wasn't made.`,
  skippedNoGroup: 'Skipped because the Store managers group couldn\'t be made.',
  noManagersGroup: 'The Store managers group isn\'t there.',
  listGone: (list: string): string => `${list} isn't there.`,
  // One column that wouldn't go in, and SharePoint's reason.
  columnFailed: (column: string, reason: string): string => `${column} (${reason})`,
  columnsNotAdded: (failed: string[]): string => `Couldn't add ${failed.join('; ')}`,
  // A column that points at another list, made before that list.
  lookupBeforeList: (list: string, column: string): string =>
    `The ${list} list has to exist before ${column} can point at it.`,
  staffNotInYet: 'Staff are not on the list yet, so it was left open to site owners for now.',
  noOwnersGroup: 'This site has no Owners group to look after the Store managers group.'
};
