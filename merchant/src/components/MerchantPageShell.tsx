import React from 'react';
import styles from './MerchantPage.module.css';

type MerchantPageShellProps = {
  children: React.ReactNode;
  className?: string;
  fullWidth?: boolean;
};

const MerchantPageShell: React.FC<MerchantPageShellProps> = ({ children, className, fullWidth }) => {
  return <div className={[styles.page, fullWidth ? styles.pageFullWidth : '', className].filter(Boolean).join(' ')}>{children}</div>;
};

export default MerchantPageShell;
