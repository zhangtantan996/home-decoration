import React, { useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, Text, View } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';

import { Button } from '@/components/Button';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import { loadTinodeService } from '@/services/loadTinodeService';
import { getProviderDetail, type ProviderDetail, type ProviderType } from '@/services/providers';
import { refreshTinodeToken } from '@/services/tinode';
import { useAuthStore } from '@/store/auth';
import { showErrorToast } from '@/utils/error';
import { formatProviderPricing } from '@/utils/providerPricing';

const normalizeProviderType = (value?: string): ProviderType => {
  if (value === 'company' || value === '2') {
    return 'company';
  }
  if (value === 'foreman' || value === '3') {
    return 'foreman';
  }
  return 'designer';
};

const parseStringList = (raw?: string): string[] => {
  if (!raw) {
    return [];
  }
  const text = raw.trim();
  if (!text) {
    return [];
  }
  if (text.startsWith('[') && text.endsWith(']')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
    } catch {
      // fallback
    }
  }
  if (text.includes(' · ')) {
    return text.split(' · ').map((item) => item.trim()).filter(Boolean);
  }
  return text.split(',').map((item) => item.trim()).filter(Boolean);
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

  const providerDetail = useMemo(() => ((detail as { provider?: ProviderDetail })?.provider || detail || null), [detail]);
  const userDetail = useMemo(() => ((detail as { user?: { id?: number; publicId?: string; nickname?: string; avatar?: string } })?.user || null), [detail]);

  const serviceAreaTags = useMemo(() => {
    const parsed = parseStringList(providerDetail?.serviceArea);
    return parsed.length > 0 ? parsed : ['本地服务'];
  }, [providerDetail?.serviceArea]);

  const highlightTags = useMemo(
    () => parseStringList(providerDetail?.highlightTags),
    [providerDetail?.highlightTags]
  );

  const quoteDisplay = useMemo(
    () => formatProviderPricing({
      role: params.type,
      pricingJson: providerDetail?.pricingJson,
      priceMin: providerDetail?.priceMin,
      priceMax: providerDetail?.priceMax,
      priceUnit: providerDetail?.priceUnit,
    }).quoteDisplay,
    [params.type, providerDetail?.pricingJson, providerDetail?.priceMax, providerDetail?.priceMin, providerDetail?.priceUnit]
  );

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

    const providerName = encodeURIComponent(userDetail?.nickname || providerDetail?.nickname || providerDetail?.companyName || '服务商');
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

    const providerUserID = providerDetail?.userId || userDetail?.id;
    if (!providerUserID) {
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

      const TinodeService = await loadTinodeService();
      const tinodeUserId = await TinodeService.resolveTinodeUserId(providerUserID);
      const providerName = userDetail?.nickname || providerDetail?.nickname || providerDetail?.companyName || '服务商';
      const avatarUrl = userDetail?.avatar || providerDetail?.avatar || providerDetail?.coverImage || '';

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

  const displayName = userDetail?.nickname || providerDetail?.nickname || providerDetail?.companyName || '服务商';
  const avatarUrl = userDetail?.avatar || providerDetail?.avatar || providerDetail?.coverImage || detail.coverImage || '';
  const establishedYears = providerDetail?.establishedYear
    ? Math.max(1, new Date().getFullYear() - providerDetail.establishedYear)
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
              <View className="text-lg font-bold mb-xs">{displayName}</View>
              <View className="flex flex-row items-center text-sm text-gray-500">
                <Text className="text-primary font-bold mr-sm">{providerDetail?.rating?.toFixed(1) || '5.0'}分</Text>
                <Text className="mr-sm">·</Text>
                <Text>{providerDetail?.completedCnt || 0} 单成交</Text>
              </View>
            </View>
          </View>

          <View className="mt-md flex flex-wrap gap-xs">
            {providerDetail?.verified ? <Tag variant="primary">已认证</Tag> : null}
            {highlightTags.map((tag) => (
              <Tag key={`highlight-${tag}`} variant="secondary">{tag}</Tag>
            ))}
          </View>
        </View>

        <View className="bg-white p-md mb-sm">
          <View className="font-bold mb-md text-base">服务介绍</View>
          <View className="text-gray-600 leading-relaxed text-sm">
            {providerDetail?.serviceIntro || '暂无详细介绍'}
          </View>
        </View>

        <View className="bg-white p-md mb-sm">
          <View className="font-bold mb-md text-base">详细信息</View>
          <View className="space-y-sm">
            <View className="flex justify-between text-sm py-xs border-b border-gray-100">
              <Text className="text-gray-500">擅长风格</Text>
              <Text>{providerDetail?.specialty || '-'}</Text>
            </View>
            <View className="flex justify-between text-sm py-xs border-b border-gray-100">
              <Text className="text-gray-500">服务区域</Text>
              <Text>{serviceAreaTags.join('、')}</Text>
            </View>
            {providerDetail?.graduateSchool ? (
              <View className="flex justify-between text-sm py-xs border-b border-gray-100">
                <Text className="text-gray-500">毕业院校</Text>
                <Text>{providerDetail.graduateSchool}</Text>
              </View>
            ) : null}
            {providerDetail?.designPhilosophy ? (
              <View className="text-sm py-xs border-b border-gray-100">
                <Text className="text-gray-500 mb-xs">理念说明</Text>
                <Text>{providerDetail.designPhilosophy}</Text>
              </View>
            ) : null}
            {establishedYears ? (
              <View className="flex justify-between text-sm py-xs border-b border-gray-100">
                <Text className="text-gray-500">从业年限</Text>
                <Text>{establishedYears}年</Text>
              </View>
            ) : null}
          </View>
        </View>

        {quoteDisplay ? (
          <View className="bg-white p-md mb-xl">
            <View className="text-gray-500 text-sm mb-xs">{quoteDisplay.title}</View>
            <View className="text-brand font-bold text-lg leading-normal">
              {quoteDisplay.primary}
            </View>
            {quoteDisplay.secondary ? (
              <View className="text-sm text-gray-500 mt-xs leading-relaxed">
                {quoteDisplay.secondary}
              </View>
            ) : null}
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
