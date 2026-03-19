import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { EmptyBlock, ErrorBlock, LoadingBlock } from '../components/AsyncState';
import { MaterialShopCard } from '../components/MaterialShopCard';
import { ProviderCard } from '../components/ProviderCard';
import { useAsyncData } from '../hooks/useAsyncData';
import { useSessionStore } from '../modules/session/sessionStore';
import { getPublicHomePageData } from '../services/home';
import type { HomeServiceCategory } from '../types/viewModels';

const tabs: Array<{ id: HomeServiceCategory; label: string }> = [
  { id: 'designer', label: '设计师' },
  { id: 'company', label: '装修公司' },
  { id: 'foreman', label: '工长' },
  { id: 'material', label: '主材门店' },
];

function SearchIcon() {
  return (
    <svg fill="none" height="18" viewBox="0 0 24 24" width="18">
      <circle cx="11" cy="11" r="8" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [activeTab, setActiveTab] = useState<HomeServiceCategory>('designer');
  const user = useSessionStore((state) => state.user);

  const { data, loading, error, reload } = useAsyncData(() => getPublicHomePageData(), []);

  const heroStats = useMemo(() => {
    if (!data) return [];
    return [
      { value: `${data.stats.designerCount}`, label: '认证服务商' },
      { value: `${data.stats.companyCount + data.stats.foremanCount}`, label: '施工团队' },
      { value: `${data.stats.caseCount}`, label: '真实案例' },
    ];
  }, [data]);

  const recommendationNodes = useMemo(() => {
    if (!data) return [];
    if (activeTab === 'material') return data.materialShops.map((shop) => <MaterialShopCard key={shop.id} shop={shop} />);
    if (activeTab === 'company') return data.companies.map((provider) => <ProviderCard key={provider.id} provider={provider} />);
    if (activeTab === 'foreman') return data.foremen.map((provider) => <ProviderCard key={provider.id} provider={provider} />);
    return data.designers.map((provider) => <ProviderCard key={provider.id} provider={provider} />);
  }, [activeTab, data]);

  const displayName = user?.nickname || user?.phone || '用户';

  const handleSearch = (event?: React.FormEvent) => {
    event?.preventDefault();
    const query = keyword.trim();
    navigate(`/providers${query ? `?keyword=${encodeURIComponent(query)}` : ''}`);
  };

  if (loading) return <div className="top-page"><LoadingBlock title="加载首页" /></div>;
  if (error || !data) return <div className="top-page"><ErrorBlock description={error || '首页加载失败'} onRetry={() => void reload()} /></div>;

  return (
    <div className="top-page">
      <section className="hero home-hero-refined">
        <div className="hero-inner">
          <div className="hero-text">
            <p className="hero-greeting">您好，{displayName}</p>
            <div className="hero-brow">平台严选 · 真实案例 · 同城服务</div>
            <h1>
              找到靠谱的<em>装修服务商</em>
              <br />
              让装修更省心
            </h1>
            <p className="hero-desc">从设计、施工到主材选择，把找服务、比报价和后续推进放到一条清晰的用户路径里。</p>
            <div className="hero-actions">
              <button className="hero-btn primary" onClick={() => navigate('/providers')} type="button">去找服务</button>
              <button className="hero-btn ghost" onClick={() => navigate('/inspiration')} type="button">先看案例</button>
            </div>
          </div>
          <div className="hero-mini hero-mini-refined">
            {heroStats.map((item) => (
              <dl className="hero-mini-card" key={item.label}>
                <dt>{item.value}</dt>
                <dd>{item.label}</dd>
              </dl>
            ))}
          </div>
        </div>
      </section>

      <section className="search-section home-search-refined">
        <form className="search-body" onSubmit={handleSearch}>
          <div className="search-wrap">
            <SearchIcon />
            <input
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索服务商名称、风格、区域或类型"
              value={keyword}
            />
          </div>
          <button className="search-submit" type="submit">搜索</button>
        </form>
      </section>

      <section>
        <div className="section-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <h2>推荐服务商</h2>
            <div className="ptabs">
              {tabs.map((tab) => (
                <button className={`ptab ${activeTab === tab.id ? 'active' : ''}`} key={tab.id} onClick={() => setActiveTab(tab.id)} type="button">
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <Link className="sec-more" to="/providers">查看更多</Link>
        </div>
        <div className="providers-grid">
          {recommendationNodes.length > 0 ? recommendationNodes : <EmptyBlock title="暂无推荐服务商" description="当前还没有可展示的服务商。" />}
        </div>
      </section>

      <section className="home-inspiration-section">
        <div className="section-head home-case-head">
          <h2>灵感案例</h2>
          <Link className="sec-more" to="/inspiration">查看更多</Link>
        </div>
        <div className="insp-grid home-inspiration-grid-refined">
          {data.inspirationHighlights.map((item) => (
            <Link className="icard" key={item.id} to={`/inspiration/${item.id}`}>
              <div className="icard-cover">
                <img alt={item.title} src={item.coverImage} />
                <div className="icard-overlay" />
                <div className="icard-style">{item.style}</div>
              </div>
              <div className="icard-body">
                <div className="icard-title">{item.title}</div>
                <div className="icard-author">
                  <div className="icard-av">{item.authorName.slice(0, 1)}</div>
                  <span>{item.authorName} · {item.layout} · {item.area}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
