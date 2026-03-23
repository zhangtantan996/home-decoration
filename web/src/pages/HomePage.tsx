import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { ErrorBlock } from '../components/AsyncState';
import { MaterialShopCard } from '../components/MaterialShopCard';
import { ProviderCard } from '../components/ProviderCard';
import { useAsyncData } from '../hooks/useAsyncData';
import { getPublicHomePageData } from '../services/home';
import type { HomeServiceCategory } from '../types/viewModels';
import styles from './HomePage.module.scss';

const tabs: Array<{ id: HomeServiceCategory; label: string }> = [
  { id: 'designer', label: '设计师' },
  { id: 'company', label: '装修公司' },
  { id: 'foreman', label: '工长' },
  { id: 'material', label: '主材门店' },
];

function joinClassNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

function ProviderSectionSkeleton() {
  return (
    <div className={styles.providerGrid}>
      {Array.from({ length: 4 }, (_, index) => (
        <article className={styles.providerSkeleton} key={`provider-skeleton-${index}`}>
          <div className={styles.providerSkeletonMedia} />
          <div className={styles.providerSkeletonBody}>
            <span className={styles.providerSkeletonLine} />
            <span className={joinClassNames(styles.providerSkeletonLine, styles.shortLine)} />
            <span className={joinClassNames(styles.providerSkeletonLine, styles.mutedLine)} />
          </div>
        </article>
      ))}
    </div>
  );
}

function InspirationSectionSkeleton() {
  return (
    <div className={styles.inspirationGrid}>
      {Array.from({ length: 8 }, (_, index) => (
        <article className={styles.inspirationSkeleton} key={`inspiration-skeleton-${index}`}>
          <div className={styles.inspirationSkeletonMedia} />
          <div className={styles.inspirationSkeletonBody}>
            <span className={joinClassNames(styles.providerSkeletonLine, styles.shortLine)} />
            <span className={styles.providerSkeletonLine} />
            <span className={joinClassNames(styles.providerSkeletonLine, styles.mutedLine)} />
          </div>
        </article>
      ))}
    </div>
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [activeTab, setActiveTab] = useState<HomeServiceCategory>('designer');

  const { data, loading, error, reload } = useAsyncData(() => getPublicHomePageData(), []);

  const recommendationNodes = useMemo(() => {
    if (!data) return [] as ReactNode[];
    if (activeTab === 'material') return data.materialShops.map((shop) => <MaterialShopCard key={shop.id} shop={shop} />);
    if (activeTab === 'company') return data.companies.map((provider) => <ProviderCard key={provider.id} provider={provider} />);
    if (activeTab === 'foreman') return data.foremen.map((provider) => <ProviderCard key={provider.id} provider={provider} />);
    return data.designers.map((provider) => <ProviderCard key={provider.id} provider={provider} />);
  }, [activeTab, data]);
  const displayedRecommendationNodes = useMemo(() => recommendationNodes.slice(0, 4), [recommendationNodes]);
  const providerCount = displayedRecommendationNodes.length;

  const handleSearch = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const query = keyword.trim();
    navigate(`/providers${query ? `?keyword=${encodeURIComponent(query)}` : ''}`);
  };

  const providerEmptyState = (
    <div className={styles.emptyPanel}>
      <div className={styles.emptyBadge}>推荐服务商</div>
      <h3>当前还没有可展示的推荐内容</h3>
      <p>稍后再看，或直接进入找服务页搜索你想要的设计师、装修公司、工长或主材门店。</p>
      <Link className={styles.emptyAction} to="/providers">去找服务</Link>
    </div>
  );

  const inspirationEmptyState = (
    <div className={styles.emptyPanel}>
      <div className={styles.emptyBadge}>灵感发现</div>
      <h3>当前还没有可展示的灵感案例</h3>
      <p>灵感图库为独立上传内容，后续有内容后会从这里开始展示。</p>
      <Link className={styles.emptyAction} to="/inspiration">查看灵感案例</Link>
    </div>
  );

  const providerSectionContent = (() => {
    if (loading) return <ProviderSectionSkeleton />;
    if (error) {
      return (
        <div className={styles.stateBlock}>
          <ErrorBlock description={error} onRetry={() => void reload()} />
        </div>
      );
    }
    if (providerCount === 0) {
      return providerEmptyState;
    }
    return <div className={styles.providerGrid}>{displayedRecommendationNodes}</div>;
  })();

  const inspirationSectionContent = (() => {
    if (loading) return <InspirationSectionSkeleton />;
    if (error) {
      return (
        <div className={styles.stateBlock}>
          <ErrorBlock description={error} onRetry={() => void reload()} />
        </div>
      );
    }
    if (!data || data.inspirationHighlights.length === 0) {
      return inspirationEmptyState;
    }
    return (
      <div className={styles.inspirationGrid}>
        {data.inspirationHighlights.slice(0, 8).map((item) => (
          <Link className={styles.inspirationCard} key={item.id} to={`/inspiration/${item.id}`}>
            <div className={styles.inspirationMedia}>
              <img alt={item.title} src={item.coverImage} />
            </div>
            <div className={styles.inspirationBody}>
              <div className={styles.inspirationMetaTop}>
                <span>{item.style || '灵感案例'}</span>
                <span>{[item.layout, item.area].filter(Boolean).join(' · ') || '精选灵感'}</span>
              </div>
              <h3>{item.title}</h3>
              <div className={styles.inspirationFoot}>
                <div className={styles.inspirationAuthor}>
                  {item.authorAvatar ? (
                    <img alt={item.authorName} src={item.authorAvatar} />
                  ) : (
                    <span className={styles.inspirationAuthorFallback}>{item.authorName.slice(0, 1) || '官'}</span>
                  )}
                  <span>{item.authorName}</span>
                </div>
                <span className={styles.inspirationEngagement}>赞 {item.likeCount + item.commentCount}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    );
  })();

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <h1 className={styles.heroTitle}>开启您的理想家居之旅</h1>
          <form className={styles.searchPanel} onSubmit={handleSearch}>
            <div className={styles.searchForm}>
              <input
                aria-label="搜索服务商"
                className={styles.searchInput}
                id="home-provider-search"
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="搜索设计师、装修公司、工长或主材门店"
                value={keyword}
              />
              <button className={styles.searchButton} type="submit">立即搜索</button>
            </div>
          </form>
        </div>
      </section>

      <div className={styles.pageInner}>
        <div className={styles.showcaseShell}>
          <section className={styles.section} id="home-providers">
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>推荐服务商</h2>
            </div>

            <div className={styles.inlineTabList}>
              {tabs.map((tab) => (
                <button
                  className={joinClassNames(styles.inlineTab, activeTab === tab.id && styles.inlineTabActive)}
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  type="button"
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {providerSectionContent}

            <div className={styles.sectionFooter}>
              <Link className={styles.sectionMoreButton} to={`/providers?category=${activeTab}`}>查看更多服务商</Link>
            </div>
          </section>

          <section className={joinClassNames(styles.section, styles.inspirationSection)} id="home-inspiration">
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>灵感发现</h2>
            </div>

            {inspirationSectionContent}

            <div className={styles.sectionFooter}>
              <Link className={styles.sectionMoreButton} to="/inspiration">查看更多灵感</Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
