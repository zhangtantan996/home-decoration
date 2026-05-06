import React, { useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, Text, View } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';

import { Empty } from '@/components/Empty';
import { Icon } from '@/components/Icon';
import MiniPageNav, { MINI_PAGE_NAV_EXTRA_BOTTOM } from '@/components/MiniPageNav';
import PageStateCard from '@/components/PageStateCard';
import { Skeleton } from '@/components/Skeleton';
import useSlowLoadingHint from '@/hooks/useSlowLoadingHint';
import {
  getProviderReviews,
  getReviewStats,
  type ProviderReviewItem,
  type ProviderType,
  type ReviewStats,
} from '@/services/providers';
import { getMiniNavMetrics } from '@/utils/navLayout';
import { formatServerDate, getServerTimeMs } from '@/utils/serverTime';

import './index.scss';

type FilterKey = 'all' | 'with-image' | 'high-score' | string;

interface ExtendedReviewStats extends ReviewStats {
  avgRating?: number;
  total?: number;
  withImage?: number;
  goodCount?: number;
  tags?: Record<string, number>;
  starDistribution?: Record<string, number>;
}

const normalizeProviderType = (value?: string): ProviderType => {
  if (value === 'company' || value === '2') return 'company';
  if (value === 'foreman' || value === '3') return 'foreman';
  return 'designer';
};

