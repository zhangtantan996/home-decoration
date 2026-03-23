import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { MaterialShopCard } from '../components/MaterialShopCard';
import { Pagination } from '../components/Pagination';
import { ProviderCard } from '../components/ProviderCard';
import { UserPageFrame } from '../components/UserPageFrame';
import { useAsyncData } from '../hooks/useAsyncData';
import { getDictionaryOptions } from '../services/dictionaries';
import { listMaterialShops } from '../services/materialShops';
import { listProviders } from '../services/providers';
import { listPublicCities } from '../services/regions';
import type { HomeServiceCategory, MaterialShopListItemVM, ProviderListItemVM, ProviderRole } from '../types/viewModels';
import styles from './ProvidersPage.module.scss';

interface BudgetOption {
  value: string;
  label: string;
  min: number | null;
  max: number | null;
}

const PROVIDERS_PAGE_SIZE = 12;

const tabs: Array<{ value: HomeServiceCategory; label: string }> = [
  { value: 'designer', label: '设计师' },
  { value: 'company', label: '装修公司' },
  { value: 'foreman', label: '工长' },
  { value: 'material', label: '主材门店' },
];

function getSortOptions(category: HomeServiceCategory) {
  if (category === 'material') {
    return [
      { key: 'recommend', label: '推荐' },
      { key: 'rating', label: '评分高' },
    ] as const;
  }

  return [
    { key: 'recommend', label: '推荐' },
    { key: 'rating', label: '评分高' },
    { key: 'completed', label: '成交多' },
    { key: 'price', label: '价格低' },
  ] as const;
}

