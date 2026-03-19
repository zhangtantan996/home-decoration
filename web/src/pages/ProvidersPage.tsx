import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import { ErrorBlock, LoadingBlock } from '../components/AsyncState';
import { MaterialShopCard } from '../components/MaterialShopCard';
import { Pagination } from '../components/Pagination';
import { ProviderCard } from '../components/ProviderCard';
import { useAsyncData } from '../hooks/useAsyncData';
import { getDictionaryOptions } from '../services/dictionaries';
import { listMaterialShops } from '../services/materialShops';
import { listProviders } from '../services/providers';
import { listPublicCities } from '../services/regions';
import type { HomeServiceCategory, MaterialShopListItemVM, ProviderListItemVM, ProviderRole } from '../types/viewModels';

type ProvidersFilterCategory = HomeServiceCategory | 'all';
type MixedResultItem =
  | { kind: 'provider'; provider: ProviderListItemVM }
  | { kind: 'shop'; shop: MaterialShopListItemVM };

interface BudgetOption {
  value: string;
  label: string;
  min: number | null;
  max: number | null;
}

const PROVIDER_FETCH_PAGE_SIZE = 50;
const MATERIAL_FETCH_PAGE_SIZE = 50;
const RESULT_PAGE_SIZE = 9;

const tabs: Array<{ value: HomeServiceCategory; label: string }> = [
  { value: 'designer', label: '设计师' },
  { value: 'company', label: '装修公司' },
  { value: 'foreman', label: '工长' },
  { value: 'material', label: '主材门店' },
];

function SearchIcon() {
  return (
    <svg fill="none" height="16" viewBox="0 0 24 24" width="16">
      <circle cx="11" cy="11" r="8" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

function readCategory(value: string | null, keyword: string): ProvidersFilterCategory {
  if (value === 'company' || value === 'foreman' || value === 'material') return value;
  if (!value && keyword.trim()) return 'all';
  return 'designer';
}

function extractPriceValue(text: string) {
  const match = text.match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : 0;
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

function matchesCityText(source: string, city: string) {
  const normalizedCity = normalizeCityToken(city);
  if (!normalizedCity) {
    return true;
  }
  const normalizedSource = normalizeCityToken(source);
  if (!normalizedSource) {
    return false;
  }
  return normalizedSource.includes(normalizedCity) || normalizedCity.includes(normalizedSource);
}

function matchesProviderCity(item: ProviderListItemVM, city: string) {
  if (!city) {
    return true;
  }
  return item.serviceArea.some((area) => matchesCityText(area, city));
}

function matchesShopCity(item: MaterialShopListItemVM, city: string) {
  if (!city) {
    return true;
  }
  const candidates = [item.address, ...item.productCategories, ...item.mainProducts, ...item.tags];
  return candidates.some((text) => matchesCityText(text, city));
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

function filterProviders(list: ProviderListItemVM[], city: string, rating: string, budget: string, budgetOptions: BudgetOption[]) {
  return list.filter((item) => {
    const cityMatch = matchesProviderCity(item, city);
    const ratingValue = rating === '4.8' ? 4.8 : rating === '4.5' ? 4.5 : 0;
    const ratingMatch = ratingValue === 0 || item.rating >= ratingValue;
    const price = extractPriceValue(item.priceText);
    const selectedBudget = budgetOptions.find((option) => option.value === budget);
    const budgetMatch = !selectedBudget || price === 0 || (
      (selectedBudget.min === null || price >= selectedBudget.min) &&
      (selectedBudget.max === null || price < selectedBudget.max)
    );
    return cityMatch && ratingMatch && budgetMatch;
  });
}

function filterShops(list: MaterialShopListItemVM[], city: string, rating: string) {
  return list.filter((item) => {
    const cityMatch = matchesShopCity(item, city);
    const ratingValue = rating === '4.8' ? 4.8 : rating === '4.5' ? 4.5 : 0;
    const ratingMatch = ratingValue === 0 || item.rating >= ratingValue;
    return cityMatch && ratingMatch;
  });
}

async function listAllProviders(role: ProviderRole, keyword: string) {
  const firstPage = await listProviders({ role, keyword, page: 1, pageSize: PROVIDER_FETCH_PAGE_SIZE });
  const totalPages = Math.max(1, Math.ceil(firstPage.total / Math.max(1, firstPage.pageSize || PROVIDER_FETCH_PAGE_SIZE)));
  if (totalPages === 1) {
    return firstPage;
  }

  const remainingPages = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) =>
      listProviders({ role, keyword, page: index + 2, pageSize: firstPage.pageSize || PROVIDER_FETCH_PAGE_SIZE })),
  );

  return {
    list: [firstPage, ...remainingPages].flatMap((page) => page.list),
    total: firstPage.total,
    page: 1,
    pageSize: firstPage.total,
  };
}

async function listAllMaterialShops(sortBy: string) {
  const firstPage = await listMaterialShops({ page: 1, pageSize: MATERIAL_FETCH_PAGE_SIZE, sortBy });
  const totalPages = Math.max(1, Math.ceil(firstPage.total / Math.max(1, firstPage.pageSize || MATERIAL_FETCH_PAGE_SIZE)));
  if (totalPages === 1) {
    return firstPage;
  }

  const remainingPages = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) =>
      listMaterialShops({ page: index + 2, pageSize: firstPage.pageSize || MATERIAL_FETCH_PAGE_SIZE, sortBy })),
  );

  return {
    list: [firstPage, ...remainingPages].flatMap((page) => page.list),
    total: firstPage.total,
    page: 1,
    pageSize: firstPage.total,
  };
}

