import * as React from 'react';
import { Icon } from '@fluentui/react';
import styles from './CompanyStore.module.scss';

/* SharePoint's own back arrow, for the "← All products" style links. Read-out text comes from the link itself. */
const BackArrow: React.FC = () => <Icon iconName="Back" className={styles.backArrow} aria-hidden="true" />;

export default BackArrow;
