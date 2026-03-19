import React from 'react';
import { Card } from 'antd';
import styles from './MerchantPage.module.css';

type Tone = 'slate' | 'blue' | 'green' | 'amber' | 'red';

type MerchantStatItem = {
  label: string;
  value: React.ReactNode;
  meta?: React.ReactNode;
  percent?: number;
  tone?: Tone;
  tag?: React.ReactNode;
};

type MerchantStatGridProps = {
  items: MerchantStatItem[];
  className?: string;
};

const toneClassMap: Record<Tone, string> = {
  slate: styles.toneSlate,
  blue: styles.toneBlue,
  green: styles.toneGreen,
  amber: styles.toneAmber,
  red: styles.toneRed,
};

const MerchantStatGrid: React.FC<MerchantStatGridProps> = ({ items, className }) => {
  return (
    <div className={[styles.statsGrid, className].filter(Boolean).join(' ')}>
      {items.map((item) => {
        const tone = item.tone || 'blue';
        const percent = Math.max(0, Math.min(100, item.percent ?? 0));
        return (
          <Card key={item.label} className={[styles.statCard, toneClassMap[tone]].join(' ')}>
            <div className={styles.statLabel}>{item.label}</div>
            <div className={styles.statValueRow}>
              <div className={styles.statValue}>{item.value}</div>
              {item.tag || null}
            </div>
            {item.meta ? <div className={styles.statMeta}>{item.meta}</div> : null}
            <div className={styles.statProgressTrack}>
              <div className={styles.statProgressFill} style={{ width: `${percent}%` }} />
            </div>
          </Card>
        );
      })}
    </div>
  );
};

export type { MerchantStatItem };
export default MerchantStatGrid;
