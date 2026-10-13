import * as React from 'react';
import styles from './Manage.module.scss';
import { MANAGE_NAV } from '../../strings/manageSettings';

export type ManageTab = 'shop' | 'products' | 'orders' | 'settings' | 'customize';

export interface IManageNavProps {
  /** The page showing now. */
  current: ManageTab;
  onGo: (tab: ManageTab) => void;
}

const TABS: { key: ManageTab; label: string }[] = [
  { key: 'shop', label: MANAGE_NAV.shop },
  { key: 'products', label: MANAGE_NAV.products },
  { key: 'orders', label: MANAGE_NAV.orders },
  { key: 'settings', label: MANAGE_NAV.settings },
  { key: 'customize', label: MANAGE_NAV.customize }
];

/* The row of pages site owners see along the top of the store. Staff never see it. */
const ManageNav: React.FC<IManageNavProps> = ({ current, onGo }) => (
  <nav className={styles.nav} aria-label={MANAGE_NAV.label}>
    {TABS.map(t => (
      <button
        key={t.key}
        type="button"
        className={styles.tab}
        data-label={t.label}
        aria-current={t.key === current ? 'page' : undefined}
        onClick={() => onGo(t.key)}
      >
        {t.label}
      </button>
    ))}
  </nav>
);

export default ManageNav;
