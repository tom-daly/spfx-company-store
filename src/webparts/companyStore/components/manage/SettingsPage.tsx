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
import { COMMON } from '../../strings/common';
import { SETTINGS_PAGE } from '../../strings/manageSettings';
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
          <h2>{SETTINGS_PAGE.title}</h2>
          <p className={styles.intro}>{SETTINGS_PAGE.intro}</p>
        </div>
      </div>

      <div className={styles.form}>
        <Dropdown
          label={SETTINGS_PAGE.currency}
          selectedKey={form.currency}
          options={CURRENCIES.map(c => ({ key: c.code, text: c.label }))}
          disabled={saving}
          onChange={(_, o) => { if (o) set('currency', o.key as Currency); }}
        />

        <TextField
          label={SETTINGS_PAGE.orderPrefix}
          value={form.orderPrefix}
          disabled={saving}
          onChange={(_, v) => set('orderPrefix', v || '')}
          description={SETTINGS_PAGE.orderPrefixHint(prefix)}
        />

        <TextField
          label={SETTINGS_PAGE.orderEmails}
          value={form.orderEmails}
          disabled={saving}
          onChange={(_, v) => set('orderEmails', v || '')}
          description={SETTINGS_PAGE.orderEmailsHint}
        />

        <h3>{SETTINGS_PAGE.methods}</h3>
        <Toggle
          label={SETTINGS_PAGE.pickUp} checked={form.pickUp} disabled={saving}
          onChange={(_, v) => set('pickUp', !!v)} onText={SETTINGS_PAGE.on} offText={SETTINGS_PAGE.off}
        />
        <Toggle
          label={SETTINGS_PAGE.delivery} checked={form.delivery} disabled={saving}
          onChange={(_, v) => set('delivery', !!v)} onText={SETTINGS_PAGE.on} offText={SETTINGS_PAGE.off}
        />

        {error && <MessageBar messageBarType={MessageBarType.error} isMultiline>{error}</MessageBar>}
      </div>

      <div className={styles.actions}>
        <PrimaryButton
          text={COMMON.save} disabled={!changed || saving} onClick={() => { save().catch(() => undefined); }}
        />
        {saving && <Spinner size={SpinnerSize.small} label={COMMON.saving} labelPosition="right" />}
        {/* Always there, so screen readers hear "Saved." when it appears. */}
        <span className={styles.saved} role="status">{saved && !changed ? SETTINGS_PAGE.saved : ''}</span>
      </div>

      <section className={styles.section}>
        <h3>{SETTINGS_PAGE.messages}</h3>
        <p className={styles.intro}>{SETTINGS_PAGE.messagesIntro}</p>
        <DefaultButton text={SETTINGS_PAGE.customize} disabled={saving} onClick={onCustomize} />
      </section>

      {/* Saves each change by itself, straight away, so it has no part in Save or unsaved changes. */}
      <StoreManagers sp={sp} site={site} />

      <section className={styles.section}>
        <h3>{SETTINGS_PAGE.lists}</h3>
        <p className={styles.intro}>{SETTINGS_PAGE.listsIntro}</p>
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
