import type { SPFI } from '../sp';
import type { IList } from '@pnp/sp/lists';
import type { IView } from '@pnp/sp/views';
import { AddFieldOptions } from '@pnp/sp/fields';
import { IListDef, IViewDef, ListIds, MANAGERS_GROUP, PHOTO_FOLDER, listDef } from './schema';
import { RoleType, RoleTypeValue, hasStaff, lockOutOrder } from './permissions';
import { ISiteInfo, listIds, managersGroupId } from './problems';
import { IStep, Unmade, planSetup, skipReason } from './plan';
import { ensureFolder, findManagersGroup, readStoreState, readAccess } from './storeState';
import { explain } from './errors';

export type OnSteps = (steps: IStep[]) => void;

/* What the Store managers group says it is for, in SharePoint's own group pages. */
const MANAGERS_DESCRIPTION = 'People who run the company store: products, stock and orders. ' +
  'Site owners add people from the store\'s Settings.';

/* The Store managers group, once there is one, for the steps that let it in. */
interface IGroupRef {
  id?: number;
}

/**
 * Works out what setup has to do, then does it one step at a time, reporting
 * every change so the page can tick the steps off. Safe to run again: the plan
 * only holds what is missing or wrong, so a half-finished run is picked up
 * where it stopped.
 *
 * Returns the steps as they ended. Any with state 'failed' did not happen.
 */
export async function runSetup(sp: SPFI, site: ISiteInfo, onSteps: OnSteps): Promise<IStep[]> {
  const state = await readStoreState(sp, site, true);
  const steps = planSetup(state, site.everyoneLogin);
  const report = (): void => onSteps(steps.map(s => ({ ...s })));
  report();

  const ids = listIds(state);
  const group: IGroupRef = { id: managersGroupId(state) };
  const unmade = new Set<Unmade>();

  for (const step of steps) {
    const skip = skipReason(step, unmade);
    if (skip) {
      step.state = 'skipped';
      step.error = skip;
      report();
      continue;
    }
    step.state = 'running';
    report();
    try {
      await runStep(sp, site, step, ids, group);
      step.state = 'done';
    } catch (e) {
      step.state = 'failed';
      step.error = explain(e);
      if (step.kind === 'makeList' && step.list) unmade.add(step.list);
      if (step.kind === 'makeGroup') unmade.add('managers');
    }
    report();
  }
  return steps.map(s => ({ ...s }));
}

const groupIdOf = (group: IGroupRef): number => {
  if (group.id === undefined) throw new Error('The Store managers group isn\'t there.');
  return group.id;
};

async function runStep(sp: SPFI, site: ISiteInfo, step: IStep, ids: ListIds, group: IGroupRef): Promise<void> {
  if (step.kind === 'makeGroup') {
    group.id = await makeManagersGroup(sp, site);
    return;
  }
  if (step.kind === 'managersPhotos') {
    await letManagersAddPhotos(sp, groupIdOf(group));
    return;
  }

  if (!step.list) throw new Error(`"${step.label}" doesn't say which list it is for.`);
  const def = listDef(step.list);

  if (step.kind === 'makeList') {
    ids[def.key] = await createList(sp, def);
    return;
  }

  const id = ids[def.key];
  if (!id) throw new Error(`${def.title} isn't there.`);
  const list = sp.web.lists.getById(id);

  switch (step.kind) {
    case 'addColumns': {
      // Try every column, then report the ones that would not go in.
      const failed: string[] = [];
      for (const name of step.fields || []) {
        const f = def.fields.filter(x => x.name === name)[0];
        try {
          await list.fields.createFieldAsXml({
            SchemaXml: f.xml(ids),
            // Keep the internal name we gave it, and put it in the default view if it belongs there.
            Options: AddFieldOptions.AddFieldInternalNameHint |
              (f.inDefaultView ? AddFieldOptions.AddFieldToDefaultView : AddFieldOptions.DefaultValue)
          });
        } catch (e) {
          failed.push(`${f.title} (${explain(e)})`);
        }
      }
      if (failed.length) throw new Error(`Couldn't add ${failed.join('; ')}`);
      return;
    }
    case 'addChoices': {
      // Keeps every choice the column has, including any added by hand, and adds the new ones.
      const c = step.choices;
      if (c) await list.fields.getByInternalNameOrTitle(c.field).update({ Choices: c.all }, 'SP.FieldChoice');
      return;
    }
    case 'views':
      for (let i = 0; i < def.views.length; i++) await applyView(list, def.views[i], i === 0);
      return;
    case 'settings':
      await list.update(step.settings || {});
      return;
    case 'staffAccess':
      await letStaffIn(sp, list, site);
      return;
    case 'lockOut':
      await lockOut(sp, list, site);
      return;
    case 'managersAccess':
      // Edit: every row and the list's own settings, but not who gets in.
      await grant(sp, list, await hasOwnPermissions(list), groupIdOf(group), RoleType.editor);
      return;
  }
}

