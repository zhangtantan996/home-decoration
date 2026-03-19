import { Link } from 'react-router-dom';

import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/AsyncState';
import { useAsyncData } from '../../hooks/useAsyncData';
import { listDemands } from '../../services/demands';

function calcDemandProgress(status: string) {
  if (status === 'closed') return 100;
  if (status === 'matched') return 78;
  if (status === 'matching') return 56;
  if (status === 'submitted') return 32;
  return 12;
}

export function DemandsPage() {
  const { data, loading, error, reload } = useAsyncData(() => listDemands({ page: 1, pageSize: 12 }), []);

  if (loading) return <LoadingBlock title="加载我的需求" />;
  if (error || !data) return <ErrorBlock description={error || '需求列表加载失败'} onRetry={() => void reload()} />;

  return (
    <section>
      <div className="section-head" style={{ marginBottom: 20 }}>
        <h2>我的需求</h2>
        <Link className="button-secondary" to="/demands/new">新建需求</Link>
      </div>
      {data.list.length === 0 ? (
        <EmptyBlock title="还没有提交过需求" description="先创建一个需求，平台审核后会开始分配商家。" action={<Link className="button-secondary" to="/demands/new">去创建</Link>} />
      ) : (
        <div className="project-list">
          {data.list.map((item) => {
            const progress = calcDemandProgress(item.status);
            return (
              <Link className="proj-card" key={item.id} to={`/demands/${item.id}`}>
                <div>
                  <div className="proj-name">{item.title}</div>
                  <div className="proj-phase">{item.city}{item.district ? ` · ${item.district}` : ''} · {item.status}</div>
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
