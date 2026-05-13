import Taro, { useLoad, usePageScroll, useShareAppMessage } from '@tarojs/taro';
import { Image, Text, View } from '@tarojs/components';
import { useEffect, useMemo, useState } from 'react';

import { Empty } from '@/components/Empty';
import MiniPageNav from '@/components/MiniPageNav';
import { Skeleton } from '@/components/Skeleton';
import type { InspirationDetailDTO } from '@/services/dto';
import { inspirationService } from '@/services/inspiration';
import { useAuthStore } from '@/store/auth';
import { showErrorToast } from '@/utils/error';
import { getInspirationCoverImage, getInspirationGalleryImages } from '@/utils/inspirationImages';

import './index.scss';

const INSPIRATION_CASE_SYNC_KEY = 'inspiration_case_sync';
const NAV_SCROLL_DISTANCE = 180;

interface InspirationCaseSyncPayload {
  id: number;
  isLiked?: boolean;
  likeCount?: number;
  isFavorited?: boolean;
}

const mergeSyncPayload = (payload: InspirationCaseSyncPayload) => {
  const exists = Taro.getStorageSync(INSPIRATION_CASE_SYNC_KEY) as Partial<InspirationCaseSyncPayload> | undefined;
  if (exists && typeof exists.id === 'number' && exists.id === payload.id) {
    Taro.setStorageSync(INSPIRATION_CASE_SYNC_KEY, { ...exists, ...payload });
    return;
  }

  Taro.setStorageSync(INSPIRATION_CASE_SYNC_KEY, payload);
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const formatAreaText = (value?: string) => {
  if (!value) return '暂无';
  return value.includes('㎡') ? value : `${value}㎡`;
};

const buildFooterActionClass = (base: string, active?: boolean, primary?: boolean) => {
  return [
    base,
    active ? `${base}--active` : '',
    primary ? `${base}--primary` : '',
  ].filter(Boolean).join(' ');
};

export default function InspirationDetailPage() {
  const auth = useAuthStore();
  const [id, setId] = useState<number>(0);
  const [detail, setDetail] = useState<InspirationDetailDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [navProgress, setNavProgress] = useState(0);

  useLoad((options) => {
    if (options.id) {
      setId(Number(options.id));
    }
  });

  usePageScroll(({ scrollTop }) => {
    const next = clamp(scrollTop / NAV_SCROLL_DISTANCE, 0, 1);
    setNavProgress((prev) => (Math.abs(prev - next) < 0.01 ? prev : next));
  });

  const previewImages = useMemo(() => {
    if (!detail) return [];
    return getInspirationGalleryImages(detail);
  }, [detail]);

  const coverImage = useMemo(() => {
    if (!detail) return '';
    return getInspirationCoverImage(detail);
  }, [detail]);

  const handlePreviewImage = (current: string) => {
    if (!current || previewImages.length === 0) return;

    Taro.previewImage({
      current,
      urls: previewImages,
    });
  };

  const fetchDetail = async (): Promise<InspirationDetailDTO | null> => {
    if (!id) return null;

    setLoading(true);
    try {
      const detailRes = await inspirationService.detail(id);
      setDetail(detailRes);
      return detailRes;
    } catch (error) {
      showErrorToast(error, '加载失败');
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!id) return;

    void fetchDetail();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const ensureAuth = () => {
    if (auth.token) return true;
    Taro.switchTab({ url: '/pages/profile/index' });
    return false;
  };

  const handleBack = () => {
    if (Taro.getCurrentPages().length > 1) {
      Taro.navigateBack();
      return;
    }
    Taro.switchTab({ url: '/pages/inspiration/index' });
  };

  useShareAppMessage(() => ({
    title: detail?.title || '灵感详情',
    path: `/pages/inspiration/detail/index?id=${id}`,
    imageUrl: coverImage || undefined,
  }));

  const handleLike = async () => {
    if (!detail || !ensureAuth() || submitting) return;

    setSubmitting(true);
    const originLiked = detail.isLiked;
    const originCount = detail.likeCount;
    const nextLiked = !originLiked;
    const nextLikeCount = originLiked ? Math.max(0, originCount - 1) : originCount + 1;

    setDetail({
      ...detail,
      isLiked: nextLiked,
      likeCount: nextLikeCount,
    });

    try {
      if (originLiked) {
        await inspirationService.unlike(detail.id);
      } else {
        await inspirationService.like(detail.id);
      }

      mergeSyncPayload({
        id: detail.id,
        isLiked: nextLiked,
        likeCount: nextLikeCount,
        isFavorited: detail.isFavorited,
      });
    } catch (error) {
      setDetail({ ...detail, isLiked: originLiked, likeCount: originCount });
      showErrorToast(error, '点赞失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFavorite = async () => {
    if (!detail || !ensureAuth() || submitting) return;

    setSubmitting(true);
    const originFavorited = detail.isFavorited;
    const nextFavorited = !originFavorited;
    setDetail({ ...detail, isFavorited: nextFavorited });

    try {
      if (originFavorited) {
        await inspirationService.unfavorite(detail.id);
      } else {
        await inspirationService.favorite(detail.id);
      }

      mergeSyncPayload({
        id: detail.id,
        isFavorited: nextFavorited,
        isLiked: detail.isLiked,
        likeCount: detail.likeCount,
      });
    } catch (error) {
      setDetail({ ...detail, isFavorited: originFavorited });
      showErrorToast(error, '收藏失败');
    } finally {
      setSubmitting(false);
    }
  };

  const solidNav = <MiniPageNav title="灵感详情" onBack={handleBack} placeholder />;

  if (loading) {
    return (
      <View className="inspiration-detail-page inspiration-detail-page--loading">
        {solidNav}
        <Skeleton height={560} />
        <Skeleton height={240} className="inspiration-detail-page__loading-card inspiration-detail-page__loading-card--hero" />
        <Skeleton height={140} className="inspiration-detail-page__loading-card" />
        <Skeleton height={240} className="inspiration-detail-page__loading-card" />
      </View>
    );
  }

  if (!detail) {
    return (
      <View className="inspiration-detail-page inspiration-detail-page--empty">
        {solidNav}
        <Empty description="未找到灵感内容" action={{ text: '返回灵感页', onClick: handleBack }} />
      </View>
    );
  }

  const fixedNav = <MiniPageNav title={detail.title || '灵感详情'} onBack={handleBack} variant="overlay" progress={navProgress} />;
  const summaryItems = [
    { label: '户型', value: detail.layout || '暂无' },
    { label: '面积', value: formatAreaText(detail.area) },
    { label: '风格', value: detail.style || '暂无' },
  ];

  return (
    <View className="page-inspiration-detail inspiration-detail-page">
      {fixedNav}

      <View className="inspiration-detail-page__hero">
        {coverImage ? (
          <Image
            src={coverImage}
            mode="aspectFill"
            className="inspiration-detail-page__hero-image"
            onClick={() => handlePreviewImage(coverImage)}
          />
        ) : (
          <View className="inspiration-detail-page__hero-placeholder" />
        )}
        <View className="inspiration-detail-page__hero-mask" />
      </View>

      <View className="inspiration-detail-page__content">
        <View className="inspiration-detail-page__summary-card">
          <Text className="inspiration-detail-page__summary-kicker">灵感案例</Text>
          <Text className="inspiration-detail-page__title">{detail.title}</Text>

          <View className="inspiration-detail-page__price-row">
            <Text className="inspiration-detail-page__price-label">预算参考</Text>
            <Text className="inspiration-detail-page__price-value">¥{Number(detail.price || 0).toLocaleString()}</Text>
          </View>

          <View className="inspiration-detail-page__summary-divider" />

          <View className="inspiration-detail-page__summary-grid">
            {summaryItems.map((item, index) => (
              <View key={item.label} className="inspiration-detail-page__summary-grid-item">
                {index > 0 ? <View className="inspiration-detail-page__summary-grid-divider" /> : null}
                <Text className="inspiration-detail-page__summary-grid-label">{item.label}</Text>
                <Text className="inspiration-detail-page__summary-grid-value" numberOfLines={1}>{item.value}</Text>
              </View>
            ))}
          </View>
        </View>

        {detail.author?.name ? (
          <View className="inspiration-detail-page__module-card inspiration-detail-page__author-card">
            {detail.author.avatar ? (
              <Image className="inspiration-detail-page__author-avatar" src={detail.author.avatar} mode="aspectFill" lazyLoad />
            ) : (
              <View className="inspiration-detail-page__author-avatar inspiration-detail-page__author-avatar--placeholder" />
            )}
            <View className="inspiration-detail-page__author-main">
              <Text className="inspiration-detail-page__author-name">{detail.author.name}</Text>
              <Text className="inspiration-detail-page__author-subtitle">案例作者 · 灵感分享</Text>
            </View>
            <View className="inspiration-detail-page__author-badge">
              <Text className="inspiration-detail-page__author-badge-text">作者</Text>
            </View>
          </View>
        ) : null}

        {detail.description ? (
          <View className="inspiration-detail-page__module-card">
            <View className="inspiration-detail-page__section-head">
              <Text className="inspiration-detail-page__section-title">设计说明</Text>
              <Text className="inspiration-detail-page__section-caption">空间细节与思路</Text>
            </View>
            <Text className="inspiration-detail-page__description">{detail.description}</Text>
          </View>
        ) : null}

        {detail.images.length > 0 ? (
          <View className="inspiration-detail-page__module-card">
            <View className="inspiration-detail-page__section-head">
              <Text className="inspiration-detail-page__section-title">空间画廊</Text>
              <Text className="inspiration-detail-page__section-caption">{detail.images.length} 张图片</Text>
            </View>
            <View className="inspiration-detail-page__gallery">
              {detail.images.map((image, index) => (
                <View key={`${image}-${index}`} className="inspiration-detail-page__gallery-item">
                  <Text className="inspiration-detail-page__gallery-index">{String(index + 1).padStart(2, '0')}</Text>
                  <Image
                    src={image}
                    mode="aspectFill"
                    className="inspiration-detail-page__gallery-image"
                    onClick={() => handlePreviewImage(image)}
                  />
                </View>
              ))}
            </View>
          </View>
        ) : null}

      </View>

      <View className="inspiration-detail-page__footer">
        <View
          className={buildFooterActionClass('inspiration-detail-page__footer-action', detail.isLiked)}
          onClick={handleLike}
        >
          <Text className={buildFooterActionClass('inspiration-detail-page__footer-action-text', detail.isLiked)}>
            点赞 {detail.likeCount || 0}
          </Text>
        </View>
        <View
          className={buildFooterActionClass('inspiration-detail-page__footer-action', detail.isFavorited)}
          onClick={handleFavorite}
        >
          <Text className={buildFooterActionClass('inspiration-detail-page__footer-action-text', detail.isFavorited)}>
            {detail.isFavorited ? '已收藏' : '收藏'}
          </Text>
        </View>
      </View>
    </View>
  );
}
