import Taro, { usePullDownRefresh, useReachBottom, useRouter } from '@tarojs/taro';
import { View } from '@tarojs/components';
import React, { useEffect, useRef, useState } from 'react';

import { Card } from '@/components/Card';
import { Empty } from '@/components/Empty';
import { Input } from '@/components/Input';
import { ListItem } from '@/components/ListItem';
import { Skeleton } from '@/components/Skeleton';
import { Tabs } from '@/components/Tabs';
import { listProviders, type ProviderListItem, type ProviderType } from '@/services/providers';
import { useAuthStore } from '@/store/auth';
import { showErrorToast } from '@/utils/error';

const normalizeProviderType = (value?: string): ProviderType => {
  if (value === 'company' || value === '2') {
    return 'company';
  }
  if (value === 'foreman' || value === '3') {
    return 'foreman';
  }
  return 'designer';
};

export default function ProviderList() {
  const router = useRouter();
  const auth = useAuthStore();
  const [activeTab, setActiveTab] = useState<ProviderType>(normalizeProviderType(router.params.type));
  const [providers, setProviders] = useState<ProviderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState((router.params.keyword || '').trim());
  const requestIdRef = useRef(0);
  const skipSearchFirstRunRef = useRef(true);

  const providerTypes = [
    { label: '设计师', value: 'designer' },
    { label: '装修公司', value: 'company' },
    { label: '工长', value: 'foreman' },
  ];

  const fetchProviders = async (reset = false) => {
    if (loading && !reset) {
      return;
    }

    setLoading(true);
    const currentPage = reset ? 1 : page;
    const requestId = Date.now();
    requestIdRef.current = requestId;

    try {
      const data = await listProviders({
        page: currentPage,
        pageSize: 10,
        type: activeTab,
        keyword: search.trim(),
      });

      if (requestIdRef.current !== requestId) {
        return;
      }

      const newList = data.list || [];
      if (reset) {
        setProviders(newList);
      } else {
        setProviders((prev) => [...prev, ...newList]);
      }

      setHasMore(newList.length === 10);
      setPage(currentPage + 1);
    } catch (err) {
      showErrorToast(err, '加载失败');
    } finally {
      if (requestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  };
  useEffect(() => {
    fetchProviders(true);
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (skipSearchFirstRunRef.current) {
      skipSearchFirstRunRef.current = false;
      return;
    }

    const timer = setTimeout(() => {
      fetchProviders(true);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  usePullDownRefresh(() => {
    fetchProviders(true).finally(() => {
      Taro.stopPullDownRefresh();
    });
  });

  useReachBottom(() => {
    if (hasMore && !loading) {
      fetchProviders();
    }
  });

  const handleCardClick = (id: number) => {
    Taro.navigateTo({
      url: `/pages/providers/detail/index?id=${id}&type=${activeTab}`,
    });
  };

  const handleEmptyAction = () => {
    if (search.trim()) {
      setSearch('');
      return;
    }

    if (auth.token) {
      Taro.switchTab({ url: '/pages/home/index' });
      return;
    }

    Taro.navigateTo({ url: '/pages/profile/index' });
  };

  const emptyActionText = search.trim()
    ? '清空搜索'
    : auth.token
      ? '返回首页'
      : '去登录';

  return (
    <View className="page bg-gray-50 min-h-screen">
      <View className="sticky top-0 z-10 bg-white shadow-sm">
        <View className="p-md">
          <Input
            value={search}
            onChange={setSearch}
            placeholder="搜索服务商..."
          />
        </View>
        <Tabs
          options={providerTypes}
          value={activeTab}
          onChange={(val) => setActiveTab(val as ProviderType)}
        />
      </View>

      <View className="p-md">
        {loading && page === 1 ? (
          <View>
            <View className="mb-sm"><Skeleton width="100%" height={100} /></View>
            <View className="mb-sm"><Skeleton width="100%" height={100} /></View>
            <View className="mb-sm"><Skeleton width="100%" height={100} /></View>
          </View>
        ) : providers.length === 0 ? (
          <Empty
            description="暂无服务商"
            action={{ text: emptyActionText, onClick: handleEmptyAction }}
          />
        ) : (
          providers.map((provider) => (
            <Card
              key={provider.id}
              className="mb-md"
              onClick={() => handleCardClick(provider.id)}
            >
              <ListItem
                title={provider.companyName || provider.nickname}
                description={provider.specialty || '暂无介绍'}
                extra={<View className="text-secondary">{provider.rating?.toFixed(1) || '0.0'}分</View>}
              />
              <View className="mt-sm flex flex-wrap gap-xs px-md pb-md">
                <View className="text-xs text-gray-500">
                  {provider.yearsExperience ? `${provider.yearsExperience}年经验` : '新入驻'}
                  {' · '}
                  {provider.reviewCount || 0} 条评价
                </View>
              </View>
            </Card>
          ))
        )}

        {loading && page > 1 && (
          <View className="text-center py-md text-gray-400 text-sm">加载中...</View>
        )}

        {!hasMore && providers.length > 0 && (
          <View className="text-center py-md text-gray-400 text-sm">没有更多了</View>
        )}
      </View>
    </View>
  );
}
