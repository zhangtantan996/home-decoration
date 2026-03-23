import { Link } from 'react-router-dom';

import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/AsyncState';
import { useAsyncData } from '../../hooks/useAsyncData';
import { listComplaints } from '../../services/complaints';
import styles from './WorkspacePage.module.scss';

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
    <div className={styles.pageContainer}>
      <header className={styles.sectionHead}>
        <h2>我的投诉</h2>
        <Link className={styles.headerAction} to="/complaints/new">
          发起投诉
        </Link>
      </header>

      {data.length === 0 ? (
        <EmptyBlock title="暂无投诉记录" description="" />
      ) : (
        <div className={styles.list}>
          {data.map((item) => {
            const progress = calcProgress(item.status);
            return (
              <div className={styles.card} key={item.id}>
                <div className={styles.cardBody}>
                  <div className={styles.cardTitle}>
                    <h3>{item.title}</h3>
                    <p>{item.category}</p>
                  </div>
                  <div className={styles.statusBar}>
                    <div className={styles.statusFill} style={{ width: `${progress}%` }} />
                  </div>
                </div>
                <div className={styles.metaBlock}>
                  <span>{item.status}</span>
                  <strong>{progress}%</strong>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
