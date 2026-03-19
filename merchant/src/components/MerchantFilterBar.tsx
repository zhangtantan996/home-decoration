import React from 'react';
import { Card } from 'antd';
import styles from './MerchantPage.module.css';

type MerchantFilterBarProps = {
  children: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
};

const MerchantFilterBar: React.FC<MerchantFilterBarProps> = ({ children, hint, className }) => {
  return (
    <Card className={[styles.filterCard, className].filter(Boolean).join(' ')}>
      <div className={styles.filterBar}>
        <div className={styles.filterMain}>{children}</div>
        {hint ? <div className={styles.filterHint}>{hint}</div> : null}
      </div>
    </Card>
  );
};

export default MerchantFilterBar;
