import React, { useEffect, useMemo, useState } from 'react';
import { Image, Text, View } from '@tarojs/components';
import Taro, { useLoad, usePageScroll, useShareAppMessage } from '@tarojs/taro';

import { Empty } from '@/components/Empty';
import MiniPageNav from '@/components/MiniPageNav';
import PageStateCard from '@/components/PageStateCard';
import { Skeleton } from '@/components/Skeleton';
import { getProviderSceneDetail, type ProviderSceneDetail } from '@/services/providers';
import useSlowLoadingHint from '@/hooks/useSlowLoadingHint';
import { normalizeProviderMediaUrl, parseStringListValue } from '@/utils/providerMedia';

import './index.scss';

const NAV_SCROLL_DISTANCE = 200;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const decodeText = (value?: string) => {
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const buildGalleryImages = (detail?: ProviderSceneDetail | null) => {
  if (!detail) return [];
  const images = [
    normalizeProviderMediaUrl(detail.coverImage),
    ...parseStringListValue(detail.images).map((item) => normalizeProviderMediaUrl(item)),
  ].filter(Boolean);
  return Array.from(new Set(images));
};

const SceneDetailPage: React.FC = () => {
  const [sceneId, setSceneId] = useState(0);
  const [providerId, setProviderId] = useState(0);
  const [providerType, setProviderType] = useState('foreman');
  const [providerName, setProviderName] = useState('');
  const [detail, setDetail] = useState<ProviderSceneDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [navProgress, setNavProgress] = useState(0);

  useLoad((options) => {
    setSceneId(Number(options.sceneId || 0));
    setProviderId(Number(options.providerId || 0));
    setProviderType(options.providerType || 'foreman');
    setProviderName(decodeText(options.providerName) || '');
  });

  usePageScroll(({ scrollTop }) => {
    const next = clamp(scrollTop / NAV_SCROLL_DISTANCE, 0, 1);
    setNavProgress((prev) => (Math.abs(prev - next) < 0.01 ? prev : next));
  });

  const fetchDetail = async () => {
    if (!sceneId) {
      setLoading(false);
      setLoadError('缺少案例实景参数，请返回上一页后重试。');
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      const detailRes = await getProviderSceneDetail(sceneId);
      setDetail(detailRes);
    } catch {
      setDetail(null);
      setLoadError('案例实景加载失败，请检查网络后重试。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!sceneId) return;
    void fetchDetail();
  }, [sceneId]); // eslint-disable-line react-hooks/exhaustive-deps

  const galleryImages = useMemo(() => buildGalleryImages(detail), [detail]);
  const coverImage = galleryImages[0] || '';
  const detailTitle = detail?.title || '案例实景';
  const slowLoadingVisible = useSlowLoadingHint(loading);

  const infoItems = useMemo(
    () => [
      { label: '类型', value: '真实项目案例' },
      { label: '年份', value: detail?.year || '暂无' },
      { label: '时间', value: detail?.createdAt || '暂无' },
    ],
    [detail?.createdAt, detail?.year],
  );

  const previewImage = (current?: string) => {
    if (!current || galleryImages.length === 0) return;
    Taro.previewImage({ current, urls: galleryImages });
  };

  useShareAppMessage(() => ({
    title: detailTitle,
    path: `/pages/cases/scene-detail/index?sceneId=${sceneId}&providerId=${providerId}&providerType=${providerType}&providerName=${encodeURIComponent(providerName)}`,
    imageUrl: coverImage || undefined,
  }));

  const handleBack = () => {
    if (Taro.getCurrentPages().length > 1) {
      Taro.navigateBack();
      return;
    }
    Taro.switchTab({ url: '/pages/home/index' });
  };

  const fixedNav = <MiniPageNav title={detailTitle} onBack={handleBack} variant="overlay" progress={navProgress} />;

  if (loading) {
    return (
      <View className="case-detail-page case-detail-page--loading">
        {fixedNav}
        <Skeleton height={620} />
        <View className="case-detail-page__loading-block">
          <Skeleton height={210} />
        </View>
        <View className="case-detail-page__section">
          <Skeleton row={3} />
        </View>
        {slowLoadingVisible ? (
          <View className="case-detail-page__state-card-wrap">
            <PageStateCard
              variant="loading"
              title="正在加载案例实景"
              description="网络较慢时会多等待一点，页面内容正在继续加载。"
              className="case-detail-page__state-card"
            />
          </View>
        ) : null}
      </View>
    );
  }

  if (loadError) {
    return (
      <View className="case-detail-page case-detail-page--empty">
        {fixedNav}
        <View className="case-detail-page__state-card-wrap">
          <PageStateCard
            variant="error"
            title="案例实景加载失败"
            description={loadError}
            className="case-detail-page__state-card"
            action={sceneId ? { text: '重新加载', onClick: () => void fetchDetail() } : { text: '返回上一页', onClick: handleBack }}
          />
        </View>
      </View>
    );
  }

  if (!detail) {
    return (
      <View className="case-detail-page case-detail-page--empty">
        {fixedNav}
        <Empty description="未找到案例实景" action={{ text: '返回上一页', onClick: handleBack }} />
      </View>
    );
  }

  return (
    <View className="case-detail-page">
      {fixedNav}

      <View className="case-detail-page__hero">
        {coverImage ? (
          <Image className="case-detail-page__hero-image" src={coverImage} mode="aspectFill" lazyLoad onClick={() => previewImage(coverImage)} />
        ) : (
          <View className="case-detail-page__hero-placeholder" />
        )}
        <View className="case-detail-page__hero-mask" />
        <View className="case-detail-page__hero-copy">
          <Text className="case-detail-page__hero-title" numberOfLines={2}>{detailTitle}</Text>
        </View>
      </View>

      <View className="case-detail-page__content">
        <View className="case-detail-page__info-card">
          <View className="case-detail-page__info-row">
            {infoItems.map((item, index) => (
              <React.Fragment key={item.label}>
                {index > 0 ? <View className="case-detail-page__info-divider" /> : null}
                <View className="case-detail-page__info-item">
                  <Text className="case-detail-page__info-label">{item.label}</Text>
                  <Text className="case-detail-page__info-value" numberOfLines={1}>{item.value}</Text>
                </View>
              </React.Fragment>
            ))}
          </View>
        </View>

        <View className="case-detail-page__section">
          <Text className="case-detail-page__section-title">案例说明</Text>
          <Text className="case-detail-page__description">{detail.description || '暂无案例说明'}</Text>
        </View>

        {galleryImages.length > 0 ? (
          <View className="case-detail-page__section case-detail-page__section--gallery">
            <Text className="case-detail-page__section-title">案例图赏</Text>
            <View className="case-detail-page__gallery">
              {galleryImages.map((image, index) => (
                <View key={`${image}-${index}`} className="case-detail-page__gallery-item">
                  <Text className="case-detail-page__gallery-index">{String(index + 1).padStart(2, '0')}</Text>
                  <Image
                    className="case-detail-page__gallery-image"
                    src={image}
                    mode="widthFix"
                    lazyLoad
                    onClick={() => previewImage(image)}
                  />
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
};

export default SceneDetailPage;
