import { useEffect, useMemo, useState } from 'react';
import { Image, Text, View } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';

import { Empty } from '@/components/Empty';
import MiniPageNav from '@/components/MiniPageNav';
import PageStateCard from '@/components/PageStateCard';
import { Skeleton } from '@/components/Skeleton';
import useSlowLoadingHint from '@/hooks/useSlowLoadingHint';
import { getProviderDetail, type ProviderDetail } from '@/services/providers';
import { collectCompanyAlbumImages } from '@/utils/providerMedia';

import './index.scss';

const decodeText = (value?: string) => {
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const CompanyAlbumPage: React.FC = () => {
  const [providerId, setProviderId] = useState(0);
  const [providerName, setProviderName] = useState('装修公司');
  const [detail, setDetail] = useState<ProviderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useLoad((options) => {
    setProviderId(Number(options.providerId || 0));
    setProviderName(decodeText(options.providerName) || '装修公司');
  });

  const fetchDetail = async () => {
    if (!providerId) {
      setLoading(false);
      setLoadError('缺少公司参数，请返回上一页后重试。');
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      const data = await getProviderDetail('company', providerId);
      setDetail(data);
    } catch {
      setDetail(null);
      setLoadError('公司相册加载失败，请检查网络后重试。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!providerId) return;
    void fetchDetail();
  }, [providerId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBack = () => {
    if (Taro.getCurrentPages().length > 1) {
      Taro.navigateBack();
      return;
    }

    Taro.switchTab({ url: '/pages/home/index' });
  };

  const albumImages = useMemo(() => collectCompanyAlbumImages(detail), [detail]);
  const slowLoadingVisible = useSlowLoadingHint(loading);

  const previewImage = (current?: string) => {
    if (!current || albumImages.length === 0) return;
    Taro.previewImage({
      current,
      urls: albumImages,
    });
  };

  const header = <MiniPageNav title="公司相册" onBack={handleBack} placeholder />;

  if (loading) {
    return (
      <View className="company-album-page">
        {header}
        <View className="company-album-page__content">
          <Skeleton className="company-album-page__loading-summary" />
          <Skeleton className="company-album-page__loading-hero" />
          <View className="company-album-page__loading-grid">
            {[0, 1, 2, 3].map((item) => (
              <Skeleton key={item} className="company-album-page__loading-card" />
            ))}
          </View>
          {slowLoadingVisible ? (
            <PageStateCard
              variant="loading"
              title="正在加载公司相册"
              description="网络较慢时会多等待一点，图片资源正在继续加载。"
              className="company-album-page__state-card"
            />
          ) : null}
        </View>
      </View>
    );
  }

  if (loadError) {
    return (
      <View className="company-album-page">
        {header}
        <View className="company-album-page__content">
          <PageStateCard
            variant="error"
            title="公司相册加载失败"
            description={loadError}
            className="company-album-page__state-card"
            action={providerId ? { text: '重新加载', onClick: () => void fetchDetail() } : { text: '返回上一页', onClick: handleBack }}
          />
        </View>
      </View>
    );
  }

  if (albumImages.length === 0) {
    return (
      <View className="company-album-page">
        {header}
        <View className="company-album-page__content">
          <Empty description="暂无公司相册" action={{ text: '返回上一页', onClick: handleBack }} />
        </View>
      </View>
    );
  }

  const [heroImage, ...restImages] = albumImages;

  return (
    <View className="company-album-page">
      {header}

      <View className="company-album-page__content">
        <View className="company-album-page__summary-card">
          <Text className="company-album-page__summary-title">{providerName}</Text>
          <Text className="company-album-page__summary-subtitle">已收录 {albumImages.length} 张公司环境与品牌展示图片</Text>
        </View>

        <View className="company-album-page__hero-card" onClick={() => previewImage(heroImage)}>
          <Image className="company-album-page__hero-image" src={heroImage} mode="aspectFill" lazyLoad />
          <View className="company-album-page__hero-mask" />
          <View className="company-album-page__hero-badge">
            <Text className="company-album-page__hero-badge-text">01</Text>
          </View>
        </View>

        {restImages.length > 0 ? (
          <View className="company-album-page__grid">
            {restImages.map((image, index) => (
              <View key={`${image}-${index}`} className="company-album-page__grid-card" onClick={() => previewImage(image)}>
                <Image className="company-album-page__grid-image" src={image} mode="aspectFill" lazyLoad />
                <View className="company-album-page__grid-index">
                  <Text className="company-album-page__grid-index-text">
                    {String(index + 2).padStart(2, '0')}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
};

export default CompanyAlbumPage;
