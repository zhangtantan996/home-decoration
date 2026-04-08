import Taro, { useDidShow, useReachBottom } from '@tarojs/taro';
import { Image, Text, View } from '@tarojs/components';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Empty } from '@/components/Empty';
import MiniPageNav from '@/components/MiniPageNav';
import { PullToRefreshNotice } from '@/components/PullToRefreshNotice';
import { Skeleton } from '@/components/Skeleton';
import { usePullToRefreshFeedback } from '@/hooks/usePullToRefreshFeedback';
import type { FavoriteItemDTO } from '@/services/dto';
import { favoriteService } from '@/services/inspiration';
import { useAuthStore } from '@/store/auth';
import { showErrorToast } from '@/utils/error';
import { formatServerMonthDay, getServerTimeMs } from '@/utils/serverTime';

import './index.scss';

const PAGE_SIZE = 20;
const INSPIRATION_CASE_SYNC_KEY = 'inspiration_case_sync';

interface InspirationCaseSyncPayload {
  id: number;
  isFavorited?: boolean;
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
    if (!current || getDateTimestamp(item.createdAt) >= getDateTimestamp(current.createdAt)) {
      map.set(key, item);
    }
  });

  return Array.from(map.values()).sort(
    (left, right) => getDateTimestamp(right.createdAt) - getDateTimestamp(left.createdAt),
  );
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

const formatFavoriteDate = (value?: string) => {
  if (!value) {
    return '最近收藏';
  }
  return formatServerMonthDay(value, '最近收藏');
};

const renderSkeletonCards = () => (
  [0, 1, 2].map((idx) => (
    <View key={`favorite-skeleton-${idx}`} className="profile-favorites-page__skeleton">
      <Skeleton height={idx === 1 ? 360 : idx === 2 ? 300 : 420} />
      <View className="profile-favorites-page__skeleton-body">
        <View className="profile-favorites-page__skeleton-line">
          <Skeleton width="88%" />
        </View>
        <View className="profile-favorites-page__skeleton-line">
          <Skeleton width="56%" />
        </View>
      </View>
    </View>
  ))
);

