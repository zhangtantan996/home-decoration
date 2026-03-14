import Taro from '@tarojs/taro';
import { View } from '@tarojs/components';
import React, { useEffect, useState } from 'react';
import { SearchBar, Tabs, Cell, Empty, Skeleton, Button } from '@nutui/nutui-react-taro';
import { Star } from '@nutui/icons-react-taro';

import { Card } from '@/components/Card';
import { listProjects, type ProjectItem } from '@/services/projects';
import { listProviders, type ProviderListItem, type ProviderType } from '@/services/providers';
import { useAuthStore } from '@/store/auth';
import { showErrorToast } from '@/utils/error';

const getProviderType = (providerType: number): ProviderType => {
  if (providerType === 2) {
    return 'company';
  }
  if (providerType === 3) {
    return 'foreman';
  }
  return 'designer';
};

const getProviderName = (provider: ProviderListItem) => {
  return provider.companyName || provider.nickname || '服务商';
};

export default function Home() {
  const auth = useAuthStore();
  const [providers, setProviders] = useState<ProviderListItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [activeTab, setActiveTab] = useState('0');

  const providerTypes = [
    { title: '全部', value: '0' },
    { title: '设计师', value: '1' },
    { title: '装修公司', value: '2' },
    { title: '工长', value: '3' },
  ];

  useEffect(() => {
    fetchProviders();
  }, [activeTab]);

  const fetchProviders = async () => {
    setLoadingProviders(true);
    try {
      const params: any = { page: 1, pageSize: 10, sortBy: 'rating' };
      if (activeTab !== '0') {
        params.type = parseInt(activeTab);
      }
      const data = await listProviders(params);
      setProviders(data.list || []);
    } catch (err) {
      showErrorToast(err, '加载失败');
    } finally {
      setLoadingProviders(false);
    }
  };

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
        showErrorToast(err, '加载失败');
      } finally {
        setLoadingProjects(false);
      }
    };

    fetchProjects();
  }, [auth.token]);

  const handleSearch = () => {
    if (!searchValue.trim()) {
      Taro.showToast({ title: '请输入搜索关键词', icon: 'none' });
      return;
    }
    Taro.navigateTo({
      url: `/pages/providers/list/index?keyword=${encodeURIComponent(searchValue)}`,
    });
  };

  const handleProviderClick = (provider: ProviderListItem) => {
    const providerName = encodeURIComponent(getProviderName(provider));
    const providerType = getProviderType(provider.providerType);
    Taro.navigateTo({
      url: `/pages/providers/detail/index?id=${provider.id}&type=${providerType}&providerName=${providerName}`,
    });
  };

  return (
    <View className="page">
      <View className="m-md">
        <View className="text-primary font-bold" style={{ fontSize: '40rpx', marginBottom: '24rpx' }}>
          精选推荐
        </View>

        {/* 搜索框 */}
        <View style={{ marginBottom: '24rpx' }}>
          <SearchBar
            placeholder="搜索设计师、装修公司、工长"
            value={searchValue}
            onChange={(val) => setSearchValue(val)}
            onSearch={handleSearch}
          />
        </View>

        {/* 分类 Tabs */}
        <Tabs
          value={activeTab}
          onChange={(value) => setActiveTab(value as string)}
          style={{ marginBottom: '24rpx' }}
        >
          {providerTypes.map((type) => (
            <Tabs.TabPane key={type.value} title={type.title} value={type.value} />
          ))}
        </Tabs>

        {/* 服务商列表 */}
        <Card title="推荐服务商">
          {loadingProviders ? (
            <View className="p-sm">
              <Skeleton rows={3} animated />
            </View>
          ) : providers.length === 0 ? (
            <Empty description="暂无推荐服务商" />
          ) : (
            providers.map((provider) => (
              <Cell
                key={provider.id}
                title={getProviderName(provider)}
                description={provider.specialty || '暂无介绍'}
                extra={
                  <View style={{ display: 'flex', alignItems: 'center', color: '#D4AF37' }}>
                    <Star size="14" />
                    <View style={{ marginLeft: '4rpx' }}>{provider.rating?.toFixed(1) || '0.0'}</View>
                  </View>
                }
                onClick={() => handleProviderClick(provider)}
              />
            ))
          )}
        </Card>

        {/* 我的项目 */}
        <Card title="我的项目" style={{ marginTop: '24rpx' }}>
          {!auth.token ? (
            <Cell
              title="您还未登录"
              description="登录后查看项目进度"
              extra={<Button size="small" type="primary">去登录</Button>}
              onClick={() => Taro.switchTab({ url: '/pages/profile/index' })}
            />
          ) : loadingProjects ? (
            <View className="p-sm">
              <Skeleton rows={2} animated />
            </View>
          ) : projects.length === 0 ? (
            <Empty description="暂无项目" />
          ) : (
            projects.map((project) => (
              <Cell
                key={project.id}
                title={project.name || '项目'}
                description={project.address || '暂无地址'}
                onClick={() => Taro.navigateTo({ url: `/pages/projects/detail/index?id=${project.id}` })}
              />
            ))
          )}
        </Card>

        {/* 待支付订单 */}
        <Card
          title="待支付订单"
          style={{ marginTop: '24rpx' }}
          extra={
            <View className="text-brand" onClick={() => Taro.navigateTo({ url: '/pages/orders/pending/index' })}>
              查看全部
            </View>
          }
        >
          {!auth.token ? (
            <Cell
              title="登录后查看待支付订单"
              description="完成支付后进入施工阶段"
              onClick={() => Taro.switchTab({ url: '/pages/profile/index' })}
            />
          ) : (
            <Cell
              title="查看待支付订单"
              description="点击进入待支付列表"
              onClick={() => Taro.navigateTo({ url: '/pages/orders/pending/index' })}
            />
          )}
        </Card>
      </View>
    </View>
  );
}
