import React, { useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, Text, View } from '@tarojs/components';
import Taro, { usePageScroll, useRouter } from '@tarojs/taro';

import { Card } from '@/components/Card';
import { Empty } from '@/components/Empty';
import { Icon } from '@/components/Icon';
import MiniPageNav from '@/components/MiniPageNav';
import PageStateCard from '@/components/PageStateCard';
import { PullToRefreshNotice } from '@/components/PullToRefreshNotice';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import { getMaterialShopDetail, type MaterialShopItem, type MaterialShopProductItem } from '@/services/materialShops';
import { usePullToRefreshFeedback } from '@/hooks/usePullToRefreshFeedback';
import useSlowLoadingHint from '@/hooks/useSlowLoadingHint';
import { resolveMaterialBrandLogoUrl, resolveMaterialCoverUrl } from '@/utils/providerMedia';
import './index.scss';

const NAV_SCROLL_DISTANCE = 200;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const formatProductPrice = (product: MaterialShopProductItem) => {
  if (product.price > 0) {
    return `¥${product.price.toLocaleString()}${product.unit ? `/${product.unit}` : ''}`;
  }
  return product.unit ? `按${product.unit}计价` : '到店咨询';
};

const buildSummaryText = (shop: MaterialShopItem) => {
  const categories = shop.productCategories.slice(0, 2).join('、');
  const products = shop.mainProducts.slice(0, 3).join('、');
  const parts = [
    categories ? `主营 ${categories}` : '',
    products ? `重点品类包括 ${products}` : '',
    shop.openTime ? `营业提示：${shop.openTime}` : '',
  ].filter(Boolean);

  return parts.length > 0 ? `${parts.join('；')}。` : '门店信息正在持续完善中。';
};

