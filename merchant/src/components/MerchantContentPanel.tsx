import React from 'react';
import styles from './MerchantPage.module.css';

type MerchantContentPanelProps = {
  children: React.ReactNode;
  className?: string;
};

const MerchantContentPanel: React.FC<MerchantContentPanelProps> = ({ children, className }) => {
  return <div className={[styles.contentPanel, className].filter(Boolean).join(' ')}>{children}</div>;
};

export default MerchantContentPanel;
