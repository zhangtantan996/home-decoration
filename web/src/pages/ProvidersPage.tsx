import { useMemo } from 'react';
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
    const cityMatch = !city || item.serviceArea.some((area) => area.includes(city));
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
    const cityMatch = !city || item.address.includes(city);
    const ratingValue = rating === '4.8' ? 4.8 : rating === '4.5' ? 4.5 : 0;
    const ratingMatch = ratingValue === 0 || item.rating >= ratingValue;
    return cityMatch && ratingMatch;
  });
}

function sortProviders(list: ProviderListItemVM[], sortBy: string) {
  const next = [...list];
  if (sortBy === 'rating') return next.sort((a, b) => b.rating - a.rating);
  if (sortBy === 'completed') return next.sort((a, b) => b.completedCount - a.completedCount);
  if (sortBy === 'price') return next.sort((a, b) => extractPriceValue(a.priceText) - extractPriceValue(b.priceText));
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

  const { data, loading, error, reload } = useAsyncData(async () => {
    const [cities, rawBudgetOptions] = await Promise.all([
      listPublicCities().catch(() => ['西安']),
      getDictionaryOptions('provider_budget_range').catch(() => []),
    ]);
    const budgetOptions = normalizeBudgetOptions(rawBudgetOptions);

    if (category === 'all') {
      const [designers, companies, foremen, shops] = await Promise.all([
        listProviders({ role: 'designer', keyword, page: 1, pageSize: 12 }),
        listProviders({ role: 'company', keyword, page: 1, pageSize: 12 }),
        listProviders({ role: 'foreman', keyword, page: 1, pageSize: 12 }),
        listMaterialShops({ page: 1, pageSize: 12, sortBy: 'recommend' }),
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

      return { mode: 'mixed' as const, list: mixed, total: mixed.length, page, pageSize: 9, cities, budgetOptions };
    }

    if (category === 'material') {
      const result = await listMaterialShops({ page: 1, pageSize: 24, sortBy: 'recommend' });
      const searched = keyword.trim() ? result.list.filter((item) => `${item.name}${item.productCategories.join('')}${item.mainProducts.join('')}`.includes(keyword.trim())) : result.list;
      const filtered = filterShops(searched, city, rating);
      return { mode: 'material' as const, list: sortShops(filtered, sortBy), total: filtered.length, page: 1, pageSize: filtered.length || 24, cities, budgetOptions };
    }

    const result = await listProviders({ role: category as ProviderRole, keyword, page: 1, pageSize: 30 });
    const filtered = filterProviders(result.list, city, rating, budget, budgetOptions);
    return { mode: 'provider' as const, list: sortProviders(filtered, sortBy), total: filtered.length, page, pageSize: 9, cities, budgetOptions };
  }, [category, keyword, city, rating, budget, sortBy, page]);

  const paginatedProviders = useMemo(() => {
    if (!data || data.mode !== 'provider') return [] as ProviderListItemVM[];
    const start = (page - 1) * data.pageSize;
    return data.list.slice(start, start + data.pageSize);
  }, [data, page]);

  const paginatedMixed = useMemo(() => {
    if (!data || data.mode !== 'mixed') return [] as MixedResultItem[];
    const start = (page - 1) * data.pageSize;
    return data.list.slice(start, start + data.pageSize);
  }, [data, page]);

  const activeTags = useMemo(() => {
    const tags: string[] = [];
    if (city) tags.push(city);
    const selectedBudget = data?.budgetOptions.find((option) => option.value === budget);
    if (selectedBudget) tags.push(selectedBudget.label);
    if (rating !== 'all') tags.push(`${rating} 分以上`);
    return tags;
  }, [budget, city, rating, data]);

  const updateParams = (patch: Record<string, string>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      if (!value || value === 'all') next.delete(key);
      else next.set(key, value);
    });
    if (!patch.page) next.set('page', '1');
    setSearchParams(next, { replace: true });
  };

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
            {(data?.cities || ['西安']).map((item) => (
              <button className={`svc-filter-item ${city === item || (!city && item === '西安') ? 'active' : ''}`} key={item} onClick={() => updateParams({ city: item })} type="button">{item}</button>
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

          {loading ? <LoadingBlock title="加载服务商列表" /> : null}
          {error ? <ErrorBlock description={error} onRetry={() => void reload()} /> : null}
          {!loading && !error && data && data.total === 0 ? <div className="svc-empty">暂无匹配服务商</div> : null}
          {!loading && !error && data ? (
            <>
              <div className="svc-results">
                {data.mode === 'material'
                  ? data.list.map((shop) => <MaterialShopCard key={shop.id} shop={shop} />)
                  : data.mode === 'mixed'
                    ? paginatedMixed.map((item) => item.kind === 'shop' ? <MaterialShopCard key={`shop-${item.shop.id}`} shop={item.shop} /> : <ProviderCard key={`provider-${item.provider.id}`} provider={item.provider} />)
                    : paginatedProviders.map((provider) => <ProviderCard key={provider.id} provider={provider} />)}
              </div>
              {data.mode !== 'material' ? <div style={{ marginTop: 20 }}><Pagination onChange={(nextPage) => updateParams({ page: String(nextPage) })} page={page} pageSize={data.pageSize} total={data.total} /></div> : null}
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}
