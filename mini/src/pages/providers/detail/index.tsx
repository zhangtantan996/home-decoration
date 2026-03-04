import React, { useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, Text, View } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';

import { Button } from '@/components/Button';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import TinodeService from '@/services/TinodeService';
import { getProviderDetail, type ProviderDetail, type ProviderType } from '@/services/providers';
import { refreshTinodeToken } from '@/services/tinode';
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

interface ProviderDetailParams {
  id: string;
  type: ProviderType;
}

const ProviderDetailPage: React.FC = () => {
  const auth = useAuthStore();
  const [detail, setDetail] = useState<ProviderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [consulting, setConsulting] = useState(false);
  const [params, setParams] = useState<ProviderDetailParams>({ id: '', type: 'designer' });

  useLoad((options) => {
    if (options.id) {
      setParams({
        id: options.id,
        type: normalizeProviderType(options.type),
      });
    }
  });

  useEffect(() => {
    if (!params.id) {
      return;
    }

    const fetchDetail = async () => {
      setLoading(true);
      try {
        const res = await getProviderDetail(params.type, Number(params.id));
        setDetail(res);
      } catch (error) {
        showErrorToast(error, '加载失败');
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [params.id, params.type]);

  const workTypeTags = useMemo(() => {
    if (!detail?.workTypes) {
      return [];
    }
    const raw = detail.workTypes.trim();
    if (!raw) {
      return [];
    }

    if (raw.startsWith('[') && raw.endsWith(']')) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.map((item) => String(item).trim()).filter(Boolean);
        }
      } catch {
        // fallback to split parsing
      }
    }

    return raw.split(',').map((item) => item.trim()).filter(Boolean);
  }, [detail?.workTypes]);

  const handleBook = () => {
    if (!auth.token) {
      Taro.showToast({ title: '请先登录', icon: 'none' });
      Taro.switchTab({ url: '/pages/profile/index' });
      return;
    }

    if (!detail || !params.id) {
      Taro.showToast({ title: '服务商信息异常', icon: 'none' });
      return;
    }

    const providerName = encodeURIComponent(detail.nickname || detail.companyName || '服务商');
    Taro.navigateTo({
      url: `/pages/booking/create/index?providerId=${params.id}&providerName=${providerName}&type=${params.type}`,
    });
  };

  const handleConsult = async () => {
    if (!auth.token) {
      Taro.showToast({ title: '请先登录', icon: 'none' });
      Taro.switchTab({ url: '/pages/profile/index' });
      return;
    }

    if (!detail?.userId) {
      Taro.showToast({ title: '服务商信息异常', icon: 'none' });
      return;
    }

    setConsulting(true);
    try {
      let tinodeToken = auth.tinodeToken;
      if (!tinodeToken) {
        const res = await refreshTinodeToken();
        useAuthStore.getState().updateTinodeAuth(res);
        tinodeToken = res.tinodeToken;
        if (!tinodeToken) {
          Taro.showToast({ title: res.tinodeError || '聊天暂不可用', icon: 'none' });
          return;
        }
      }

      const tinodeUserId = await TinodeService.resolveTinodeUserId(detail.userId);
      const providerName = detail.nickname || detail.companyName || '服务商';
      const avatarUrl = detail.avatar || detail.coverImage || '';

      const parts = [`topic=${encodeURIComponent(tinodeUserId)}`, `name=${encodeURIComponent(providerName)}`];
      if (avatarUrl) {
        parts.push(`avatar=${encodeURIComponent(avatarUrl)}`);
      }

      Taro.navigateTo({ url: `/pages/chat/index?${parts.join('&')}` });
    } catch (error) {
      showErrorToast(error, '打开聊天失败');
    } finally {
      setConsulting(false);
    }
  };

  if (loading) {
    return (
      <View className="page bg-white p-md">
        <View className="flex flex-row mb-md">
          <Skeleton width="120rpx" height="120rpx" className="mr-md" />
          <View className="flex-1">
            <View className="mb-sm"><Skeleton width="60%" /></View>
            <View><Skeleton width="40%" /></View>
          </View>
        </View>
        <Skeleton row={5} />
      </View>
    );
  }

  if (!detail) {
    return <View className="p-md text-center text-gray-500">未找到服务商信息</View>;
  }

  const avatarUrl = detail.avatar || detail.coverImage || '';
  const establishedYears = detail.establishedYear
    ? Math.max(1, new Date().getFullYear() - detail.establishedYear)
    : undefined;

  return (
    <View className="page bg-gray-50 min-h-screen pb-xl">
      <ScrollView scrollY className="h-full">
        <View className="bg-white p-md mb-sm">
          <View className="flex flex-row items-center">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                className="rounded-full bg-gray-200"
                style={{ width: '120rpx', height: '120rpx' }}
                mode="aspectFill"
              />
            ) : (
              <View
                className="rounded-full bg-gray-200"
                style={{ width: '120rpx', height: '120rpx' }}
              />
            )}

            <View className="ml-md flex-1">
              <View className="text-lg font-bold mb-xs">{detail.nickname || detail.companyName}</View>
              <View className="flex flex-row items-center text-sm text-gray-500">
                <Text className="text-primary font-bold mr-sm">{detail.rating?.toFixed(1) || '5.0'}分</Text>
                <Text className="mr-sm">·</Text>
                <Text>{detail.completedCnt || 0} 单成交</Text>
              </View>
            </View>
          </View>

          <View className="mt-md flex flex-wrap gap-xs">
            {detail.verified ? <Tag variant="primary">已认证</Tag> : null}
            {workTypeTags.map((type) => (
              <Tag key={type} variant="secondary">{type}</Tag>
            ))}
          </View>
        </View>

        <View className="bg-white p-md mb-sm">
          <View className="font-bold mb-md text-base">服务介绍</View>
          <View className="text-gray-600 leading-relaxed text-sm">
            {detail.serviceIntro || '暂无详细介绍'}
          </View>
        </View>

        <View className="bg-white p-md mb-sm">
          <View className="font-bold mb-md text-base">详细信息</View>
          <View className="space-y-sm">
            <View className="flex justify-between text-sm py-xs border-b border-gray-100">
              <Text className="text-gray-500">擅长风格</Text>
              <Text>{detail.specialty || '-'}</Text>
            </View>
            <View className="flex justify-between text-sm py-xs border-b border-gray-100">
              <Text className="text-gray-500">服务区域</Text>
              <Text>{detail.serviceArea || '本地'}</Text>
            </View>
            {establishedYears ? (
              <View className="flex justify-between text-sm py-xs border-b border-gray-100">
                <Text className="text-gray-500">从业年限</Text>
                <Text>{establishedYears}年</Text>
              </View>
            ) : null}
          </View>
        </View>

        {detail.priceMin !== undefined ? (
          <View className="bg-white p-md mb-xl">
            <View className="font-bold mb-md text-base">参考价格</View>
            <View className="text-brand font-bold text-lg">
              ¥{detail.priceMin} - ¥{detail.priceMax}
              <Text className="text-sm text-gray-500 font-normal ml-xs">
                {detail.priceUnit ? `/${detail.priceUnit}` : ''}
              </Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View className="fixed bottom-0 left-0 right-0 bg-white p-md shadow-top safe-area-bottom">
        <View className="flex flex-row gap-sm">
          <Button
            onClick={handleConsult}
            size="lg"
            variant="outline"
            loading={consulting}
            className="flex-1"
          >
            在线咨询
          </Button>
          <Button onClick={handleBook} size="lg" variant="brand" className="flex-1">
            立即预约
          </Button>
        </View>
      </View>
    </View>
  );
};

export default ProviderDetailPage;
