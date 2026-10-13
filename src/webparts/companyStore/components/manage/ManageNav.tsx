import * as React from 'react';
import styles from './Manage.module.scss';

export type ManageTab = 'shop' | 'products' | 'orders' | 'settings' | 'customize';

export interface IManageNavProps {
  /** The page showing now. */
  current: ManageTab;
  onGo: (tab: ManageTab) => void;
}

const TABS: { key: ManageTab; label: string }[] = [
  { key: 'shop', label: 'Shop' },
  { key: 'products', label: 'Products & stock' },
  { key: 'orders', label: 'Orders' },
  { key: 'settings', label: 'Settings' },
  { key: 'customize', label: 'Customize' }
];

/* The row of pages site owners see along the top of the store. Staff never see it. */
const ManageNav: React.FC<IManageNavProps> = ({ current, onGo }) => (
  <nav className={styles.nav} aria-label="Run the store">
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
