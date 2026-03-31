import { Link } from 'react-router-dom';
import { useState } from 'react';
import styles from './TodoCard.module.scss';

export type TodoTone = 'urgent' | 'pending' | 'normal';

export interface TodoCardAction {
  label: string;
  to?: string;
  onClick?: () => Promise<void> | void;
  danger?: boolean;
}

export interface TodoCardProps {
  id: string;
  title: string;
  description: string;
  amountText?: string;
  tone: TodoTone;
  badgeText: string;
  actions: TodoCardAction[];
}

export function TodoCard({ title, description, amountText, tone, badgeText, actions }: TodoCardProps) {
  const [loadingIdx, setLoadingIdx] = useState<number | null>(null);

  const handleClick = async (action: TodoCardAction, idx: number) => {
    if (!action.onClick) return;
    setLoadingIdx(idx);
    try {
      await action.onClick();
    } finally {
      setLoadingIdx(null);
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.top}>
        <div>
          <strong>{title}</strong>
          <p>{description}</p>
        </div>
        <span className={`${styles.badge} ${styles[tone]}`}>{badgeText}</span>
      </div>
      <div className={styles.bottom}>
        {amountText && <em>{amountText}</em>}
        <div className={styles.actionRow}>
          {actions.map((action, idx) => {
            if (action.to) {
              return (
                <Link key={idx} className={`${styles.actionBtn} ${action.danger ? styles.danger : ''}`} to={action.to}>
                  {action.label}
                </Link>
              );
            }
            return (
              <button
                key={idx}
                className={`${styles.actionBtn} ${action.danger ? styles.danger : ''}`}
                disabled={loadingIdx !== null}
                onClick={() => void handleClick(action, idx)}
              >
                {loadingIdx === idx ? '处理中...' : action.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
