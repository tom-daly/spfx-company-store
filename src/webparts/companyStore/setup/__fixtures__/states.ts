import { STORE_LISTS, ListKey, MANAGERS_GROUP, keepsOwnRows } from '../schema';
import { RoleType, everyoneClaim } from '../permissions';
import { IListState, StoreState, OWN_ROWS } from '../problems';

export const EVERYONE = everyoneClaim('tenant');
export const OWNERS = { principalId: 3, loginName: 'Store Owners', roles: [RoleType.administrator] };
export const STAFF = { principalId: 9, loginName: EVERYONE, roles: [RoleType.contributor] };
export const MANAGERS = { principalId: 20, loginName: MANAGERS_GROUP, roles: [RoleType.editor] };

/* Store managers with only the Limited Access SharePoint hands out on its own, which opens nothing. */
export const LIMITED_MANAGERS = { ...MANAGERS, roles: [RoleType.guest] };

/* The new order columns and status this version brings. */
const NEW_ORDER_COLUMNS = ['ReadyBy', 'Tracking', 'PickedUpOn'];

/* A site exactly as setup leaves it, seen by a site owner who is not IT. */
export function healthy(): StoreState {
  const state = {} as StoreState;
  for (const def of STORE_LISTS) {
    const s: IListState = {
      exists: true,
      id: def.key,
      hidden: def.hidden,
      noCrawl: !def.searchable,
      versioning: def.keepVersions,
      readSecurity: 1,
      writeSecurity: 1,
      // Lists the store managers run have permissions of their own, even ones that otherwise follow the site.
      uniquePermissions: def.access !== 'site' || def.managers,
      canManage: true,
      fields: def.fields.map(f => f.name),
      choices: def.fields.reduce<Record<string, string[]>>((all, f) => {
        if (f.choices) all[f.name] = f.choices;
        return all;
      }, {}),
      access: [OWNERS, ...(def.access === 'site' ? [] : [STAFF]), ...(def.managers ? [MANAGERS] : [])]
    };
    if (keepsOwnRows(def)) {
      s.readSecurity = OWN_ROWS;
      s.writeSecurity = OWN_ROWS;
    }
    if (def.access === 'ownRowsOnly') {
      // locked: the owner reaches it only as a member of staff
      s.canManage = false;
      s.access = undefined;
    }
    state[def.key] = s;
  }
  state.managers = { exists: true, id: MANAGERS.principalId };
  state.photos = {
    exists: true,
    uniquePermissions: true,
    access: [OWNERS, STAFF, { ...MANAGERS, roles: [RoleType.contributor] }]
  };
  return state;
}

export function empty(): StoreState {
  const state = {} as StoreState;
  STORE_LISTS.forEach(def => { state[def.key] = { exists: false }; });
  state.managers = { exists: false };
  state.photos = { exists: false };
  return state;
}

export const change = (state: StoreState, key: ListKey, patch: Partial<IListState>): StoreState =>
  ({ ...state, [key]: { ...state[key], ...patch } });

/*
 * A healthy site whose Status column was made before Confirmed and the pick-up
 * statuses, with a status added by hand.
 */
export function oldStatusColumn(): StoreState {
  const before = healthy().orders.choices || {};
  return change(healthy(), 'orders', { choices: { ...before, OrderStatus: ['New', 'Packed', 'Shipped', 'On hold'] } });
}

/*
 * A site the last version of the store set up: no Store managers group, no
 * photo folder, products and settings still following the site, and an orders
 * list without the newest columns and the Confirmed status.
 */
export function lastVersion(): StoreState {
  const now = healthy();
  const state = {} as StoreState;
  for (const def of STORE_LISTS) {
    const s = now[def.key];
    state[def.key] = {
      ...s,
      uniquePermissions: def.access !== 'site',
      access: s.access && s.access.filter(a => a.principalId !== MANAGERS.principalId)
    };
  }
  state.orders = {
    ...state.orders,
    fields: (state.orders.fields || []).filter(f => NEW_ORDER_COLUMNS.indexOf(f) < 0),
    choices: { ...state.orders.choices, OrderStatus: ['New', 'Packed', 'Shipped', 'Ready for pick-up', 'Picked up'] }
  };
  state.managers = { exists: false };
  state.photos = { exists: false };
  return state;
}
