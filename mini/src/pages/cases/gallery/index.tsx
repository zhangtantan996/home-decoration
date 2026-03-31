import React, { useEffect, useMemo, useState } from 'react';
import { Image, Text, View } from '@tarojs/components';
import Taro, { useLoad, useReachBottom } from '@tarojs/taro';

import { Empty } from '@/components/Empty';
import { Icon } from '@/components/Icon';
import { Skeleton } from '@/components/Skeleton';
import {
  getProviderCases,
  getProviderSceneCases,
  type ProviderCaseItem,
  type ProviderSceneItem,
  type ProviderType,
} from '@/services/providers';
import { showErrorToast } from '@/utils/error';
import { normalizeProviderMediaUrl } from '@/utils/providerMedia';

import './index.scss';

const PAGE_SIZE = 12;

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

const CaseGalleryPage: React.FC = () => {
  const [providerId, setProviderId] = useState(0);
  const [providerType, setProviderType] = useState<ProviderType>('designer');
  const [providerName, setProviderName] = useState('');
  const [galleryKind, setGalleryKind] = useState<GalleryKind>('craft');
  const [list, setList] = useState<GalleryItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useLoad((options) => {
    setProviderId(Number(options.providerId || 0));
    setProviderType(normalizeProviderType(options.providerType));
    setProviderName(decodeText(options.providerName) || '服务商');
    setGalleryKind(options.kind === 'scene' ? 'scene' : 'craft');
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
        ? await getProviderSceneCases(providerType, providerId, targetPage, PAGE_SIZE)
        : await getProviderCases(providerType, providerId, targetPage, PAGE_SIZE);
      const incoming = (res.list || []) as GalleryItem[];
      setList((prev) => (reset ? incoming : [...prev, ...incoming]));
      setPage(targetPage + 1);
      setHasMore((res.total || 0) > targetPage * PAGE_SIZE || incoming.length === PAGE_SIZE);
    } catch (error) {
      showErrorToast(error, galleryKind === 'scene' ? '加载案例实景失败' : '加载案例失败');
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

  const title = useMemo(() => {
    if (galleryKind === 'scene') return '案例实景';
    if (providerType === 'foreman') return '工艺展示';
    return '案例作品';
  }, [galleryKind, providerType]);

  const subtitle = useMemo(() => {
    if (galleryKind === 'scene') return '真实项目完工案例与施工实景';
    if (providerType === 'company') return '装修公司项目案例';
    if (providerType === 'foreman') return '工长工艺展示与施工案例';
    return '设计方案与落地案例';
  }, [galleryKind, providerType]);

  const openDetail = (item: GalleryItem) => {
    const encodedName = encodeURIComponent(providerName);
    Taro.navigateTo({
      url: galleryKind === 'scene'
        ? `/pages/cases/scene-detail/index?sceneId=${item.id}&providerId=${providerId}&providerType=${providerType}&providerName=${encodedName}`
        : `/pages/cases/detail/index?caseId=${item.id}&providerId=${providerId}&providerType=${providerType}&providerName=${encodedName}`,
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
        <Empty description={galleryKind === 'scene' ? '暂无案例实景' : providerType === 'foreman' ? '暂无工艺展示' : '暂无案例作品'} />
      </View>
    );
  }

  return (
    <View className="case-gallery-page">
      <View className="case-gallery-page__hero">
        <Text className="case-gallery-page__eyebrow">{title}</Text>
        <Text className="case-gallery-page__title">{providerName || '服务商作品'}</Text>
        <Text className="case-gallery-page__subtitle">{subtitle}</Text>
      </View>

      <View className="case-gallery-page__grid">
        {list.map((item) => {
          const coverImage = normalizeProviderMediaUrl(item.coverImage);
          const meta = galleryKind === 'scene'
            ? [('year' in item && item.year ? `${item.year}` : ''), ('createdAt' in item ? item.createdAt || '' : '')]
              .filter(Boolean)
              .join(' · ')
            : [('style' in item ? item.style || '' : ''), ('area' in item ? formatArea(item.area) : '')]
              .filter(Boolean)
              .join(' · ');

          return (
            <View key={item.id} className="case-gallery-page__card" onClick={() => openDetail(item)}>
              {coverImage ? (
                <Image className="case-gallery-page__cover" src={coverImage} mode="aspectFill" lazyLoad />
              ) : (
                <View className="case-gallery-page__cover-placeholder">
                  <Icon name="inspiration" size={56} color="#ffffff" />
                </View>
              )}
              <View className="case-gallery-page__content">
                <Text className="case-gallery-page__card-title" numberOfLines={2}>{item.title || title}</Text>
                <Text className="case-gallery-page__card-meta" numberOfLines={2}>
                  {meta || (galleryKind === 'scene' ? '真实项目案例' : providerType === 'foreman' ? '工艺信息待补充' : '案例信息待补充')}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      {loadingMore ? <View className="case-gallery-page__more">加载中...</View> : null}
      {!hasMore ? <View className="case-gallery-page__end">已经到底了</View> : null}
    </View>
  );
};

export default CaseGalleryPage;
