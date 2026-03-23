import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/AsyncState';
import { useAsyncData } from '../../hooks/useAsyncData';
import { listProposals } from '../../services/proposals';
import styles from './WorkspacePage.module.scss';

const filters = [
  { key: 'all', label: '全部' },
  { key: 1, label: '待确认' },
  { key: 2, label: '已确认' },
  { key: 4, label: '已过期' },
] as const;

function calcProgress(status: number) {
  if (status === 2) return 100;
  if (status === 1) return 62;
  if (status === 4) return 100;
  return 18;
}

export function ProposalsPage() {
  const [activeFilter, setActiveFilter] = useState<(typeof filters)[number]['key']>('all');
  const { data, loading, error, reload } = useAsyncData(listProposals, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    if (activeFilter === 'all') return data;
    return data.filter((item) => item.status === activeFilter);
  }, [activeFilter, data]);

  if (loading) return <LoadingBlock title="加载报价列表" />;
  if (error || !data) return <ErrorBlock description={error || '报价列表加载失败'} onRetry={() => void reload()} />;

  return (
    <div className={styles.pageContainer}>
      <header className={styles.sectionHead}>
        <h2>我的报价</h2>
      </header>

      <div className={styles.filterTabs}>
        {filters.map((item) => (
          <button
            className={`${styles.filterTab} ${activeFilter === item.key ? styles.active : ''}`}
            key={String(item.key)}
            onClick={() => setActiveFilter(item.key)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyBlock title="暂无报价" description="" />
      ) : (
        <div className={styles.list}>
          {filtered.map((item) => {
            const progress = calcProgress(item.status);
            return (
              <Link className={styles.card} key={item.id} to={item.href}>
                <div className={styles.cardBody}>
                  <div className={styles.cardTitle}>
                    <h3>{item.summary}</h3>
                    <p>{item.designFeeText}</p>
                  </div>
                  <div className={styles.statusBar}>
                    <div className={styles.statusFill} style={{ width: `${progress}%` }} />
                  </div>
                </div>
                <div className={styles.metaBlock}>
                  <span>{item.statusText}</span>
                  <strong>{item.designFeeText}</strong>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
