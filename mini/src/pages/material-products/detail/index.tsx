import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Swiper, SwiperItem, Text, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';

import { Empty } from '@/components/Empty';
import { Icon } from '@/components/Icon';
import MiniPageNav from '@/components/MiniPageNav';
import PageStateCard from '@/components/PageStateCard';
import { Skeleton } from '@/components/Skeleton';
import { getMaterialShopDetail, type MaterialShopItem } from '@/services/materialShops';
import { colors } from '@/theme/tokens';
import {
  formatMaterialProductPrice,
  getMaterialProductById,
  getMaterialProductImages,
  getMaterialProductSpecRows,
  getMaterialProductSubtitle,
} from '@/utils/materialProducts';

import './index.scss';

const MaterialProductDetailPage: React.FC = () => {
  const router = useRouter();
  const shopId = Number(router.params?.shopId || router.params?.id || 0);
  const productId = Number(router.params?.productId || 0);

  const [shop, setShop] = useState<MaterialShopItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const fetchShop = useCallback(async () => {
    if (!shopId || !productId) {
      setShop(null);
      setLoading(false);
      setLoadError('缺少商品参数，请返回上一页后重试。');
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      const data = await getMaterialShopDetail(shopId);
      setShop(data);
    } catch {
      setShop(null);
      setLoadError('商品详情加载失败，请检查网络后重试。');
    } finally {
      setLoading(false);
    }
  }, [productId, shopId]);

  useEffect(() => {
    void fetchShop();
  }, [fetchShop]);

  const product = useMemo(() => getMaterialProductById(shop, productId), [productId, shop]);
  const productImages = useMemo(() => (product ? getMaterialProductImages(product) : []), [product]);
  const specRows = useMemo(() => (product ? getMaterialProductSpecRows(product) : []), [product]);

  useEffect(() => {
    setCurrentImageIndex(0);
    setFailedImages({});
  }, [productId, productImages.length]);

  const handleBack = () => {
    if (Taro.getCurrentPages().length > 1) {
      Taro.navigateBack();
      return;
    }

    if (shopId) {
      Taro.navigateTo({ url: `/pages/material-products/list/index?shopId=${shopId}` });
      return;
    }

    Taro.switchTab({ url: '/pages/home/index' });
  };

  const handleCopyAddress = () => {
    const address = shop?.address || '';
    if (!address || address === '地址待补充') {
      Taro.showToast({ title: '门店地址待补充', icon: 'none' });
      return;
    }
    Taro.setClipboardData({ data: address });
  };

  const handleCopyPhone = () => {
    const phone = shop?.contactPhone || '';
    if (!phone) {
      return;
    }
    Taro.setClipboardData({ data: phone });
  };

  if (loading) {
    return (
      <View className="material-product-detail material-product-detail--loading">
        <MiniPageNav title="商品详情" onBack={handleBack} placeholder />
        <Skeleton className="material-product-detail__hero-skeleton" />
        <Skeleton className="material-product-detail__content-skeleton" />
        <Skeleton className="material-product-detail__content-skeleton" />
      </View>
    );
  }

  if (loadError) {
    return (
      <View className="material-product-detail material-product-detail--empty">
        <MiniPageNav title="商品详情" onBack={handleBack} placeholder />
        <View className="material-product-detail__empty-wrap">
          <PageStateCard
            variant="error"
            title="商品详情加载失败"
            description={loadError}
            action={{ text: '重新加载', onClick: () => void fetchShop() }}
          />
        </View>
      </View>
    );
  }

  if (!shop || !product) {
    return (
      <View className="material-product-detail material-product-detail--empty">
        <MiniPageNav title="商品详情" onBack={handleBack} placeholder />
        <View className="material-product-detail__empty-wrap">
          <Empty description="商品信息不存在或已下架" action={{ text: '返回上一页', onClick: handleBack }} />
        </View>
      </View>
    );
  }

  return (
    <View className="material-product-detail">
      <MiniPageNav title="商品详情" onBack={handleBack} placeholder />

      <View className="material-product-detail__hero">
        {productImages.length > 0 ? (
          <Swiper
            className="material-product-detail__swiper"
            circular={productImages.length > 1}
            current={currentImageIndex}
            onChange={(event: { detail?: { current?: number } }) => {
              setCurrentImageIndex(Number(event.detail?.current || 0));
            }}
          >
            {productImages.map((image, index) => (
              <SwiperItem key={`${image}-${index}`} className="material-product-detail__swiper-item">
                {!failedImages[image] ? (
                  <Image
                    className="material-product-detail__hero-image"
                    src={image}
                    mode="aspectFill"
                    onError={() => setFailedImages((prev) => ({ ...prev, [image]: true }))}
                  />
                ) : (
                  <View className="material-product-detail__hero-placeholder">
                    <Icon name="material-service" size={78} color={colors.white} />
                    <Text>图片暂不可用</Text>
                  </View>
                )}
              </SwiperItem>
            ))}
          </Swiper>
        ) : (
          <View className="material-product-detail__hero-placeholder">
            <Icon name="material-service" size={96} color={colors.white} />
            <Text>暂无商品图片</Text>
          </View>
        )}
        {productImages.length > 1 ? (
          <Text className="material-product-detail__image-count">{currentImageIndex + 1}/{productImages.length}</Text>
        ) : null}
      </View>

      <View className="material-product-detail__main">
        <View className="material-product-detail__heading">
          <Text className="material-product-detail__title">{product.name}</Text>
          <Text className="material-product-detail__subtitle">{getMaterialProductSubtitle(product)}</Text>
        </View>

        <View className="material-product-detail__price-row">
          <Text className="material-product-detail__price">{formatMaterialProductPrice(product)}</Text>
          <Text className="material-product-detail__price-note">参考价</Text>
        </View>

        <View className="material-product-detail__card">
          <Text className="material-product-detail__card-title">规格参数</Text>
          <View className="material-product-detail__spec-grid">
            {specRows.map((row) => (
              <View key={row.label} className="material-product-detail__spec-item">
                <Text className="material-product-detail__spec-label">{row.label}</Text>
                <Text className="material-product-detail__spec-value">{row.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className="material-product-detail__card material-product-detail__shop-card">
          <Text className="material-product-detail__card-title">门店信息</Text>
          <Text className="material-product-detail__shop-name">{shop.name}</Text>
          <View className="material-product-detail__rating-row">
            {Array.from({ length: 5 }).map((_, index) => (
              <Icon key={index} name="star" size={22} color={colors.warning} />
            ))}
            <Text>{shop.rating.toFixed(1)}分</Text>
          </View>
          <View className="material-product-detail__shop-meta-row">
            <Icon name="location-pin" size={24} color={colors.textTertiary} />
            <Text className="material-product-detail__shop-meta-text" numberOfLines={1}>
              门店地址：{shop.address || '地址待补充'}
            </Text>
            <View className="material-product-detail__copy-action" onClick={handleCopyAddress} hoverClass="material-product-detail__copy-action--pressed">
              <Text>复制</Text>
            </View>
          </View>
          <View className="material-product-detail__shop-meta-row">
            <Icon name="calendar" size={24} color={colors.textTertiary} />
            <Text className="material-product-detail__shop-meta-text" numberOfLines={1}>
              营业时间：{shop.openTime || '待补充'}
            </Text>
          </View>
          {shop.contactPhone ? (
            <View className="material-product-detail__shop-meta-row">
              <Icon name="phone" size={24} color={colors.textTertiary} />
              <Text className="material-product-detail__shop-meta-text" numberOfLines={1}>
                联系电话：{shop.contactPhone}
              </Text>
              <View className="material-product-detail__copy-action" onClick={handleCopyPhone} hoverClass="material-product-detail__copy-action--pressed">
                <Text>复制</Text>
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
};

export default MaterialProductDetailPage;
