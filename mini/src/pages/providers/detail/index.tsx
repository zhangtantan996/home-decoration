import React, { useEffect, useState } from 'react';
import { View, Image, Text, ScrollView } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';
import { Button } from '@/components/Button';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import { getProviderDetail, type ProviderDetail, type ProviderType } from '@/services/providers';
import { useAuthStore } from '@/store/auth';

const ProviderDetailPage: React.FC = () => {
  const auth = useAuthStore();
  const [detail, setDetail] = useState<ProviderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [params, setParams] = useState<{ id: string; type: string }>({ id: '', type: 'designer' });

  useLoad((options) => {
    if (options.id) {
      setParams({ id: options.id, type: options.type || 'designer' });
    }
  });

  useEffect(() => {
    if (!params.id) return;
    const fetchDetail = async () => {
      setLoading(true);
      try {
        const res = await getProviderDetail(params.type as ProviderType, Number(params.id));
        setDetail(res);
      } catch (error) {
        console.error(error);
        Taro.showToast({ title: '加载失败', icon: 'none' });
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [params]);

  const handleBook = () => {
    if (!auth.token) {
      Taro.navigateTo({ url: '/pages/profile/index' });
      return;
    }

    Taro.navigateTo({
      url: `/pages/booking/create/index?providerId=${params.id}&providerName=${detail?.nickname || detail?.companyName}&type=${params.type}`
    });
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

  if (!detail) return <View className="p-md text-center text-gray-500">未找到服务商信息</View>;

  return (
    <View className="page bg-gray-50 min-h-screen pb-xl">
      <ScrollView scrollY className="h-full">
        {/* Header */}
         <View className="bg-white p-md mb-sm">
           <View className="flex flex-row items-center">
             <Image 
               src={detail.avatar || detail.coverImage || ''} 
               className="rounded-full bg-gray-200"
               style={{ width: '120rpx', height: '120rpx' }}
               mode="aspectFill"
             />

            <View className="ml-md flex-1">
              <View className="text-lg font-bold mb-xs">{detail.nickname || detail.companyName}</View>
              <View className="flex flex-row items-center text-sm text-gray-500">
                <Text className="text-primary font-bold mr-sm">{detail.rating?.toFixed(1) || 5.0}分</Text>
                <Text className="mr-sm">·</Text>
                <Text>{detail.completedCnt || 0} 单成交</Text>
              </View>
            </View>
          </View>
          
          <View className="mt-md flex flex-wrap gap-xs">
            {detail.verified && <Tag variant="primary">已认证</Tag>}
            {detail.workTypes?.split(',').map((type, i) => (
               <Tag key={i} variant="secondary">{type}</Tag>
            ))}
          </View>
        </View>

        {/* Info */}
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
             {detail.establishedYear && (
               <View className="flex justify-between text-sm py-xs border-b border-gray-100">
                 <Text className="text-gray-500">从业年限</Text>
                 <Text>{new Date().getFullYear() - detail.establishedYear}年</Text>
               </View>
             )}
          </View>
        </View>

        {/* Price */}
        {detail.priceMin !== undefined && (
           <View className="bg-white p-md mb-xl">
              <View className="font-bold mb-md text-base">参考价格</View>
              <View className="text-brand font-bold text-lg">
                ¥{detail.priceMin} - ¥{detail.priceMax} 
                <Text className="text-sm text-gray-500 font-normal ml-xs">
                  {detail.priceUnit ? `/${detail.priceUnit}` : ''}
                </Text>
              </View>
           </View>
        )}
      </ScrollView>

      {/* Footer */}
       <View className="fixed bottom-0 left-0 right-0 bg-white p-md shadow-top safe-area-bottom">
         <Button onClick={handleBook} size="lg" className="w-full">
           立即预约
         </Button>
       </View>

    </View>
  );
};

export default ProviderDetailPage;
