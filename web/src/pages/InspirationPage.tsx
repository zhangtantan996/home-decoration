import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';

import { UserPageFrame } from '../components/UserPageFrame';
import { useAsyncData } from '../hooks/useAsyncData';
import { getDictionaryOptions, type PublicDictOption } from '../services/dictionaries';
import { listInspiration } from '../services/inspiration';
import styles from './InspirationPage.module.scss';

type SortMode = 'recommend' | 'latest' | 'hot';
type FilterGroupKey = 'style' | 'layout' | 'area';
interface FilterOption {
  value: string;
  label: string;
}

interface AreaBucketOption extends FilterOption {
  min: number | null;
  max: number | null;
}

const CARD_WIDTH = 252;
const GRID_GAP = 18;
const FILTER_VISIBLE_LIMIT = 12;
const ALL_FILTER_VALUE = '__all__';
const FALLBACK_STYLE_OPTIONS = ['全部', '现代简约', '奶油风', '原木风', '北欧', '轻奢'];
const FALLBACK_LAYOUT_OPTIONS = ['全部', '一居', '二居', '三居', '四居及以上', '别墅'];
const FALLBACK_AREA_OPTIONS: AreaBucketOption[] = [
  { value: 'small', label: '90㎡以下', min: 0, max: 90 },
  { value: 'medium', label: '90-140㎡', min: 90, max: 140 },
  { value: 'large', label: '140㎡以上', min: 140, max: null },
];

