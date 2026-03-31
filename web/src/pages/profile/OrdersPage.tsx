import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/AsyncState';
import { useAsyncData } from '../../hooks/useAsyncData';
import { listOrders, payOrder } from '../../services/orders';
import styles from './WorkspacePage.module.scss';

const filters = [
  { key: 'all', label: '全部' },
  { key: 0, label: '待付款' },
  { key: 1, label: '已支付' },
  { key: 2, label: '已取消' },
] as const;

function calcProgress(status: number) {
  if (status === 1) return 100;
  if (status === 0) return 48;
  if (status === 2) return 100;
  return 24;
}

export function OrdersPage() {
  const [activeFilter, setActiveFilter] = useState<(typeof filters)[number]['key']>('all');
  const [actionMessage, setActionMessage] = useState('');
  const { data, loading, error, reload } = useAsyncData(() => listOrders({ page: 1, pageSize: 12 }), []);

  const filtered = useMemo(() => {
    if (!data) return [];
    if (activeFilter === 'all') return data.list;
    return data.list.filter((item) => item.status === activeFilter);
  }, [activeFilter, data]);

  if (loading) return <LoadingBlock title="加载订单列表" />;
  if (error || !data) return <ErrorBlock description={error || '加载订单失败'} onRetry={() => void reload()} />;

  return (
    <div className={styles.pageContainer}>
      <header className={styles.sectionHead}>
        <h2>我的订单</h2>
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

      {actionMessage ? <div className={styles.messageNote}>{actionMessage}</div> : null}

      {filtered.length === 0 ? (
        <EmptyBlock title="暂无订单" description="" />
      ) : (
        <div className={styles.list}>
          {filtered.map((item) => {
            const href = item.actionPath
              || (item.recordType === 'payment'
                ? `/payments/${item.id}`
                : item.projectId
                  ? `/projects/${item.projectId}`
                  : item.proposalId
                    ? `/proposals/${item.proposalId}`
                    : undefined);
            const progress = calcProgress(item.status);

            const card = (
              <div className={styles.card}>
                <div className={styles.cardBody}>
                  <div className={styles.cardTitle}>
                    <h3>{item.orderNo}</h3>
                    <p>{item.providerName}</p>
                  </div>
                  <div className={styles.statusBar}>
                    <div className={styles.statusFill} style={{ width: `${progress}%` }} />
                  </div>
                </div>
                <div className={styles.metaBlock}>
                  <span>{item.statusText}</span>
                  <strong>{item.amountText}</strong>
                </div>
              </div>
            );

            return href ? (
              <Link key={`${item.recordType}-${item.id}`} to={href}>{card}</Link>
            ) : (
              <div key={`${item.recordType}-${item.id}`}>{card}</div>
            );
          })}
        </div>
      )}

      {filtered.some((item) => item.recordType === 'order' && item.status === 0) && (
        <div className={styles.inlineActionWrap}>
          {filtered.filter((item) => item.recordType === 'order' && item.status === 0).slice(0, 1).map((item) => (
            <button
              className={styles.primaryInlineAction}
              key={`${item.recordType}-${item.id}`}
              onClick={async () => {
                setActionMessage('');
                try {
                  const payment = await payOrder(item.id);
                  window.location.assign(payment.launchUrl);
                } catch (payError) {
                  setActionMessage(payError instanceof Error ? payError.message : '支付失败');
                }
              }}
              type="button"
            >
              支付最近待付款订单
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