export default function ProfileFavoritesPage() {
  const auth = useAuthStore();
  const [favorites, setFavorites] = useState<FavoriteItemDTO[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const requestIdRef = useRef(0);
  const loadingMoreRef = useRef(false);

  const openInspirationDetail = (id: number) => {
    Taro.navigateTo({ url: `/pages/inspiration/detail/index?id=${id}` });
  };

  const fetchFavorites = useCallback(async (reset = false) => {
    if (!auth.token) {
      requestIdRef.current += 1;
      loadingMoreRef.current = false;
      setFavorites([]);
      setPage(1);
      setHasMore(false);
      setLoading(false);
      setLoadingMore(false);
      return;
    }

    if (reset) {
      setLoading(true);
      setLoadingMore(false);
      setPage(1);
      setHasMore(true);
      setFavorites([]);
      loadingMoreRef.current = false;
    } else {
      if (loading || loadingMore || loadingMoreRef.current || !hasMore) {
        return;
      }
      loadingMoreRef.current = true;
      setLoadingMore(true);
    }

    const requestId = ++requestIdRef.current;
    const targetPage = reset ? 1 : page;

    try {
      const res = await favoriteService.listCases(targetPage, PAGE_SIZE);
      if (requestId !== requestIdRef.current) {
        return;
      }

      const incoming = res.list || [];
      setFavorites((prev) => dedupeFavorites(reset ? incoming : [...prev, ...incoming]));
      setPage(targetPage + 1);

      const hasMoreByTotal = Number(res.total || 0) > targetPage * PAGE_SIZE;
      setHasMore(hasMoreByTotal || incoming.length === PAGE_SIZE);
    } catch (error) {
      if (requestId === requestIdRef.current) {
        showErrorToast(error, '加载收藏失败');
      }
    } finally {
      if (!reset) {
        loadingMoreRef.current = false;
      }

      if (requestId === requestIdRef.current) {
        if (reset) {
          setLoading(false);
        } else {
          setLoadingMore(false);
        }
      }
    }
  }, [auth.token, hasMore, loading, loadingMore, page]);

  const { refreshStatus, drawerHeight, drawerProgress, bindPullToRefresh, runReload } =
    usePullToRefreshFeedback(() => fetchFavorites(true));

  useEffect(() => {
    void runReload();
  }, [auth.token, runReload]);

  useDidShow(() => {
    const syncPayload = Taro.getStorageSync(INSPIRATION_CASE_SYNC_KEY) as Partial<InspirationCaseSyncPayload> | undefined;
    if (!syncPayload || typeof syncPayload.id !== 'number') {
      return;
    }

    if (syncPayload.isFavorited === false) {
      setFavorites((prev) => prev.filter((item) => item.targetId !== syncPayload.id));
    }

    if (syncPayload.isFavorited === true && auth.token) {
      void fetchFavorites(true);
    }

    Taro.removeStorageSync(INSPIRATION_CASE_SYNC_KEY);
  });

  useReachBottom(() => {
    void fetchFavorites();
  });

  const [leftColumn, rightColumn] = useMemo(() => splitColumns(favorites), [favorites]);

  const handleBack = () => {
    if (Taro.getCurrentPages().length > 1) {
      Taro.navigateBack();
      return;
    }
    Taro.switchTab({ url: '/pages/profile/index' });
  };

  const renderFavoriteCard = (item: FavoriteItemDTO) => (
    <View key={item.id} className="profile-favorites-page__card" onClick={() => openInspirationDetail(item.targetId)}>
      {item.coverImage ? (
        <Image className="profile-favorites-page__cover" src={item.coverImage} mode="widthFix" lazyLoad />
      ) : (
        <View className="profile-favorites-page__cover profile-favorites-page__cover--placeholder" />
      )}
      <View className="profile-favorites-page__card-body">
        <Text className="profile-favorites-page__card-title line-clamp-2">{item.title || '未命名灵感案例'}</Text>
        <Text className="profile-favorites-page__card-subtitle">点击查看灵感详情</Text>
        <View className="profile-favorites-page__card-footer">
          <Text className="profile-favorites-page__saved-time">{formatFavoriteDate(item.createdAt)}</Text>
          <View className="profile-favorites-page__saved-badge">
            <Text className="profile-favorites-page__saved-badge-text">已收藏</Text>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <View className="profile-favorites-page page" {...bindPullToRefresh}>
      <MiniPageNav title="灵感收藏" onBack={handleBack} placeholder />
      <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />

      {!auth.token ? (
        <View className="p-md">
          <Empty
            description="登录后查看收藏的灵感案例"
            action={{ text: '去登录', onClick: () => Taro.switchTab({ url: '/pages/profile/index' }) }}
          />
        </View>
      ) : (
        <View className="profile-favorites-page__content">
          {loading && favorites.length === 0 ? (
            <View className="profile-favorites-page__waterfall">
              <View className="profile-favorites-page__column">{renderSkeletonCards()}</View>
              <View className="profile-favorites-page__column">{renderSkeletonCards()}</View>
            </View>
          ) : favorites.length === 0 ? (
            <Empty description="暂无收藏的灵感案例" />
          ) : (
            <>
              <View className="profile-favorites-page__waterfall">
                <View className="profile-favorites-page__column">
                  {leftColumn.map((item) => renderFavoriteCard(item))}
                </View>
                <View className="profile-favorites-page__column">
                  {rightColumn.map((item) => renderFavoriteCard(item))}
                </View>
              </View>
              {loadingMore ? <View className="profile-favorites-page__loading">加载中...</View> : null}
              {!hasMore ? <View className="profile-favorites-page__loading">已经到底啦</View> : null}
            </>
          )}
        </View>
      )}
    </View>
  );
}