const MaterialShopDetailPage: React.FC = () => {
  const router = useRouter();
  const shopId = Number(router.params?.id || 0);

  const [detail, setDetail] = useState<MaterialShopItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [navProgress, setNavProgress] = useState(0);

  usePageScroll(({ scrollTop }) => {
    const next = clamp(scrollTop / NAV_SCROLL_DISTANCE, 0, 1);
    setNavProgress((prev) => (Math.abs(prev - next) < 0.01 ? prev : next));
  });

  const fetchDetail = async () => {
    if (!shopId) {
      setDetail(null);
      setLoading(false);
      setLoadError('缺少门店参数，请返回上一页后重试。');
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      const data = await getMaterialShopDetail(shopId);
      setDetail(data);
    } catch (error) {
      setDetail(null);
      setLoadError('门店详情加载失败，请检查网络后重试。');
    } finally {
      setLoading(false);
    }
  };
  const { refreshStatus, drawerHeight, drawerProgress, bindPullToRefresh, runReload } =
    usePullToRefreshFeedback(fetchDetail);

  useEffect(() => {
    void runReload();
  }, [runReload, shopId]);

  const handleBack = () => {
    if (Taro.getCurrentPages().length > 1) {
      Taro.navigateBack();
      return;
    }

    Taro.switchTab({ url: '/pages/home/index' });
  };

  const productFallbackImages = useMemo(
    () => (detail
      ? detail.products.flatMap((product) =>
          [product.coverImage, ...product.images].filter((item): item is string => Boolean(item)),
        )
      : []),
    [detail],
  );

  const brandLogoUrl = useMemo(
    () => resolveMaterialBrandLogoUrl(detail?.brandLogo),
    [detail?.brandLogo],
  );

  const heroImage = useMemo(
    () => resolveMaterialCoverUrl({ cover: detail?.cover, productImages: productFallbackImages }),
    [detail?.cover, productFallbackImages],
  );

  const previewUrls = useMemo(
    () => [heroImage, brandLogoUrl].filter(Boolean) as string[],
    [brandLogoUrl, heroImage]
  );

  const handlePreviewImage = (current?: string) => {
    if (!current || previewUrls.length === 0) {
      return;
    }

    Taro.previewImage({
      current,
      urls: previewUrls,
    });
  };

  const handlePreviewProduct = (product: MaterialShopProductItem) => {
    const urls = [product.coverImage, ...product.images].filter(Boolean) as string[];
    if (urls.length === 0) return;
    Taro.previewImage({
      current: product.coverImage || urls[0],
      urls,
    });
  };

  const settled = detail?.isSettled !== false;
  const slowLoadingVisible = useSlowLoadingHint(loading);
  const fixedNav = <MiniPageNav title={detail?.name || '主材详情'} onBack={handleBack} variant="overlay" progress={navProgress} />;
  const solidNav = <MiniPageNav title="主材详情" onBack={handleBack} placeholder />;

  if (loading) {
    return (
      <View className="material-detail-page material-detail-page--loading" {...bindPullToRefresh}>
        {fixedNav}
        <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />
        <View className="material-detail-page__hero material-detail-page__hero--loading">
          <Skeleton height={560} className="material-detail-page__hero-skeleton" />
        </View>
        <Skeleton className="material-detail-page__skeleton-block" />
        <Skeleton className="material-detail-page__skeleton-block" />
        {slowLoadingVisible ? (
          <View className="material-detail-page__state-card-wrap">
            <PageStateCard
              variant="loading"
              title="正在加载门店详情"
              description="网络较慢时会多等待一点，门店信息正在继续加载。"
              className="material-detail-page__state-card"
            />
          </View>
        ) : null}
      </View>
    );
  }

  if (loadError) {
    return (
      <View className="material-detail-page material-detail-page--empty" {...bindPullToRefresh}>
        {solidNav}
        <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />
        <View className="material-detail-page__empty-content">
          <PageStateCard
            variant="error"
            title="门店页面加载失败"
            description={loadError}
            className="material-detail-page__state-card"
            action={shopId ? { text: '重新加载', onClick: () => void fetchDetail() } : { text: '返回上一页', onClick: handleBack }}
          />
        </View>
      </View>
    );
  }

  if (!shopId || !detail) {
    return (
      <View className="material-detail-page material-detail-page--empty" {...bindPullToRefresh}>
        {solidNav}
        <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />
        <View className="material-detail-page__empty-content">
          <Empty
            description={shopId ? '主材详情加载失败' : '无效的主材门店编号'}
            action={{ text: '返回上一页', onClick: handleBack }}
          />
        </View>
      </View>
    );
  }

  const displayTags = Array.from(new Set([
    ...detail.productCategories,
    ...detail.mainProducts,
    ...detail.tags,
  ]))
    .filter((tag) => !['沟通中', '未入驻', '已入驻'].includes(tag))
    .slice(0, 6);

  return (
    <View
      className={`material-detail-page ${settled ? 'material-detail-page--no-fixed-footer' : ''}`}
      {...bindPullToRefresh}
    >
      {fixedNav}
      <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />

      <View className="material-detail-page__hero">
        {heroImage ? (
          <Image
            className="material-detail-page__hero-image"
            src={heroImage}
            mode="aspectFill"
            lazyLoad
            onClick={() => handlePreviewImage(heroImage)}
          />
        ) : (
          <View className="material-detail-page__hero-placeholder">
            <Icon name="material-service" size={88} color="#FFFFFF" />
          </View>
        )}

        <View className="material-detail-page__hero-overlay">
          <Text className="material-detail-page__hero-title">{detail.name}</Text>
          <Text className="material-detail-page__hero-subtitle">
            {detail.productCategories.join(' / ') || '主材采购服务'}
          </Text>
        </View>
      </View>

      <Card className="material-detail-page__summary-card">
        <View className="material-detail-page__summary">
          <View className="material-detail-page__summary-head">
            {brandLogoUrl ? (
              <Image
                className="material-detail-page__brand-logo"
                src={brandLogoUrl}
                mode="aspectFill"
                lazyLoad
                onClick={() => handlePreviewImage(brandLogoUrl)}
              />
            ) : (
              <View className="material-detail-page__brand-logo-placeholder">
                <Icon name="material-service" size={44} color="#111111" />
              </View>
            )}

            <View className="material-detail-page__summary-main">
              <View className="material-detail-page__summary-title-row">
                <Text className="material-detail-page__summary-title">{detail.name}</Text>
                <View className="material-detail-page__summary-badges">
                  {detail.isVerified ? <Tag variant="success">已认证</Tag> : null}
                  <Tag variant={settled ? 'secondary' : 'warning'}>{settled ? '已入驻' : '平台整理'}</Tag>
                </View>
              </View>
              {!settled ? (
                <View className="material-detail-page__tag-list material-detail-page__tag-list--inline">
                  <Tag variant="warning">待商家认领</Tag>
                  <Tag variant="secondary">信息仅供参考</Tag>
                </View>
              ) : null}

              <View className="material-detail-page__meta-row">
                <View className="material-detail-page__rating">
                  <Icon name="star" size={22} color="#111111" />
                  <Text>{detail.rating.toFixed(1)}</Text>
                </View>
                <Text>{detail.reviewCount > 0 ? `${detail.reviewCount}条评价` : '暂无评价'}</Text>
                <Text>{detail.distance || '附近'}</Text>
              </View>

              {displayTags.length > 0 ? (
                <View className="material-detail-page__tag-list material-detail-page__tag-list--inline">
                  {displayTags.map((tag) => (
                    <Tag key={tag} variant="secondary">{tag}</Tag>
                  ))}
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </Card>

      <Card className="material-detail-page__section-card">
        <View className="material-detail-page__section">
          <Text className="material-detail-page__section-title">门店信息</Text>
          <View className="material-detail-page__stat-grid">
            <View className="material-detail-page__stat-item">
              <Text className="material-detail-page__stat-label">门店评分</Text>
              <Text className="material-detail-page__stat-value">{detail.rating.toFixed(1)}</Text>
            </View>
            <View className="material-detail-page__stat-item">
              <Text className="material-detail-page__stat-label">门店距离</Text>
              <Text className="material-detail-page__stat-value">{detail.distance || '附近'}</Text>
            </View>
            <View className="material-detail-page__stat-item">
              <Text className="material-detail-page__stat-label">营业时间</Text>
              <Text className="material-detail-page__stat-value">{detail.openTime || '待补充'}</Text>
            </View>
            <View className="material-detail-page__stat-item">
              <Text className="material-detail-page__stat-label">主营品类</Text>
              <Text className="material-detail-page__stat-value">
                {detail.productCategories.slice(0, 2).join(' / ') || '待补充'}
              </Text>
            </View>
          </View>
        </View>
      </Card>

      <Card className="material-detail-page__section-card">
        <View className="material-detail-page__section">
          <Text className="material-detail-page__section-title">门店概览</Text>
          <Text className="material-detail-page__summary-copy">{buildSummaryText(detail)}</Text>
        </View>
      </Card>

      <Card className="material-detail-page__section-card">
        <View className="material-detail-page__section">
          <Text className="material-detail-page__section-title">门店位置</Text>
          <View className="material-detail-page__location-card">
            <View className="material-detail-page__location-icon">
              <Icon name="location-pin" size={28} color="#F97316" />
            </View>
            <View className="material-detail-page__location-main">
              <Text className="material-detail-page__location-label">门店地址</Text>
              <Text className="material-detail-page__location-text">{detail.address || '地址待补充'}</Text>
            </View>
            <View className="material-detail-page__location-distance">
              <Text className="material-detail-page__location-distance-text">{detail.distance || '附近'}</Text>
            </View>
          </View>
        </View>
      </Card>

      {detail.products.length > 0 ? (
        <Card className="material-detail-page__section-card">
          <View className="material-detail-page__section">
            <Text className="material-detail-page__section-title">门店商品</Text>
            <ScrollView scrollX className="material-detail-page__product-scroll" showScrollbar={false}>
              <View className="material-detail-page__product-list">
                {detail.products.map((product) => {
                  const coverImage = resolveMaterialCoverUrl({
                    cover: product.coverImage,
                    productImages: product.images,
                    fallback: '',
                  });
                  return (
                    <View
                      key={product.id || product.name}
                      className="material-detail-page__product-card"
                      onClick={() => handlePreviewProduct(product)}
                    >
                      {coverImage ? (
                        <Image className="material-detail-page__product-image" src={coverImage} mode="aspectFill" lazyLoad />
                      ) : (
                        <View className="material-detail-page__product-image material-detail-page__product-image--placeholder">
                          <Icon name="material-service" size={48} color="#FFFFFF" />
                        </View>
                      )}
                      <View className="material-detail-page__product-body">
                        <Text className="material-detail-page__product-title" numberOfLines={1}>{product.name}</Text>
                        <Text className="material-detail-page__product-price">{formatProductPrice(product)}</Text>
                        {product.description ? (
                          <Text className="material-detail-page__product-desc" numberOfLines={2}>{product.description}</Text>
                        ) : (
                          <Text className="material-detail-page__product-desc material-detail-page__product-desc--muted" numberOfLines={2}>
                            商品信息待补充
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </Card>
      ) : null}

      {!settled ? (
        <View className="material-detail-page__unsettled-bar">
          <View className="material-detail-page__unsettled-head">
            <View className="material-detail-page__unsettled-dot" />
            <Text className="material-detail-page__unsettled-title">平台整理</Text>
          </View>
          <Text className="material-detail-page__unsettled-text">待商家认领，信息仅供参考；不代表平台认证、合作或履约承诺。</Text>
        </View>
      ) : null}
    </View>
  );
};

export default MaterialShopDetailPage;
