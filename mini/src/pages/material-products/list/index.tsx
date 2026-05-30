import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';

import { Empty } from '@/components/Empty';
import MaterialProductCard from '@/components/material-products/MaterialProductCard';
import MiniPageNav from '@/components/MiniPageNav';
import PageStateCard from '@/components/PageStateCard';
import { Skeleton } from '@/components/Skeleton';
import { getMaterialShopDetail, type MaterialShopItem, type MaterialShopProductItem } from '@/services/materialShops';

import './index.scss';

const MaterialProductListPage: React.FC = () => {
  const router = useRouter();
  const shopId = Number(router.params?.shopId || router.params?.id || 0);

  const [shop, setShop] = useState<MaterialShopItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchShop = useCallback(async () => {
    if (!shopId) {
      setShop(null);
      setLoading(false);
      setLoadError('缺少门店参数，请返回上一页后重试。');
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      const data = await getMaterialShopDetail(shopId);
      setShop(data);
    } catch {
      setShop(null);
      setLoadError('门店商品加载失败，请检查网络后重试。');
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useEffect(() => {
    void fetchShop();
  }, [fetchShop]);

  const products = useMemo(() => shop?.products || [], [shop]);

  const handleBack = () => {
    if (Taro.getCurrentPages().length > 1) {
      Taro.navigateBack();
      return;
    }

    if (shopId) {
      Taro.navigateTo({ url: `/pages/material-shops/detail/index?id=${shopId}` });
      return;
    }

    Taro.switchTab({ url: '/pages/home/index' });
  };

  const handleOpenProduct = (product: MaterialShopProductItem) => {
    if (!shopId || !product.id) return;
    Taro.navigateTo({ url: `/pages/material-products/detail/index?shopId=${shopId}&productId=${product.id}` });
  };

  if (loading) {
    return (
      <View className="material-products-page material-products-page--loading">
        <MiniPageNav title="门店商品" onBack={handleBack} placeholder />
        <View className="material-products-page__grid">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="material-products-page__card-skeleton" />
          ))}
        </View>
      </View>
    );
  }

  if (loadError) {
    return (
      <View className="material-products-page material-products-page--empty">
        <MiniPageNav title="门店商品" onBack={handleBack} placeholder />
        <View className="material-products-page__empty-wrap">
          <PageStateCard
            variant="error"
            title="门店商品加载失败"
            description={loadError}
            action={{ text: '重新加载', onClick: () => void fetchShop() }}
          />
        </View>
      </View>
    );
  }

  if (!shop) {
    return (
      <View className="material-products-page material-products-page--empty">
        <MiniPageNav title="门店商品" onBack={handleBack} placeholder />
        <View className="material-products-page__empty-wrap">
          <Empty description="暂无门店商品" action={{ text: '返回上一页', onClick: handleBack }} />
        </View>
      </View>
    );
  }

  return (
    <View className="material-products-page">
      <MiniPageNav title="门店商品" onBack={handleBack} placeholder />

      {products.length > 0 ? (
        <View className="material-products-page__grid">
          {products.map((product) => (
            <MaterialProductCard
              key={product.id || product.name}
              product={product}
              variant="grid"
              onClick={() => handleOpenProduct(product)}
            />
          ))}
        </View>
      ) : (
        <View className="material-products-page__empty-wrap material-products-page__empty-wrap--products">
          <Empty description="暂无门店商品" />
        </View>
      )}
    </View>
  );
};

export default MaterialProductListPage;
