import { Link } from 'react-router-dom';

import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/AsyncState';
import { useAsyncData } from '../../hooks/useAsyncData';
import { listComplaints } from '../../services/complaints';

function calcProgress(status: string) {
  if (status === 'resolved') return 100;
  if (status === 'processing') return 62;
  return 24;
}

export function ComplaintsPage() {
  const { data, loading, error, reload } = useAsyncData(() => listComplaints(), []);

  if (loading) return <LoadingBlock title="加载我的投诉" />;
  if (error || !data) return <ErrorBlock description={error || '投诉列表加载失败'} onRetry={() => void reload()} />;

  return (
    <section>
      <div className="section-head" style={{ marginBottom: 20 }}>
        <h2>我的投诉</h2>
        <Link className="button-secondary" to="/complaints/new">发起投诉</Link>
      </div>
      {data.length === 0 ? (
        <EmptyBlock title="暂无投诉记录" description="项目出现争议后，可以在这里发起投诉并持续查看处理进度。" />
      ) : (
        <div className="project-list">
          {data.map((item) => {
            const progress = calcProgress(item.status);
            return (
              <div className="proj-card" key={item.id}>
                <div>
                  <div className="proj-name">{item.title}</div>
                  <div className="proj-phase">{item.category} · {item.status}</div>
                  <div className="proj-bar"><div className="proj-bar-fill" style={{ width: `${progress}%` }} /></div>
                </div>
                <div className="proj-percent">{progress}%</div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
