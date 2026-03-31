import React, { useEffect, useMemo, useState } from 'react';
import { Button as TaroButton, Image, Text, View } from '@tarojs/components';
import Taro, { useLoad, useShareAppMessage } from '@tarojs/taro';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Empty } from '@/components/Empty';
import { Icon } from '@/components/Icon';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import { getProviderSceneDetail, type ProviderSceneDetail } from '@/services/providers';
import { showErrorToast } from '@/utils/error';
import { normalizeProviderMediaUrl, parseStringListValue } from '@/utils/providerMedia';

import './index.scss';

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
  return Array.from(
    new Set(
      [normalizeProviderMediaUrl(detail.coverImage), ...parseStringListValue(detail.images).map((item) => normalizeProviderMediaUrl(item))]
        .filter(Boolean)
    )
  );
};

const SceneDetailPage: React.FC = () => {
  const [sceneId, setSceneId] = useState(0);
  const [providerId, setProviderId] = useState(0);
  const [providerType, setProviderType] = useState('foreman');
  const [providerName, setProviderName] = useState('');
  const [detail, setDetail] = useState<ProviderSceneDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useLoad((options) => {
    setSceneId(Number(options.sceneId || 0));
    setProviderId(Number(options.providerId || 0));
    setProviderType(options.providerType || 'foreman');
    setProviderName(decodeText(options.providerName) || '');
  });

  const fetchDetail = async () => {
    if (!sceneId) {
      setLoading(false);
      setLoadError('缺少案例实景参数');
      return;
    }

    setLoading(true);
    setLoadError('');
    try {
      const detailRes = await getProviderSceneDetail(sceneId);
      setDetail(detailRes);
    } catch (error) {
      setDetail(null);
      setLoadError('案例实景加载失败，请稍后重试');
      showErrorToast(error, '加载案例实景失败');
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

  const previewImage = (current?: string) => {
    if (!current || galleryImages.length === 0) return;
    Taro.previewImage({ current, urls: galleryImages });
  };

  useShareAppMessage(() => ({
    title: detail?.title || '案例实景',
    path: `/pages/cases/scene-detail/index?sceneId=${sceneId}&providerId=${providerId}&providerType=${providerType}&providerName=${encodeURIComponent(providerName)}`,
    imageUrl: coverImage || undefined,
  }));

  const back = () => {
    if (Taro.getCurrentPages().length > 1) {
      Taro.navigateBack();
      return;
    }
    Taro.switchTab({ url: '/pages/home/index' });
  };

  const openProvider = () => {
    if (!providerId) return;
    Taro.navigateTo({
      url: `/pages/providers/detail/index?id=${providerId}&type=${providerType}`,
    });
  };

  const openBooking = () => {
    if (!providerId) return;
    Taro.navigateTo({
      url: `/pages/booking/create/index?providerId=${providerId}&type=${providerType}&providerName=${encodeURIComponent(providerName || '服务商')}`,
    });
  };

  if (loading) {
    return (
      <View className="case-detail-page case-detail-page--loading">
        <Skeleton height={520} />
        <Skeleton height={180} className="mt-md" />
        <Skeleton height={280} className="mt-md" />
      </View>
    );
  }

  if (!detail) {
    return (
      <View className="case-detail-page case-detail-page--empty">
        <Empty
          description={loadError || '未找到案例实景'}
          action={{ text: loadError ? '重新加载' : '返回上一页', onClick: loadError ? () => void fetchDetail() : back }}
        />
      </View>
    );
  }

  const detailTags = [detail.year ? `${detail.year}` : '', detail.createdAt || ''].filter(Boolean);

  return (
    <View className="case-detail-page">
      <View className="case-detail-page__hero">
        {coverImage ? (
          <Image className="case-detail-page__hero-image" src={coverImage} mode="aspectFill" lazyLoad onClick={() => previewImage(coverImage)} />
        ) : (
          <View className="case-detail-page__hero-placeholder" />
        )}
        <View className="case-detail-page__hero-mask" />
        <View className="case-detail-page__nav" style={{ paddingTop: `${(Taro.getSystemInfoSync().statusBarHeight || 24) + 12}px` }}>
          <View className="case-detail-page__nav-button" onClick={back}>
            <Icon name="arrow-left" size={26} color="#ffffff" />
          </View>
          <TaroButton className="case-detail-page__nav-button" openType="share">
            <Icon name="share" size={24} color="#ffffff" />
          </TaroButton>
        </View>
      </View>

      <View className="case-detail-page__content">
        <Card className="case-detail-page__card">
          <View className="case-detail-page__section">
            <Text className="case-detail-page__title">{detail.title || '案例实景'}</Text>
            <View className="case-detail-page__meta">
              {detailTags.map((item) => (
                <Tag key={item} variant="secondary">{item}</Tag>
              ))}
            </View>
            <Text className="case-detail-page__price">真实项目案例</Text>
          </View>
        </Card>

        <Card className="case-detail-page__card">
          <View className="case-detail-page__section">
            <Text className="case-detail-page__section-title">关联服务商</Text>
            <View className="case-detail-page__author">
              <View className="case-detail-page__author-avatar-placeholder" />
              <View className="case-detail-page__author-main">
                <Text className="case-detail-page__author-name">{providerName || '服务商'}</Text>
                <Text className="case-detail-page__author-subtitle">查看服务商详情或直接预约</Text>
              </View>
            </View>
          </View>
        </Card>

        <Card className="case-detail-page__card">
          <View className="case-detail-page__section">
            <Text className="case-detail-page__section-title">案例说明</Text>
            <Text className="case-detail-page__description">{detail.description || '暂无案例说明'}</Text>
          </View>
        </Card>

        {galleryImages.length > 0 ? (
          <Card className="case-detail-page__card">
            <View className="case-detail-page__section">
              <Text className="case-detail-page__section-title">空间画廊</Text>
              <View className="case-detail-page__gallery">
                {galleryImages.map((image, index) => (
                  <Image
                    key={`${image}-${index}`}
                    className="case-detail-page__gallery-image"
                    src={image}
                    mode="aspectFill"
                    lazyLoad
                    onClick={() => previewImage(image)}
                  />
                ))}
              </View>
            </View>
          </Card>
        ) : null}
      </View>

      {providerId ? (
        <View className="case-detail-page__footer">
          <Button variant="outline" className="case-detail-page__footer-button" onClick={openProvider}>
            查看服务商
          </Button>
          <Button className="case-detail-page__footer-button" onClick={openBooking}>
            立即预约
          </Button>
        </View>
      ) : null}
    </View>
  );
};

export default SceneDetailPage;