function sortProviders(list: ProviderListItemVM[], sortBy: string, role?: ProviderRole) {
  const next = [...list];
  if (sortBy === 'rating') return next.sort((a, b) => b.rating - a.rating);
  if (sortBy === 'completed') return next.sort((a, b) => b.completedCount - a.completedCount);
  if (sortBy === 'price') return next.sort((a, b) => extractPriceValue(a.priceText) - extractPriceValue(b.priceText));
  if (role === 'company') {
    return next.sort((a, b) => {
      const aHasRealSignals = Number(a.reviewCount > 0 || a.completedCount > 0);
      const bHasRealSignals = Number(b.reviewCount > 0 || b.completedCount > 0);
      if (bHasRealSignals !== aHasRealSignals) return bHasRealSignals - aHasRealSignals;

      if (b.completedCount !== a.completedCount) return b.completedCount - a.completedCount;
      if (b.reviewCount !== a.reviewCount) return b.reviewCount - a.reviewCount;
      if (Number(b.isSettled !== false) !== Number(a.isSettled !== false)) {
        return Number(b.isSettled !== false) - Number(a.isSettled !== false);
      }
      return b.rating - a.rating;
    });
  }
  return next;
}

function sortShops(list: MaterialShopListItemVM[], sortBy: string) {
  const next = [...list];
  if (sortBy === 'rating') return next.sort((a, b) => b.rating - a.rating);
  return next;
}

