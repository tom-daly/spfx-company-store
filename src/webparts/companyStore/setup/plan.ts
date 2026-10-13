import { STORE_LISTS, IListDef, ListKey, keepsOwnRows, listDef } from './schema';
import {
  IListState, StoreState, OWN_ROWS, missingChoices, missingFields, managersCanAddPhotos, managersCanChange,
  managersGroupId, othersCanOpen, staffLetIn
} from './problems';
import { inWords } from '../store/orderText';

/*
 * Setup as a list of named steps, worked out before anything runs, so the page
 * can show the whole list up front and tick each one off as it goes.
 *
 * Only what is missing or wrong makes it into the plan: on a fresh site that is
 * everything; on a site that drifted it is just the fix.
 */

export type StepKind =
  | 'makeList' | 'addColumns' | 'addChoices' | 'views' | 'settings' | 'staffAccess' | 'lockOut'
  | 'makeGroup' | 'managersAccess' | 'managersPhotos';
export type StepState = 'waiting' | 'running' | 'done' | 'failed' | 'skipped';

/* Steps that let the Store managers group in somewhere, so can't run without it. */
const NEEDS_GROUP: StepKind[] = ['managersAccess', 'managersPhotos'];

/** What a failed step can leave unmade: a list, or the Store managers group. */
export type Unmade = ListKey | 'managers';

export interface IListSettings {
  Hidden?: boolean;
  NoCrawl?: boolean;
  EnableVersioning?: boolean;
  ReadSecurity?: number;
  WriteSecurity?: number;
}

export interface IStep {
  id: string;
  kind: StepKind;
  /** The list it works on. Missing for the Store managers group and the photo folder. */
  list?: ListKey;
  label: string;
  /** addColumns: the internal names to add. */
  fields?: string[];
  /** settings: what to change. */
  settings?: IListSettings;
  /** addChoices: the column, and every choice it should end up with (what it has, then the new ones). */
  choices?: { field: string; all: string[] };
  state: StepState;
  error?: string;
}

/** List settings that differ from the schema. `now` is undefined for a list about to be made. */
function settingsToChange(def: IListDef, now: IListState | undefined): IListSettings {
  const s: IListSettings = {};
  if (now ? now.hidden !== def.hidden : def.hidden) s.Hidden = def.hidden;
  if (!def.searchable && (!now || now.noCrawl !== true)) s.NoCrawl = true;
  if (!def.keepVersions && (!now || now.versioning)) s.EnableVersioning = false;
  if (keepsOwnRows(def) && (!now || now.readSecurity !== OWN_ROWS || now.writeSecurity !== OWN_ROWS)) {
    s.ReadSecurity = OWN_ROWS;
    s.WriteSecurity = OWN_ROWS;
  }
  return s;
}

function describeSettings(def: IListDef, s: IListSettings): string {
  const parts: string[] = [];
  if (s.Hidden === true) parts.push('hide it from the site contents');
  if (s.Hidden === false) parts.push('show it in the site contents');
  if (s.NoCrawl) parts.push('keep it out of search');
  if (s.EnableVersioning === false) parts.push('stop keeping old copies');
  if (s.ReadSecurity === OWN_ROWS) parts.push('let each person see only their own rows');
  return `${def.title}: ${inWords(parts)}`;
}

const STAFF_LABEL: Record<string, (title: string) => string> = {
  everyoneEdits: t => `Let staff update the numbers in ${t}`,
  ownRows: t => `Let staff add their own rows to ${t}`,
  ownRowsOnly: t => `Let staff add their own rows to ${t}`
};

/**
 * Every choice a column should end up with: all it has, in its own order,
 * with each new one put in after the one the store lists before it. So
 * Confirmed goes in after New, not at the bottom.
 */
export function mergeChoices(have: string[], want: string[]): string[] {
  const out = have.slice();
  want.forEach((c, i) => {
    if (out.indexOf(c) > -1) return;
    let at = 0;
    for (let j = i - 1; j >= 0; j--) {
      const k = out.indexOf(want[j]);
      if (k > -1) {
        at = k + 1;
        break;
      }
    }
    out.splice(at, 0, c);
  });
  return out;
}

