import Taro, { useDidShow, useLoad, useReachBottom } from '@tarojs/taro';
import { Image, Text, View } from '@tarojs/components';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { Empty } from '@/components/Empty';
import { Icon } from '@/components/Icon';
import { PullToRefreshNotice } from '@/components/PullToRefreshNotice';
import { Skeleton } from '@/components/Skeleton';
import { usePullToRefreshFeedback } from '@/hooks/usePullToRefreshFeedback';
import type { FavoriteItemDTO, InspirationItemDTO } from '@/services/dto';
import { favoriteService, inspirationService } from '@/services/inspiration';
import { useAuthStore } from '@/store/auth';
import { setCustomTabBarHidden, syncCurrentTabBar } from '@/utils/customTabBar';
import { showErrorToast } from '@/utils/error';
import { getInspirationCoverImage } from '@/utils/inspirationImages';
import { getMiniNavMetrics } from '@/utils/navLayout';
import { formatServerMonthDay, getServerTimeMs } from '@/utils/serverTime';

import './index.scss';

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

interface InspirationCaseSyncPayload {
  id: number;
  isLiked?: boolean;
  likeCount?: number;
  isFavorited?: boolean;
  commentCount?: number;
}

interface InspirationFilterState {
  activeStyle?: string;
  activeLayout?: string;
  activeArea?: string;
  sortMode?: SortMode;
  activeTab?: 'all' | 'favorites';
}

const ALL_FILTER_VALUE = '__all__';
const PAGE_SIZE = 20;
const INSPIRATION_CASE_SYNC_KEY = 'inspiration_case_sync';
const INSPIRATION_FILTER_KEY = 'inspiration_filter_state';
const FILTER_SHEET_ANIMATION_MS = 280;

const STYLE_OPTIONS: FilterOption[] = [
  { value: '现代简约', label: '现代简约' },
  { value: '奶油风', label: '奶油风' },
  { value: '原木风', label: '原木风' },
  { value: '北欧风格', label: '北欧风格' },
  { value: '新中式', label: '新中式' },
  { value: '轻奢风格', label: '轻奢风格' },
  { value: '美式风格', label: '美式风格' },
  { value: '欧式风格', label: '欧式风格' },
  { value: '日式风格', label: '日式风格' },
  { value: '工业风格', label: '工业风格' },
  { value: '法式风格', label: '法式风格' },
  { value: '地中海风格', label: '地中海风格' },
];

const LAYOUT_OPTIONS: FilterOption[] = [
  { value: '一居', label: '一居' },
  { value: '二居', label: '二居' },
  { value: '三居', label: '三居' },
  { value: '四居及以上', label: '四居及以上' },
  { value: '复式', label: '复式' },
  { value: '别墅', label: '别墅' },
  { value: '其他', label: '其他' },
];

const AREA_OPTIONS: AreaBucketOption[] = [
  { value: 'small', label: '90㎡以下', min: 0, max: 90 },
  { value: 'medium', label: '90-140㎡', min: 90, max: 140 },
  { value: 'large', label: '140-200㎡', min: 140, max: 200 },
  { value: 'villa', label: '200㎡以上', min: 200, max: null },
];

const SORT_OPTIONS: Array<{ value: SortMode; label: string }> = [
  { value: 'recommend', label: '推荐' },
  { value: 'latest', label: '最新' },
  { value: 'hot', label: '热度' },
];

const getDateTimestamp = (value?: string) => {
  if (!value) {
    return 0;
  }
  return getServerTimeMs(value);
};

const dedupeFavorites = (items: FavoriteItemDTO[]) => {
  const map = new Map<string, FavoriteItemDTO>();

  items.forEach((item) => {
    const key = `${item.targetType}-${item.targetId}`;
    const current = map.get(key);
    if (!current) {
      map.set(key, item);
      return;
    }

    if (getDateTimestamp(item.createdAt) >= getDateTimestamp(current.createdAt)) {
      map.set(key, item);
    }
  });

  return Array.from(map.values()).sort(
    (left, right) => getDateTimestamp(right.createdAt) - getDateTimestamp(left.createdAt),
  );
};

const compactCount = (value?: number) => {
  const safeValue = value || 0;
  if (safeValue >= 10000) {
    return `${(safeValue / 10000).toFixed(safeValue >= 100000 ? 0 : 1)}w`;
  }

  if (safeValue >= 1000) {
    return `${(safeValue / 1000).toFixed(safeValue >= 10000 ? 0 : 1)}k`;
  }

  return `${safeValue}`;
};