function SearchIcon() {
  return (
    <svg fill="none" height="16" viewBox="0 0 24 24" width="16">
      <circle cx="11" cy="11" r="8" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

function parseAreaValue(areaText: string) {
  const matched = areaText.match(/(\d+(?:\.\d+)?)/);
  return matched ? Number(matched[1]) : 0;
}

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function formatHeat(value: number) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return `${value}`;
}

function formatAreaText(areaText: string) {
  const text = areaText.trim();
  if (!text) return '面积待补充';
  if (/㎡|m²|m2|平方米/i.test(text)) return text;
  return /^\d+(?:\.\d+)?$/.test(text) ? `${text}㎡` : text;
}

function normalizeNamedOptions(raw: PublicDictOption[], fallbackLabels: string[]): FilterOption[] {
  if (!raw || raw.length === 0) {
    return fallbackLabels
      .filter((item) => item !== '全部')
      .map((item) => ({ value: item, label: item }));
  }

  const seen = new Set<string>();
  return raw
    .map((item) => {
      const value = String(item.value || item.label || '').trim();
      const label = String(item.label || item.value || '').trim();
      return { value, label };
    })
    .filter((item) => {
      if (!item.value || !item.label || seen.has(item.value)) {
        return false;
      }
      seen.add(item.value);
      return true;
    });
}

function normalizeAreaOptions(raw: PublicDictOption[]): AreaBucketOption[] {
  if (!raw || raw.length === 0) {
    return FALLBACK_AREA_OPTIONS;
  }

  const options = raw
    .map((item) => {
      const extra = item.extraData || {};
      const rawMin = typeof extra.min === 'number' ? extra.min : extra.min == null ? null : Number(extra.min);
      const rawMax = typeof extra.max === 'number' ? extra.max : extra.max == null ? null : Number(extra.max);
      const min = Number.isNaN(rawMin as number) ? null : rawMin;
      const max = Number.isNaN(rawMax as number) ? null : rawMax;
      return {
        value: String(item.value || item.label || '').trim(),
        label: String(item.label || item.value || '').trim(),
        min,
        max,
      };
    })
    .filter((item) => item.value && item.label);

  return options.length > 0 ? options : FALLBACK_AREA_OPTIONS;
}

function matchNamedOption(itemText: string, activeValue: string, options: FilterOption[]) {
  if (activeValue === ALL_FILTER_VALUE) return true;
  const option = options.find((item) => item.value === activeValue);
  if (!option) return false;
  const normalized = normalizeText(itemText);
  return normalized === normalizeText(option.value) || normalized === normalizeText(option.label);
}

function matchAreaBucket(areaText: string, option: AreaBucketOption) {
  const value = parseAreaValue(areaText);
  if (value <= 0) return false;

  if (option.min != null && value < option.min) {
    return false;
  }

  if (option.max == null) {
    return true;
  }

  if (option.min === 0) {
    return value < option.max;
  }

  return value <= option.max;
}

function resolveOptionLabel(options: FilterOption[], value: string) {
  return options.find((item) => item.value === value)?.label || value;
}

function buildPageItems(currentPage: number, totalPages: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const items: Array<number | 'ellipsis'> = [1];
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  if (start > 2) {
    items.push('ellipsis');
  }

  for (let page = start; page <= end; page += 1) {
    items.push(page);
  }

  if (end < totalPages - 1) {
    items.push('ellipsis');
  }

  items.push(totalPages);
  return items;
}

function resolveGridLayout(width: number) {
  const columns = Math.max(1, Math.floor((width + GRID_GAP) / (CARD_WIDTH + GRID_GAP)));
  const rows = columns >= 4 ? 2 : columns === 3 ? 3 : columns === 2 ? 4 : 6;
  return {
    columns,
    rows,
    pageSize: Math.max(1, columns * rows),
  };
}

export function InspirationPage() {
  const { data, loading, error, reload } = useAsyncData(async () => {
    const [result, rawStyleOptions, rawLayoutOptions, rawAreaOptions] = await Promise.all([
      listInspiration({ page: 1, pageSize: 60 }),
      getDictionaryOptions('style').catch(() => []),
      getDictionaryOptions('layout').catch(() => []),
      getDictionaryOptions('inspiration_area_bucket').catch(() => []),
    ]);

    return {
      ...result,
      styleOptions: normalizeNamedOptions(rawStyleOptions, FALLBACK_STYLE_OPTIONS),
      layoutOptions: normalizeNamedOptions(rawLayoutOptions, FALLBACK_LAYOUT_OPTIONS),
      areaOptions: normalizeAreaOptions(rawAreaOptions),
    };
  }, []);
  const [draftKeyword, setDraftKeyword] = useState('');
  const [keyword, setKeyword] = useState('');
  const [activeStyle, setActiveStyle] = useState(ALL_FILTER_VALUE);
  const [activeLayout, setActiveLayout] = useState(ALL_FILTER_VALUE);
  const [activeArea, setActiveArea] = useState(ALL_FILTER_VALUE);
  const [sortMode, setSortMode] = useState<SortMode>('recommend');
  const [currentPage, setCurrentPage] = useState(1);
  const [gridLayout, setGridLayout] = useState(() => {
    if (typeof window === 'undefined') {
      return resolveGridLayout(1120);
    }
    return resolveGridLayout(Math.max(window.innerWidth - 120, CARD_WIDTH));
  });
  const [expandedGroups, setExpandedGroups] = useState<Record<FilterGroupKey, boolean>>({
    style: false,
    layout: false,
    area: false,
  });
  const [mobileCollapsedGroups, setMobileCollapsedGroups] = useState<Record<FilterGroupKey, boolean>>({
    style: false,
    layout: true,
    area: true,
  });
  const resultsGridRef = useRef<HTMLDivElement | null>(null);

  const inspirationList = data?.list || [];
  const styleOptions = data?.styleOptions || normalizeNamedOptions([], FALLBACK_STYLE_OPTIONS);
  const layoutOptions = data?.layoutOptions || normalizeNamedOptions([], FALLBACK_LAYOUT_OPTIONS);
  const areaOptions = data?.areaOptions || FALLBACK_AREA_OPTIONS;

  const filteredList = useMemo(() => {
    const query = normalizeText(keyword);
    const next = inspirationList.filter((item) => {
      const text = normalizeText(`${item.title} ${item.style} ${item.layout} ${item.authorName} ${item.area}`);
      if (query && !text.includes(query)) return false;
      if (!matchNamedOption(item.style, activeStyle, styleOptions)) return false;
      if (!matchNamedOption(item.layout, activeLayout, layoutOptions)) return false;
      if (activeArea !== ALL_FILTER_VALUE) {
        const selectedArea = areaOptions.find((item) => item.value === activeArea);
        if (!selectedArea) return false;
        if (!matchAreaBucket(item.area, selectedArea)) return false;
      }
      return true;
    });

    return [...next].sort((left, right) => {
      if (sortMode === 'latest') {
        return right.id - left.id;
      }
      return right.likeCount - left.likeCount;
    });
  }, [activeArea, activeLayout, activeStyle, areaOptions, inspirationList, keyword, layoutOptions, sortMode, styleOptions]);

  useEffect(() => {
    setCurrentPage(1);
  }, [keyword, activeStyle, activeLayout, activeArea, sortMode]);

  useEffect(() => {
    if (activeStyle !== ALL_FILTER_VALUE && !styleOptions.some((item) => item.value === activeStyle)) {
      setActiveStyle(ALL_FILTER_VALUE);
    }
  }, [activeStyle, styleOptions]);

  useEffect(() => {
    if (activeLayout !== ALL_FILTER_VALUE && !layoutOptions.some((item) => item.value === activeLayout)) {
      setActiveLayout(ALL_FILTER_VALUE);
    }
  }, [activeLayout, layoutOptions]);

  useEffect(() => {
    if (activeArea !== ALL_FILTER_VALUE && !areaOptions.some((item) => item.value === activeArea)) {
      setActiveArea(ALL_FILTER_VALUE);
    }
  }, [activeArea, areaOptions]);

  useEffect(() => {
    const element = resultsGridRef.current;
    if (!element || typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const syncGridLayout = (width: number) => {
      const nextLayout = resolveGridLayout(width);
      setGridLayout((currentLayout) => (
        currentLayout.columns === nextLayout.columns
        && currentLayout.rows === nextLayout.rows
        && currentLayout.pageSize === nextLayout.pageSize
          ? currentLayout
          : nextLayout
      ));
    };

    syncGridLayout(element.getBoundingClientRect().width);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      syncGridLayout(entry.contentRect.width);
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [filteredList.length]);

  const activeFilters = [
    activeStyle !== ALL_FILTER_VALUE ? resolveOptionLabel(styleOptions, activeStyle) : null,
    activeLayout !== ALL_FILTER_VALUE ? resolveOptionLabel(layoutOptions, activeLayout) : null,
    activeArea !== ALL_FILTER_VALUE ? resolveOptionLabel(areaOptions, activeArea) : null,
    keyword ? keyword : null,
  ].filter(Boolean) as string[];
  const totalPages = Math.max(1, Math.ceil(filteredList.length / gridLayout.pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pagedList = filteredList.slice((safeCurrentPage - 1) * gridLayout.pageSize, safeCurrentPage * gridLayout.pageSize);
  const pageItems = buildPageItems(safeCurrentPage, totalPages);
  const hasPagination = filteredList.length > gridLayout.pageSize;

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const resetFilters = () => {
    setDraftKeyword('');
    setKeyword('');
    setActiveStyle(ALL_FILTER_VALUE);
    setActiveLayout(ALL_FILTER_VALUE);
    setActiveArea(ALL_FILTER_VALUE);
  };

  const toggleGroupExpansion = (group: FilterGroupKey) => {
    setExpandedGroups((current) => ({ ...current, [group]: !current[group] }));
  };

  const toggleMobileGroup = (group: FilterGroupKey) => {
    setMobileCollapsedGroups((current) => ({ ...current, [group]: !current[group] }));
  };

  const buildVisibleOptions = (group: FilterGroupKey, options: FilterOption[], activeValue: string) => {
    if (expandedGroups[group] || options.length <= FILTER_VISIBLE_LIMIT) {
      return options;
    }

    const limited = options.slice(0, FILTER_VISIBLE_LIMIT);
    if (activeValue !== ALL_FILTER_VALUE && options.some((item) => item.value === activeValue) && !limited.some((item) => item.value === activeValue)) {
      const selected = options.find((item) => item.value === activeValue);
      return selected ? [...limited.slice(0, FILTER_VISIBLE_LIMIT - 1), selected] : limited;
    }
    return limited;
  };

  const renderFilterGroup = (group: FilterGroupKey, label: string, options: FilterOption[], activeValue: string, onSelect: (value: string) => void) => {
    const visibleOptions = buildVisibleOptions(group, options, activeValue);
    const hasMore = options.length > FILTER_VISIBLE_LIMIT;
    const isCollapsed = mobileCollapsedGroups[group];

    return (
      <section className={styles.filterGroup}>
        <div className={styles.filterLabel}>{label}</div>
        <div className={styles.filterContent}>
          <div className={`${styles.filterOptions} ${isCollapsed ? styles.filterOptionsCollapsed : ''}`.trim()}>
            <button
              className={`${styles.filterChip} ${activeValue === ALL_FILTER_VALUE ? styles.filterChipActive : ''}`.trim()}
              onClick={() => onSelect(ALL_FILTER_VALUE)}
              type="button"
            >
              全部
            </button>
            {visibleOptions.map((item) => (
              <button
                className={`${styles.filterChip} ${activeValue === item.value ? styles.filterChipActive : ''}`.trim()}
                key={item.value}
                onClick={() => onSelect(item.value)}
                type="button"
              >
                {item.label}
              </button>
            ))}
            {hasMore ? (
              <button className={styles.filterMore} onClick={() => toggleGroupExpansion(group)} type="button">
                {expandedGroups[group] ? '收起' : '展开更多'}
              </button>
            ) : null}
          </div>
          <button
            aria-expanded={!isCollapsed}
            className={styles.filterMobileToggle}
            onClick={() => toggleMobileGroup(group)}
            type="button"
          >
            {isCollapsed ? '展开' : '收起'}
          </button>
        </div>
      </section>
    );
  };

  return (
    <UserPageFrame
      contentClassName={styles.content}
      frameClassName={styles.frame}
      mainClassName={styles.main}
      sidebar={null}
      sidebarClassName={styles.sidebar}
      wrapClassName={styles.wrap}
    >
      <section className={styles.toolbarPanel}>
        <div className={styles.toolbar}>
          <form
            className={styles.searchForm}
            onSubmit={(event) => {
              event.preventDefault();
              setActiveStyle(ALL_FILTER_VALUE);
              setActiveLayout(ALL_FILTER_VALUE);
              setActiveArea(ALL_FILTER_VALUE);
              setKeyword(draftKeyword);
            }}
          >
            <div className={styles.searchField}>
              <SearchIcon />
              <input
                onChange={(event) => setDraftKeyword(event.target.value)}
                placeholder="搜索标题、风格或作者"
                value={draftKeyword}
              />
            </div>
            <button type="submit">搜索</button>
          </form>

          <div className={styles.filterBoard}>
            {renderFilterGroup('style', '风格', styleOptions, activeStyle, setActiveStyle)}
            {renderFilterGroup('layout', '户型', layoutOptions, activeLayout, setActiveLayout)}
            {renderFilterGroup('area', '面积', areaOptions, activeArea, setActiveArea)}
          </div>

          {activeFilters.length > 0 ? (
            <div className={styles.activeBar}>
              <div className={styles.activeTags}>
                <span className={styles.activeTagsLabel}>当前筛选</span>
                {activeFilters.map((item) => (
                  <em className={styles.activeTag} key={item}>{item}</em>
                ))}
                <button className={styles.clearInline} onClick={resetFilters} type="button">
                  清空筛选
                </button>
              </div>
            </div>
          ) : null}

          <div className={styles.metaBar}>
            <div className={styles.sortBar}>
              <span className={styles.sortLabel}>排序</span>
              <div className={styles.sortButtons} role="tablist" aria-label="排序方式">
                <button
                  className={`${styles.sortButton} ${sortMode === 'recommend' ? styles.sortButtonActive : ''}`.trim()}
                  onClick={() => setSortMode('recommend')}
                  type="button"
                >
                  推荐
                </button>
                <button
                  className={`${styles.sortButton} ${sortMode === 'latest' ? styles.sortButtonActive : ''}`.trim()}
                  onClick={() => setSortMode('latest')}
                  type="button"
                >
                  最新
                </button>
                <button
                  className={`${styles.sortButton} ${sortMode === 'hot' ? styles.sortButtonActive : ''}`.trim()}
                  onClick={() => setSortMode('hot')}
                  type="button"
                >
                  热度
                </button>
              </div>
            </div>
            <div className={styles.resultCount}>找到 {filteredList.length} 个结果</div>
          </div>
        </div>
      </section>

      <section
        className={`${styles.resultsPanel} ${hasPagination ? styles.resultsPanelFixed : ''}`.trim()}
        style={{ '--inspiration-grid-rows': String(gridLayout.rows) } as CSSProperties}
      >
        {loading && !data ? (
          <div className={styles.stateBlock}>
            <div className={styles.stateSpinner} aria-hidden="true" />
            <strong>加载灵感案例</strong>
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

        {!loading && !error && filteredList.length === 0 ? (
          <div className={styles.emptyState}>
            <strong>{inspirationList.length === 0 ? '暂无公开灵感案例' : '暂无匹配灵感案例'}</strong>
            <span>
              {inspirationList.length === 0
                ? '当前灵感库还没有可展示的数据，请先补充独立上传的案例。'
                : '试试减少筛选条件，或切换风格、户型和面积。'}
            </span>
            {activeFilters.length > 0 ? (
              <button className={styles.stateButton} onClick={resetFilters} type="button">
                清空筛选
              </button>
            ) : null}
          </div>
        ) : null}

        {filteredList.length > 0 ? (
          <>
            <div className={`${styles.resultsGrid} ${hasPagination ? styles.resultsGridFixed : ''}`.trim()} ref={resultsGridRef}>
              {pagedList.map((item, index) => {
                const summary = [item.style, item.layout, formatAreaText(item.area)].filter(Boolean).join(' · ');
                return (
                  <Link className={styles.caseCard} key={item.id} to={`/inspiration/${item.id}`}>
                    <div className={styles.caseMedia}>
                      <img alt={item.title} src={item.coverImage} />
                      <div className={styles.caseBadges}>
                        <span>{item.style}</span>
                        {sortMode !== 'latest' && safeCurrentPage === 1 && index === 0 ? <span className={styles.caseBadgeAccent}>精选</span> : null}
                      </div>
                    </div>
                    <div className={styles.caseBody}>
                      <h3>{item.title}</h3>
                      <p className={styles.caseSummary}>{summary}</p>
                    </div>
                    <div className={styles.caseFooter}>
                      <div className={styles.caseAuthor}>
                        <img alt={item.authorName} src={item.authorAvatar} />
                        <span>{item.authorName}</span>
                      </div>
                      <div className={styles.caseHeat}>热度 {formatHeat(item.likeCount)}</div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {hasPagination ? (
              <div className={styles.paginationWrap}>
                <div className={styles.paginationInfo}>第 {safeCurrentPage} / {totalPages} 页，共 {filteredList.length} 条结果</div>
                <div className="inspiration-stitch-pagination" aria-label="灵感分页">
                  <button
                    disabled={safeCurrentPage <= 1}
                    onClick={() => {
                      setCurrentPage((page) => Math.max(1, page - 1));
                      if (typeof window !== 'undefined') {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }
                    }}
                    type="button"
                  >
                    上一页
                  </button>
                  {pageItems.map((item, index) => item === 'ellipsis' ? (
                    <span className="gap" key={`ellipsis-${index}`}>...</span>
                  ) : (
                    <button
                      className={item === safeCurrentPage ? 'active' : undefined}
                      key={item}
                      onClick={() => {
                        setCurrentPage(item);
                        if (typeof window !== 'undefined') {
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }
                      }}
                      type="button"
                    >
                      {item}
                    </button>
                  ))}
                  <button
                    disabled={safeCurrentPage >= totalPages}
                    onClick={() => {
                      setCurrentPage((page) => Math.min(totalPages, page + 1));
                      if (typeof window !== 'undefined') {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }
                    }}
                    type="button"
                  >
                    下一页
                  </button>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </section>
    </UserPageFrame>
  );
}
