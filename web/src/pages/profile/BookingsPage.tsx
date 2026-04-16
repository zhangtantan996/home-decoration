import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/AsyncState';
import { useAsyncData } from '../../hooks/useAsyncData';
import { listBookings } from '../../services/bookings';
import type { BookingListItemVM } from '../../types/viewModels';
import styles from './BookingsPage.module.scss';

const filters = [
  { key: 'all', label: '全部' },
  { key: '待沟通', label: '待确认' },
  { key: '已确认', label: '已接受' },
  { key: '已取消', label: '已取消' },
  { key: '已完成', label: '已转报价' },
] as const;

function buildFilterCountMap(list: BookingListItemVM[]) {
  return list.reduce<Record<string, number>>((acc, item) => {
    const key = item.statusText;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function readStatusTone(statusText: string) {
  switch (statusText) {
    case '已确认':
      return 'confirmed';
    case '已完成':
      return 'completed';
    case '已取消':
      return 'cancelled';
    default:
      return 'pending';
  }
}

function readProgress(statusText: string) {
  switch (statusText) {
    case '已完成':
      return 100;
    case '已确认':
      return 72;
    case '待沟通':
      return 36;
    default:
      return 12;
  }
}

function readStageHint(item: BookingListItemVM) {
  switch (item.statusText) {
    case '已完成':
      return '预约阶段已完成，当前可继续查看后续报价或施工衔接。';
    case '已确认':
      return `${item.providerTypeText}已经确认预约，接下来会进入沟通确认与量房安排。`;
    case '已取消':
      return '这笔预约已经取消，当前仅保留历史记录查看入口。';
    default:
      return `正在等待${item.providerTypeText}确认预约与档期安排，确认前无需继续支付。`;
  }
}

function readProgressLabel(statusText: string) {
  switch (statusText) {
    case '已完成':
      return '已进入后续阶段';
    case '已确认':
      return '等待沟通与量房';
    case '已取消':
      return '预约已关闭';
    default:
      return '等待服务商确认';
  }
}

export function BookingsPage() {
  const [activeFilter, setActiveFilter] = useState<(typeof filters)[number]['key']>('all');
  const { data, loading, error, reload } = useAsyncData(listBookings, []);
  const filterCounts = useMemo(() => buildFilterCountMap(data || []), [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    if (activeFilter === 'all') return data;
    return data.filter((item) => item.statusText === activeFilter);
  }, [activeFilter, data]);

  if (loading) return <LoadingBlock title="加载预约列表" />;
  if (error || !data) return <ErrorBlock description={error || '预约列表加载失败'} onRetry={() => void reload()} />;

  return (
    <div className={styles.pageContainer}>
      <header className={styles.pageHead}>
        <p className={styles.kicker}>个人中心</p>
        <div className={styles.headlineRow}>
          <div className={styles.headlineCopy}>
            <h2>我的预约</h2>
            <p>这里集中查看预约确认、量房安排以及是否已经进入后续报价阶段。</p>
          </div>
          <span className={styles.summaryBadge}>{data.length} 条预约记录</span>
        </div>
      </header>

      <div className={styles.filterTabs} role="tablist" aria-label="预约筛选">
        {filters.map((item) => {
          const count = item.key === 'all' ? data.length : filterCounts[item.key] || 0;
          const active = activeFilter === item.key;
          return (
            <button
              aria-selected={active}
              className={`${styles.filterTab} ${active ? styles.filterTabActive : ''}`.trim()}
              key={item.key}
              onClick={() => setActiveFilter(item.key)}
              role="tab"
              type="button"
            >
              <span>{item.label}</span>
              <em>{count}</em>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <EmptyBlock title="暂无预约" description="" />
      ) : (
        <div className={styles.bookingList}>
          {filtered.map((item) => {
            const progress = readProgress(item.statusText);
            const statusTone = readStatusTone(item.statusText);
            return (
              <article className={`${styles.bookingCard} ${styles[`card${statusTone[0].toUpperCase()}${statusTone.slice(1)}`]}`.trim()} key={item.id}>
                <div className={styles.cardMain}>
                  <div className={styles.cardTop}>
                    <div className={styles.identityBlock}>
                      <div className={styles.badgeRow}>
                        <span className={styles.kindBadge}>{item.providerTypeText}预约</span>
                        <span className={`${styles.statusChip} ${styles[`status${statusTone[0].toUpperCase()}${statusTone.slice(1)}`]}`.trim()}>{item.statusText}</span>
                      </div>
                      <h3 title={item.title}>{item.title}</h3>
                      <p>{readStageHint(item)}</p>
                    </div>

                    <div className={styles.progressBlock}>
                      <span>推进进度</span>
                      <strong>{progress}%</strong>
                    </div>
                  </div>

                  <div className={styles.metaGrid}>
                    <div className={styles.metaItem}>
                      <span>服务地址</span>
                      <strong title={item.address}>{item.address}</strong>
                    </div>
                    <div className={styles.metaItem}>
                      <span>期望时间</span>
                      <strong>{item.preferredDate || '待确认'}</strong>
                    </div>
                    <div className={styles.metaItem}>
                      <span>预算范围</span>
                      <strong>{item.budgetRange || '待确认'}</strong>
                    </div>
                    <div className={styles.metaItem}>
                      <span>最近更新</span>
                      <strong>{item.updatedAt || '待补充'}</strong>
                    </div>
                  </div>

                  <div className={styles.progressRow}>
                    <div className={styles.progressTrack}>
                      <div className={styles.progressFill} style={{ width: `${progress}%` }} />
                    </div>
                    <p>{readProgressLabel(item.statusText)}</p>
                  </div>
                </div>

                <div className={styles.actionColumn}>
                  <div className={styles.referenceBlock}>
                    <span>预约编号</span>
                    <strong>{`#${item.id}`}</strong>
                  </div>
                  <Link className={styles.primaryAction} to={item.href}>
                    查看预约
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