const formatFavoriteDate = (value?: string) => {
  if (!value) {
    return '最近收藏';
  }
  return formatServerMonthDay(value, '最近收藏');
};

const parseAreaValue = (areaText?: string) => {
  const matched = String(areaText || '').match(/(\d+(?:\.\d+)?)/);
  return matched ? Number(matched[1]) : 0;
};

const matchAreaBucket = (areaText: string, option: AreaBucketOption) => {
  const value = parseAreaValue(areaText);
  if (value <= 0) {
    return false;
  }

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
};

const resolveOptionLabel = (options: FilterOption[], value: string) => {
  return options.find((item) => item.value === value)?.label || value;
};

const splitColumns = <T,>(items: T[]) => {
  return items.reduce<[T[], T[]]>(
    (columns, item, index) => {
      columns[index % 2].push(item);
      return columns;
    },
    [[], []],
  );
};

const renderSkeletonCards = (prefix: string) => {
  return [0, 1, 2].map((idx) => (
    <View key={`${prefix}-${idx}`} className="inspiration-page__card inspiration-page__card--skeleton">
      <Skeleton height={idx === 1 ? 360 : idx === 2 ? 300 : 420} className="inspiration-page__skeleton-cover" />
      <View className="inspiration-page__card-body">
        <View className="inspiration-page__card-title">
          <Skeleton width="88%" />
        </View>
        <View className="inspiration-page__card-title inspiration-page__card-title--secondary">
          <Skeleton width="62%" />
        </View>
        <View className="inspiration-page__card-footer">
          <View className="inspiration-page__author">
            <Skeleton width="40rpx" height={40} />
            <Skeleton width="90rpx" />
          </View>
          <Skeleton width="72rpx" />
        </View>
      </View>
    </View>
  ));
};

