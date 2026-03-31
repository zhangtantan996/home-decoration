import styles from './ProjectTimeline.module.scss';

export type TimelineEventTone = 'done' | 'active' | 'pending';

export interface TimelineEvent {
  id: string;
  label: string;
  date?: string;
  tone: TimelineEventTone;
}

export interface ProjectTimelineProps {
  events: TimelineEvent[];
  className?: string;
}

export function ProjectTimeline({ events, className }: ProjectTimelineProps) {
  if (events.length === 0) {
    return (
      <div className={`${styles.wrap} ${className || ''}`}>
        <div className={styles.empty}>暂无项目时间线数据。</div>
      </div>
    );
  }

  return (
    <div className={`${styles.wrap} ${className || ''}`}>
      <ol className={styles.timeline}>
        {events.map((event) => (
          <li key={event.id} className={`${styles.item} ${styles[event.tone]}`}>
            <div className={styles.dot} />
            <div className={styles.body}>
              <span className={styles.label}>{event.label}</span>
              {event.date && <span className={styles.date}>{event.date}</span>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
