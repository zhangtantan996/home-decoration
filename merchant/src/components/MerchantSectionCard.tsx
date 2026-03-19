import React from 'react';
import { Card } from 'antd';
import styles from './MerchantPage.module.css';

type MerchantSectionCardProps = {
  children: React.ReactNode;
  className?: string;
  title?: React.ReactNode;
  extra?: React.ReactNode;
};

const MerchantSectionCard: React.FC<MerchantSectionCardProps> = ({ children, className, title, extra }) => {
  return (
    <Card title={title} extra={extra} className={[styles.sectionCard, className].filter(Boolean).join(' ')}>
      {children}
    </Card>
  );
};

export default MerchantSectionCard;
