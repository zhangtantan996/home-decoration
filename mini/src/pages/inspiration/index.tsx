import Taro, { useDidShow, useLoad, usePullDownRefresh, useReachBottom } from '@tarojs/taro';
import { Image, ScrollView, View } from '@tarojs/components';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Empty } from '@/components/Empty';
import { ListItem } from '@/components/ListItem';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import type { FavoriteItemDTO, InspirationItemDTO } from '@/services/dto';
import { favoriteService, inspirationService } from '@/services/inspiration';
import { useAuthStore } from '@/store/auth';
import { showErrorToast } from '@/utils/error';

const STYLES = ['现代', '原木', '极简', '侘寂', '美式', '法式'];
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
  activeTab?: 'all' | 'favorites';
}

const getDateTimestamp = (value?: string) => {
  if (!value) {
    return 0;
  }

  const time = Date.parse(value);
  return Number.isNaN(time) ? 0 : time;
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

const renderCaseSkeletons = () => {
  return [0, 1].map((idx) => (
    <View key={`case-skeleton-${idx}`} className="mb-md border-b border-gray-100 pb-md">
      <View className="mb-sm"><Skeleton width="70%" /></View>
      <View className="mb-sm"><Skeleton width="45%" /></View>
      <Skeleton height={220} className="mb-sm" />
      <View className="flex justify-between items-center px-md">
        <Skeleton width="35%" />
        <View className="flex gap-sm">
          <Skeleton width="110rpx" />
          <Skeleton width="110rpx" />
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

  const [likingIds, setLikingIds] = useState<number[]>([]);
  const [favoritingIds, setFavoritingIds] = useState<number[]>([]);

  const casesRequestIdRef = useRef(0);
  const favoritesRequestIdRef = useRef(0);
  const loadingCasesMoreRef = useRef(false);
  const loadingFavoritesMoreRef = useRef(false);

  const likingIdSet = useMemo(() => new Set(likingIds), [likingIds]);
  const favoritingIdSet = useMemo(() => new Set(favoritingIds), [favoritingIds]);

  useLoad((options) => {
    const savedFilter = Taro.getStorageSync(INSPIRATION_FILTER_KEY) as Partial<InspirationFilterState> | undefined;
    if (savedFilter?.activeStyle && STYLES.includes(savedFilter.activeStyle)) {
      setActiveStyle(savedFilter.activeStyle);
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
      activeTab: activeTab === 'favorites' && !auth.token ? 'all' : activeTab,
    };
    Taro.setStorageSync(INSPIRATION_FILTER_KEY, nextFilter);
  }, [activeStyle, activeTab, auth.token]);

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
    } catch (err) {
      if (requestId === casesRequestIdRef.current) {
        showErrorToast(err, '加载失败');
      }
    } finally {
      if (!reset) {
        loadingCasesMoreRef.current = false;
      }

      const isLatestRequest = requestId === casesRequestIdRef.current;
      if (isLatestRequest) {
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
    } catch (err) {
      if (requestId === favoritesRequestIdRef.current) {
        showErrorToast(err, '加载收藏失败');
      }
    } finally {
      if (!reset) {
        loadingFavoritesMoreRef.current = false;
      }

      const isLatestRequest = requestId === favoritesRequestIdRef.current;
      if (isLatestRequest) {
        if (reset) {
          setLoadingFavorites(false);
        } else {
          setLoadingFavoritesMore(false);
        }
      }
    }
  };

  useDidShow(() => {
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
    const shouldLoadFavorites = auth.token && activeTab === 'favorites';
    if (!shouldLoadFavorites) {
      return;
    }

    void fetchFavorites(true);
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
      if (!auth.token) {
        return;
      }
      void fetchFavorites();
      return;
    }

    void fetchCases();
  });

  const ensureAuth = () => {
    if (auth.token) {
      return true;
    }
    Taro.navigateTo({ url: '/pages/profile/index' });
    return false;
  };

  const handleLike = async (item: InspirationItemDTO) => {
    if (!ensureAuth()) {
      return;
    }

    if (likingIdSet.has(item.id)) {
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
    if (!ensureAuth()) {
      return;
    }

    if (favoritingIdSet.has(item.id)) {
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

  return (
    <View className="page">
      <View className="m-md">
        <View className="text-primary font-bold" style={{ fontSize: '40rpx', marginBottom: '24rpx' }}>
          灵感合集
        </View>

        <Card title="热门风格" className="mb-lg">
          <ScrollView scrollX style={{ whiteSpace: 'nowrap', width: '100%' }}>
            <View style={{ display: 'inline-block', marginRight: '16rpx' }}>
              <Tag
                variant={activeStyle ? 'secondary' : 'brand'}
                className="px-lg py-sm"
                style={{ fontSize: '28rpx', padding: '12rpx 32rpx' }}
                onClick={() => setActiveStyle('')}
              >
                全部
              </Tag>
            </View>
            {STYLES.map((style) => (
              <View key={style} style={{ display: 'inline-block', marginRight: '16rpx' }}>
                <Tag
                  variant={activeStyle === style ? 'brand' : 'secondary'}
                  className="px-lg py-sm"
                  style={{ fontSize: '28rpx', padding: '12rpx 32rpx' }}
                  onClick={() => setActiveStyle(style)}
                >
                  {style}
                </Tag>
              </View>
            ))}
          </ScrollView>
        </Card>

        <Card title="内容分区" className="mb-lg">
          <View className="flex gap-sm">
            <Button variant={activeTab === 'all' ? 'primary' : 'secondary'} size="sm" onClick={() => setActiveTab('all')}>
              灵感列表
            </Button>
            <Button
              variant={activeTab === 'favorites' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => {
                if (!ensureAuth()) {
                  return;
                }
                setActiveTab('favorites');
              }}
            >
              我的收藏
            </Button>
          </View>
        </Card>

        <Card
          title={activeTab === 'all' ? '精选案例' : '我的收藏'}
          extra={
            <View className="text-brand" onClick={() => Taro.navigateTo({ url: '/pages/providers/list/index' })}>
              查看服务商
            </View>
          }
        >
          {activeTab === 'all' && loadingCases && cases.length === 0 ? (
            <View className="p-sm">{renderCaseSkeletons()}</View>
          ) : activeTab === 'all' && cases.length === 0 ? (
            <Empty description="暂无案例数据" />
          ) : activeTab === 'favorites' && !auth.token ? (
            <Empty description="登录后查看收藏" action={{ text: '去登录', onClick: () => Taro.switchTab({ url: '/pages/profile/index' }) }} />
          ) : activeTab === 'favorites' && loadingFavorites && favorites.length === 0 ? (
            <View className="p-sm">
              <View className="mb-sm"><Skeleton width="80%" /></View>
              <View className="mb-sm"><Skeleton width="60%" /></View>
              <View><Skeleton width="70%" /></View>
            </View>
          ) : activeTab === 'favorites' && favorites.length === 0 ? (
            <Empty description="暂无收藏案例" action={{ text: '去逛逛', onClick: () => setActiveTab('all') }} />
          ) : activeTab === 'favorites' ? (
            favorites.map((item) => (
              <ListItem
                key={item.id}
                title={item.title}
                description={item.targetType === 'case' ? '案例收藏' : '其他收藏'}
                arrow
                onClick={() => openInspirationDetail(item.targetId)}
              />
            ))
          ) : (
            cases.map((item) => (
              <View key={item.id} className="mb-md border-b border-gray-100 pb-md">
                <ListItem
                  title={item.title}
                  description={item.style ? `${item.style} · ${item.layout || ''} · ${item.area || ''}` : '暂无风格信息'}
                  arrow
                  onClick={() => openInspirationDetail(item.id)}
                />
                {item.coverImage ? (
                  <Image
                    src={item.coverImage}
                    mode="aspectFill"
                    style={{ width: '100%', height: '260rpx', borderRadius: '12rpx', marginTop: '12rpx' }}
                  />
                ) : null}
                <View className="flex justify-between items-center mt-sm px-md">
                  <View className="text-gray-500 text-sm">
                    {item.author?.name || '官方'} · {item.commentCount || 0} 评论
                  </View>
                  <View className="flex gap-sm">
                    <Button
                      size="sm"
                      variant={item.isLiked ? 'brand' : 'secondary'}
                      onClick={() => handleLike(item)}
                      loading={likingIdSet.has(item.id)}
                      disabled={likingIdSet.has(item.id) || favoritingIdSet.has(item.id)}
                    >
                      点赞 {item.likeCount || 0}
                    </Button>
                    <Button
                      size="sm"
                      variant={item.isFavorited ? 'brand' : 'secondary'}
                      onClick={() => handleFavorite(item)}
                      loading={favoritingIdSet.has(item.id)}
                      disabled={likingIdSet.has(item.id) || favoritingIdSet.has(item.id)}
                    >
                      {item.isFavorited ? '已收藏' : '收藏'}
                    </Button>
                  </View>
                </View>
              </View>
            ))
          )}

          {activeTab === 'all' && loadingCasesMore ? (
            <View className="text-center text-gray-400 text-xs py-md">加载中...</View>
          ) : null}
          {activeTab === 'all' && !casesHasMore && cases.length > 0 ? (
            <View className="text-center text-gray-400 text-xs py-md">没有更多案例了</View>
          ) : null}

          {activeTab === 'favorites' && loadingFavoritesMore ? (
            <View className="text-center text-gray-400 text-xs py-md">加载中...</View>
          ) : null}
          {activeTab === 'favorites' && !favoritesHasMore && favorites.length > 0 ? (
            <View className="text-center text-gray-400 text-xs py-md">没有更多收藏了</View>
          ) : null}
        </Card>
      </View>
    </View>
  );
}
