import type { ReactNode } from 'react';
import styles from './ActionPanel.module.scss';

interface ActionPanelProps {
  eyebrow?: string;
  title: string;
  description: string;
  children: ReactNode;
  sticky?: boolean;
}

export function ActionPanel({ eyebrow, title, description, children, sticky = false }: ActionPanelProps) {
  return (
    <aside className={`${styles.panel} ${sticky ? styles.sticky : ''}`.trim()}>
      <div className={styles.meta}>
        {eyebrow ? <p className="kicker eyebrow-accent">{eyebrow}</p> : null}
        <h2 className="section-title">{title}</h2>
        <p className="page-subtitle">{description}</p>
      </div>
      {children}
    </aside>
  );
}
