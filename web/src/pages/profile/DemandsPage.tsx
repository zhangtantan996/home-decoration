import { Link } from 'react-router-dom';

import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/AsyncState';
import { useAsyncData } from '../../hooks/useAsyncData';
import { listDemands } from '../../services/demands';
import styles from './WorkspacePage.module.scss';

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
    <div className={styles.pageContainer}>
      <header className={styles.sectionHead}>
        <h2>我的需求</h2>
        <Link className={styles.headerAction} to="/demands/new">
          新建需求
        </Link>
      </header>

      {data.list.length === 0 ? (
        <EmptyBlock
          title="还没有提交过需求"
          description=""
          action={<Link className={styles.headerAction} to="/demands/new">去创建</Link>}
        />
      ) : (
        <div className={styles.list}>
          {data.list.map((item) => {
            const progress = calcDemandProgress(item.status);
            return (
              <Link className={styles.card} key={item.id} to={`/demands/${item.id}`}>
                <div className={styles.cardBody}>
                  <div className={styles.cardTitle}>
                    <h3>{item.title}</h3>
                    <p>{item.city}{item.district ? ` · ${item.district}` : ''}</p>
                  </div>
                  <div className={styles.statusBar}>
                    <div className={styles.statusFill} style={{ width: `${progress}%` }} />
                  </div>
                </div>
                <div className={styles.metaBlock}>
                  <span>{item.status}</span>
                  <strong>{progress}%</strong>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
