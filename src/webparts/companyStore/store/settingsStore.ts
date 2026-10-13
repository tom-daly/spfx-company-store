import type { SPFI } from '../sp';
import { ListIds, MONEY_COLUMNS } from '../setup/schema';
import {
  IStoreSettings, ISettingRow, currencyInfo, rowsFromSettings, settingsFromRows
} from './settings';
import { listOf } from './lists';

export async function loadSettings(sp: SPFI, ids: ListIds): Promise<IStoreSettings> {
  const rows = await listOf(sp, ids, 'settings').items.select('Title', 'SettingValue').top(500)();
  return settingsFromRows(rows as ISettingRow[]);
}

/*
 * Writes every setting, adding rows that are not there yet. When the currency
 * changes, the price columns in the lists change with it, so SharePoint shows
 * the same symbol as the store.
 */
export async function saveSettings(
  sp: SPFI, ids: ListIds, next: IStoreSettings, before: IStoreSettings
): Promise<void> {
  const list = listOf(sp, ids, 'settings');
  const existing = (await list.items.select('Id', 'Title').top(500)()) as { Id: number; Title: string }[];
  for (const row of rowsFromSettings(next)) {
    const hit = existing.filter(e => e.Title === row.Title)[0];
    if (hit) await list.items.getById(hit.Id).update({ SettingValue: row.SettingValue });
    else await list.items.add(row);
  }

  if (next.currency !== before.currency) {
    const lcid = currencyInfo(next.currency).lcid;
    for (const c of MONEY_COLUMNS) {
      await listOf(sp, ids, c.list).fields.getByInternalNameOrTitle(c.field)
        .update({ CurrencyLocaleId: lcid }, 'SP.FieldCurrency');
    }
  }
}
