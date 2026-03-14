import type { ReactNode } from 'react';
import styles from './HeroSection.module.scss';

interface HeroMetric {
  label: string;
  value: string;
  description: string;
}

interface HeroSectionProps {
  eyebrow: string;
  title: string;
  description: string;
  actions: ReactNode;
  asideTitle: string;
  asideDescription: string;
  metrics: HeroMetric[];
}

export function HeroSection({ eyebrow, title, description, actions, asideTitle, asideDescription, metrics }: HeroSectionProps) {
  return (
    <section className={styles.hero}>
      <article className={styles.content}>
        <div className={styles.inner}>
          <div>
            <p className="kicker eyebrow-accent">{eyebrow}</p>
            <h1 className={styles.display}>{title}</h1>
          </div>
          <p className={styles.copy}>{description}</p>
          <div className={styles.actions}>{actions}</div>
        </div>
      </article>

      <aside className={styles.aside}>
        <div className={styles.asideInner}>
          <div>
            <p className="kicker" style={{ color: 'rgba(255,255,255,0.62)' }}>Trust & Authority</p>
            <h2 className="section-title" style={{ color: '#fff' }}>{asideTitle}</h2>
            <p className="page-subtitle" style={{ color: 'rgba(255,255,255,0.78)' }}>{asideDescription}</p>
          </div>

          <div className={styles.metricGrid}>
            {metrics.map((metric) => (
              <article className={styles.metricCard} key={metric.label}>
                <span className={styles.metricLabel}>{metric.label}</span>
                <span className={styles.metricValue}>{metric.value}</span>
                <p className={styles.metricDesc}>{metric.description}</p>
              </article>
            ))}
          </div>
        </div>
      </aside>
    </section>
  );
}
