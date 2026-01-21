import Taro from '@tarojs/taro';
import { View, ScrollView } from '@tarojs/components';
import React, { useEffect, useState } from 'react';
import { Card } from '@/components/Card';
import { Empty } from '@/components/Empty';
import { Tag } from '@/components/Tag';
import { ListItem } from '@/components/ListItem';
import { Skeleton } from '@/components/Skeleton';
import { listProviders, getProviderCases, type ProviderListItem, type ProviderCaseItem } from '@/services/providers';
import { useAuthStore } from '@/store/auth';

const STYLES = ['现代', '原木', '极简', '侘寂', '美式', '法式'];

export default function Inspiration() {
  const auth = useAuthStore();
  const [cases, setCases] = useState<ProviderCaseItem[]>([]);
  const [loadingCases, setLoadingCases] = useState(true);

  useEffect(() => {
    const fetchCases = async () => {
      try {
        const providerData = await listProviders({ page: 1, pageSize: 1 });
        const provider = providerData.list?.[0] as ProviderListItem | undefined;
        if (!provider) {
          setCases([]);
          return;
        }

        const providerType = provider.providerType === 1
          ? 'designer'
          : provider.providerType === 2
            ? 'company'
            : 'foreman';

        const caseData = await getProviderCases(providerType, provider.id, 1, 6);
        setCases(caseData.list || []);
      } catch (err) {
        Taro.showToast({ title: err instanceof Error ? err.message : '加载失败', icon: 'none' });
      } finally {
        setLoadingCases(false);
      }
    };

    fetchCases();
  }, [auth.token]);

  return (
    <View className="page">
      <View className="m-md">
        <View className="text-primary font-bold" style={{ fontSize: '40rpx', marginBottom: '24rpx' }}>
          灵感合集
        </View>

        <Card title="热门风格" className="mb-lg">
          <ScrollView scrollX style={{ whiteSpace: 'nowrap', width: '100%' }}>
            {STYLES.map((style) => (
              <View key={style} style={{ display: 'inline-block', marginRight: '16rpx' }}>
                <Tag variant="secondary" className="px-lg py-sm" style={{ fontSize: '28rpx', padding: '12rpx 32rpx' }}>
                  {style}
                </Tag>
              </View>
            ))}
          </ScrollView>
        </Card>

        <Card
          title="精选案例"
          extra={
            <View
              className="text-brand"
              onClick={() => Taro.navigateTo({ url: '/pages/providers/list/index' })}
            >
              查看服务商
            </View>
          }
        >
          {loadingCases ? (
            <View className="p-sm">
              <View className="mb-sm"><Skeleton width="80%" /></View>
              <View className="mb-sm"><Skeleton width="60%" /></View>
              <View><Skeleton width="70%" /></View>
            </View>
          ) : cases.length === 0 ? (
            <Empty description="暂无案例数据" />
          ) : (
            cases.map((item) => (
              <ListItem
                key={item.id}
                title={item.title}
                description={item.style ? `${item.style} · ${item.area ?? ''}` : '暂无风格信息'}
                arrow
                onClick={() => Taro.navigateTo({ url: '/pages/providers/list/index' })}
              />
            ))
          )}
        </Card>
      </View>
    </View>
  );
}
