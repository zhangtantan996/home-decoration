import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/AsyncState';
import { useAsyncData } from '../../hooks/useAsyncData';
import { startOrderCenterEntryPayment } from '../../services/orderCenter';
import { listOrders, payOrder } from '../../services/orders';
import type { OrderListItemVM } from '../../types/viewModels';
import { startAlipayWebPayment } from '../../utils/paymentLaunch';
import styles from './OrdersPage.module.scss';

const filters = [
  { key: 'all', label: '全部' },
  { key: 0, label: '待付款' },
  { key: 1, label: '已支付' },
  { key: 2, label: '已取消' },
  { key: 3, label: '已退款' },
] as const;

function buildFilterCountMap(list: OrderListItemVM[]) {
  return list.reduce<Record<string, number>>((acc, item) => {
    const key = String(item.status);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function buildReferenceText(item: OrderListItemVM) {
  if (item.projectId) return `项目 #${item.projectId}`;
  if (item.bookingId) return `预约 #${item.bookingId}`;
  if (item.proposalId) return `方案 #${item.proposalId}`;
  return '订单记录';
}

function resolvePrimaryHref(item: OrderListItemVM) {
  if (item.entryKey) {
    return `/orders/${encodeURIComponent(item.entryKey)}`;
  }
  return `/orders/${item.id}`;
}

function resolvePrimaryActionLabel(item: OrderListItemVM) {
  if (item.status === 0) {
    return '去支付';
  }
  return '查看订单';
}

function resolveSecondaryHref(item: OrderListItemVM, primaryHref: string) {
  const candidates = [
    item.actionPath,
    item.projectId ? `/projects/${item.projectId}` : '',
    item.bookingId ? `/bookings/${item.bookingId}` : '',
    item.proposalId ? `/proposals/${item.proposalId}` : '',
  ].filter(Boolean);

  return candidates.find((path) => path && path !== primaryHref) || '';
}

function resolveSecondaryLabel(path: string) {
  if (path.startsWith('/projects/')) return '查看项目';
  if (path.startsWith('/bookings/')) return '查看预约';
  if (path.startsWith('/proposals/')) return '查看方案';
  return '查看关联业务';
}

function resolveStatusTone(status: number) {
  switch (status) {
    case 1:
      return 'paid';
    case 2:
      return 'cancelled';
    case 3:
      return 'refunded';
    default:
      return 'pending';
  }
}

function resolveTimeMeta(item: OrderListItemVM) {
  if (item.status === 0 && item.nextPayableAt && item.nextPayableAt !== '待补充') {
    return {
      label: '支付截止',
      value: item.nextPayableAt,
    };
  }
  return {
    label: '创建时间',
    value: item.createdAt || '待补充',
  };
}

function resolveActionKey(item: OrderListItemVM) {
  return item.entryKey || `${item.recordType}:${item.id}`;
}

export function OrdersPage() {
  const [searchParams] = useSearchParams();
  const [activeFilter, setActiveFilter] = useState<(typeof filters)[number]['key']>('all');
  const [actionMessage, setActionMessage] = useState('');
  const [payingItemKey, setPayingItemKey] = useState<string | null>(null);
  const { data, loading, error, reload } = useAsyncData(() => listOrders({ page: 1, pageSize: 12 }), []);
  const focusOrderId = Number(searchParams.get('focusOrderId') || 0);

  const filterCounts = useMemo(() => buildFilterCountMap(data?.list || []), [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    if (activeFilter === 'all') return data.list;
    return data.list.filter((item) => item.status === activeFilter);
  }, [activeFilter, data]);

  const latestPending = useMemo(() => {
    const source = data?.list || [];
    return source.find((item) => item.status === 0) || null;
  }, [data]);

  useEffect(() => {
    if (!focusOrderId || !filtered.length) return;
    const target = document.getElementById(`order-${focusOrderId}`);
    if (!target) return;
    window.requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [filtered, focusOrderId]);

  const handlePayItem = async (item: OrderListItemVM) => {
    setActionMessage('');
    setPayingItemKey(resolveActionKey(item));
    try {
      if (item.entryKey) {
        await startAlipayWebPayment((request) => startOrderCenterEntryPayment(item.entryKey!, request), { onPaid: reload });
      } else {
        await startAlipayWebPayment((request) => payOrder(item.id, request), { onPaid: reload });
      }
    } catch (payError) {
      setActionMessage(payError instanceof Error ? payError.message : '发起支付失败，请稍后重试。');
    } finally {
      setPayingItemKey(null);
    }
  };

  if (loading) return <LoadingBlock title="加载订单列表" />;
  if (error || !data) return <ErrorBlock description={error || '加载订单失败'} onRetry={() => void reload()} />;

  return (
    <div className={styles.pageContainer}>
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>个人中心</p>
          <h2>我的订单</h2>
          <p className={styles.subtitle}>待支付、已完成与已关闭记录都在这里统一查看，当前动作直接跟着对应订单走。</p>
        </div>

        <div className={styles.heroAside}>
          {latestPending ? (
            <div className={styles.quickActionCard}>
              <div className={styles.quickActionCopy}>
                <span>最近待处理</span>
                <strong>{latestPending.orderTypeText}</strong>
                <p>{latestPending.providerName} · {latestPending.amountText}</p>
              </div>

              {latestPending.status === 0 ? (
                <button
                  className={styles.quickActionButton}
                  disabled={payingItemKey === resolveActionKey(latestPending)}
                  onClick={() => void handlePayItem(latestPending)}
                  type="button"
                >
                  {payingItemKey === resolveActionKey(latestPending) ? '拉起支付中…' : '去支付'}
                </button>
              ) : (
                <Link className={styles.quickActionButton} to={resolvePrimaryHref(latestPending)}>
                  去处理
                </Link>
              )}
            </div>
          ) : null}
        </div>
      </header>

      <div className={styles.filterTabs} role="tablist" aria-label="订单筛选">
        {filters.map((item) => {
          const count = item.key === 'all' ? data.list.length : filterCounts[String(item.key)] || 0;
          const active = activeFilter === item.key;
          return (
            <button
              aria-selected={active}
              className={`${styles.filterTab} ${active ? styles.filterTabActive : ''}`.trim()}
              key={String(item.key)}
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

      {actionMessage ? <div className={styles.messageNote}>{actionMessage}</div> : null}

      {filtered.length === 0 ? (
        <EmptyBlock title="当前筛选下暂无订单" description="" />
      ) : (
        <div className={styles.orderList}>
          {filtered.map((item) => {
            const primaryHref = resolvePrimaryHref(item);
            const secondaryHref = resolveSecondaryHref(item, primaryHref);
            const highlighted = focusOrderId > 0 && item.id === focusOrderId;
            const statusTone = resolveStatusTone(item.status);
            const timeMeta = resolveTimeMeta(item);

            return (
              <article
                className={`${styles.orderCard} ${styles[`card${statusTone[0].toUpperCase()}${statusTone.slice(1)}`]} ${highlighted ? styles.focusedCard : ''}`.trim()}
                id={`order-${item.id}`}
                key={`${item.recordType}-${item.id}`}
              >
                <div className={styles.cardMain}>
                  <div className={styles.cardTop}>
                    <div className={styles.identityBlock}>
                      <div className={styles.badgeRow}>
                        <span className={styles.kindBadge}>{item.orderTypeText}</span>
                      </div>
                      <h3 className={styles.orderNo} title={item.orderNo}>{item.orderNo}</h3>
                      <p className={styles.providerName} title={item.providerName}>{item.providerName || '服务商待确认'}</p>
                    </div>

                    <div className={styles.amountBlock}>
                      <span className={`${styles.statusChip} ${styles[`status${statusTone[0].toUpperCase()}${statusTone.slice(1)}`]}`}>{item.statusText}</span>
                      <strong>{item.amountText}</strong>
                    </div>
                  </div>

                  <div className={styles.metaGrid}>
                    <div className={styles.metaItem}>
                      <span>服务地址</span>
                      <strong title={item.address}>{item.address || '待补充'}</strong>
                    </div>
                    <div className={styles.metaItem}>
                      <span>{timeMeta.label}</span>
                      <strong>{timeMeta.value}</strong>
                    </div>
                    <div className={styles.metaItem}>
                      <span>关联业务</span>
                      <strong>{buildReferenceText(item)}</strong>
                    </div>
                  </div>
                </div>

                <div className={styles.actionColumn}>
                  {item.status === 0 ? (
                    <button
                      className={styles.primaryAction}
                      disabled={payingItemKey === resolveActionKey(item)}
                      onClick={() => void handlePayItem(item)}
                      type="button"
                    >
                      {payingItemKey === resolveActionKey(item) ? '拉起支付中…' : '去支付'}
                    </button>
                  ) : (
                    <Link className={styles.primaryAction} to={primaryHref}>
                      {resolvePrimaryActionLabel(item)}
                    </Link>
                  )}

                  {secondaryHref ? (
                    <Link className={styles.secondaryAction} to={secondaryHref}>
                      {resolveSecondaryLabel(secondaryHref)}
                    </Link>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
