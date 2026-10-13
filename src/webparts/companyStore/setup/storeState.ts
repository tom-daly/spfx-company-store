import type { SPFI } from '../sp';
import type { IList } from '@pnp/sp/lists';
import { PermissionKind } from '@pnp/sp/security';
import { STORE_LISTS, IListDef, MANAGERS_GROUP, PHOTO_FOLDER, SITE_ASSETS } from './schema';
import { IAssignment } from './permissions';
import { ISiteInfo, IListState, IFolderState, IGroupState, StoreState, listServerUrl } from './problems';
import { isDenied } from './errors';

/**
 * One call finds which of the store's lists exist. Lists are trimmed to what
 * the person looking may see, so for staff "missing" and "not allowed" look
 * the same — either way the store is not ready for them.
 *
 * `detail` adds settings, columns and who has access, for the owner's check,
 * along with the Store managers group and the photo folder.
 */
export async function readStoreState(sp: SPFI, site: ISiteInfo, detail: boolean): Promise<StoreState> {
  const all = await sp.web.lists.select('Id', 'RootFolder/ServerRelativeUrl').expand('RootFolder').top(5000)();
  const byUrl: Record<string, string> = {};
  all.forEach(l => { byUrl[l.RootFolder.ServerRelativeUrl.toLowerCase()] = l.Id; });

  const state = {} as StoreState;
  await Promise.all(STORE_LISTS.map(async def => {
    const id = byUrl[listServerUrl(site, def).toLowerCase()];
    state[def.key] = !id ? { exists: false }
      : detail ? await readList(sp.web.lists.getById(id), def, id)
      : { exists: true, id };
  }));
  if (!detail) return state;

  const assetsUrl = `${site.webServerRelativeUrl.replace(/\/$/, '')}/${SITE_ASSETS}`;
  const [managers, photos] = await Promise.all([
    readGroup(sp),
    byUrl[assetsUrl.toLowerCase()]
      ? readFolder(sp, `${assetsUrl}/${PHOTO_FOLDER}`)
      : Promise.resolve<IFolderState>({ exists: false })
  ]);
  return { ...state, managers, photos };
}

async function readList(list: IList, def: IListDef, id: string): Promise<IListState> {
  const [info, fields, access] = await Promise.all([
    list.select('Hidden', 'NoCrawl', 'EnableVersioning', 'ReadSecurity', 'WriteSecurity',
      'HasUniqueRoleAssignments', 'EffectiveBasePermissions')(),
    list.fields.select('InternalName')(),
    def.access === 'site' && !def.managers ? Promise.resolve(undefined) : readAccess(list)
  ]);
  // Each choice column's choices, so a column made by an older version can get any new ones.
  const choiceFields = def.fields.filter(f => !!f.choices && fields.some(x => x.InternalName === f.name));
  const read = await Promise.all(choiceFields.map(async (f): Promise<[string, string[]]> => {
    const got = await list.fields.getByInternalNameOrTitle(f.name).select('Choices')();
    const raw = (got as unknown as { Choices?: string[] | { results?: string[] } }).Choices;
    return [f.name, Array.isArray(raw) ? raw : raw && raw.results ? raw.results : []];
  }));
  const choices: Record<string, string[]> = {};
  read.forEach(([name, list]) => { choices[name] = list; });
  return {
    exists: true,
    id,
    choices,
    hidden: info.Hidden,
    noCrawl: info.NoCrawl,
    versioning: info.EnableVersioning,
    readSecurity: info.ReadSecurity,
    writeSecurity: info.WriteSecurity,
    uniquePermissions: (info as unknown as { HasUniqueRoleAssignments: boolean }).HasUniqueRoleAssignments,
    canManage: list.hasPermissions(info.EffectiveBasePermissions, PermissionKind.ManageLists),
    fields: fields.map(f => f.InternalName),
    access
  };
}

/** The Store managers group's ID, found by its name, or undefined if it hasn't been made. */
export async function findManagersGroup(sp: SPFI): Promise<number | undefined> {
  const found = await sp.web.siteGroups
    .filter(`Title eq '${MANAGERS_GROUP.replace(/'/g, "''")}'`)
    .select('Id')();
  return found.length ? found[0].Id : undefined;
}

async function readGroup(sp: SPFI): Promise<IGroupState> {
  const id = await findManagersGroup(sp);
  return id === undefined ? { exists: false } : { exists: true, id };
}

/** Whether there is a folder at this address. */
export async function folderExists(sp: SPFI, folderUrl: string): Promise<boolean> {
  try {
    return (await sp.web.getFolderByServerRelativePath(folderUrl).select('Exists')()).Exists;
  } catch {
    // not there yet
    return false;
  }
}

/** Makes the folder at this address, unless it is there already. */
export async function ensureFolder(sp: SPFI, folderUrl: string): Promise<void> {
  if (!(await folderExists(sp, folderUrl))) await sp.web.folders.addUsingPath(folderUrl);
}

async function readFolder(sp: SPFI, folderUrl: string): Promise<IFolderState> {
  if (!(await folderExists(sp, folderUrl))) return { exists: false };
  try {
    const item = await sp.web.getFolderByServerRelativePath(folderUrl)
      .getItem<{ HasUniqueRoleAssignments: boolean }>('HasUniqueRoleAssignments');
    return { exists: true, uniquePermissions: item.HasUniqueRoleAssignments, access: await readAccess(item) };
  } catch (e) {
    // There, but who gets in is not for the person looking to see.
    if (isDenied(e)) return { exists: true };
    throw e;
  }
}

interface IRawBinding {
  RoleTypeKind: number;
}

interface IRawAssignment {
  PrincipalId: number;
  Member: { LoginName: string };
  RoleDefinitionBindings?: IRawBinding[] | { results?: IRawBinding[] };
}

const levelsOf = (raw: IRawAssignment['RoleDefinitionBindings']): number[] => {
  const list = Array.isArray(raw) ? raw : raw && raw.results ? raw.results : [];
  return list.map(b => b.RoleTypeKind);
};

/**
 * Whether the person looking can run the store: anyone who can change the
 * orders list can see and handle every order. Site owners can, and so can the
 * store managers once setup has let them in.
 */
export async function canRunStore(sp: SPFI, ordersListId: string): Promise<boolean> {
  const list = sp.web.lists.getById(ordersListId);
  const info = await list.select('EffectiveBasePermissions')();
  return list.hasPermissions(info.EffectiveBasePermissions, PermissionKind.ManageLists);
}

/**
 * Who has a way into a list or folder, with their permission levels, or
 * undefined if the person looking may not see that.
 */
export async function readAccess(target: Pick<IList, 'roleAssignments'>): Promise<IAssignment[] | undefined> {
  try {
    const raw = await target.roleAssignments.expand('Member', 'RoleDefinitionBindings')
      .select('PrincipalId', 'Member/LoginName', 'RoleDefinitionBindings/RoleTypeKind')();
    return (raw as unknown as IRawAssignment[]).map(a => ({
      principalId: a.PrincipalId,
      loginName: a.Member.LoginName,
      roles: levelsOf(a.RoleDefinitionBindings)
    }));
  } catch (e) {
    if (isDenied(e)) return undefined;
    throw e;
  }
}
