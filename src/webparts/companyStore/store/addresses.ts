import type { SPFI } from '../sp';
import type { ListIds } from '../setup/schema';
import type { IAddress } from './types';
import { tidyAddress } from './orderText';
import { listOf } from './lists';

/*
 * Each person's delivery address, one row each in the Store addresses list.
 *
 * Staff only ever see their own row there, but site collection admins (and
 * whoever is testing) see everyone's. So every read asks for the person's own
 * row by who created it, and never trusts that the first row is theirs.
 */

/* eslint-disable @rushstack/no-new-null -- SharePoint sends null for an empty column */
interface IAddressRow {
  Id: number;
  Title: string | null;
  AddressLine1: string | null;
  AddressLine2: string | null;
  Postcode: string | null;
  City: string | null;
  Country: string | null;
  Phone: string | null;
}
/* eslint-enable @rushstack/no-new-null */

/* Newest first, so if anyone ever ends up with two rows the latest one wins. */
async function myRows(sp: SPFI, ids: ListIds, userId: number): Promise<IAddressRow[]> {
  if (!userId) throw new Error("We couldn't tell who you are, so we can't look up your address.");
  const rows = await listOf(sp, ids, 'addresses').items
    .select('Id', 'Title', 'AddressLine1', 'AddressLine2', 'Postcode', 'City', 'Country', 'Phone')
    .filter(`AuthorId eq ${userId}`)
    .orderBy('Id', false)
    .top(20)();
  return rows as IAddressRow[];
}

const fromRow = (r: IAddressRow): IAddress => ({
  name: r.Title || '',
  line1: r.AddressLine1 || '',
  line2: r.AddressLine2 || '',
  postcode: r.Postcode || '',
  city: r.City || '',
  country: r.Country || '',
  phone: r.Phone || ''
});

const toRow = (address: IAddress): Record<string, string> => {
  const a = tidyAddress(address);
  return {
    Title: a.name,
    AddressLine1: a.line1,
    AddressLine2: a.line2,
    Postcode: a.postcode,
    City: a.city,
    Country: a.country,
    Phone: a.phone
  };
};

/** The person's saved address, or undefined if they have none. */
export async function loadMyAddress(sp: SPFI, ids: ListIds, userId: number): Promise<IAddress | undefined> {
  const rows = await myRows(sp, ids, userId);
  return rows.length ? fromRow(rows[0]) : undefined;
}

/** Keeps the address for next time: changes the person's row if they have one, adds it if not. */
export async function saveMyAddress(sp: SPFI, ids: ListIds, userId: number, address: IAddress): Promise<void> {
  const list = listOf(sp, ids, 'addresses');
  const rows = await myRows(sp, ids, userId);
  if (!rows.length) {
    await list.items.add(toRow(address));
    return;
  }
  await list.items.getById(rows[0].Id).update(toRow(address));
  // One row per person: clear out any older ones left over.
  for (const extra of rows.slice(1)) {
    await list.items.getById(extra.Id).delete().catch(() => undefined);
  }
}

/** Deletes the person's saved address. */
export async function forgetMyAddress(sp: SPFI, ids: ListIds, userId: number): Promise<void> {
  const list = listOf(sp, ids, 'addresses');
  const rows = await myRows(sp, ids, userId);
  for (const row of rows) {
    await list.items.getById(row.Id).delete();
  }
}
