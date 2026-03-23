import React, { useEffect, useMemo, useState } from 'react';
import { Image, Text, View } from '@tarojs/components';
import Taro, { useLoad, useReachBottom } from '@tarojs/taro';

import { Empty } from '@/components/Empty';
import { Icon } from '@/components/Icon';
import { Skeleton } from '@/components/Skeleton';
import { getProviderCases, type ProviderCaseItem, type ProviderType } from '@/services/providers';
import { showErrorToast } from '@/utils/error';

import './index.scss';

const PAGE_SIZE = 12;

const normalizeProviderType = (value?: string): ProviderType => {
  if (value === 'company' || value === '2') return 'company';
  if (value === 'foreman' || value === '3') return 'foreman';
  return 'designer';
};

const decodeText = (value?: string) => {
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const CaseGalleryPage: React.FC = () => {
  const [providerId, setProviderId] = useState(0);
  const [providerType, setProviderType] = useState<ProviderType>('designer');
  const [providerName, setProviderName] = useState('');
  const [list, setList] = useState<ProviderCaseItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useLoad((options) => {
    setProviderId(Number(options.providerId || 0));
    setProviderType(normalizeProviderType(options.providerType));
    setProviderName(decodeText(options.providerName) || '服务商');
  });

  const fetchList = async (reset = false) => {
    if (!providerId) {
      setList([]);
      setLoading(false);
      setHasMore(false);
      return;
    }

    const targetPage = reset ? 1 : page;
    if (reset) {
      setLoading(true);
    } else {
      if (loadingMore || !hasMore) return;
      setLoadingMore(true);
    }

    try {
      const res = await getProviderCases(providerType, providerId, targetPage, PAGE_SIZE);
      const incoming = res.list || [];
      setList((prev) => (reset ? incoming : [...prev, ...incoming]));
      setPage(targetPage + 1);
      setHasMore((res.total || 0) > targetPage * PAGE_SIZE || incoming.length === PAGE_SIZE);
    } catch (error) {
      showErrorToast(error, '加载案例失败');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!providerId) return;
    void fetchList(true);
  }, [providerId, providerType]); // eslint-disable-line react-hooks/exhaustive-deps

  useReachBottom(() => {
    void fetchList();
  });

  const subtitle = useMemo(() => {
    if (providerType === 'company') return '装修公司项目案例';
    if (providerType === 'foreman') return '工地交付与施工案例';
    return '设计方案与落地案例';
  }, [providerType]);

  const openDetail = (item: ProviderCaseItem) => {
    const encodedName = encodeURIComponent(providerName);
    Taro.navigateTo({
      url: `/pages/cases/detail/index?caseId=${item.id}&providerId=${providerId}&providerType=${providerType}&providerName=${encodedName}`,
    });
  };

  if (loading) {
    return (
      <View className="case-gallery-page case-gallery-page__loading">
        {[0, 1, 2].map((item) => (
          <Skeleton key={item} className="case-gallery-page__loading-card" />
        ))}
      </View>
    );
  }

  if (list.length === 0) {
    return (
      <View className="case-gallery-page case-gallery-page__empty">
        <Empty description="暂无案例作品" />
      </View>
    );
  }

  return (
    <View className="case-gallery-page">
      <View className="case-gallery-page__hero">
        <Text className="case-gallery-page__eyebrow">案例作品</Text>
        <Text className="case-gallery-page__title">{providerName || '服务商案例'}</Text>
        <Text className="case-gallery-page__subtitle">{subtitle}</Text>
      </View>

      <View className="case-gallery-page__grid">
        {list.map((item) => (
          <View key={item.id} className="case-gallery-page__card" onClick={() => openDetail(item)}>
            {item.coverImage ? (
              <Image className="case-gallery-page__cover" src={item.coverImage} mode="aspectFill" lazyLoad />
            ) : (
              <View className="case-gallery-page__cover-placeholder">
                <Icon name="inspiration" size={56} color="#ffffff" />
              </View>
            )}
            <View className="case-gallery-page__content">
              <Text className="case-gallery-page__card-title" numberOfLines={2}>{item.title || '案例作品'}</Text>
              <Text className="case-gallery-page__card-meta" numberOfLines={2}>
                {[item.style, item.area ? `${item.area}㎡` : ''].filter(Boolean).join(' · ') || '案例信息待补充'}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {loadingMore ? <View className="case-gallery-page__more">加载中...</View> : null}
      {!hasMore ? <View className="case-gallery-page__end">已经到底了</View> : null}
    </View>
  );
};

export default CaseGalleryPage;
