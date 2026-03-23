import React, { useEffect, useMemo, useState } from 'react';
import { Button as TaroButton, Image, Text, View } from '@tarojs/components';
import Taro, { useLoad, useShareAppMessage } from '@tarojs/taro';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Empty } from '@/components/Empty';
import { Icon } from '@/components/Icon';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import type { InspirationDetailDTO } from '@/services/dto';
import type { CaseQuote } from '@/services/inspiration';
import { inspirationService } from '@/services/inspiration';
import { showErrorToast } from '@/utils/error';
import { getInspirationCoverImage, getInspirationGalleryImages } from '@/utils/inspirationImages';

import './index.scss';

const decodeText = (value?: string) => {
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const CaseDetailPage: React.FC = () => {
  const [caseId, setCaseId] = useState(0);
  const [providerId, setProviderId] = useState(0);
  const [providerType, setProviderType] = useState('designer');
  const [providerName, setProviderName] = useState('');
  const [detail, setDetail] = useState<InspirationDetailDTO | null>(null);
  const [quote, setQuote] = useState<CaseQuote | null>(null);
  const [loading, setLoading] = useState(true);

  useLoad((options) => {
    setCaseId(Number(options.caseId || 0));
    setProviderId(Number(options.providerId || 0));
    setProviderType(options.providerType || 'designer');
    setProviderName(decodeText(options.providerName) || '');
  });

  const fetchDetail = async () => {
    if (!caseId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const detailRes = await inspirationService.detail(caseId);
      setDetail(detailRes);
      try {
        const quoteRes = await inspirationService.getQuote(caseId);
        setQuote(quoteRes);
      } catch {
        setQuote(null);
      }
    } catch (error) {
      setDetail(null);
      showErrorToast(error, '加载案例失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!caseId) return;
    void fetchDetail();
  }, [caseId]); // eslint-disable-line react-hooks/exhaustive-deps

  const coverImage = useMemo(() => {
    if (!detail) return '';
    return getInspirationCoverImage(detail);
  }, [detail]);

  const galleryImages = useMemo(() => {
    if (!detail) return [];
    return getInspirationGalleryImages(detail);
  }, [detail]);

  const previewImage = (current?: string) => {
    if (!current || galleryImages.length === 0) return;
    Taro.previewImage({ current, urls: galleryImages });
  };

  useShareAppMessage(() => ({
    title: detail?.title || '案例详情',
    path: `/pages/cases/detail/index?caseId=${caseId}&providerId=${providerId}&providerType=${providerType}&providerName=${encodeURIComponent(providerName)}`,
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
      url: `/pages/booking/create/index?providerId=${providerId}&type=${providerType}&providerName=${encodeURIComponent(providerName || detail?.author?.name || '服务商')}`,
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
        <Empty description="未找到案例详情" action={{ text: '返回上一页', onClick: back }} />
      </View>
    );
  }

  const displayName = providerName || detail.author?.name || '服务商';
  const detailTags = [detail.style, detail.layout, detail.area ? `${detail.area}` : ''].filter(Boolean);

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
            <Text className="case-detail-page__title">{detail.title || '案例详情'}</Text>
            <View className="case-detail-page__meta">
              {detailTags.map((item) => (
                <Tag key={item} variant="secondary">{item}</Tag>
              ))}
            </View>
            <Text className="case-detail-page__price">参考预算：¥{Number(detail.price || 0).toLocaleString()}</Text>
          </View>
        </Card>

        <Card className="case-detail-page__card">
          <View className="case-detail-page__section">
            <Text className="case-detail-page__section-title">关联服务商</Text>
            <View className="case-detail-page__author">
              {detail.author?.avatar ? (
                <Image className="case-detail-page__author-avatar" src={detail.author.avatar} mode="aspectFill" lazyLoad />
              ) : (
                <View className="case-detail-page__author-avatar-placeholder" />
              )}
              <View className="case-detail-page__author-main">
                <Text className="case-detail-page__author-name">{displayName}</Text>
                <Text className="case-detail-page__author-subtitle">
                  {providerId ? '查看服务商详情或直接预约' : '案例作者信息'}
                </Text>
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

        {quote?.items?.length ? (
          <Card className="case-detail-page__card">
            <View className="case-detail-page__section">
              <Text className="case-detail-page__section-title">报价参考</Text>
              {quote.items.map((item) => (
                <View key={`${item.name}-${item.unit}`} className="case-detail-page__quote-item">
                  <View>
                    <Text className="case-detail-page__quote-name">{item.name}</Text>
                    <Text className="case-detail-page__quote-desc">
                      {item.quantity}{item.unit} × ¥{item.unitPrice.toLocaleString()}
                    </Text>
                  </View>
                  <Text className="case-detail-page__quote-value">¥{item.totalPrice.toLocaleString()}</Text>
                </View>
              ))}
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

export default CaseDetailPage;
