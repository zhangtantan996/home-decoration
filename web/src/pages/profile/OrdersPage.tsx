import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/AsyncState';
import { useAsyncData } from '../../hooks/useAsyncData';
import { listOrders, payOrder } from '../../services/orders';

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
  if (error || !data) return <ErrorBlock description={error || '订单列表加载失败'} onRetry={() => void reload()} />;

  return (
    <section>
      <div className="section-head" style={{ marginBottom: 20 }}>
        <h2>我的订单</h2>
      </div>
      <div className="ptabs" style={{ marginBottom: 16 }}>
        {filters.map((item) => (
          <button className={`ptab ${activeFilter === item.key ? 'active' : ''}`} key={String(item.key)} onClick={() => setActiveFilter(item.key)} type="button">
            {item.label}
          </button>
        ))}
      </div>
      {actionMessage ? <div className="status-note" style={{ marginBottom: 16 }}>{actionMessage}</div> : null}
      {filtered.length === 0 ? <EmptyBlock title="暂无订单" description="当前筛选条件下没有订单记录。" /> : (
        <div className="project-list">
          {filtered.map((item) => {
            const href = item.projectId ? `/projects/${item.projectId}` : item.proposalId ? `/proposals/${item.proposalId}` : undefined;
            const progress = calcProgress(item.status);
            const card = (
              <div className="proj-card">
                <div>
                  <div className="proj-name">{item.orderNo}</div>
                  <div className="proj-phase">{item.providerName} · {item.statusText}</div>
                  <div className="proj-bar"><div className="proj-bar-fill" style={{ width: `${progress}%` }} /></div>
                </div>
                <div className="proj-percent">{item.amountText}</div>
              </div>
            );

            return href ? (
              <Link key={item.id} to={href}>{card}</Link>
            ) : (
              <div key={item.id}>{card}</div>
            );
          })}
        </div>
      )}
      {filtered.some((item) => item.status === 0) ? (
        <div className="inline-actions" style={{ marginTop: 16 }}>
          {filtered.filter((item) => item.status === 0).slice(0, 1).map((item) => (
            <button
              className="button-secondary"
              key={item.id}
              onClick={async () => {
                setActionMessage('');
                try {
                  await payOrder(item.id);
                  setActionMessage(`订单 ${item.orderNo} 已支付。`);
                  await reload();
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
      ) : null}
    </section>
  );
}
