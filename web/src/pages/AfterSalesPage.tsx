import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { EmptyBlock, ErrorBlock, LoadingBlock } from '../components/AsyncState';
import { useAsyncData } from '../hooks/useAsyncData';
import { listAfterSales } from '../services/afterSales';
import styles from './profile/WorkspacePage.module.scss';

const filters = [
  { key: 'all', label: '全部' },
  { key: 0, label: '待处理' },
  { key: 1, label: '处理中' },
  { key: 2, label: '已完成' },
  { key: 3, label: '已关闭' },
] as const;

export function AfterSalesPage() {
  const [activeFilter, setActiveFilter] = useState<(typeof filters)[number]['key']>('all');
  const { data, loading, error, reload } = useAsyncData(() => listAfterSales(), []);

  const filtered = useMemo(() => {
    if (!data) {
      return [];
    }
    if (activeFilter === 'all') {
      return data;
    }
    return data.filter((item) => item.status === activeFilter);
  }, [activeFilter, data]);

  if (loading) {
    return <LoadingBlock title="加载售后中心" />;
  }

  if (error || !data) {
    return <ErrorBlock description={error || '售后中心加载失败'} onRetry={() => void reload()} />;
  }

  return (
    <div className={styles.pageContainer}>
      <header className={styles.sectionHead}>
        <h2>售后 / 争议</h2>
        <Link className={styles.headerAction} to="/after-sales/new">发起售后申请</Link>
      </header>

      <div className={styles.filterTabs}>
        {filters.map((item) => (
          <button className={`${styles.filterTab} ${activeFilter === item.key ? styles.active : ''}`} key={String(item.key)} onClick={() => setActiveFilter(item.key)} type="button">
            {item.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? <EmptyBlock title="暂无售后申请" description="你当前还没有符合筛选条件的售后或争议记录。" /> : (
        <div className={styles.list}>
          {filtered.map((item) => (
            <Link className={styles.card} key={item.id} to={`/after-sales/${item.id}`}>
              <div className={styles.cardBody}>
                <div className={styles.cardTitle}>
                  <h3>{item.reason}</h3>
                  <p>关联预约 #{item.bookingId} · 单号 {item.orderNo}</p>
                </div>
                <div className={styles.statusBar}>
                  <div className={styles.statusFill} style={{ width: `${item.status === 2 || item.status === 3 ? 100 : item.status === 1 ? 62 : 28}%` }} />
                </div>
              </div>
              <div className={styles.metaBlock}>
                <span>{item.statusText}</span>
                <strong>{item.amountText}</strong>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
