import type { ReactNode } from 'react';
import styles from './StatusBanner.module.scss';

interface StatusBannerProps {
  label: string;
  title: string;
  description: string;
  tone?: 'info' | 'warning' | 'success';
  meta?: ReactNode;
}

export function StatusBanner({ label, title, description, tone = 'info', meta }: StatusBannerProps) {
  return (
    <section className={`${styles.banner} ${styles[tone]}`.trim()}>
      <div className={styles.main}>
        <p className={styles.label}>{label}</p>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.copy}>{description}</p>
      </div>
      {meta ? <div className={styles.meta}>{meta}</div> : null}
    </section>
  );
}
