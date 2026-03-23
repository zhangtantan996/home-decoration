import Taro, { useDidShow, useLoad, usePullDownRefresh, useReachBottom } from '@tarojs/taro';
import { Image, Input, Text, View } from '@tarojs/components';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { Empty } from '@/components/Empty';
import { Icon } from '@/components/Icon';
import { Skeleton } from '@/components/Skeleton';
import type { FavoriteItemDTO, InspirationItemDTO } from '@/services/dto';
import { favoriteService, inspirationService } from '@/services/inspiration';
import { useAuthStore } from '@/store/auth';
import { syncCurrentTabBar } from '@/utils/customTabBar';
import { showErrorToast } from '@/utils/error';
import { getInspirationCoverImage } from '@/utils/inspirationImages';
import { formatServerMonthDay, getServerTimeMs } from '@/utils/serverTime';

import './index.scss';

const STYLES = ['现代', '原木', '极简', '侘寂', '美式', '法式'];
const SPACE_TAGS = ['全部', '客厅', '卧室', '厨卫', '阳台', '办公区'];
const PAGE_SIZE = 10;
const INSPIRATION_CASE_SYNC_KEY = 'inspiration_case_sync';
const INSPIRATION_FILTER_KEY = 'inspiration_filter_state';

interface InspirationCaseSyncPayload {
  id: number;
  isLiked?: boolean;
  likeCount?: number;
  isFavorited?: boolean;
  commentCount?: number;
}

interface InspirationFilterState {
  activeStyle?: string;
  activeSpace?: string;
  activeTab?: 'all' | 'favorites';
  keyword?: string;
}

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

  return Array.from(map.values()).sort((left, right) => getDateTimestamp(right.createdAt) - getDateTimestamp(left.createdAt));
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