export function ProvidersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const keyword = searchParams.get('keyword') || '';
  const category = readCategory(searchParams.get('category'), keyword);
  const city = searchParams.get('city') || '';
  const rating = searchParams.get('rating') || 'all';
  const budget = searchParams.get('budget') || '';
  const sortBy = searchParams.get('sort') || 'recommend';
  const page = Math.max(1, Number(searchParams.get('page') || '1'));

  const updateParams = (patch: Record<string, string>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      if (!value || value === 'all') next.delete(key);
      else next.set(key, value);
    });
    if (!patch.page) next.set('page', '1');
    setSearchParams(next, { replace: true });
  };

  const { data, loading, error, reload } = useAsyncData(async () => {
    const [cities, rawBudgetOptions] = await Promise.all([
      listPublicCities().catch(() => ['西安']),
      getDictionaryOptions('provider_budget_range').catch(() => []),
    ]);
    const budgetOptions = normalizeBudgetOptions(rawBudgetOptions);
    const cityOptions = normalizeCityOptions(cities.length > 0 ? cities : ['西安']);

    if (category === 'all') {
      const [designers, companies, foremen, shops] = await Promise.all([
        listAllProviders('designer', keyword),
        listAllProviders('company', keyword),
        listAllProviders('foreman', keyword),
        listAllMaterialShops('recommend'),
      ]);

      const filteredProviders = [
        ...filterProviders(designers.list, city, rating, budget, budgetOptions),
        ...filterProviders(companies.list, city, rating, budget, budgetOptions),
        ...filterProviders(foremen.list, city, rating, budget, budgetOptions),
      ];
      const filteredShops = filterShops(
        keyword.trim() ? shops.list.filter((item) => `${item.name}${item.productCategories.join('')}${item.mainProducts.join('')}`.includes(keyword.trim())) : shops.list,
        city,
        rating,
      );

      const mixed: MixedResultItem[] = [
        ...sortProviders(filteredProviders, sortBy).map((provider) => ({ kind: 'provider' as const, provider })),
        ...sortShops(filteredShops, sortBy).map((shop) => ({ kind: 'shop' as const, shop })),
      ];

      return { mode: 'mixed' as const, list: mixed, total: mixed.length, page: 1, pageSize: RESULT_PAGE_SIZE, cities: cityOptions, budgetOptions };
    }

    if (category === 'material') {
      const result = await listAllMaterialShops('recommend');
      const searched = keyword.trim() ? result.list.filter((item) => `${item.name}${item.productCategories.join('')}${item.mainProducts.join('')}`.includes(keyword.trim())) : result.list;
      const filtered = filterShops(searched, city, rating);
      return { mode: 'material' as const, list: sortShops(filtered, sortBy), total: filtered.length, page: 1, pageSize: RESULT_PAGE_SIZE, cities: cityOptions, budgetOptions };
    }

    const result = await listAllProviders(category as ProviderRole, keyword);
    const filtered = filterProviders(result.list, city, rating, budget, budgetOptions);
    return { mode: 'provider' as const, list: sortProviders(filtered, sortBy, category as ProviderRole), total: filtered.length, page: 1, pageSize: RESULT_PAGE_SIZE, cities: cityOptions, budgetOptions };
  }, [category, keyword, city, rating, budget, sortBy]);

  const totalPages = useMemo(() => {
    if (!data) {
      return 1;
    }
    return Math.max(1, Math.ceil(data.total / Math.max(1, data.pageSize)));
  }, [data]);

  const currentPage = Math.min(page, totalPages);

  useEffect(() => {
    if (!data || page === currentPage) {
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.set('page', String(currentPage));
    setSearchParams(next, { replace: true });
  }, [currentPage, data, page, searchParams, setSearchParams]);

  const paginatedProviders = useMemo(() => {
    if (!data || data.mode !== 'provider') return [] as ProviderListItemVM[];
    const start = (currentPage - 1) * data.pageSize;
    return data.list.slice(start, start + data.pageSize);
  }, [currentPage, data]);

  const paginatedMixed = useMemo(() => {
    if (!data || data.mode !== 'mixed') return [] as MixedResultItem[];
    const start = (currentPage - 1) * data.pageSize;
    return data.list.slice(start, start + data.pageSize);
  }, [currentPage, data]);

  const paginatedShops = useMemo(() => {
    if (!data || data.mode !== 'material') return [] as MaterialShopListItemVM[];
    const start = (currentPage - 1) * data.pageSize;
    return data.list.slice(start, start + data.pageSize);
  }, [currentPage, data]);

  // 仅装修公司和主材门店分类可能含未入驻商家，需展示免责横幅
  const hasUnsettled = useMemo(() => {
    if (!data) return false;
    if (data.mode === 'provider') {
      return category === 'company' && (data.list as ProviderListItemVM[]).some((p) => p.isSettled === false);
    }
    if (data.mode === 'material') {
      return (data.list as MaterialShopListItemVM[]).some((s) => s.isSettled === false);
    }
    if (data.mode === 'mixed') {
      return (data.list as MixedResultItem[]).some((item) =>
        (item.kind === 'shop' && item.shop.isSettled === false) ||
        (item.kind === 'provider' && item.provider.role === 'company' && item.provider.isSettled === false)
      );
    }
    return false;
  }, [data, category]);

  const activeTags = useMemo(() => {
    const tags: string[] = [];
    if (city) tags.push(shortenCityLabel(city));
    const selectedBudget = data?.budgetOptions.find((option) => option.value === budget);
    if (selectedBudget) tags.push(selectedBudget.label);
    if (rating !== 'all') tags.push(`${rating} 分以上`);
    return tags;
  }, [budget, city, rating, data]);

  return (
    <div className="top-page">
      <div className="svc-layout">
        <aside className="svc-sidebar">
          <div className="svc-filter-group">
            <div className="svc-filter-title">服务类型</div>
            {tabs.map((tab) => (
              <button className={`svc-filter-item ${tab.value === category ? 'active' : ''}`} key={tab.value} onClick={() => updateParams({ category: tab.value })} type="button">
                {tab.label}
              </button>
            ))}
          </div>

          <div className="svc-filter-group">
            <div className="svc-filter-title">所在城市</div>
            <button className={`svc-filter-item ${!city ? 'active' : ''}`} onClick={() => updateParams({ city: 'all' })} type="button">
              全部城市
            </button>
            {(data?.cities || ['西安']).map((item) => (
              <button className={`svc-filter-item ${shortenCityLabel(city) === item ? 'active' : ''}`} key={item} onClick={() => updateParams({ city: item })} type="button">{item}</button>
            ))}
          </div>

          {category !== 'material' ? (
            <div className="svc-filter-group">
              <div className="svc-filter-title">预算区间</div>
              {(data?.budgetOptions || []).map((item) => (
                <button className={`svc-filter-item ${budget === item.value ? 'active' : ''}`} key={item.value} onClick={() => updateParams({ budget: item.value })} type="button">{item.label}</button>
              ))}
            </div>
          ) : null}

          <div className="svc-filter-group">
            <div className="svc-filter-title">评分筛选</div>
            {[
              { key: 'all', label: '全部' },
              { key: '4.5', label: '4.5 分以上' },
              { key: '4.8', label: '4.8 分以上' },
            ].map((item) => (
              <button className={`svc-filter-item ${rating === item.key ? 'active' : ''}`} key={item.key} onClick={() => updateParams({ rating: item.key })} type="button">{item.label}</button>
            ))}
          </div>
        </aside>

        <section>
          <div className="svc-topbar">
            <div className="svc-search">
              <SearchIcon />
              <input
                defaultValue={keyword}
                onBlur={(event) => {
                  if (event.target.value.trim() !== keyword) updateParams({ keyword: event.target.value.trim() });
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    const target = event.target as HTMLInputElement;
                    updateParams({ keyword: target.value.trim() });
                  }
                }}
                placeholder="搜索服务商名称、风格、区域或类型"
              />
            </div>
            <div className="svc-sort">
              {[
                { key: 'recommend', label: '综合推荐' },
                { key: 'rating', label: '评分最高' },
                { key: 'completed', label: '评价最多' },
                { key: 'price', label: '价格最低' },
              ].map((item) => (
                <button className={`svc-sort-btn ${sortBy === item.key ? 'active' : ''}`} key={item.key} onClick={() => updateParams({ sort: item.key })} type="button">{item.label}</button>
              ))}
            </div>
          </div>

          {activeTags.length > 0 ? <div className="svc-active-filters">{activeTags.map((tag) => <span className="svc-tag" key={tag}>{tag}</span>)}</div> : null}

          {hasUnsettled && (
            <div className="svc-reference-banner">
              <span className="svc-reference-banner-label">公开参考</span>
              <div className="svc-reference-banner-copy">
                <strong>当前结果包含平台未入驻的公开资料</strong>
                <span>卡片上标有「参考信息 / 公开资料」的内容，仅用于选店与比对参考，不代表平台认证、合作或履约承诺。</span>
              </div>
            </div>
          )}

          {loading ? <LoadingBlock title="加载服务商列表" /> : null}
          {error ? <ErrorBlock description={error} onRetry={() => void reload()} /> : null}
          {!loading && !error && data && data.total === 0 ? <div className="svc-empty">暂无匹配服务商</div> : null}
          {!loading && !error && data ? (
            <>
              <div className="svc-results">
                {data.mode === 'material'
                  ? paginatedShops.map((shop) => <MaterialShopCard key={shop.id} shop={shop} />)
                  : data.mode === 'mixed'
                    ? paginatedMixed.map((item) => item.kind === 'shop' ? <MaterialShopCard key={`shop-${item.shop.id}`} shop={item.shop} /> : <ProviderCard key={`provider-${item.provider.id}`} provider={item.provider} />)
                    : paginatedProviders.map((provider) => <ProviderCard key={provider.id} provider={provider} />)}
              </div>
              {data.total > data.pageSize ? (
                <div style={{ marginTop: 20 }}>
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
      </div>
    </div>
  );
}
