import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/AsyncState';
import { useAsyncData } from '../../hooks/useAsyncData';
import { listProposals } from '../../services/proposals';

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
    <section>
      <div className="section-head" style={{ marginBottom: 20 }}>
        <h2>我的报价</h2>
      </div>
      <div className="ptabs" style={{ marginBottom: 16 }}>
        {filters.map((item) => (
          <button className={`ptab ${activeFilter === item.key ? 'active' : ''}`} key={String(item.key)} onClick={() => setActiveFilter(item.key)} type="button">
            {item.label}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? <EmptyBlock title="暂无报价" description="当前筛选条件下没有报价方案。" /> : (
        <div className="project-list">
          {filtered.map((item) => {
            const progress = calcProgress(item.status);
            return (
              <Link className="proj-card" key={item.id} to={item.href}>
                <div>
                  <div className="proj-name">{item.summary}</div>
                  <div className="proj-phase">{item.statusText} · {item.designFeeText}</div>
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
