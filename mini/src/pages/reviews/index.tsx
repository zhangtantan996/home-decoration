import React, { useEffect, useMemo, useState } from 'react';
import { Image, Text, View } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';

import { Empty } from '@/components/Empty';
import { Icon } from '@/components/Icon';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import { getProviderReviews, getReviewStats, type ProviderReviewItem, type ProviderType, type ReviewStats } from '@/services/providers';
import { showErrorToast } from '@/utils/error';
import { formatServerDate, getServerTimeMs } from '@/utils/serverTime';

import './index.scss';

type FilterKey = 'all' | 'with-image' | 'high-score';

const FILTER_OPTIONS: Array<{ id: FilterKey; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'with-image', label: '有图' },
  { id: 'high-score', label: '高分' },
];

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
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const parseTags = (value?: string) => {
  if (!value) return [];
  return value
    .split(/[、，,|/]/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const ReviewsPage: React.FC = () => {
  const [providerId, setProviderId] = useState(0);
  const [providerType, setProviderType] = useState<ProviderType>('designer');
  const [providerName, setProviderName] = useState('');
  const [list, setList] = useState<ProviderReviewItem[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');

  useLoad((options) => {
    setProviderId(Number(options.providerId || 0));
    setProviderType(normalizeProviderType(options.providerType));
    setProviderName(decodeText(options.providerName) || '服务商');
  });

  useEffect(() => {
    if (!providerId) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        const [reviewRes, statsRes] = await Promise.all([
          getProviderReviews(providerType, providerId, 1, 50),
          getReviewStats(providerType, providerId).catch(() => null),
        ]);
        setList(reviewRes.list || []);
        setStats(statsRes);
      } catch (error) {
        setList([]);
        showErrorToast(error, '加载评价失败');
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, [providerId, providerType]);

  const filteredList = useMemo(() => {
    const base = [...list].sort((left, right) => {
      const leftTime = getServerTimeMs(left.createdAt);
      const rightTime = getServerTimeMs(right.createdAt);
      return rightTime - leftTime;
    });

    if (activeFilter === 'with-image') {
      return base.filter((item) => parseImages(item.images).length > 0);
    }

    if (activeFilter === 'high-score') {
      return base.filter((item) => Number(item.rating || 0) >= 4);
    }

    return base;
  }, [list, activeFilter]);

  if (loading) {
    return (
      <View className="reviews-page">
        {[0, 1, 2].map((item) => (
          <Skeleton key={item} className="reviews-page__loading-card" />
        ))}
      </View>
    );
  }

  if (!providerId || filteredList.length === 0) {
    return (
      <View className="reviews-page reviews-page__empty">
        <Empty description="暂无评价内容" />
      </View>
    );
  }

  return (
    <View className="reviews-page">
      <View className="reviews-page__hero">
        <Text className="reviews-page__title">{providerName}</Text>
        <Text className="reviews-page__subtitle">真实业主口碑与交付反馈</Text>
        <View className="reviews-page__stats">
          <View className="reviews-page__stat">
            <Text className="reviews-page__stat-value">{Number(stats?.rating || 0).toFixed(1)}</Text>
            <Text className="reviews-page__stat-label">综合评分</Text>
          </View>
          <View className="reviews-page__stat">
            <Text className="reviews-page__stat-value">{stats?.restoreRate || 0}%</Text>
            <Text className="reviews-page__stat-label">还原度</Text>
          </View>
          <View className="reviews-page__stat">
            <Text className="reviews-page__stat-value">{stats?.totalCount || list.length}</Text>
            <Text className="reviews-page__stat-label">评价总数</Text>
          </View>
        </View>
      </View>

      <View className="reviews-page__filters">
        {FILTER_OPTIONS.map((item) => (
          <Tag key={item.id} variant={activeFilter === item.id ? 'primary' : 'secondary'} onClick={() => setActiveFilter(item.id)}>
            {item.label}
          </Tag>
        ))}
      </View>

      {filteredList.map((item) => {
        const images = parseImages(item.images).slice(0, 3);
        const tags = [
          ...parseTags(item.tags),
          item.serviceType || '',
          item.area ? `${item.area}` : '',
          item.style || '',
        ].filter(Boolean).slice(0, 4);

        return (
          <View key={item.id} className="reviews-page__review-card">
            <View className="reviews-page__review-main">
              <View className="reviews-page__review-head">
                {item.userAvatar ? (
                  <Image className="reviews-page__review-avatar" src={item.userAvatar} mode="aspectFill" lazyLoad />
                ) : (
                  <View className="reviews-page__review-avatar-placeholder" />
                )}
                  <View style={{ flex: 1 }}>
                    <Text className="reviews-page__review-name">{item.userName || '匿名业主'}</Text>
                    <Text className="reviews-page__review-date">
                    {formatServerDate(item.createdAt, '近期评价')}
                    </Text>
                  </View>
                <View className="reviews-page__review-rating">
                  <Icon name="star" size={18} color="#f59e0b" />
                  <Text>{Number(item.rating || 0).toFixed(1).replace(/\.0$/, '')}</Text>
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
                <View className="reviews-page__review-images">
                  {images.map((image) => (
                    <Image
                      key={image}
                      className="reviews-page__review-image"
                      src={image}
                      mode="aspectFill"
                      lazyLoad
                      onClick={() => Taro.previewImage({ current: image, urls: images })}
                    />
                  ))}
                </View>
              ) : null}

              <View className="reviews-page__review-foot">
                <Text>来自真实业主评价</Text>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
};

export default ReviewsPage;
