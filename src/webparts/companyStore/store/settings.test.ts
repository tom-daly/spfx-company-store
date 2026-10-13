import {
  DEFAULT_SETTINGS, checkSettings, formatMoney, rowsFromSettings, settingsFromRows
} from './settings';

describe('store settings', () => {
  it('uses the defaults when nothing has been saved yet', () => {
    expect(settingsFromRows([])).toEqual(DEFAULT_SETTINGS);
  });

  it('reads back exactly what it writes', () => {
    const s = {
      ...DEFAULT_SETTINGS, currency: 'EUR' as const, orderPrefix: 'CS-', orderEmails: 'hr@contoso.com',
      pickUp: false, delivery: true, deliveryNote: 'A week, give or take.'
    };
    expect(settingsFromRows(rowsFromSettings(s))).toEqual(s);
  });

  it('keeps one row for every setting, each under its own name', () => {
    const rows = rowsFromSettings(DEFAULT_SETTINGS);
    expect(rows).toHaveLength(Object.keys(DEFAULT_SETTINGS).length);
    expect(rows).toHaveLength(16);
    expect(new Set(rows.map(r => r.Title)).size).toBe(rows.length);
  });

  it('reads back the wording of every email, blank ones included', () => {
    const s = {
      ...DEFAULT_SETTINGS,
      emailSubject: 'New order {order}',
      emailMessage: '',
      confirmedSubject: 'Got it: {order}',
      confirmedMessage: 'Hi {first name},\nwe have your order.',
      readySubject: 'Come and get {order}',
      readyMessage: '',
      shippedSubject: '{order} has left the building',
      shippedMessage: 'It is on its way, {first name}.'
    };
    expect(settingsFromRows(rowsFromSettings(s))).toEqual(s);
  });

  it('finds the status email wording by its row name', () => {
    const s = settingsFromRows([
      { Title: 'Confirmed email subject', SettingValue: 'A' },
      { Title: 'Confirmed email message', SettingValue: 'B' },
      { Title: 'Ready email subject', SettingValue: 'C' },
      { Title: 'Ready email message', SettingValue: 'D' },
      { Title: 'Shipped email subject', SettingValue: 'E' },
      { Title: 'Shipped email message', SettingValue: 'F' }
    ]);
    expect([s.confirmedSubject, s.confirmedMessage, s.readySubject, s.readyMessage, s.shippedSubject, s.shippedMessage])
      .toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
  });

  it('uses the standard status email wording when a row is empty in SharePoint', () => {
    expect(settingsFromRows([{ Title: 'Shipped email subject', SettingValue: null }]).shippedSubject)
      .toBe(DEFAULT_SETTINGS.shippedSubject);
  });

  it('tells people at the desk they will hear when a pick-up is ready', () => {
    expect(DEFAULT_SETTINGS.pickUpNote).toBe('Pick it up at the front desk.');
  });

  it('ignores a currency it does not know and keeps the default', () => {
    expect(settingsFromRows([{ Title: 'Currency', SettingValue: 'XYZ' }]).currency).toBe('USD');
  });

  it('reads a blank value as blank, not as the default', () => {
    expect(settingsFromRows([{ Title: 'Order numbers start with', SettingValue: '' }]).orderPrefix).toBe('');
  });

  it('accepts the defaults', () => {
    expect(checkSettings(DEFAULT_SETTINGS)).toBeUndefined();
  });

  it('says which email address looks wrong', () => {
    expect(checkSettings({ ...DEFAULT_SETTINGS, orderEmails: 'hr@contoso.com, adele' }))
      .toBe("adele doesn't look like an email address.");
  });

  it('will not let both pick-up and delivery be off', () => {
    expect(checkSettings({ ...DEFAULT_SETTINGS, pickUp: false, delivery: false })).toContain('nobody can get');
  });

  it('keeps every email subject under 200 characters, and says which one is too long', () => {
    const long = 'x'.repeat(201);
    expect(checkSettings({ ...DEFAULT_SETTINGS, emailSubject: long }))
      .toBe('Keep the subject of the "New order" email under 200 characters.');
    expect(checkSettings({ ...DEFAULT_SETTINGS, confirmedSubject: long }))
      .toBe('Keep the subject of the "Order confirmed" email under 200 characters.');
    expect(checkSettings({ ...DEFAULT_SETTINGS, readySubject: long }))
      .toBe('Keep the subject of the "Ready for pick-up" email under 200 characters.');
    expect(checkSettings({ ...DEFAULT_SETTINGS, shippedSubject: long }))
      .toBe('Keep the subject of the "On its way" email under 200 characters.');
  });

  it('allows a subject of exactly 200 characters, and long opening words', () => {
    const at = 'x'.repeat(200);
    expect(checkSettings({
      ...DEFAULT_SETTINGS, emailSubject: at, confirmedSubject: at, readySubject: at, shippedSubject: at,
      shippedMessage: 'y'.repeat(2000)
    })).toBeUndefined();
  });

  it('keeps order numbers short and simple', () => {
    expect(checkSettings({ ...DEFAULT_SETTINGS, orderPrefix: 'LA 2026/' })).toBeDefined();
    expect(checkSettings({ ...DEFAULT_SETTINGS, orderPrefix: 'CS-' })).toBeUndefined();
  });

  it('shows prices in the chosen currency, and nothing as Free', () => {
    expect(formatMoney(22, 'USD')).toBe('$22.00');
    expect(formatMoney(22, 'EUR')).toBe('€22.00');
    expect(formatMoney(22, 'GBP')).toBe('£22.00');
    expect(formatMoney(0, 'EUR')).toBe('Free');
  });
});
