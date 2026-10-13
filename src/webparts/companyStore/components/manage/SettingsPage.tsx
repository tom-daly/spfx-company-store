import * as React from 'react';
import {
  DefaultButton, Dropdown, Link, MessageBar, MessageBarType, PrimaryButton, Spinner, SpinnerSize, TextField, Toggle
} from '@fluentui/react';
import styles from './Manage.module.scss';
import type { SPFI } from '../../sp';
import { ListIds, ListKey, listDef } from '../../setup/schema';
import { ISiteInfo, listWebUrl } from '../../setup/problems';
import { CURRENCIES, Currency, IStoreSettings, checkSettings } from '../../store/settings';
import { saveSettings } from '../../store/settingsStore';
import { explain } from '../../setup/errors';
import StoreManagers from './StoreManagers';

export interface ISettingsPageProps {
  sp: SPFI;
  ids: ListIds;
  site: ISiteInfo;
  /** As saved. */
  settings: IStoreSettings;
  onSaved: (settings: IStoreSettings) => void;
  /** Opens Customize, where the words people see are changed. */
  onCustomize: () => void;
  /** True while something here isn't saved, so the store can ask before leaving the page. */
  onUnsavedChange: (unsaved: boolean) => void;
}

/* What this page changes. The wording is changed in Customize, so it's left alone here. */
const FIELDS: (keyof IStoreSettings)[] = ['currency', 'orderPrefix', 'orderEmails', 'pickUp', 'delivery'];

const sameFields = (a: IStoreSettings, b: IStoreSettings): boolean => FIELDS.every(k => a[k] === b[k]);

/* The raw lists, for site owners and store managers who want to see the rows themselves. */
const RAW_LISTS: ListKey[] = ['products', 'stock', 'orders'];

const SettingsPage: React.FC<ISettingsPageProps> = ({
  sp, ids, site, settings, onSaved, onCustomize, onUnsavedChange
}) => {
  const [form, setForm] = React.useState<IStoreSettings>(settings);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>();
  const [saved, setSaved] = React.useState(false);
  const alive = React.useRef(true);

  const changed = !sameFields(form, settings);

  React.useEffect(() => { onUnsavedChange(changed); }, [changed, onUnsavedChange]);

  // Leaving the page leaves nothing behind to ask about.
  React.useEffect(() => () => {
    alive.current = false;
    onUnsavedChange(false);
  }, [onUnsavedChange]);

  const set = <K extends keyof IStoreSettings>(key: K, value: IStoreSettings[K]): void => {
    setForm(f => ({ ...f, [key]: value }));
    setError(undefined);
  };

  const save = async (): Promise<void> => {
    // Built on what is saved, so wording changed in Customize meanwhile is never put back.
    const next: IStoreSettings = {
      ...settings,
      currency: form.currency,
      orderPrefix: form.orderPrefix.trim(),
      orderEmails: form.orderEmails.trim(),
      pickUp: form.pickUp,
      delivery: form.delivery
    };
    const wrong = checkSettings(next);
    if (wrong) {
      setError(wrong);
      return;
    }
    setSaving(true);
    setSaved(false);
    setError(undefined);
    try {
      await saveSettings(sp, ids, next, settings);
      if (alive.current) {
        setForm(next);
        setSaved(true);
      }
      onSaved(next);
    } catch (e) {
      if (alive.current) setError(explain(e));
    } finally {
      if (alive.current) setSaving(false);
    }
  };

  const prefix = form.orderPrefix.trim();

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div>
          <h2>Settings</h2>
          <p className={styles.intro}>These apply to the whole store, on every page it appears.</p>
        </div>
      </div>

      <div className={styles.form}>
        <Dropdown
          label="Currency"
          selectedKey={form.currency}
          options={CURRENCIES.map(c => ({ key: c.code, text: c.label }))}
          disabled={saving}
          onChange={(_, o) => { if (o) set('currency', o.key as Currency); }}
        />

        <TextField
          label="Order numbers start with"
          value={form.orderPrefix}
          disabled={saving}
          onChange={(_, v) => set('orderPrefix', v || '')}
          description={`Like CS- for CS-0042. Orders will be numbered ${prefix}0001, ${prefix}0002 and so on.`}
        />

        <TextField
          label="Who gets order emails"
          value={form.orderEmails}
          disabled={saving}
          onChange={(_, v) => set('orderEmails', v || '')}
          description="One or more email addresses, separated by commas. A shared mailbox works too."
        />

        <h3>How people get their order</h3>
        <Toggle
          label="Pick up at the office" checked={form.pickUp} disabled={saving}
          onChange={(_, v) => set('pickUp', !!v)} onText="On" offText="Off"
        />
        <Toggle
          label="Delivery" checked={form.delivery} disabled={saving}
          onChange={(_, v) => set('delivery', !!v)} onText="On" offText="Off"
        />

        {error && <MessageBar messageBarType={MessageBarType.error} isMultiline>{error}</MessageBar>}
      </div>

      <div className={styles.actions}>
        <PrimaryButton text="Save" disabled={!changed || saving} onClick={() => { save().catch(() => undefined); }} />
        {saving && <Spinner size={SpinnerSize.small} label="Saving…" labelPosition="right" />}
        {/* Always there, so screen readers hear "Saved." when it appears. */}
        <span className={styles.saved} role="status">{saved && !changed ? 'Saved.' : ''}</span>
      </div>

      <section className={styles.section}>
        <h3>Messages</h3>
        <p className={styles.intro}>
          The pick-up and delivery instructions, the message after an order and the order email are
          changed on the screens themselves, so you can see them as staff will.
        </p>
        <DefaultButton text="Customize the messages" disabled={saving} onClick={onCustomize} />
      </section>

      {/* Saves each change by itself, straight away, so it has no part in Save or unsaved changes. */}
      <StoreManagers sp={sp} site={site} />

      <section className={styles.section}>
        <h3>SharePoint lists</h3>
        <p className={styles.intro}>
          The store keeps everything in SharePoint lists. You won&apos;t need them day to day, but you can
          open them to see the rows themselves.
        </p>
        <ul className={styles.links}>
          {RAW_LISTS.map(key => {
            const def = listDef(key);
            return (
              <li key={key}>
                <Link href={listWebUrl(site, def)}>{def.title}</Link>
                <span className={styles.hint}>{def.description}</span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
};

export default SettingsPage;