const decodeText = (value?: string) => {
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const parseImages = (value?: string) => {
  if (!value) return [] as string[];

  const text = value.trim();
  if (!text) return [];

  if (text.startsWith('[') && text.endsWith(']')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
    } catch {
      // ignore invalid json payload
    }
  }

  return text
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const parseTags = (value?: string) => {
  if (!value) return [] as string[];
  return value
    .split(/[、，,|/]/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const buildStarDistribution = (list: ProviderReviewItem[]) => {
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  list.forEach((item) => {
    const rating = Math.min(5, Math.max(1, Math.round(Number(item.rating || 0))));
    distribution[rating as keyof typeof distribution] += 1;
  });

  return distribution;
};

const ReviewsPage: React.FC = () => {
  const navMetrics = useMemo(() => getMiniNavMetrics(), []);
  const [providerId, setProviderId] = useState(0);
  const [providerType, setProviderType] = useState<ProviderType>('designer');
  const [providerName, setProviderName] = useState('');
  const [list, setList] = useState<ProviderReviewItem[]>([]);
  const [stats, setStats] = useState<ExtendedReviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');

  const filterBarStyle = useMemo(
    () => ({ top: `${navMetrics.menuBottom + MINI_PAGE_NAV_EXTRA_BOTTOM}px` }),
    [navMetrics.menuBottom],
  );

  useLoad((options) => {
    setProviderId(Number(options.providerId || 0));
    setProviderType(normalizeProviderType(options.providerType));
    setProviderName(decodeText(options.providerName) || '服务商');
  });

  const fetchData = async () => {
    if (!providerId) {
      setLoading(false);
      setLoadError('缺少服务商参数，请返回上一页后重试。');
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      const [reviewRes, statsRes] = await Promise.all([
        getProviderReviews(providerType, providerId, 1, 20),
        getReviewStats(providerType, providerId).catch(() => null),
      ]);
      setList(reviewRes.list || []);
      setStats((statsRes as ExtendedReviewStats | null) || null);
    } catch (error) {
      setList([]);
      setStats(null);
      setLoadError('评价内容加载失败，请检查网络后重试。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, [providerId, providerType]); // eslint-disable-line react-hooks/exhaustive-deps

  const sortedList = useMemo(() => {
    return [...list].sort((left, right) => {
      const leftTime = getServerTimeMs(left.createdAt);
      const rightTime = getServerTimeMs(right.createdAt);
      return rightTime - leftTime;
    });
  }, [list]);

  const averageRating = useMemo(() => {
    const apiRating = Number(stats?.avgRating ?? stats?.rating ?? 0);
    if (apiRating > 0) return apiRating;
    if (sortedList.length === 0) return 0;

    const total = sortedList.reduce((sum, item) => sum + Number(item.rating || 0), 0);
    return total / sortedList.length;
  }, [sortedList, stats?.avgRating, stats?.rating]);

  const totalCount = useMemo(() => {
    return Number(stats?.total ?? stats?.totalCount ?? sortedList.length ?? 0);
  }, [sortedList.length, stats?.total, stats?.totalCount]);

  const dynamicTagEntries = useMemo(() => {
    if (stats?.tags && Object.keys(stats.tags).length > 0) {
      return Object.entries(stats.tags)
        .filter(([, count]) => Number(count) > 0)
        .slice(0, 6)
        .map(([label]) => ({ id: label, label }));
    }

    const countMap = new Map<string, number>();
    sortedList.forEach((item) => {
      parseTags(item.tags).forEach((tag) => {
        countMap.set(tag, (countMap.get(tag) || 0) + 1);
      });
    });

    return Array.from(countMap.entries())
      .sort((left, right) => right[1] - left[1])
      .slice(0, 6)
      .map(([label]) => ({ id: label, label }));
  }, [sortedList, stats?.tags]);

  const filterOptions = useMemo(() => {
    return [
      { id: 'all', label: '全部' },
      { id: 'with-image', label: '有图' },
      { id: 'high-score', label: '好评' },
      ...dynamicTagEntries,
    ];
  }, [dynamicTagEntries]);

  const starDistribution = useMemo(() => {
    if (stats?.starDistribution && Object.keys(stats.starDistribution).length > 0) {
      return {
        1: Number(stats.starDistribution['1'] || 0),
        2: Number(stats.starDistribution['2'] || 0),
        3: Number(stats.starDistribution['3'] || 0),
        4: Number(stats.starDistribution['4'] || 0),
        5: Number(stats.starDistribution['5'] || 0),
      };
    }

    return buildStarDistribution(sortedList);
  }, [sortedList, stats?.starDistribution]);

  const filteredList = useMemo(() => {
    if (activeFilter === 'all') return sortedList;
    if (activeFilter === 'with-image') {
      return sortedList.filter((item) => parseImages(item.images).length > 0);
    }
    if (activeFilter === 'high-score') {
      return sortedList.filter((item) => Number(item.rating || 0) >= 4);
    }

    return sortedList.filter((item) => parseTags(item.tags).includes(activeFilter));
  }, [activeFilter, sortedList]);

  const sentiment = useMemo(() => {
    if (averageRating >= 4.8) return '超赞口碑';
    if (averageRating >= 4.5) return '非常满意';
    if (averageRating >= 4.0) return '值得推荐';
    if (averageRating > 0) return '整体不错';
    return providerName || '用户评价';
  }, [averageRating, providerName]);
  const slowLoadingVisible = useSlowLoadingHint(loading);

  const handleBack = () => {
    if (Taro.getCurrentPages().length > 1) {
      Taro.navigateBack();
      return;
    }

    Taro.switchTab({ url: '/pages/home/index' });
  };

  const pageHeader = <MiniPageNav title="用户评价" onBack={handleBack} placeholder />;

  if (loading) {
    return (
      <View className="reviews-page">
        {pageHeader}
        <View className="reviews-page__content">
          <Skeleton className="reviews-page__loading-overview" />
          <View className="reviews-page__loading-filters">
            {[0, 1, 2].map((item) => (
              <Skeleton key={item} className="reviews-page__loading-pill" />
            ))}
          </View>
          {[0, 1, 2].map((item) => (
            <Skeleton key={item} className="reviews-page__loading-card" />
          ))}
          {slowLoadingVisible ? (
            <PageStateCard
              variant="loading"
              title="正在加载评价内容"
              description="网络较慢时会多等待一点，评价列表正在继续加载。"
              className="reviews-page__state-card"
            />
          ) : null}
        </View>
      </View>
    );
  }

  if (loadError) {
    return (
      <View className="reviews-page reviews-page__empty">
        {pageHeader}
        <View className="reviews-page__content">
          <PageStateCard
            variant="error"
            title="评价页加载失败"
            description={loadError}
            className="reviews-page__state-card"
            action={providerId ? { text: '重新加载', onClick: () => void fetchData() } : { text: '返回上一页', onClick: handleBack }}
          />
        </View>
      </View>
    );
  }

  if (!providerId || sortedList.length === 0) {
    return (
      <View className="reviews-page reviews-page__empty">
        {pageHeader}
        <View className="reviews-page__content">
          <Empty description="暂无评价内容" />
        </View>
      </View>
    );
  }

  return (
    <View className="reviews-page">
      {pageHeader}
      <View className="reviews-page__content">
        <View className="reviews-page__overview-card">
          <View className="reviews-page__overview-left">
            <Text className="reviews-page__overview-kicker">{sentiment}</Text>
            <Text className="reviews-page__overview-score">{averageRating > 0 ? averageRating.toFixed(1) : '0.0'}</Text>
            <View className="reviews-page__overview-stars">
              {[1, 2, 3, 4, 5].map((star) => (
                <Icon
                  key={star}
                  name="star"
                  size={20}
                  color={star <= Math.round(averageRating) ? '#F59E0B' : '#E5E7EB'}
                />
              ))}
            </View>
            <Text className="reviews-page__overview-total">{totalCount} 条真实评价</Text>
          </View>

          <View className="reviews-page__overview-right">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = starDistribution[star as keyof typeof starDistribution] || 0;
              const widthPercent = totalCount > 0 ? Math.max((count / totalCount) * 100, count > 0 ? 10 : 0) : 0;

              return (
                <View key={star} className="reviews-page__distribution-row">
                  <Text className="reviews-page__distribution-label">{star}</Text>
                  <View className="reviews-page__distribution-track">
                    <View className="reviews-page__distribution-fill" style={{ width: `${widthPercent}%` }} />
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        <ScrollView scrollX className="reviews-page__filters" style={filterBarStyle} showScrollbar={false}>
          <View className="reviews-page__filters-row">
            {filterOptions.map((item) => {
              const active = activeFilter === item.id;
              return (
                <View
                  key={item.id}
                  className={`reviews-page__filter-pill ${active ? 'reviews-page__filter-pill--active' : ''}`}
                  onClick={() => setActiveFilter(item.id)}
                >
                  <Text className={`reviews-page__filter-text ${active ? 'reviews-page__filter-text--active' : ''}`}>
                    {item.label}
                  </Text>
                  {active ? <View className="reviews-page__filter-dot" /> : null}
                </View>
              );
            })}
          </View>
        </ScrollView>

        {filteredList.length === 0 ? (
          <View className="reviews-page__filter-empty">
            <Empty description="当前筛选下暂无评价" />
          </View>
        ) : (
          filteredList.map((item) => {
            const images = parseImages(item.images).slice(0, 3);
            const tags = [
              ...parseTags(item.tags),
              item.serviceType || '',
              item.area ? `${item.area}` : '',
              item.style || '',
            ].filter(Boolean).slice(0, 4);

            return (
              <View key={item.id} className="reviews-page__review-card">
                <View className="reviews-page__review-head">
                  {item.userAvatar ? (
                    <Image className="reviews-page__review-avatar" src={item.userAvatar} mode="aspectFill" lazyLoad />
                  ) : (
                    <View className="reviews-page__review-avatar reviews-page__review-avatar--placeholder" />
                  )}

                  <View className="reviews-page__review-info">
                    <Text className="reviews-page__review-name">{item.userName || '匿名业主'}</Text>
                    <Text className="reviews-page__review-date">{formatServerDate(item.createdAt, '近期评价')}</Text>
                  </View>

                  <View className="reviews-page__review-rating">
                    <Icon name="star" size={18} color="#F59E0B" />
                    <Text className="reviews-page__review-rating-text">
                      {Number(item.rating || 0).toFixed(1).replace(/\.0$/, '')}
                    </Text>
                  </View>
                </View>

                <Text className="reviews-page__review-content">{item.content || '暂无评价内容'}</Text>

                {tags.length > 0 ? (
                  <View className="reviews-page__review-tags">
                    {tags.map((tag) => (
                      <Text key={tag} className="reviews-page__review-tag">{tag}</Text>
                    ))}
                  </View>
                ) : null}

                {images.length > 0 ? (
                  <View className={`reviews-page__review-images ${images.length === 1 ? 'reviews-page__review-images--single' : ''}`}>
                    {images.map((image) => (
                      <Image
                        key={image}
                        className={`reviews-page__review-image ${images.length === 1 ? 'reviews-page__review-image--single' : ''}`}
                        src={image}
                        mode="aspectFill"
                        lazyLoad
                        onClick={() => Taro.previewImage({ current: image, urls: images })}
                      />
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </View>
    </View>
  );
};

export default ReviewsPage;