export function planSetup(state: StoreState, everyoneLogin: string): IStep[] {
  const steps: IStep[] = [];
  const add = (def: IListDef, kind: StepKind, label: string, extra: Partial<IStep> = {}): void => {
    steps.push({ id: `${def.key}:${kind}`, kind, list: def.key, label, state: 'waiting', ...extra });
  };

  for (const def of STORE_LISTS) {
    const now = state[def.key];
    const isNew = !now || !now.exists;

    // Once the address list is locked, nobody but IT can change it from here — that is the point.
    if (!isNew && !now.canManage) continue;

    if (isNew) add(def, 'makeList', `Make the ${def.title} list`);

    const missing = missingFields(def, isNew ? undefined : now);
    if (missing.length === 1) {
      add(def, 'addColumns', `Add the ${missing[0].title} column to ${def.title}`, { fields: [missing[0].name] });
    } else if (missing.length > 1) {
      add(def, 'addColumns', `Add ${missing.length} columns to ${def.title}`, { fields: missing.map(f => f.name) });
    }

    if (!isNew) {
      missingChoices(def, now).forEach(m => {
        const have = (now.choices && now.choices[m.name]) || [];
        const want = def.fields.filter(f => f.name === m.name)[0].choices || [];
        add(def, 'addChoices', `Add ${inWords(m.choices)} to the ${m.title} column in ${def.title}`,
          { choices: { field: m.name, all: mergeChoices(have, want) } });
      });
    }

    // Views only on the first run, so changes made by hand afterwards stay put.
    if (isNew) {
      const names = def.views.map(v => `"${v.title}"`);
      add(def, 'views', `Set up the ${names.join(' and ')} view${names.length > 1 ? 's' : ''}`);
    }

    const settings = settingsToChange(def, isNew ? undefined : now);
    if (Object.keys(settings).length) add(def, 'settings', describeSettings(def, settings), { settings });

    if (def.access === 'site') continue;

    // Each step goes in unless the check is sure it isn't needed.
    if (isNew || staffLetIn(now, everyoneLogin) !== true) {
      add(def, 'staffAccess', STAFF_LABEL[def.access](def.title));
    }

    if (def.access === 'ownRowsOnly' && (isNew || othersCanOpen(now, everyoneLogin) !== false)) {
      add(def, 'lockOut', `Lock ${def.title} so site owners can't open it`);
    }
  }

  // Store managers come last, once every list is right. The address list is
  // locked by then, before the group shows up anywhere on the site.
  if (!state.managers) return steps;
  const groupId = managersGroupId(state);
  if (groupId === undefined) {
    steps.push({ id: 'managers:makeGroup', kind: 'makeGroup', label: 'Make the Store managers group', state: 'waiting' });
  }
  for (const def of STORE_LISTS) {
    if (!def.managers) continue;
    const now = state[def.key];
    const isNew = !now || !now.exists;
    if (!isNew && !now.canManage) continue;
    if (isNew || groupId === undefined || managersCanChange(now, groupId) !== true) {
      add(def, 'managersAccess', `Let store managers change ${def.title}`);
    }
  }
  if (groupId === undefined || managersCanAddPhotos(state.photos, groupId) !== true) {
    steps.push({
      id: 'photos:managersPhotos', kind: 'managersPhotos', label: 'Let store managers add product photos', state: 'waiting'
    });
  }
  return steps;
}

/**
 * Why a step can't run, when an earlier one failed to make what it needs:
 * the list it works on, or the Store managers group.
 */
export function skipReason(step: IStep, unmade: Set<Unmade>): string | undefined {
  if (step.list && unmade.has(step.list)) return `Skipped because ${listDef(step.list).title} wasn't made.`;
  if (NEEDS_GROUP.indexOf(step.kind) > -1 && unmade.has('managers')) {
    return 'Skipped because the Store managers group couldn\'t be made.';
  }
  return undefined;
}
