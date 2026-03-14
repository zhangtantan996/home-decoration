import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { EmptyBlock, ErrorBlock, LoadingBlock } from '../components/AsyncState';
import { useAsyncData } from '../hooks/useAsyncData';
import { listAfterSales } from '../services/afterSales';

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
    return <div className="container page-stack"><LoadingBlock title="加载售后中心" /></div>;
  }

  if (error || !data) {
    return <div className="container page-stack"><ErrorBlock description={error || '售后中心加载失败'} onRetry={() => void reload()} /></div>;
  }

  return (
    <div className="container page-stack">
      <section className="card section-card">
        <div className="page-hero">
          <div className="page-hero-copy">
            <p className="kicker eyebrow-accent">售后 / 争议</p>
            <h1 className="page-title">统一查看退款、投诉与返修申请</h1>
            <p className="page-subtitle">把售后记录集中起来，方便你持续跟进平台处理状态，不需要在消息里反复回找。</p>
          </div>
          <div className="inline-actions">
            <Link className="button-secondary" to="/after-sales/new">发起售后申请</Link>
          </div>
        </div>
      </section>

      <section className="card section-card">
        <div className="inline-actions">
          {filters.map((item) => (
            <button className="filter-chip" data-active={activeFilter === item.key} key={String(item.key)} onClick={() => setActiveFilter(item.key)} type="button">
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <section className="card section-card">
        {filtered.length === 0 ? <EmptyBlock title="暂无售后申请" description="你当前还没有符合筛选条件的售后或争议记录。" /> : (
          <div className="list-stack">
            {filtered.map((item) => (
              <Link className="list-card" key={item.id} to={`/after-sales/${item.id}`}>
                <div>
                  <div className="inline-actions" style={{ marginBottom: 10 }}>
                    <span className="status-chip" data-tone={item.status === 0 ? 'warning' : item.status === 1 ? 'brand' : item.status === 2 ? 'success' : 'danger'}>{item.statusText}</span>
                    <span className="status-chip">{item.typeText}</span>
                  </div>
                  <h3>{item.reason}</h3>
                  <p>关联预约 #{item.bookingId} · 单号 {item.orderNo}</p>
                </div>
                <div className="list-meta">
                  <strong>{item.amountText}</strong>
                  <span>{item.createdAt}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