export default function Inspiration() {
  const auth = useAuthStore();

  const [cases, setCases] = useState<InspirationItemDTO[]>([]);
  const [casesPage, setCasesPage] = useState(1);
  const [casesHasMore, setCasesHasMore] = useState(true);
  const [loadingCases, setLoadingCases] = useState(true);
  const [loadingCasesMore, setLoadingCasesMore] = useState(false);

  const [favorites, setFavorites] = useState<FavoriteItemDTO[]>([]);
  const [favoritesPage, setFavoritesPage] = useState(1);
  const [favoritesHasMore, setFavoritesHasMore] = useState(true);
  const [loadingFavorites, setLoadingFavorites] = useState(false);
  const [loadingFavoritesMore, setLoadingFavoritesMore] = useState(false);

  const [activeStyle, setActiveStyle] = useState(ALL_FILTER_VALUE);
  const [activeLayout, setActiveLayout] = useState(ALL_FILTER_VALUE);
  const [activeArea, setActiveArea] = useState(ALL_FILTER_VALUE);
  const [sortMode, setSortMode] = useState<SortMode>('recommend');

  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [filterSheetMounted, setFilterSheetMounted] = useState(false);
  const [draftStyle, setDraftStyle] = useState(ALL_FILTER_VALUE);
  const [draftLayout, setDraftLayout] = useState(ALL_FILTER_VALUE);
  const [draftArea, setDraftArea] = useState(ALL_FILTER_VALUE);

  const [likingIds, setLikingIds] = useState<number[]>([]);
  const [favoritingIds, setFavoritingIds] = useState<number[]>([]);

  const casesRequestIdRef = useRef(0);
  const favoritesRequestIdRef = useRef(0);
  const loadingCasesMoreRef = useRef(false);
  const loadingFavoritesMoreRef = useRef(false);
  const filterSheetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const likingIdSet = useMemo(() => new Set(likingIds), [likingIds]);
  const favoritingIdSet = useMemo(() => new Set(favoritingIds), [favoritingIds]);
  const navMetrics = useMemo(() => getMiniNavMetrics(), []);
  const headerInsetStyle = useMemo(
    () => ({
      paddingTop: `${navMetrics.menuTop}px`,
      paddingRight: `${navMetrics.menuRightInset}px`,
    }),
    [navMetrics.menuRightInset, navMetrics.menuTop],
  );
  const headerMainStyle = useMemo(
    () => ({ height: `${navMetrics.menuHeight}px` }),
    [navMetrics.menuHeight],
  );
  const headerPlaceholderStyle = useMemo(
    () => ({ height: `${navMetrics.menuBottom}px` }),
    [navMetrics.menuBottom],
  );
  const capsuleSpacerStyle = useMemo(
    () => ({
      width: `${navMetrics.menuWidth}px`,
      height: `${navMetrics.menuHeight}px`,
    }),
    [navMetrics.menuHeight, navMetrics.menuWidth],
  );
  const toolbarInsetStyle = useMemo(
    () => ({ top: `${navMetrics.menuBottom}px` }),
    [navMetrics.menuBottom],
  );

  useLoad((options) => {
    const savedFilter = Taro.getStorageSync(INSPIRATION_FILTER_KEY) as Partial<InspirationFilterState> | undefined;

    if (savedFilter?.activeStyle && STYLE_OPTIONS.some((item) => item.value === savedFilter.activeStyle)) {
      setActiveStyle(savedFilter.activeStyle);
    }
    if (savedFilter?.activeLayout && LAYOUT_OPTIONS.some((item) => item.value === savedFilter.activeLayout)) {
      setActiveLayout(savedFilter.activeLayout);
    }
    if (savedFilter?.activeArea && AREA_OPTIONS.some((item) => item.value === savedFilter.activeArea)) {
      setActiveArea(savedFilter.activeArea);
    }
    if (savedFilter?.sortMode && SORT_OPTIONS.some((item) => item.value === savedFilter.sortMode)) {
      setSortMode(savedFilter.sortMode);
    }
  });

  useEffect(() => {
    const nextFilter: InspirationFilterState = {
      activeStyle,
      activeLayout,
      activeArea,
      sortMode,
      activeTab: 'all',
    };
    Taro.setStorageSync(INSPIRATION_FILTER_KEY, nextFilter);
  }, [activeArea, activeLayout, activeStyle, sortMode]);

  useEffect(() => {
    setCustomTabBarHidden(filterSheetMounted);

    return () => {
      setCustomTabBarHidden(false);
    };
  }, [filterSheetMounted]);

  useEffect(() => {
    return () => {
      if (filterSheetTimerRef.current) {
        clearTimeout(filterSheetTimerRef.current);
      }
    };
  }, []);

  const fetchCases = async (reset = false) => {
    if (reset) {
      setLoadingCases(true);
      setLoadingCasesMore(false);
      setCasesHasMore(true);
      setCasesPage(1);
      setCases([]);
      loadingCasesMoreRef.current = false;
    } else {
      if (loadingCases || loadingCasesMore || loadingCasesMoreRef.current || !casesHasMore) {
        return;
      }
      loadingCasesMoreRef.current = true;
      setLoadingCasesMore(true);
    }

    const requestId = ++casesRequestIdRef.current;
    const targetPage = reset ? 1 : casesPage;

    try {
      const caseData = await inspirationService.list({
        page: targetPage,
        pageSize: PAGE_SIZE,
        style: activeStyle !== ALL_FILTER_VALUE ? activeStyle : undefined,
        layout: activeLayout !== ALL_FILTER_VALUE ? activeLayout : undefined,
      });

      if (requestId !== casesRequestIdRef.current) {
        return;
      }

      const incoming = caseData.list || [];
      setCases((prev) => (reset ? incoming : [...prev, ...incoming]));
      setCasesPage(targetPage + 1);

      const hasMoreByTotal = (caseData.total || 0) > targetPage * PAGE_SIZE;
      setCasesHasMore(hasMoreByTotal || incoming.length === PAGE_SIZE);
    } catch (error) {
      if (requestId === casesRequestIdRef.current) {
        showErrorToast(error, '加载失败');
      }
    } finally {
      if (!reset) {
        loadingCasesMoreRef.current = false;
      }

      if (requestId === casesRequestIdRef.current) {
        if (reset) {
          setLoadingCases(false);
        } else {
          setLoadingCasesMore(false);
        }
      }
    }
  };

  const fetchFavorites = async (reset = false) => {
    if (!auth.token) {
      favoritesRequestIdRef.current += 1;
      loadingFavoritesMoreRef.current = false;
      setFavorites([]);
      setFavoritesPage(1);
      setFavoritesHasMore(false);
      setLoadingFavorites(false);
      setLoadingFavoritesMore(false);
      return;
    }

    if (reset) {
      setLoadingFavorites(true);
      setLoadingFavoritesMore(false);
      setFavoritesHasMore(true);
      setFavoritesPage(1);
      setFavorites([]);
      loadingFavoritesMoreRef.current = false;
    } else {
      if (loadingFavorites || loadingFavoritesMore || loadingFavoritesMoreRef.current || !favoritesHasMore) {
        return;
      }
      loadingFavoritesMoreRef.current = true;
      setLoadingFavoritesMore(true);
    }

    const requestId = ++favoritesRequestIdRef.current;
    const targetPage = reset ? 1 : favoritesPage;

    try {
      const res = await favoriteService.listCases(targetPage, PAGE_SIZE);
      if (requestId !== favoritesRequestIdRef.current) {
        return;
      }

      const incoming = res.list || [];
      setFavorites((prev) => dedupeFavorites(reset ? incoming : [...prev, ...incoming]));
      setFavoritesPage(targetPage + 1);

      const hasMoreByTotal = (res.total || 0) > targetPage * PAGE_SIZE;
      setFavoritesHasMore(hasMoreByTotal || incoming.length === PAGE_SIZE);
    } catch (error) {
      if (requestId === favoritesRequestIdRef.current) {
        showErrorToast(error, '加载收藏失败');
      }
    } finally {
      if (!reset) {
        loadingFavoritesMoreRef.current = false;
      }

      if (requestId === favoritesRequestIdRef.current) {
        if (reset) {
          setLoadingFavorites(false);
        } else {
          setLoadingFavoritesMore(false);
        }
      }
    }
  };
  const { refreshStatus, drawerHeight, drawerProgress, bindPullToRefresh, runReload } = usePullToRefreshFeedback(
    () => fetchCases(true),
  );

  useDidShow(() => {
    syncCurrentTabBar('/pages/inspiration/index');

    const syncPayload = Taro.getStorageSync(INSPIRATION_CASE_SYNC_KEY) as Partial<InspirationCaseSyncPayload> | undefined;
    if (!syncPayload || typeof syncPayload.id !== 'number') {
      return;
    }

    setCases((prev) => prev.map((item) => {
      if (item.id !== syncPayload.id) {
        return item;
      }

      return {
        ...item,
        isLiked: syncPayload.isLiked ?? item.isLiked,
        likeCount: syncPayload.likeCount ?? item.likeCount,
        isFavorited: syncPayload.isFavorited ?? item.isFavorited,
        commentCount: syncPayload.commentCount ?? item.commentCount,
      };
    }));

    if (syncPayload.isFavorited === false) {
      setFavorites((prev) => prev.filter((item) => item.targetId !== syncPayload.id));
    }

    if (syncPayload.isFavorited === true && auth.token) {
      void fetchFavorites(true);
    }

    Taro.removeStorageSync(INSPIRATION_CASE_SYNC_KEY);
  });

  useEffect(() => {
    void runReload();
  }, [activeLayout, activeStyle, runReload]); // eslint-disable-line react-hooks/exhaustive-deps

  useReachBottom(() => {
    void fetchCases();
  });

  const ensureAuth = () => {
    if (auth.token) {
      return true;
    }
    Taro.switchTab({ url: '/pages/profile/index' });
    return false;
  };

  const handleLike = async (item: InspirationItemDTO) => {
    if (!ensureAuth() || likingIdSet.has(item.id)) {
      return;
    }

    setLikingIds((prev) => [...prev, item.id]);

    const originLiked = item.isLiked;
    const originCount = item.likeCount;

    setCases((prev) =>
      prev.map((caseItem) =>
        caseItem.id === item.id
          ? {
              ...caseItem,
              isLiked: !originLiked,
              likeCount: originLiked ? Math.max(0, originCount - 1) : originCount + 1,
            }
          : caseItem,
      ),
    );

    try {
      if (originLiked) {
        await inspirationService.unlike(item.id);
      } else {
        await inspirationService.like(item.id);
      }
    } catch (error) {
      setCases((prev) =>
        prev.map((caseItem) =>
          caseItem.id === item.id ? { ...caseItem, isLiked: originLiked, likeCount: originCount } : caseItem,
        ),
      );
      showErrorToast(error, '点赞操作失败');
    } finally {
      setLikingIds((prev) => prev.filter((id) => id !== item.id));
    }
  };

  const handleFavorite = async (item: InspirationItemDTO) => {
    if (!ensureAuth() || favoritingIdSet.has(item.id)) {
      return;
    }

    setFavoritingIds((prev) => [...prev, item.id]);
    const originFavorited = item.isFavorited;

    setCases((prev) =>
      prev.map((caseItem) =>
        caseItem.id === item.id ? { ...caseItem, isFavorited: !originFavorited } : caseItem,
      ),
    );

    if (originFavorited) {
      setFavorites((prev) => prev.filter((favoriteItem) => favoriteItem.targetId !== item.id));
    }

    try {
      if (originFavorited) {
        await inspirationService.unfavorite(item.id);
      } else {
        await inspirationService.favorite(item.id);
      }
    } catch (error) {
      setCases((prev) =>
        prev.map((caseItem) =>
          caseItem.id === item.id ? { ...caseItem, isFavorited: originFavorited } : caseItem,
        ),
      );
      showErrorToast(error, '收藏操作失败');
    } finally {
      setFavoritingIds((prev) => prev.filter((id) => id !== item.id));
    }
  };

  const openInspirationDetail = (id: number) => {
    Taro.navigateTo({ url: `/pages/inspiration/detail/index?id=${id}` });
  };

  const filteredCases = useMemo(() => {
    const list = [...cases];

    const areaFiltered = activeArea === ALL_FILTER_VALUE
      ? list
      : list.filter((item) => {
          const selectedArea = AREA_OPTIONS.find((option) => option.value === activeArea);
          if (!selectedArea) {
            return true;
          }
          return matchAreaBucket(item.area, selectedArea);
        });

    if (sortMode === 'latest') {
      return areaFiltered.sort((left, right) => right.id - left.id);
    }

    if (sortMode === 'hot') {
      return areaFiltered.sort((left, right) => {
        if ((right.likeCount || 0) !== (left.likeCount || 0)) {
          return (right.likeCount || 0) - (left.likeCount || 0);
        }
        return right.id - left.id;
      });
    }

    return areaFiltered;
  }, [activeArea, cases, sortMode]);

  const [leftCases, rightCases] = useMemo(() => splitColumns(filteredCases), [filteredCases]);
  const [leftFavorites, rightFavorites] = useMemo(() => splitColumns(favorites), [favorites]);

  const selectedFilters = useMemo(() => {
    const result: Array<{ key: FilterGroupKey; label: string }> = [];

    if (activeStyle !== ALL_FILTER_VALUE) {
      result.push({ key: 'style', label: resolveOptionLabel(STYLE_OPTIONS, activeStyle) });
    }
    if (activeLayout !== ALL_FILTER_VALUE) {
      result.push({ key: 'layout', label: resolveOptionLabel(LAYOUT_OPTIONS, activeLayout) });
    }
    if (activeArea !== ALL_FILTER_VALUE) {
      result.push({ key: 'area', label: resolveOptionLabel(AREA_OPTIONS, activeArea) });
    }

    return result;
  }, [activeArea, activeLayout, activeStyle]);

  const selectedFilterCount = selectedFilters.length;
  const showEmpty = filteredCases.length === 0;

  const clearFilterSheetTimer = () => {
    if (filterSheetTimerRef.current) {
      clearTimeout(filterSheetTimerRef.current);
      filterSheetTimerRef.current = null;
    }
  };

  const handleOpenFilterSheet = () => {
    clearFilterSheetTimer();
    setDraftStyle(activeStyle);
    setDraftLayout(activeLayout);
    setDraftArea(activeArea);
    setFilterSheetMounted(true);
    filterSheetTimerRef.current = setTimeout(() => {
      setFilterSheetVisible(true);
      filterSheetTimerRef.current = null;
    }, 16);
  };

  const handleCloseFilterSheet = () => {
    setFilterSheetVisible(false);
    clearFilterSheetTimer();
    filterSheetTimerRef.current = setTimeout(() => {
      setFilterSheetMounted(false);
      filterSheetTimerRef.current = null;
    }, FILTER_SHEET_ANIMATION_MS);
  };

  const handleApplyFilters = () => {
    setActiveStyle(draftStyle);
    setActiveLayout(draftLayout);
    setActiveArea(draftArea);
    setFilterSheetVisible(false);
  };

  const handleResetDraftFilters = () => {
    setDraftStyle(ALL_FILTER_VALUE);
    setDraftLayout(ALL_FILTER_VALUE);
    setDraftArea(ALL_FILTER_VALUE);
  };

  const handleClearFilters = () => {
    setActiveStyle(ALL_FILTER_VALUE);
    setActiveLayout(ALL_FILTER_VALUE);
    setActiveArea(ALL_FILTER_VALUE);
  };

  const handleRemoveFilter = (key: FilterGroupKey) => {
    if (key === 'style') {
      setActiveStyle(ALL_FILTER_VALUE);
      return;
    }
    if (key === 'layout') {
      setActiveLayout(ALL_FILTER_VALUE);
      return;
    }
    setActiveArea(ALL_FILTER_VALUE);
  };

  const renderCaseCard = (item: InspirationItemDTO) => (
    <View key={item.id} className="inspiration-page__card" onClick={() => openInspirationDetail(item.id)}>
      {item.coverImage ? (
        <Image
          className="inspiration-page__card-cover"
          src={getInspirationCoverImage(item)}
          mode="widthFix"
          lazyLoad
        />
      ) : (
        <View className="inspiration-page__card-cover inspiration-page__card-cover--placeholder" />
      )}

      <View className="inspiration-page__card-body">
        <Text className="inspiration-page__card-title line-clamp-2">{item.title}</Text>
        <Text className="inspiration-page__card-subtitle">
          {[item.style, item.layout, item.area].filter(Boolean).join(' · ') || '空间灵感'}
        </Text>
        <View className="inspiration-page__card-footer">
          <View className="inspiration-page__author">
            {item.author?.avatar ? (
              <Image className="inspiration-page__author-avatar" src={item.author.avatar} mode="aspectFill" />
            ) : (
              <View className="inspiration-page__author-avatar inspiration-page__author-avatar--placeholder" />
            )}
            <Text className="inspiration-page__author-name">{item.author?.name || '官方'}</Text>
          </View>

          <View
            className={`inspiration-page__metric ${item.isLiked ? 'inspiration-page__metric--active' : ''}`}
            onClick={(event) => {
              event.stopPropagation();
              void handleLike(item);
            }}
          >
            <Icon name="favorites" size={22} color={item.isLiked ? '#2c3e50' : '#9ca3af'} />
            <Text className="inspiration-page__metric-text">{compactCount(item.likeCount)}</Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderFavoriteCard = (item: FavoriteItemDTO) => (
    <View key={item.id} className="inspiration-page__card" onClick={() => openInspirationDetail(item.targetId)}>
      {item.coverImage ? (
        <Image className="inspiration-page__card-cover" src={item.coverImage} mode="widthFix" lazyLoad />
      ) : (
        <View className="inspiration-page__card-cover inspiration-page__card-cover--placeholder" />
      )}
      <View className="inspiration-page__card-body">
        <Text className="inspiration-page__card-title line-clamp-2">{item.title}</Text>
        <Text className="inspiration-page__card-subtitle">案例收藏</Text>
        <View className="inspiration-page__card-footer">
          <Text className="inspiration-page__saved-time">{formatFavoriteDate(item.createdAt)}</Text>
          <View className="inspiration-page__saved-badge">
            <Text className="inspiration-page__saved-badge-text">已收藏</Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderFilterGroup = <T extends FilterOption>(
    label: string,
    options: T[],
    activeValue: string,
    onSelect: (value: string) => void,
  ) => {
    return (
      <View className="inspiration-page__sheet-group">
        <View className="inspiration-page__sheet-group-head">
          <Text className="inspiration-page__sheet-group-title">{label}</Text>
        </View>
        <View className="inspiration-page__sheet-options">
          <View
            className={`inspiration-page__sheet-chip ${activeValue === ALL_FILTER_VALUE ? 'inspiration-page__sheet-chip--active' : ''}`}
            onClick={() => onSelect(ALL_FILTER_VALUE)}
          >
            <Text className="inspiration-page__sheet-chip-text">全部</Text>
          </View>
          {options.map((item) => (
            <View
              key={item.value}
              className={`inspiration-page__sheet-chip ${activeValue === item.value ? 'inspiration-page__sheet-chip--active' : ''}`}
              onClick={() => onSelect(item.value)}
            >
              <Text className="inspiration-page__sheet-chip-text">{item.label}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  return (
    <View className="inspiration-page" {...bindPullToRefresh}>
      <View className="inspiration-page__header" style={headerInsetStyle}>
        <View className="inspiration-page__header-main" style={headerMainStyle}>
          <Text className="inspiration-page__header-title">灵感图库</Text>
          <View
            className="inspiration-page__capsule-spacer"
            style={capsuleSpacerStyle}
          />
        </View>
      </View>
      <View className="inspiration-page__header-placeholder" style={headerPlaceholderStyle} />
      <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />

      <View className="inspiration-page__content">
        <View className="inspiration-page__toolbar" style={toolbarInsetStyle}>
          <View className="inspiration-page__sort-tabs">
            {SORT_OPTIONS.map((option) => (
              <View
                key={option.value}
                className={`inspiration-page__sort-tab ${sortMode === option.value ? 'inspiration-page__sort-tab--active' : ''}`}
                onClick={() => setSortMode(option.value)}
              >
                <Text className="inspiration-page__sort-tab-text">{option.label}</Text>
              </View>
            ))}
          </View>
          <View className="inspiration-page__filter-trigger" onClick={handleOpenFilterSheet}>
            <Icon name="filter" size={26} color="#111111" />
            {selectedFilterCount > 0 ? (
              <View className="inspiration-page__filter-trigger-badge">
                <Text className="inspiration-page__filter-trigger-badge-text">{selectedFilterCount}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {selectedFilterCount > 0 ? (
          <View className="inspiration-page__active-bar">
            <View className="inspiration-page__active-list">
              {selectedFilters.map((item) => (
                <View
                  key={item.key}
                  className="inspiration-page__active-chip"
                  onClick={() => handleRemoveFilter(item.key)}
                >
                  <Text className="inspiration-page__active-chip-text">{item.label}</Text>
                  <Text className="inspiration-page__active-chip-close">×</Text>
                </View>
              ))}
            </View>
            <Text className="inspiration-page__active-clear" onClick={handleClearFilters}>清空</Text>
          </View>
        ) : null}

        {showEmpty && !loadingCases ? (
          <View className="inspiration-page__empty">
            <Empty
              description="当前筛选下暂无灵感案例"
              action={
                selectedFilterCount > 0
                  ? { text: '清空筛选', onClick: handleClearFilters }
                  : undefined
              }
            />
          </View>
        ) : (
          <View className="inspiration-page__waterfall">
            <View className="inspiration-page__column">
              {leftCases.map((item) => renderCaseCard(item))}
              {(loadingCases || loadingCasesMore) ? renderSkeletonCards('left') : null}
            </View>
            <View className="inspiration-page__column">
              {rightCases.map((item) => renderCaseCard(item))}
              {(loadingCases || loadingCasesMore) ? renderSkeletonCards('right') : null}
            </View>
          </View>
        )}

        {!showEmpty && !loadingCases ? (
          <Text className="inspiration-page__status">
            {casesHasMore ? '上拉继续发现更多灵感' : '已经看到全部灵感了'}
          </Text>
        ) : null}
      </View>

      {filterSheetMounted ? (
        <>
          <View
            className={`inspiration-page__sheet-backdrop ${filterSheetVisible ? 'inspiration-page__sheet-backdrop--active' : ''}`}
            onClick={handleCloseFilterSheet}
          />
          <View
            className={`inspiration-page__sheet ${filterSheetVisible ? 'inspiration-page__sheet--active' : ''}`}
            onClick={(event) => event.stopPropagation()}
          >
            <View className="inspiration-page__sheet-handle" />
            <View className="inspiration-page__sheet-head">
              <Text className="inspiration-page__sheet-title">筛选</Text>
              <Text className="inspiration-page__sheet-close" onClick={handleCloseFilterSheet}>×</Text>
            </View>

            <View className="inspiration-page__sheet-body">
              {renderFilterGroup('风格', STYLE_OPTIONS, draftStyle, setDraftStyle)}
              {renderFilterGroup('户型', LAYOUT_OPTIONS, draftLayout, setDraftLayout)}
              {renderFilterGroup('面积', AREA_OPTIONS, draftArea, setDraftArea)}
            </View>

            <View className="inspiration-page__sheet-footer">
              <View className="inspiration-page__sheet-button inspiration-page__sheet-button--ghost" onClick={handleResetDraftFilters}>
                <Text className="inspiration-page__sheet-button-text inspiration-page__sheet-button-text--ghost">重置</Text>
              </View>
              <View className="inspiration-page__sheet-button inspiration-page__sheet-button--primary" onClick={handleApplyFilters}>
                <Text className="inspiration-page__sheet-button-text">确认</Text>
              </View>
            </View>
          </View>
        </>
      ) : null}
    </View>
  );
}
