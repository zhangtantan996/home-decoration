import React from 'react';
import styles from './MerchantPage.module.css';

type MerchantPageShellProps = {
  children: React.ReactNode;
  className?: string;
};

const MerchantPageShell: React.FC<MerchantPageShellProps> = ({ children, className }) => {
  return <div className={[styles.page, className].filter(Boolean).join(' ')}>{children}</div>;
};

export default MerchantPageShell;
