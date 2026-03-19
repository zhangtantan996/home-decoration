import { Link } from 'react-router-dom';

import { EmptyBlock, ErrorBlock, LoadingBlock } from '../components/AsyncState';
import { useAsyncData } from '../hooks/useAsyncData';
import { getProfileHomeData } from '../services/profile';
import type { ProfileHomeVM } from '../types/viewModels';

const iconClassMap = ['ps-blue', 'ps-green', 'ps-amber', 'ps-rose'];
const shortcutIconMap = ['ps-blue', 'ps-green', 'ps-amber', 'ps-slate'];

export function ProfileHomePage() {
  const { data, loading, error, reload } = useAsyncData<ProfileHomeVM>(getProfileHomeData, []);

  if (loading) {
    return <LoadingBlock title="加载个人中心" />;
  }

  if (error || !data) {
    return <ErrorBlock description={error || '个人中心加载失败'} onRetry={() => void reload()} />;
  }

  return (
    <>
      <section className="profile-hero">
        <div className="profile-av">
          {data.avatar ? <img alt={data.displayName} src={data.avatar} /> : data.displayName.slice(0, 1)}
        </div>
        <div className="profile-info">
          <h2>{data.displayName}</h2>
          <p>{data.phoneText}</p>
        </div>
      </section>

      <div className="profile-grid">
        {data.summaryCards.slice(0, 4).map((item, index) => (
          <article className="profile-stat" key={item.title}>
            <div className={`ps-icon ${iconClassMap[index % iconClassMap.length]}`}>{item.title.slice(0, 1)}</div>
            <div className="ps-count">{item.value}</div>
            <div className="ps-label">{item.title}</div>
            <div className="ps-sub">{item.description}</div>
          </article>
        ))}
      </div>

      <div className="profile-shortcuts">
        {data.shortcuts.slice(1, 5).map((item, index) => (
          <Link className="ps-link" key={item.key} to={item.href || '/me'}>
            <span className={`ps-link-icon ${shortcutIconMap[index % shortcutIconMap.length]}`}>{item.title.slice(0, 1)}</span>
            <span>{item.title}</span>
          </Link>
        ))}
      </div>

      {data.latestMessages.length === 0 ? null : (
        <section style={{ marginTop: 24 }}>
          <div className="section-head" style={{ marginBottom: 16 }}>
            <h2>最近动态</h2>
          </div>
          <div className="msg-list">
            {data.latestMessages.map((item) => (
              <Link className="msg-item" key={item.id} to={item.href || '/messages'}>
                <div className="msg-icon mi-blue">动</div>
                <div className="msg-body">
                  <strong>{item.title}</strong>
                  <p>{item.subtitle}</p>
                </div>
                <div className="msg-time">{item.meta}</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {data.pendingPayments.length === 0 ? null : (
        <section style={{ marginTop: 24 }}>
          <div className="section-head" style={{ marginBottom: 16 }}>
            <h2>最近订单</h2>
          </div>
          <div className="project-list">
            {data.pendingPayments.map((item) => (
              <Link className="proj-card" key={item.id} to={item.href || '/me/orders'}>
                <div>
                  <div className="proj-name">{item.title}</div>
                  <div className="proj-phase">{item.subtitle}</div>
                </div>
                <div className="proj-percent">{item.meta}</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {data.shortcuts.length === 0 ? <EmptyBlock title="暂无快捷入口" description="当前没有可展示的常用入口。" /> : null}
    </>
  );
}