function SearchIcon() {
  return (
    <svg fill="none" height="16" viewBox="0 0 24 24" width="16">
      <circle cx="11" cy="11" r="8" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

function readCategory(value: string | null): HomeServiceCategory {
  if (value === 'company' || value === 'foreman' || value === 'material') return value;
  return 'designer';
}

function normalizeCityToken(value: string) {
  return value
    .trim()
    .replace(/[\s/]+/g, '')
    .replace(/(特别行政区|自治州|地区|盟|市)$/u, '');
}

function shortenCityLabel(value: string) {
  const normalized = normalizeCityToken(value);
  return normalized || value.trim();
}

function normalizeCityOptions(raw: string[]) {
  const seen = new Set<string>();
  return raw
    .map((item) => shortenCityLabel(item))
    .filter((item) => {
      if (!item || seen.has(item)) {
        return false;
      }
      seen.add(item);
      return true;
    });
}

function normalizeBudgetOptions(raw: Awaited<ReturnType<typeof getDictionaryOptions>>): BudgetOption[] {
  if (!raw || raw.length === 0) {
    return [
      { value: 'low', label: '≤ ¥300/㎡', min: 0, max: 300 },
      { value: 'mid', label: '¥300-800/㎡', min: 300, max: 800 },
      { value: 'high', label: '≥ ¥800/㎡', min: 800, max: null },
    ];
  }

  return raw.map((item) => {
    const extra = item.extraData || {};
    const min = typeof extra.min === 'number' ? extra.min : extra.min == null ? null : Number(extra.min);
    const max = typeof extra.max === 'number' ? extra.max : extra.max == null ? null : Number(extra.max);
    return {
      value: item.value,
      label: item.label,
      min: Number.isNaN(min as number) ? null : min,
      max: Number.isNaN(max as number) ? null : max,
    };
  });
}

function readRatingMin(value: string) {
  if (value === '4.8') return 4.8;
  if (value === '4.5') return 4.5;
  return undefined;
}

export function ProvidersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const keyword = searchParams.get('keyword') || '';
  const category = readCategory(searchParams.get('category'));
  const city = searchParams.get('city') || '';
  const rating = searchParams.get('rating') || 'all';
  const budget = searchParams.get('budget') || '';
  const sortBy = searchParams.get('sort') || 'recommend';
  const page = Math.max(1, Number(searchParams.get('page') || '1'));
  const [draftKeyword, setDraftKeyword] = useState(keyword);
  const sortOptions = useMemo(() => getSortOptions(category), [category]);
  const effectiveSortBy = sortOptions.some((item) => item.key === sortBy) ? sortBy : sortOptions[0].key;
  const searchPlaceholder = category === 'material'
    ? '搜索门店名称、品类或品牌'
    : '搜索服务商名称、风格或服务类型';

  const updateParams = (patch: Record<string, string>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      if (!value || value === 'all') next.delete(key);
      else next.set(key, value);
    });
    if (!patch.page) next.set('page', '1');
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    setDraftKeyword(keyword);
  }, [keyword]);

  useEffect(() => {
    if (sortBy === effectiveSortBy) {
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.set('sort', effectiveSortBy);
    next.set('page', '1');
    setSearchParams(next, { replace: true });
  }, [effectiveSortBy, searchParams, setSearchParams, sortBy]);

  const { data, loading, error, reload } = useAsyncData(async () => {
    const [cities, rawBudgetOptions] = await Promise.all([
      listPublicCities().catch(() => ['西安']),
      getDictionaryOptions('provider_budget_range').catch(() => []),
    ]);
    const budgetOptions = normalizeBudgetOptions(rawBudgetOptions);
    const cityOptions = normalizeCityOptions(cities.length > 0 ? cities : ['西安']);
    if (category === 'material') {
      const result = await listMaterialShops({
        page,
        pageSize: PROVIDERS_PAGE_SIZE,
        sortBy: effectiveSortBy,
        keyword: keyword.trim(),
        city,
        ratingMin: readRatingMin(rating),
      });

      return {
        mode: 'material' as const,
        list: result.list,
        total: result.total,
        page: result.page || page,
        pageSize: result.pageSize || PROVIDERS_PAGE_SIZE,
        cities: cityOptions,
        budgetOptions,
      };
    }

    const selectedBudget = budgetOptions.find((option) => option.value === budget);
    const result = await listProviders({
      role: category as ProviderRole,
      keyword: keyword.trim(),
      city,
      ratingMin: readRatingMin(rating),
      budgetMin: selectedBudget?.min ?? undefined,
      budgetMax: selectedBudget?.max ?? undefined,
      sortBy: effectiveSortBy,
      page,
      pageSize: PROVIDERS_PAGE_SIZE,
    });

    return {
      mode: 'provider' as const,
      list: result.list,
      total: result.total,
      page: result.page || page,
      pageSize: result.pageSize || PROVIDERS_PAGE_SIZE,
      cities: cityOptions,
      budgetOptions,
    };
  }, [category, keyword, city, rating, budget, effectiveSortBy, page]);

  const totalPages = useMemo(() => {
    if (!data) {
      return 1;
    }
    return Math.max(1, Math.ceil(data.total / Math.max(1, data.pageSize)));
  }, [data]);

  const currentPage = Math.max(1, Math.min(page, totalPages));

  useEffect(() => {
    if (!data || loading || page <= totalPages) {
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.set('page', String(totalPages));
    setSearchParams(next, { replace: true });
  }, [data, loading, page, searchParams, setSearchParams, totalPages]);

  // 仅装修公司和主材门店分类可能含未入驻商家，需展示免责横幅
  const hasUnsettled = useMemo(() => {
    if (!data) return false;
    if (data.mode === 'provider') {
      return category === 'company' && (data.list as ProviderListItemVM[]).some((provider) => provider.isSettled === false);
    }
    return (data.list as MaterialShopListItemVM[]).some((shop) => shop.isSettled === false);
  }, [data, category]);

  const sidebar = (
    <div className={styles.sidebarInner}>
      <section className="user-page-panel">
        <p className="user-page-label">服务类型</p>
        <div className="user-page-button-list">
          {tabs.map((tab) => (
            <button
              className={`user-page-filter ${tab.value === category ? 'active' : ''}`}
              key={tab.value}
              onClick={() => updateParams(tab.value === 'material' ? { category: tab.value, budget: 'all' } : { category: tab.value })}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      <section className="user-page-panel compact">
        <p className="user-page-label">所在城市</p>
        <div className="user-page-button-list">
          <button className={`user-page-filter ${!city ? 'active' : ''}`} onClick={() => updateParams({ city: 'all' })} type="button">
            全部城市
          </button>
          {(data?.cities || ['西安']).map((item) => (
            <button
              className={`user-page-filter ${shortenCityLabel(city) === item ? 'active' : ''}`}
              key={item}
              onClick={() => updateParams({ city: item })}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>
      </section>

      {category !== 'material' ? (
        <section className="user-page-panel compact">
          <p className="user-page-label">预算区间</p>
          <div className="user-page-button-list">
            <button className={`user-page-filter ${!budget ? 'active' : ''}`} onClick={() => updateParams({ budget: 'all' })} type="button">
              全部
            </button>
            {(data?.budgetOptions || []).map((item) => (
              <button className={`user-page-filter ${budget === item.value ? 'active' : ''}`} key={item.value} onClick={() => updateParams({ budget: item.value })} type="button">
                {item.label}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="user-page-panel compact">
        <p className="user-page-label">评分筛选</p>
        <div className="user-page-button-list">
          {[
            { key: 'all', label: '全部' },
            { key: '4.5', label: '4.5 分以上' },
            { key: '4.8', label: '4.8 分以上' },
          ].map((item) => (
            <button className={`user-page-filter ${rating === item.key ? 'active' : ''}`} key={item.key} onClick={() => updateParams({ rating: item.key })} type="button">
              {item.label}
            </button>
          ))}
          </div>
        </section>
    </div>
  );

  return (
    <UserPageFrame
      contentClassName={styles.content}
      frameClassName={styles.frame}
      mainClassName={styles.main}
      sidebar={sidebar}
      sidebarClassName={styles.sidebar}
      wrapClassName={styles.wrap}
    >
      <section className={styles.toolbarPanel}>
        <div className={styles.toolbar}>
          <form
            className={styles.searchForm}
            onSubmit={(event) => {
              event.preventDefault();
              updateParams({ keyword: draftKeyword.trim() });
            }}
          >
            <div className={styles.searchField}>
              <SearchIcon />
              <input
                onChange={(event) => setDraftKeyword(event.target.value)}
                placeholder={searchPlaceholder}
                value={draftKeyword}
              />
            </div>
            <button type="submit">搜索</button>
          </form>

          <div className={styles.sortBar}>
            <div className={styles.sortButtons}>
              {sortOptions.map((item) => (
                <button
                  className={`${styles.sortButton} ${effectiveSortBy === item.key ? styles.sortButtonActive : ''}`.trim()}
                  key={item.key}
                  onClick={() => updateParams({ sort: item.key })}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className={styles.resultCount}>找到 {data?.total ?? 0} 个结果</div>
          </div>
        </div>
      </section>

      {hasUnsettled ? (
        <div className="svc-reference-banner">
          <span className="svc-reference-banner-label">公开参考</span>
          <div className="svc-reference-banner-copy">
            <strong>当前结果包含平台未入驻的公开资料</strong>
            <span>卡片上标有「参考信息 / 公开资料」的内容，仅用于选店与比对参考，不代表平台认证、合作或履约承诺。</span>
          </div>
        </div>
      ) : null}

      <section className={styles.resultsPanel}>
        {loading && !data ? (
          <div className={styles.stateBlock}>
            <div className={styles.stateSpinner} aria-hidden="true" />
            <strong>加载服务商列表</strong>
            <span>正在同步当前筛选结果，请稍候。</span>
          </div>
        ) : null}

        {!loading && error && !data ? (
          <div className={styles.stateBlock}>
            <strong>加载失败</strong>
            <span>{error}</span>
            <button className={styles.stateButton} onClick={() => void reload()} type="button">重试</button>
          </div>
        ) : null}

        {!loading && !error && data && data.total === 0 ? (
          <div className={styles.emptyState}>暂无匹配服务商</div>
        ) : null}

        {data && data.total > 0 ? (
          <>
            <div className={styles.resultsGrid}>
              {data.mode === 'material'
                ? (data.list as MaterialShopListItemVM[]).map((shop) => <MaterialShopCard key={shop.id} shop={shop} />)
                : (data.list as ProviderListItemVM[]).map((provider) => <ProviderCard key={provider.id} provider={provider} />)}
            </div>
            {data.total > data.pageSize ? (
              <div className={styles.paginationWrap}>
                <Pagination
                  onChange={(nextPage) => {
                    updateParams({ page: String(nextPage) });
                    if (typeof window !== 'undefined') {
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                  }}
                  page={currentPage}
                  pageSize={data.pageSize}
                  total={data.total}
                />
              </div>
            ) : null}
          </>
        ) : null}
      </section>
    </UserPageFrame>
  );
}
