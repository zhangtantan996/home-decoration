import React, { useEffect, useMemo, useState } from 'react';
import { Image, Text, View } from '@tarojs/components';
import Taro, { usePullDownRefresh, useRouter } from '@tarojs/taro';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Empty } from '@/components/Empty';
import { Icon } from '@/components/Icon';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import { getMaterialShopDetail, type MaterialShopItem } from '@/services/materialShops';
import { showErrorToast } from '@/utils/error';
import './index.scss';

const getShopTypeLabel = (type?: string) => {
  if (type === 'brand') return '品牌馆';
  if (type === 'showroom') return '展厅';
  return '主材门店';
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

  const fetchDetail = async () => {
    if (!shopId) {
      setDetail(null);
      setLoading(false);
      Taro.stopPullDownRefresh();
      return;
    }

    setLoading(true);
    try {
      const data = await getMaterialShopDetail(shopId);
      setDetail(data);
    } catch (error) {
      setDetail(null);
      showErrorToast(error, '加载失败');
    } finally {
      setLoading(false);
      Taro.stopPullDownRefresh();
    }
  };

  useEffect(() => {
    void fetchDetail();
  }, [shopId]); // eslint-disable-line react-hooks/exhaustive-deps

  usePullDownRefresh(() => {
    void fetchDetail();
  });

  const handleBack = () => {
    if (Taro.getCurrentPages().length > 1) {
      Taro.navigateBack();
      return;
    }

    Taro.switchTab({ url: '/pages/home/index' });
  };

  const previewUrls = useMemo(
    () => (detail ? [detail.cover, detail.brandLogo].filter(Boolean) as string[] : []),
    [detail]
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

  if (loading) {
    return (
      <View className="material-detail-page">
        <Skeleton height={420} className="material-detail-page__hero" />
        <Skeleton className="material-detail-page__skeleton-block" />
        <Skeleton className="material-detail-page__skeleton-block" />
      </View>
    );
  }

  if (!shopId || !detail) {
    return (
      <View className="material-detail-page">
        <Empty
          description={shopId ? '主材详情加载失败' : '无效的主材门店编号'}
          action={{ text: '返回上一页', onClick: handleBack }}
        />
      </View>
    );
  }

  const settled = detail.isSettled !== false;
  const displayTags = Array.from(new Set([
    ...detail.productCategories,
    ...detail.mainProducts,
    ...detail.tags,
  ])).slice(0, 8);

  return (
    <View className="material-detail-page">
      <View className="material-detail-page__hero">
        {detail.cover ? (
          <Image
            className="material-detail-page__hero-image"
            src={detail.cover}
            mode="aspectFill"
            lazyLoad
            onClick={() => handlePreviewImage(detail.cover)}
          />
        ) : (
          <View className="material-detail-page__hero-placeholder">
            <Icon name="material-service" size={88} color="#FFFFFF" />
          </View>
        )}

        <View className="material-detail-page__hero-overlay">
          <View className="material-detail-page__hero-kicker">
            <Icon name="material-service" size={20} color="#F5F5F5" />
            <Text>{getShopTypeLabel(detail.type)}</Text>
          </View>
          <Text className="material-detail-page__hero-title">{detail.name}</Text>
          <Text className="material-detail-page__hero-subtitle">
            {detail.productCategories.join(' / ') || '主材采购服务'}
          </Text>
        </View>
      </View>

      {!settled ? (
        <View className="material-detail-page__settled-banner">
          该商家暂未入驻平台，当前展示信息来自已同步的门店资料，仅供选材参考。
        </View>
      ) : null}

      <Card className="material-detail-page__summary-card">
        <View className="material-detail-page__summary">
          <View className="material-detail-page__summary-head">
            {detail.brandLogo ? (
              <Image
                className="material-detail-page__brand-logo"
                src={detail.brandLogo}
                mode="aspectFill"
                lazyLoad
                onClick={() => handlePreviewImage(detail.brandLogo)}
              />
            ) : (
              <View className="material-detail-page__brand-logo-placeholder">
                <Icon name="material-service" size={44} color="#111111" />
              </View>
            )}

            <View className="material-detail-page__summary-main">
              <View className="material-detail-page__summary-title-row">
                <Text className="material-detail-page__summary-title">{detail.name}</Text>
                {detail.isVerified ? <Tag variant="success">已认证</Tag> : null}
                <Tag variant={settled ? 'secondary' : 'warning'}>{settled ? '已入驻' : '未入驻'}</Tag>
              </View>

              <View className="material-detail-page__meta-row">
                <View className="material-detail-page__rating">
                  <Icon name="star" size={22} color="#111111" />
                  <Text>{detail.rating.toFixed(1)}</Text>
                </View>
                <Text>{detail.reviewCount > 0 ? `${detail.reviewCount}条评价` : '暂无评价'}</Text>
                <Text>{detail.distance || '附近'}</Text>
              </View>

              <View className="material-detail-page__address-row">
                <Icon name="location-pin" size={22} color="#737373" />
                <Text className="material-detail-page__address-text">{detail.address || '地址待补充'}</Text>
              </View>
            </View>
          </View>

          {displayTags.length > 0 ? (
            <View className="material-detail-page__tag-list">
              {displayTags.map((tag) => (
                <Tag key={tag} variant="secondary">{tag}</Tag>
              ))}
            </View>
          ) : null}
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

      <View className="material-detail-page__footer">
        <Button block className="material-detail-page__footer-button" onClick={handleBack}>
          返回上一页
        </Button>
      </View>
    </View>
  );
};

export default MaterialShopDetailPage;
