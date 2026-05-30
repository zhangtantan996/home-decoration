import React, { useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, Text, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';

import { Card } from '@/components/Card';
import { Empty } from '@/components/Empty';
import { Icon } from '@/components/Icon';
import MaterialProductCard from '@/components/material-products/MaterialProductCard';
import MiniPageNav from '@/components/MiniPageNav';
import PageStateCard from '@/components/PageStateCard';
import { PullToRefreshNotice } from '@/components/PullToRefreshNotice';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import { usePullToRefreshFeedback } from '@/hooks/usePullToRefreshFeedback';
import useSlowLoadingHint from '@/hooks/useSlowLoadingHint';
import { getMaterialShopDetail, type MaterialShopItem, type MaterialShopProductItem } from '@/services/materialShops';
import { colors } from '@/theme/tokens';
import { resolveMaterialCoverUrl } from '@/utils/providerMedia';
import './index.scss';

const MaterialShopDetailPage: React.FC = () => {
  const router = useRouter();
  const shopId = Number(router.params?.id || 0);

  const [detail, setDetail] = useState<MaterialShopItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

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

  const heroImage = useMemo(
    () => resolveMaterialCoverUrl({ cover: detail?.cover, productImages: productFallbackImages }),
    [detail?.cover, productFallbackImages],
  );

  const handleShowAllProducts = () => {
    if (!detail?.id) return;
    Taro.navigateTo({ url: `/pages/material-products/list/index?shopId=${detail.id}` });
  };

  const handleOpenProduct = (product: MaterialShopProductItem) => {
    if (!detail?.id || !product.id) return;
    Taro.navigateTo({ url: `/pages/material-products/detail/index?shopId=${detail.id}&productId=${product.id}` });
  };

  const handleCopyAddress = () => {
    const address = detail?.address || '';
    if (!address || address === '地址待补充') {
      Taro.showToast({ title: '门店地址待补充', icon: 'none' });
      return;
    }
    Taro.setClipboardData({ data: address });
  };

  const handleCopyPhone = () => {
    const phone = detail?.contactPhone || '';
    if (!phone) {
      return;
    }
    Taro.setClipboardData({ data: phone });
  };

  const settled = detail?.isSettled !== false;
  const slowLoadingVisible = useSlowLoadingHint(loading);
  const pageNav = <MiniPageNav title="主材门店" onBack={handleBack} placeholder />;

  if (loading) {
    return (
      <View className="material-detail-page material-detail-page--loading" {...bindPullToRefresh}>
        {pageNav}
        <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />
        <View className="material-detail-page__hero material-detail-page__hero--loading">
          <Skeleton height={336} className="material-detail-page__hero-skeleton" />
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
        {pageNav}
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
        {pageNav}
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

  return (
    <View
      className={`material-detail-page ${settled ? 'material-detail-page--no-fixed-footer' : ''}`}
      {...bindPullToRefresh}
    >
      {pageNav}
      <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />

      <View className="material-detail-page__hero">
        {heroImage ? (
          <Image
            className="material-detail-page__hero-image"
            src={heroImage}
            mode="aspectFill"
            lazyLoad
          />
        ) : (
          <View className="material-detail-page__hero-placeholder">
            <Icon name="material-service" size={88} color={colors.white} />
          </View>
        )}
      </View>

      <Card className="material-detail-page__summary-card">
        <View className="material-detail-page__summary">
          <View className="material-detail-page__summary-top">
            <View className="material-detail-page__summary-main">
              <View className="material-detail-page__summary-title-row">
                <Text className="material-detail-page__summary-title">{detail.name}</Text>
                {detail.isVerified ? <Tag variant="success">已认证</Tag> : null}
              </View>
              <View className="material-detail-page__address-row">
                <Icon name="location-pin" size={24} color={colors.textTertiary} />
                <Text className="material-detail-page__address-text" numberOfLines={1}>
                  门店地址：{detail.address || '地址待补充'}
                </Text>
                <View className="material-detail-page__copy-action" onClick={handleCopyAddress} hoverClass="material-detail-page__copy-action--pressed">
                  <Text>复制</Text>
                </View>
              </View>
              <View className="material-detail-page__address-row">
                <Icon name="calendar" size={24} color={colors.textTertiary} />
                <Text className="material-detail-page__address-text" numberOfLines={1}>
                  营业时间：{detail.openTime || '待补充'}
                </Text>
              </View>
              {detail.contactPhone ? (
                <View className="material-detail-page__address-row">
                  <Icon name="phone" size={24} color={colors.textTertiary} />
                  <Text className="material-detail-page__address-text" numberOfLines={1}>
                    联系电话：{detail.contactPhone}
                  </Text>
                  <View className="material-detail-page__copy-action" onClick={handleCopyPhone} hoverClass="material-detail-page__copy-action--pressed">
                    <Text>复制</Text>
                  </View>
                </View>
              ) : null}
            </View>
          </View>

          {!settled ? (
            <View className="material-detail-page__tag-list">
              <Tag variant="warning">待商家认领</Tag>
              <Tag variant="secondary">信息仅供参考</Tag>
            </View>
          ) : null}

          <View className="material-detail-page__stat-row">
            <View className="material-detail-page__stat-item">
              <Text className="material-detail-page__stat-value">{detail.rating.toFixed(1)}</Text>
              <Text className="material-detail-page__stat-label">综合评分</Text>
            </View>
            <View className="material-detail-page__stat-item">
              <Text className="material-detail-page__stat-value">{detail.products.length}</Text>
              <Text className="material-detail-page__stat-label">商品数量</Text>
            </View>
            <View className="material-detail-page__stat-item">
              <Text className="material-detail-page__stat-value">{detail.isVerified ? '已认证' : '待认证'}</Text>
              <Text className="material-detail-page__stat-label">资质状态</Text>
            </View>
          </View>
        </View>
      </Card>

      <Card className="material-detail-page__section-card">
        <View className="material-detail-page__section">
          <View className="material-detail-page__section-head">
            <Text className="material-detail-page__section-title">门店商品</Text>
            {detail.products.length > 0 ? (
              <View className="material-detail-page__section-more" onClick={handleShowAllProducts} hoverClass="material-detail-page__section-more--pressed">
                <Text>全部</Text>
                <Icon name="arrow-left" size={24} color={colors.textTertiary} />
              </View>
            ) : null}
          </View>
          {detail.products.length > 0 ? (
            <ScrollView scrollX className="material-detail-page__product-scroll" showScrollbar={false}>
              <View className="material-detail-page__product-list">
                {detail.products.slice(0, 8).map((product) => (
                  <MaterialProductCard
                    key={product.id || product.name}
                    product={product}
                    variant="rail"
                    onClick={() => handleOpenProduct(product)}
                  />
                ))}
              </View>
            </ScrollView>
          ) : (
            <View className="material-detail-page__empty-products">
              <Text>暂无门店商品</Text>
            </View>
          )}
        </View>
      </Card>

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
