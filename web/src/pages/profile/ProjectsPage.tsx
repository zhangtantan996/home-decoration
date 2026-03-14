import { Link } from 'react-router-dom';

import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/AsyncState';
import { useAsyncData } from '../../hooks/useAsyncData';
import { listProjects } from '../../services/projects';

function calcProgress(currentPhase: string, statusText: string) {
  if (statusText.includes('完工')) return 100;
  if (currentPhase.includes('验收')) return 96;
  if (currentPhase.includes('安装')) return 82;
  if (currentPhase.includes('油漆')) return 70;
  if (currentPhase.includes('泥木')) return 56;
  if (currentPhase.includes('水电')) return 42;
  if (currentPhase.includes('拆改')) return 24;
  return 12;
}

export function ProjectsPage() {
  const { data, loading, error, reload } = useAsyncData(() => listProjects({ page: 1, pageSize: 12 }), []);

  if (loading) return <LoadingBlock title="加载项目列表" />;
  if (error || !data) return <ErrorBlock description={error || '项目列表加载失败'} onRetry={() => void reload()} />;

  return (
    <section>
      <div className="section-head" style={{ marginBottom: 20 }}>
        <h2>我的项目</h2>
        <Link className="sec-more" to="/progress">进入进度看板</Link>
      </div>
      {data.list.length === 0 ? <EmptyBlock title="暂无项目" description="当前还没有进行中的项目。" /> : (
        <div className="project-list">
          {data.list.map((item) => {
            const progress = calcProgress(item.currentPhase, item.statusText);
            return (
              <Link className="proj-card" key={item.id} to={item.href}>
                <div>
                  <div className="proj-name">{item.name}</div>
                  <div className="proj-phase">{item.currentPhase} · {item.statusText}</div>
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
