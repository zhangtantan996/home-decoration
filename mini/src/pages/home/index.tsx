import Taro from '@tarojs/taro';
import { View } from '@tarojs/components';
import React, { useEffect, useState } from 'react';
import { Card } from '@/components/Card';
import { Empty } from '@/components/Empty';
import { Button } from '@/components/Button';
import { ListItem } from '@/components/ListItem';
import { Skeleton } from '@/components/Skeleton';
import { useAuthStore } from '@/store/auth';
import { listProviders, type ProviderListItem } from '@/services/providers';
import { listProjects, type ProjectItem } from '@/services/projects';

export default function Home() {
  const auth = useAuthStore();
  const [providers, setProviders] = useState<ProviderListItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [loadingProjects, setLoadingProjects] = useState(false);

  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const data = await listProviders({ page: 1, pageSize: 3, sortBy: 'rating' });
        setProviders(data.list || []);
      } catch (err) {
        Taro.showToast({ title: err instanceof Error ? err.message : '加载失败', icon: 'none' });
      } finally {
        setLoadingProviders(false);
      }
    };

    fetchProviders();
  }, []);

  useEffect(() => {
    if (!auth.token) {
      setProjects([]);
      return;
    }

    const fetchProjects = async () => {
      setLoadingProjects(true);
      try {
        const data = await listProjects(1, 3);
        setProjects(data.list || []);
      } catch (err) {
        Taro.showToast({ title: err instanceof Error ? err.message : '加载失败', icon: 'none' });
      } finally {
        setLoadingProjects(false);
      }
    };

    fetchProjects();
  }, [auth.token]);

  return (
    <View className="page">
      <View className="m-md">
        <View className="text-primary font-bold" style={{ fontSize: '40rpx', marginBottom: '24rpx' }}>
          精选推荐
        </View>

        <Card
          title="推荐服务商"
          extra={
            <View
              className="text-brand"
              onClick={() => Taro.navigateTo({ url: '/pages/providers/list/index' })}
            >
              查看更多
            </View>
          }
        >
          {loadingProviders ? (
            <View className="p-sm">
              <View className="mb-sm"><Skeleton width="80%" /></View>
              <View className="mb-sm"><Skeleton width="60%" /></View>
              <View><Skeleton width="70%" /></View>
            </View>
          ) : providers.length === 0 ? (
            <Empty description="暂无推荐服务商" />
          ) : (
            providers.map((provider) => (
              <ListItem
                key={provider.id}
                title={provider.companyName || provider.nickname}
                description={provider.specialty || '暂无介绍'}
                extra={<View className="text-secondary">{provider.rating?.toFixed(1) || '0.0'}分</View>}
              />
            ))
          )}
        </Card>

        <Card title="我的项目">
          {!auth.token ? (
            <ListItem
              title="您还未登录"
              description="登录后查看项目进度"
              extra={
                <Button size="sm" variant="primary">去登录</Button>
              }
              onClick={() => Taro.navigateTo({ url: '/pages/profile/index' })}
            />
          ) : loadingProjects ? (
            <View className="p-sm">
              <Skeleton width="70%" />
            </View>
          ) : projects.length === 0 ? (
            <Empty description="暂无项目" />
          ) : (
            projects.map((project) => (
              <ListItem
                key={project.id}
                title={project.name || '项目'}
                description={project.address || '暂无地址'}
                arrow
                onClick={() =>
                  Taro.navigateTo({ url: `/pages/projects/detail/index?id=${project.id}` })
                }
              />
            ))
          )}
        </Card>

        <Card
          title="待支付订单"
          extra={
            <View
              className="text-brand"
              onClick={() => Taro.navigateTo({ url: '/pages/orders/pending/index' })}
            >
              查看全部
            </View>
          }
        >
          {!auth.token ? (
            <ListItem
              title="登录后查看待支付订单"
              description="完成支付后进入施工阶段"
              onClick={() => Taro.navigateTo({ url: '/pages/profile/index' })}
            />
          ) : (
            <ListItem
              title="查看待支付订单"
              description="点击进入待支付列表"
              arrow
              onClick={() => Taro.navigateTo({ url: '/pages/orders/pending/index' })}
            />
          )}
        </Card>
      </View>
    </View>
  );
}
