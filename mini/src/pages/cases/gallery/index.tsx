import React, { useEffect, useMemo, useState } from 'react';
import { Image, Text, View } from '@tarojs/components';
import Taro, { useLoad, useReachBottom } from '@tarojs/taro';

import { Empty } from '@/components/Empty';
import { Icon } from '@/components/Icon';
import MiniPageNav from '@/components/MiniPageNav';
import { Skeleton } from '@/components/Skeleton';
import {
  getProviderCases,
  getProviderSceneCases,
  type ProviderCaseItem,
  type ProviderSceneItem,
  type ProviderType,
} from '@/services/providers';
import { showErrorToast } from '@/utils/error';
import { getMiniNavMetrics } from '@/utils/navLayout';

import './index.scss';

const PAGE_SIZE = 12;
const COVER_HEIGHTS = [280, 360, 320, 300];

type GalleryKind = 'craft' | 'scene';
type GalleryItem = ProviderCaseItem | ProviderSceneItem;

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

const formatArea = (area?: string | number) => {
  if (area === undefined || area === null || area === '') return '';
  const text = String(area);
  return text.includes('㎡') ? text : `${text}㎡`;
};

interface DecoratedCaseItem {
  item: ProviderCaseItem;
  index: number;
}

type CaseGallerySource = 'provider_case' | 'inspiration';

const CaseGalleryPage: React.FC = () => {
  const navMetrics = useMemo(() => getMiniNavMetrics(), []);
  const [providerId, setProviderId] = useState(0);
  const [providerType, setProviderType] = useState<ProviderType>('designer');
  const [providerName, setProviderName] = useState('');
  const [source, setSource] = useState<CaseGallerySource>('provider_case');
  const [list, setList] = useState<ProviderCaseItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const galleryKind: GalleryKind = source === 'inspiration' ? 'scene' : 'craft';

  useLoad((options) => {
    setProviderId(Number(options.providerId || 0));
    setProviderType(normalizeProviderType(options.providerType));
    setProviderName(decodeText(options.providerName) || '服务商');
    setSource(options.source === 'inspiration' ? 'inspiration' : 'provider_case');
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
      const res = galleryKind === 'scene'
        ? await getProviderSceneCases(providerId, targetPage, PAGE_SIZE)
        : await getProviderCases(providerType, providerId, targetPage, PAGE_SIZE);
      const nextList = res.list || [];
      setList((prev) => (reset ? nextList : [...prev, ...nextList]));
      setPage(targetPage + 1);
      setHasMore((res.total || 0) > targetPage * PAGE_SIZE || nextList.length === PAGE_SIZE);
    } catch (error) {
      showErrorToast(error, '加载作品失败');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!providerId) return;
    void fetchList(true);
  }, [providerId, providerType, galleryKind]); // eslint-disable-line react-hooks/exhaustive-deps

  useReachBottom(() => {
    void fetchList();
  });

  const handleBack = () => {
    if (Taro.getCurrentPages().length > 1) {
      Taro.navigateBack();
      return;
    }

    Taro.switchTab({ url: '/pages/home/index' });
  };

  const subtitle = useMemo(() => {
    if (galleryKind === 'scene') return '真实项目完工案例与施工实景';
    if (providerType === 'company') return '装修公司项目案例';
    if (providerType === 'foreman') return '工长工艺展示与施工案例';
    return '设计方案与落地案例';
  }, [galleryKind, providerType]);

  const openDetail = (item: GalleryItem) => {
    const encodedName = encodeURIComponent(providerName);
    Taro.navigateTo({
      url: `/pages/cases/detail/index?caseId=${item.id}&providerId=${providerId}&providerType=${providerType}&providerName=${encodedName}&source=${source}`,
    });
  };

  const columns = useMemo(() => {
    return list.reduce<{ left: DecoratedCaseItem[]; right: DecoratedCaseItem[] }>(
      (acc, item, index) => {
        const bucket = index % 2 === 0 ? 'left' : 'right';
        acc[bucket].push({ item, index });
        return acc;
      },
      { left: [], right: [] },
    );
  }, [list]);

  const galleryTitle = providerType === 'foreman' ? '工艺展示' : '作品案例';
  const emptyText = providerType === 'foreman' ? '暂无工艺展示' : '暂无作品案例';
  const cardFallbackTitle = providerType === 'foreman' ? '工艺展示' : '作品案例';
  const cardFallbackMeta = providerType === 'foreman' ? '工艺信息待补充' : '案例信息待补充';

  const renderCard = ({ item, index }: DecoratedCaseItem) => {
    const coverHeight = COVER_HEIGHTS[index % COVER_HEIGHTS.length];
    const meta = [item.style, formatArea(item.area)].filter(Boolean).join(' · ') || cardFallbackMeta;

    return (
      <View key={item.id} className="case-gallery-page__card" onClick={() => openDetail(item)}>
        {item.coverImage ? (
          <Image
            className="case-gallery-page__cover"
            style={{ height: `${coverHeight}rpx` }}
            src={item.coverImage}
            mode="aspectFill"
            lazyLoad
          />
        ) : (
          <View className="case-gallery-page__cover-placeholder" style={{ height: `${coverHeight}rpx` }}>
            <Icon name="inspiration" size={58} color="#FFFFFF" />
          </View>
        )}
        <View className="case-gallery-page__card-body">
          <Text className="case-gallery-page__card-title" numberOfLines={2}>{item.title || cardFallbackTitle}</Text>
          <Text className="case-gallery-page__card-meta" numberOfLines={1}>{meta}</Text>
        </View>
      </View>
    );
  };

  const header = <MiniPageNav title={galleryTitle} onBack={handleBack} placeholder />;

  if (loading) {
    return (
      <View className="case-gallery-page">
        {header}
        <View className="case-gallery-page__columns">
          <View className="case-gallery-page__column">
            {[0, 1].map((item) => (
              <Skeleton key={`left-${item}`} className="case-gallery-page__loading-card" />
            ))}
          </View>
          <View className="case-gallery-page__column">
            {[0, 1].map((item) => (
              <Skeleton key={`right-${item}`} className="case-gallery-page__loading-card" />
            ))}
          </View>
        </View>
      </View>
    );
  }

  if (list.length === 0) {
    return (
      <View className="case-gallery-page case-gallery-page--empty">
        {header}
        <Empty description={emptyText} />
      </View>
    );
  }

  return (
    <View className="case-gallery-page">
      {header}

      <View className="case-gallery-page__columns">
        <View className="case-gallery-page__column">
          {columns.left.map(renderCard)}
        </View>
        <View className="case-gallery-page__column">
          {columns.right.map(renderCard)}
        </View>
      </View>

      {loadingMore ? <View className="case-gallery-page__more">加载中...</View> : null}
      {!hasMore ? <View className="case-gallery-page__end">已经到底了</View> : null}
    </View>
  );
};

export default CaseGalleryPage;
