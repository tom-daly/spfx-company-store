import type { SPFI } from '../sp';
import type { IList } from '@pnp/sp/lists';
import type { ListIds } from '../setup/schema';

/** One of the store's lists, found by the ID setup recorded. */
export const listOf = (sp: SPFI, ids: ListIds, key: keyof ListIds): IList => {
  const id = ids[key];
  if (!id) throw new Error('The store lists are not set up.');
  return sp.web.lists.getById(id);
};
