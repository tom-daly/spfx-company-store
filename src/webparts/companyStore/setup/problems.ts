import { STORE_LISTS, IFieldDef, IListDef, ListIds, ListKey, keepsOwnRows, listDef } from './schema';
import { CAN_ADD, CAN_CHANGE_LIST, IAssignment, hasLevel, hasStaff, sameLogin } from './permissions';

/* What the store needs to know about the site and the person looking at it. */
export interface ISiteInfo {
  webUrl: string;
  webServerRelativeUrl: string;
  everyoneLogin: string;
  currentUserId: number;
  /** The person looking, for orders and the order email. */
  user: { name: string; email: string };
  /** Can make lists and change who sees them — so can run setup. */
  isOwner: boolean;
  /** The store page's own address, without anything after ? or #, for links in emails. */
  pageUrl: string;
}

export const listServerUrl = (site: ISiteInfo, def: IListDef): string =>
  `${site.webServerRelativeUrl.replace(/\/$/, '')}/Lists/${def.urlName}`;

export const listWebUrl = (site: ISiteInfo, def: IListDef): string =>
  `${site.webUrl.replace(/\/$/, '')}/Lists/${def.urlName}`;

/** The orders list, opened in SharePoint: where the store team works the orders. */
export const ordersListUrl = (site: ISiteInfo): string => listWebUrl(site, listDef('orders'));

export interface IListState {
  exists: boolean;
  id?: string;
  hidden?: boolean;
  noCrawl?: boolean;
  versioning?: boolean;
  readSecurity?: number;
  writeSecurity?: number;
  uniquePermissions?: boolean;
  /** The person looking can change this list's columns and settings. */
  canManage?: boolean;
  fields?: string[];
  /** The choices each choice column has now, by internal name. */
  choices?: Record<string, string[]>;
  /** Who has a way in. Missing when the person looking is not allowed to see that. */
  access?: IAssignment[];
}

/** The Store managers group. */
export interface IGroupState {
  exists: boolean;
  id?: number;
}

/** The folder in Site Assets that product photos go in. */
export interface IFolderState {
  exists: boolean;
  /** It has permissions of its own, rather than the library's. */
  uniquePermissions?: boolean;
  /** Who has a way in. Missing when the person looking is not allowed to see that. */
  access?: IAssignment[];
}

/**
 * The store's lists, by key. The full check for site owners also reads the
 * Store managers group and the photo folder; for everyone else those are missing.
 */
export type StoreState = Record<ListKey, IListState> & {
  managers?: IGroupState;
  photos?: IFolderState;
};

export interface IProblem {
  /** The list it is about. Missing for the Store managers group and the photo folder. */
  list?: ListKey;
  text: string;
  /** The person looking can fix it. If not, it needs IT (a site collection admin). */
  fixable: boolean;
}

/* Item-level permission settings: 2 = only the rows they created. */
export const OWN_ROWS = 2;

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Everything about the site that does not match the schema, in plain words. */
export function findProblems(state: StoreState, everyoneLogin: string): IProblem[] {
  const out: IProblem[] = [];

  for (const def of STORE_LISTS) {
    const s = state[def.key];
    if (!s || !s.exists) {
      out.push({ list: def.key, text: `${def.title} hasn't been made yet.`, fixable: true });
      continue;
    }
    const add = (text: string): void => { out.push({ list: def.key, text, fixable: !!s.canManage }); };

    const missing = missingFields(def, s);
    if (missing.length) {
      add(`${def.title} is missing ${plural(missing.length, 'column')}: ${missing.map(f => f.title).join(', ')}.`);
    }
    missingChoices(def, s).forEach(m => {
      add(`The ${m.title} column in ${def.title} is missing ${plural(m.choices.length, 'choice')}: ${m.choices.join(', ')}.`);
    });
    if (s.hidden !== undefined && s.hidden !== def.hidden) {
      add(def.hidden ? `${def.title} still shows in the site contents.` : `${def.title} is hidden from the site contents.`);
    }
    if (!def.searchable && s.noCrawl === false) add(`${def.title} still shows up in search.`);
    if (!def.keepVersions && s.versioning) add(`${def.title} keeps old copies of every change.`);

    if (def.access === 'site') continue;

    if (staffLetIn(s, everyoneLogin) === false) add(`Staff can't add to ${def.title} yet.`);

    if (keepsOwnRows(def) && (s.readSecurity !== OWN_ROWS || s.writeSecurity !== OWN_ROWS)) {
      add(`Staff could see each other's rows in ${def.title}.`);
    }
    if (def.access === 'ownRowsOnly' && othersCanOpen(s, everyoneLogin) === true) {
      add(`Site owners can still open ${def.title}.`);
    }
  }

  // Store managers, once the full check has looked. Until the group is made, that one line says it all.
  if (!state.managers) return out;
  const groupId = managersGroupId(state);
  if (groupId === undefined) {
    out.push({ text: 'The Store managers group hasn\'t been made yet.', fixable: true });
    return out;
  }
  for (const def of STORE_LISTS) {
    const s = state[def.key];
    if (def.managers && s && s.exists && managersCanChange(s, groupId) === false) {
      out.push({ list: def.key, text: `Store managers can't change ${def.title} yet.`, fixable: !!s.canManage });
    }
  }
  if (managersCanAddPhotos(state.photos, groupId) === false) {
    out.push({ text: 'Store managers can\'t add product photos yet.', fixable: true });
  }
  return out;
}

