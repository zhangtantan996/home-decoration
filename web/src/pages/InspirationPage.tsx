import { Link } from 'react-router-dom';

import { EmptyBlock, ErrorBlock, LoadingBlock } from '../components/AsyncState';
import { useAsyncData } from '../hooks/useAsyncData';
import { listInspiration } from '../services/inspiration';
import styles from './InspirationPage.module.scss';

export function InspirationPage() {
  const { data, loading, error, reload } = useAsyncData(() => listInspiration({ page: 1, pageSize: 12 }), []);

  return (
    <div className="container page-stack">
      <section className="card section-card">
        <p className="kicker eyebrow-accent">装修灵感</p>
        <h1 className="page-title">先看真实案例，再决定要不要推进业务</h1>
        <p className="page-subtitle">灵感页不只是内容陈列，它帮你建立风格和空间判断，减少沟通里的空转。</p>
      </section>

      <section className="card section-card">
        {loading ? <LoadingBlock title="加载灵感案例" /> : null}
        {error ? <ErrorBlock description={error} onRetry={() => void reload()} /> : null}
        {!loading && !error && data?.list.length === 0 ? <EmptyBlock title="暂无灵感案例" description="当前还没有已公开的案例内容。" /> : null}
        {!loading && !error && data && data.list.length > 0 ? (
          <div className={styles.grid}>
            {data.list.map((item) => (
              <Link className={styles.card} key={item.id} to={`/inspiration/${item.id}`}>
                <img alt={item.title} src={item.coverImage} />
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.style} · {item.layout} · {item.area}</p>
                  <span>{item.authorName} · {item.priceText}</span>
                </div>
              </Link>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
