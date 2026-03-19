import { Link } from 'react-router-dom';

import { EmptyBlock, ErrorBlock, LoadingBlock } from '../components/AsyncState';
import { useAsyncData } from '../hooks/useAsyncData';
import { listInspiration } from '../services/inspiration';

export function InspirationPage() {
  const { data, loading, error, reload } = useAsyncData(() => listInspiration({ page: 1, pageSize: 12 }), []);

  return (
    <div className="container page-stack">
      <section className="hero" style={{ padding: '64px 56px', marginBottom: 0 }}>
        <div className="hero-inner">
          <div className="hero-text">
            <div className="hero-greeting">装修灵感 / INSPIRATION</div>
            <h1>沉浸真实案例，<br /><em>发现理想家</em></h1>
            <p className="hero-desc">灵感页不只是内容陈列，它帮你建立风格和空间判断，减少沟通里的空转。</p>
          </div>
          <div className="hero-mini" style={{ alignSelf: 'center' }}>
            <div className="hero-mini-card">
              <dt className="clr-blue">1000+</dt>
              <dd>高品质案例</dd>
            </div>
            <div className="hero-mini-card">
              <dt className="clr-green">100%</dt>
              <dd>真实呈现</dd>
            </div>
          </div>
        </div>
      </section>

      <section style={{ padding: '8px 0' }}>
        {loading ? <LoadingBlock title="加载灵感案例" /> : null}
        {error ? <ErrorBlock description={error} onRetry={() => void reload()} /> : null}
        {!loading && !error && data?.list.length === 0 ? <EmptyBlock title="暂无灵感案例" description="当前还没有已公开的案例内容。" /> : null}
        {!loading && !error && data && data.list.length > 0 ? (
          <div className="insp-grid">
            {data.list.map((item) => (
              <Link className="icard" key={item.id} to={`/inspiration/${item.id}`}>
                <div className="icard-cover">
                  <img alt={item.title} src={item.coverImage} />
                  <div className="icard-overlay" />
                  <div className="icard-style">{item.style}</div>
                  <div className="icard-stats">
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <svg fill="currentColor" height="12" viewBox="0 0 24 24" width="12"><path d="M21 3H3C1.89543 3 1 3.89543 1 5V19C1 20.1046 1.89543 21 3 21H21C22.1046 21 23 20.1046 23 19V5C23 3.89543 22.1046 3 21 3ZM21 19H3V5H21V19Z" /></svg>
                      {item.layout}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <svg fill="currentColor" height="12" viewBox="0 0 24 24" width="12"><path d="M12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2ZM12 20C7.58172 20 4 16.4183 4 12C4 7.58172 7.58172 4 12 4C16.4183 4 20 7.58172 20 12C20 16.4183 16.4183 20 12 20ZM12.5 7H11V13L16.2 16.2L17 15L12.5 12.2V7Z" /></svg>
                      {item.area}
                    </span>
                  </div>
                </div>
                <div className="icard-body">
                  <h3 className="icard-title">{item.title}</h3>
                  <div className="icard-author" style={{ justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="icard-av">{item.authorName.slice(0, 1)}</div>
                      <span>{item.authorName}</span>
                    </div>
                    <span style={{ fontWeight: 600, color: 'var(--color-brand)' }}>{item.priceText}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
