import React from 'react';
import { Card, Typography } from 'antd';
import styles from './MerchantPage.module.css';

const { Title, Text } = Typography;

type MerchantPageHeaderProps = {
  title: React.ReactNode;
  description?: React.ReactNode;
  extra?: React.ReactNode;
  meta?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
};

const MerchantPageHeader: React.FC<MerchantPageHeaderProps> = ({
  title,
  description,
  extra,
  meta,
  className,
  children,
}) => {
  return (
    <Card className={[styles.headerCard, className].filter(Boolean).join(' ')}>
      <div className={styles.header}>
        <div className={styles.headerMain}>
          <Title level={2} className={styles.headerTitle}>{title}</Title>
          {description ? <Text className={styles.headerDescription}>{description}</Text> : null}
          {meta ? <div className={styles.headerMeta}>{meta}</div> : null}
        </div>
        {extra ? <div className={styles.headerActions}>{extra}</div> : null}
      </div>
      {children ? <div style={{ marginTop: 16 }}>{children}</div> : null}
    </Card>
  );
};

export default MerchantPageHeader;
