import type { SPFI } from '../sp';
import type { ListIds } from '../setup/schema';
import type { ISiteInfo } from '../setup/problems';
import { IOrder, IOrderRow, orderFields, ordersFromRows } from './ordersView';
import { listOf } from './lists';

/* Plenty for one person. Anything older is still in the orders list itself. */
export const MOST_MINE = 100;

/**
 * The orders the person looking placed, newest first. Only their own, even for
 * site owners and store managers, who can see everyone's. The history is left
 * out: it is the store team's notes.
 */
export async function loadMyOrders(sp: SPFI, ids: ListIds, site: ISiteInfo): Promise<IOrder[]> {
  const rows = await listOf(sp, ids, 'orders').items
    .select(...orderFields(false))
    .expand('Author')
    .filter(`AuthorId eq ${site.currentUserId}`)
    .orderBy('Id', false)
    .top(MOST_MINE)();
  return ordersFromRows(rows as IOrderRow[]);
}