const matchesSpace = (title: string, space: string) => {
  if (!space || space === '全部') {
    return true;
  }

  const text = title.toLowerCase();
  const patternMap: Record<string, RegExp> = {
    客厅: /(客厅|会客|沙发|电视墙)/,
    卧室: /(卧室|主卧|次卧|睡眠|床头)/,
    厨卫: /(厨房|餐厨|卫生间|浴室|厨卫)/,
    阳台: /(阳台|露台)/,
    办公区: /(书房|办公|工作区|书桌)/,
  };

  return (patternMap[space] || /.*/).test(text);
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

  const [activeTab, setActiveTab] = useState<'all' | 'favorites'>('all');
  const [activeStyle, setActiveStyle] = useState('');
  const [activeSpace, setActiveSpace] = useState('全部');
  const [keyword, setKeyword] = useState('');

  const [likingIds, setLikingIds] = useState<number[]>([]);
  const [favoritingIds, setFavoritingIds] = useState<number[]>([]);

  const casesRequestIdRef = useRef(0);
  const favoritesRequestIdRef = useRef(0);
  const loadingCasesMoreRef = useRef(false);
  const loadingFavoritesMoreRef = useRef(false);

  const likingIdSet = useMemo(() => new Set(likingIds), [likingIds]);
  const favoritingIdSet = useMemo(() => new Set(favoritingIds), [favoritingIds]);
  const statusBarHeight = useMemo(() => Taro.getSystemInfoSync().statusBarHeight || 24, []);
  const navInsetStyle = useMemo(() => ({ paddingTop: `${statusBarHeight + 10}px` }), [statusBarHeight]);

  useLoad((options) => {
    const savedFilter = Taro.getStorageSync(INSPIRATION_FILTER_KEY) as Partial<InspirationFilterState> | undefined;
    if (savedFilter?.activeStyle && STYLES.includes(savedFilter.activeStyle)) {
      setActiveStyle(savedFilter.activeStyle);
    }
    if (savedFilter?.activeSpace && SPACE_TAGS.includes(savedFilter.activeSpace)) {
      setActiveSpace(savedFilter.activeSpace);
    }
    if (typeof savedFilter?.keyword === 'string') {
      setKeyword(savedFilter.keyword);
    }
    if (savedFilter?.activeTab === 'favorites' && auth.token) {
      setActiveTab('favorites');
    }
    if (options.tab === 'favorites' && auth.token) {
      setActiveTab('favorites');
    }
  });

  useEffect(() => {
    const nextFilter: InspirationFilterState = {
      activeStyle,
      activeSpace,
      keyword,
      activeTab: activeTab === 'favorites' && !auth.token ? 'all' : activeTab,
    };
    Taro.setStorageSync(INSPIRATION_FILTER_KEY, nextFilter);
  }, [activeStyle, activeSpace, activeTab, auth.token, keyword]);

  const fetchCases = async (reset = false) => {
    if (reset) {
      setLoadingCases(true);
      setLoadingCasesMore(false);
      setCasesHasMore(true);
      setCasesPage(1);
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
        style: activeStyle,
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

  useDidShow(() => {
    syncCurrentTabBar('/pages/inspiration/index');

    const nextTab = Taro.getStorageSync('inspiration_active_tab');
    if (nextTab === 'favorites' && auth.token) {
      setActiveTab('favorites');
    }
    Taro.removeStorageSync('inspiration_active_tab');

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
    void fetchCases(true);
  }, [activeStyle]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (auth.token && activeTab === 'favorites') {
      void fetchFavorites(true);
    }
  }, [activeTab, auth.token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!auth.token && activeTab === 'favorites') {
      setActiveTab('all');
    }
  }, [auth.token, activeTab]);

  usePullDownRefresh(() => {
    const refreshTask = activeTab === 'favorites'
      ? fetchFavorites(true)
      : fetchCases(true);

    refreshTask.finally(() => {
      Taro.stopPullDownRefresh();
    });
  });

  useReachBottom(() => {
    if (activeTab === 'favorites') {
      if (auth.token) {
        void fetchFavorites();
      }
      return;
    }

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
    const query = keyword.trim().toLowerCase();
    return cases.filter((item) => {
      const text = `${item.title} ${item.style} ${item.layout} ${item.area} ${item.author?.name || ''}`.toLowerCase();
      return (!query || text.includes(query)) && matchesSpace(text, activeSpace);
    });
  }, [activeSpace, cases, keyword]);

  const filteredFavorites = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    return favorites.filter((item) => {
      const text = `${item.title} ${item.targetType}`.toLowerCase();
      return (!query || text.includes(query)) && matchesSpace(text, activeSpace);
    });
  }, [activeSpace, favorites, keyword]);

  const [leftCases, rightCases] = useMemo(() => splitColumns(filteredCases), [filteredCases]);
  const [leftFavorites, rightFavorites] = useMemo(() => splitColumns(filteredFavorites), [filteredFavorites]);

  const renderCaseCard = (item: InspirationItemDTO) => (
    <View key={item.id} className="inspiration-page__card" onClick={() => openInspirationDetail(item.id)}>
      <View
        className={`inspiration-page__favorite-chip ${item.isFavorited ? 'inspiration-page__favorite-chip--active' : ''}`}
        onClick={(event) => {
          event.stopPropagation();
          void handleFavorite(item);
        }}
      >
        <Text className="inspiration-page__favorite-chip-text">{item.isFavorited ? '已藏' : '收藏'}</Text>
      </View>

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
        <Text className="inspiration-page__card-subtitle">{item.style || item.layout || '空间灵感'}</Text>
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

  const isFavoritesTab = activeTab === 'favorites';
  const showEmpty = isFavoritesTab ? filteredFavorites.length === 0 : filteredCases.length === 0;

  return (
    <View className="inspiration-page">
      <View className="inspiration-page__nav" style={navInsetStyle}>
        <Text className="inspiration-page__nav-title">发现灵感</Text>
        <View className="inspiration-page__nav-icon">
          <Icon name="search" size={30} color="#111111" />
        </View>
      </View>

      <View className="inspiration-page__content">
        <View className="inspiration-page__search">
          <Icon name="search" size={28} color="#8b8b8b" className="inspiration-page__search-icon" />
          <Input
            className="inspiration-page__search-input"
            type="text"
            confirmType="search"
            value={keyword}
            maxlength={30}
            placeholder="搜索 极简 客厅 文艺 灵感"
            placeholderClass="inspiration-page__search-placeholder"
            onInput={(event) => setKeyword(event.detail.value)}
          />
        </View>

        <View className="inspiration-page__filters">
          <View className="inspiration-page__chip-row">
            <View
              className={`inspiration-page__chip ${activeTab === 'all' ? 'inspiration-page__chip--active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              <Text className="inspiration-page__chip-text">推荐</Text>
            </View>
            <View
              className={`inspiration-page__chip ${activeTab === 'favorites' ? 'inspiration-page__chip--active' : ''}`}
              onClick={() => {
                if (!ensureAuth()) {
                  return;
                }
                setActiveTab('favorites');
              }}
            >
              <Text className="inspiration-page__chip-text">收藏</Text>
            </View>
            {STYLES.map((style) => (
              <View
                key={style}
                className={`inspiration-page__chip ${activeStyle === style ? 'inspiration-page__chip--active' : ''}`}
                onClick={() => setActiveStyle(activeStyle === style ? '' : style)}
              >
                <Text className="inspiration-page__chip-text">{style}</Text>
              </View>
            ))}
          </View>

          <View className="inspiration-page__chip-row inspiration-page__chip-row--secondary">
            {SPACE_TAGS.map((space) => (
              <View
                key={space}
                className={`inspiration-page__chip inspiration-page__chip--soft ${activeSpace === space ? 'inspiration-page__chip--active' : ''}`}
                onClick={() => setActiveSpace(space)}
              >
                <Text className="inspiration-page__chip-text">{space}</Text>
              </View>
            ))}
          </View>
        </View>

        {isFavoritesTab && !auth.token ? (
          <View className="inspiration-page__empty">
            <Empty
              description="登录后查看收藏灵感"
              action={{ text: '去登录', onClick: () => Taro.switchTab({ url: '/pages/profile/index' }) }}
            />
          </View>
        ) : null}

        {isFavoritesTab && auth.token && loadingFavorites && favorites.length === 0 ? (
          <View className="inspiration-page__waterfall">
            <View className="inspiration-page__column">{renderSkeletonCards('favorite-left')}</View>
            <View className="inspiration-page__column">{renderSkeletonCards('favorite-right')}</View>
          </View>
        ) : null}

        {!isFavoritesTab && loadingCases && cases.length === 0 ? (
          <View className="inspiration-page__waterfall">
            <View className="inspiration-page__column">{renderSkeletonCards('case-left')}</View>
            <View className="inspiration-page__column">{renderSkeletonCards('case-right')}</View>
          </View>
        ) : null}

        {!loadingCases && !loadingFavorites && showEmpty && (!isFavoritesTab || auth.token) ? (
          <View className="inspiration-page__empty">
            <Empty
              description={isFavoritesTab ? '还没有收藏灵感' : '暂无匹配的灵感内容'}
              action={isFavoritesTab ? { text: '去逛逛', onClick: () => setActiveTab('all') } : undefined}
            />
          </View>
        ) : null}

        {isFavoritesTab && auth.token && filteredFavorites.length > 0 ? (
          <View className="inspiration-page__waterfall">
            <View className="inspiration-page__column">{leftFavorites.map((item) => renderFavoriteCard(item))}</View>
            <View className="inspiration-page__column">{rightFavorites.map((item) => renderFavoriteCard(item))}</View>
          </View>
        ) : null}

        {!isFavoritesTab && filteredCases.length > 0 ? (
          <View className="inspiration-page__waterfall">
            <View className="inspiration-page__column">{leftCases.map((item) => renderCaseCard(item))}</View>
            <View className="inspiration-page__column">{rightCases.map((item) => renderCaseCard(item))}</View>
          </View>
        ) : null}

        {!isFavoritesTab && loadingCasesMore ? (
          <Text className="inspiration-page__status">加载更多灵感中...</Text>
        ) : null}
        {!isFavoritesTab && !casesHasMore && filteredCases.length > 0 ? (
          <Text className="inspiration-page__status">已经到底了</Text>
        ) : null}
        {isFavoritesTab && loadingFavoritesMore ? (
          <Text className="inspiration-page__status">加载更多收藏中...</Text>
        ) : null}
        {isFavoritesTab && !favoritesHasMore && filteredFavorites.length > 0 ? (
          <Text className="inspiration-page__status">收藏已全部展示</Text>
        ) : null}
      </View>
    </View>
  );
}