/** The Store managers group's ID, when it is there. */
export function managersGroupId(state: StoreState): number | undefined {
  return state.managers && state.managers.exists ? state.managers.id : undefined;
}

/**
 * Whether store managers can change every row of a list. Undefined when the
 * person looking can't see who has access. Limited Access doesn't count.
 */
export function managersCanChange(s: IListState, groupId: number): boolean | undefined {
  return s.access ? hasLevel(s.access, groupId, CAN_CHANGE_LIST) : undefined;
}

/** Columns the list should have but doesn't. All of them for a list about to be made (`s` undefined). */
export function missingFields(def: IListDef, s: IListState | undefined): IFieldDef[] {
  const have = (s && s.fields) || [];
  return def.fields.filter(f => have.indexOf(f.name) < 0);
}

/**
 * Whether staff can get into a list: it has permissions of its own, with
 * everyone in the organisation on it. Undefined when the person looking can't
 * see who has access.
 */
export function staffLetIn(s: IListState, everyoneLogin: string): boolean | undefined {
  if (!s.uniquePermissions) return false;
  return s.access ? hasStaff(s.access, everyoneLogin) : undefined;
}

/**
 * Whether anyone besides staff can still open a list: it follows the site, or
 * someone other than everyone in the organisation is on it. Undefined when the
 * person looking can't see who has access.
 */
export function othersCanOpen(s: IListState, everyoneLogin: string): boolean | undefined {
  if (!s.uniquePermissions) return true;
  return s.access ? s.access.some(a => !sameLogin(a.loginName, everyoneLogin)) : undefined;
}

/** Whether store managers can add product photos. Undefined when that can't be told. */
export function managersCanAddPhotos(photos: IFolderState | undefined, groupId: number): boolean | undefined {
  if (!photos || !photos.exists) return false;
  return photos.access ? hasLevel(photos.access, groupId, CAN_ADD) : undefined;
}

/** Choice columns that are there but lack choices a newer version of the store brings. */
export function missingChoices(def: IListDef, s: IListState): { name: string; title: string; choices: string[] }[] {
  const have = s.fields || [];
  const out: { name: string; title: string; choices: string[] }[] = [];
  def.fields.forEach(f => {
    if (!f.choices || have.indexOf(f.name) < 0 || !s.choices || !s.choices[f.name]) return;
    const now = s.choices[f.name];
    const lacking = f.choices.filter(c => now.indexOf(c) < 0);
    if (lacking.length) out.push({ name: f.name, title: f.title, choices: lacking });
  });
  return out;
}

/** True when every list exists — enough for staff to use the store. */
export const allListsExist = (state: StoreState): boolean =>
  STORE_LISTS.every(def => state[def.key] && state[def.key].exists);

/** The IDs of the lists that exist, for reading and writing rows. */
export function listIds(state: StoreState): ListIds {
  const ids: ListIds = {};
  STORE_LISTS.forEach(def => { if (state[def.key] && state[def.key].id) ids[def.key] = state[def.key].id; });
  return ids;
}