/* Made with the web address as its title, so the address comes out clean, then renamed. */
async function createList(sp: SPFI, def: IListDef): Promise<string> {
  const info = await sp.web.lists.add(def.urlName, def.description, 100, false);
  const list = sp.web.lists.getById(info.Id);
  try {
    await list.update({ Title: def.title });
  } catch {
    // Another list already has that title. The store finds its lists by address, so it still works.
  }
  await list.fields.getByInternalNameOrTitle('Title').update({ Title: def.titleColumn });
  return info.Id;
}

async function applyView(list: IList, v: IViewDef, isDefault: boolean): Promise<void> {
  let view: IView;
  if (isDefault) {
    view = list.defaultView;
    await view.update({ Title: v.title, ViewQuery: v.query, RowLimit: v.rowLimit });
  } else {
    const info = await list.views.add(v.title, false, { ViewQuery: v.query, RowLimit: v.rowLimit });
    view = list.views.getById(info.Id);
  }
  await view.fields.removeAll();
  for (const f of v.fields) await view.fields.add(f);
}

async function hasOwnPermissions(list: IList): Promise<boolean> {
  const info = await list.select('HasUniqueRoleAssignments')();
  return (info as unknown as { HasUniqueRoleAssignments: boolean }).HasUniqueRoleAssignments;
}

/* A list or folder, as far as who gets in goes. */
type Securable = Pick<IList, 'roleAssignments' | 'breakRoleInheritance'>;

/*
 * Lets a person or group in at a permission level. Something that still
 * follows the site gets permissions of its own first, copied from the site, so
 * everyone who could get in still can.
 */
async function grant(
  sp: SPFI, target: Securable, hasOwn: boolean, principalId: number, level: RoleTypeValue
): Promise<void> {
  if (!hasOwn) await target.breakRoleInheritance(true, false);
  const role = await sp.web.roleDefinitions.getByType(level)();
  await target.roleAssignments.add(principalId, role.Id);
}

/* The list gets its own permissions, copied from the site, and everyone in the
   organisation can add to it. */
async function letStaffIn(sp: SPFI, list: IList, site: ISiteInfo): Promise<void> {
  const hasOwn = await hasOwnPermissions(list);
  const everyone = await sp.web.ensureUser(site.everyoneLogin);
  await grant(sp, list, hasOwn, everyone.Id, RoleType.contributor);
}

/*
 * Takes everybody else off the list — site owners included — leaving staff, who
 * each see only their own row. Site collection admins (IT) always keep a way
 * in; SharePoint does not allow otherwise.
 */
async function lockOut(sp: SPFI, list: IList, site: ISiteInfo): Promise<void> {
  // Never lock the list until staff are definitely in, or nobody but IT could reach it.
  const now = await readAccess(list);
  if (!now || !hasStaff(now, site.everyoneLogin)) {
    throw new Error('Staff are not on the list yet, so it was left open to site owners for now.');
  }
  const groups = await sp.web.currentUser.groups.select('Id')();
  const order = lockOutOrder(now, site.everyoneLogin, site.currentUserId, groups.map(g => g.Id));
  for (const principalId of order) {
    await list.roleAssignments.getById(principalId).delete();
  }
}

/*
 * The group whose people run the store. The site's Owners group owns it, so
 * every site owner can add and take people off, not just whoever ran setup.
 * One already there by that name is used as it is.
 */
async function makeManagersGroup(sp: SPFI, site: ISiteInfo): Promise<number> {
  const existing = await findManagersGroup(sp);
  if (existing !== undefined) return existing;

  const owners = await sp.web.associatedOwnerGroup.select('Id')();
  if (!owners || typeof owners.Id !== 'number') {
    throw new Error('This site has no Owners group to look after the Store managers group.');
  }
  const made = await sp.web.siteGroups.add({
    Title: MANAGERS_GROUP,
    Description: MANAGERS_DESCRIPTION,
    OnlyAllowMembersViewMembership: false,
    AllowMembersEditMembership: false,
    AllowRequestToJoinLeave: false
  });
  const group = sp.web.siteGroups.getById(made.Id);
  try {
    await group.setUserAsOwner(owners.Id);
  } catch (e) {
    // Left as it is, only whoever ran setup could change it. Gone again, the next run starts clean.
    await sp.web.siteGroups.removeById(made.Id).catch(() => undefined);
    throw e;
  }
  // SharePoint puts whoever makes a group in it. Site owners can run the store anyway, so they come back out.
  await group.users.removeById(site.currentUserId).catch(() => undefined);
  return made.Id;
}

/*
 * The folder in Site Assets product photos go in, made if it isn't there. It
 * gets permissions of its own, copied from the library so staff still see the
 * photos, and store managers can add to it.
 */
async function letManagersAddPhotos(sp: SPFI, groupId: number): Promise<void> {
  const assets = await sp.web.lists.ensureSiteAssetsLibrary();
  const root = await assets.rootFolder.select('ServerRelativeUrl')();
  const folderUrl = `${root.ServerRelativeUrl}/${PHOTO_FOLDER}`;
  await ensureFolder(sp, folderUrl);
  const item = await sp.web.getFolderByServerRelativePath(folderUrl)
    .getItem<{ HasUniqueRoleAssignments: boolean }>('HasUniqueRoleAssignments');
  await grant(sp, item, item.HasUniqueRoleAssignments, groupId, RoleType.contributor);
}
