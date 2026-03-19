import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/AsyncState';
import { useAsyncData } from '../../hooks/useAsyncData';
import { listBookings } from '../../services/bookings';

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
    <section>
      <div className="section-head" style={{ marginBottom: 20 }}>
        <h2>我的预约</h2>
      </div>
      <div className="ptabs" style={{ marginBottom: 16 }}>
        {filters.map((item) => (
          <button className={`ptab ${activeFilter === item.key ? 'active' : ''}`} key={item.key} onClick={() => setActiveFilter(item.key)} type="button">
            {item.label}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? <EmptyBlock title="暂无预约" description="当前筛选条件下没有预约记录。" /> : (
        <div className="project-list">
          {filtered.map((item) => {
            const progress = calcProgress(item.statusText);
            return (
              <Link className="proj-card" key={item.id} to={item.href}>
                <div>
                  <div className="proj-name">{item.title}</div>
                  <div className="proj-phase">{item.providerTypeText} · {item.address}</div>
                  <div className="proj-bar"><div className="proj-bar-fill" style={{ width: `${progress}%` }} /></div>
                </div>
                <div className="proj-percent">{progress}%</div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
