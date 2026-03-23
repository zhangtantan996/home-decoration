import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/AsyncState';
import { useAsyncData } from '../../hooks/useAsyncData';
import { listBookings } from '../../services/bookings';
import styles from './WorkspacePage.module.scss';

const filters = [
  { key: 'all', label: '全部' },
  { key: '待沟通', label: '待确认' },
  { key: '已确认', label: '已接受' },
  { key: '已取消', label: '已取消' },
  { key: '已完成', label: '已转报价' },
] as const;

function calcProgress(statusText: string) {
  if (statusText === '已完成') return 100;
  if (statusText === '已确认') return 72;
  if (statusText === '待沟通') return 36;
  return 12;
}

export function BookingsPage() {
  const [activeFilter, setActiveFilter] = useState<(typeof filters)[number]['key']>('all');
  const { data, loading, error, reload } = useAsyncData(listBookings, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    if (activeFilter === 'all') return data;
    return data.filter((item) => item.statusText === activeFilter);
  }, [activeFilter, data]);

  if (loading) return <LoadingBlock title="加载预约列表" />;
  if (error || !data) return <ErrorBlock description={error || '预约列表加载失败'} onRetry={() => void reload()} />;

  return (
    <div className={styles.pageContainer}>
      <header className={styles.sectionHead}>
        <h2>我的预约</h2>
      </header>

      <div className={styles.filterTabs}>
        {filters.map((item) => (
          <button
            className={`${styles.filterTab} ${activeFilter === item.key ? styles.active : ''}`}
            key={item.key}
            onClick={() => setActiveFilter(item.key)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyBlock title="暂无预约" description="" />
      ) : (
        <div className={styles.list}>
          {filtered.map((item) => {
            const progress = calcProgress(item.statusText);
            return (
              <Link className={styles.card} key={item.id} to={item.href}>
                <div className={styles.cardBody}>
                  <div className={styles.cardTitle}>
                    <h3>{item.title}</h3>
                    <p>{item.providerTypeText} · {item.address}</p>
                  </div>
                  <div className={styles.statusBar}>
                    <div className={styles.statusFill} style={{ width: `${progress}%` }} />
                  </div>
                </div>
                <div className={styles.metaBlock}>
                  <span>{item.statusText}</span>
                  <strong>{progress}%</strong>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
