import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';
import { Cell, Empty } from '@nutui/nutui-react-taro';
import { Skeleton } from '@/components/Skeleton';
import { inspirationService, type CaseQuote } from '@/services/inspiration';
import { useAuthStore } from '@/store/auth';

const CaseQuotePage: React.FC = () => {
  const auth = useAuthStore();
  const [quote, setQuote] = useState<CaseQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [id, setId] = useState<number>(0);

  useLoad((options) => {
    if (options.id) {
      setId(Number(options.id));
    }
  });

  useEffect(() => {
    if (!id) return;
    const fetch = async () => {
      setLoading(true);
      try {
        const quoteRes = await inspirationService.getQuote(id);
        setQuote(quoteRes);
      } catch (error) {
        console.error(error);
        Taro.showToast({ title: '加载失败', icon: 'none' });
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [id]);

  if (loading) return (
    <View className="p-md bg-gray-50 min-h-screen">
      <Skeleton height={200} className="mb-md" />
      <Skeleton height={400} />
    </View>
  );

  if (!quote) return (
    <View className="p-md">
      <Empty description="暂无报价数据" />
    </View>
  );

  return (
    <View className="page bg-gray-50 min-h-screen pb-md">
      <ScrollView scrollY className="h-full">
        <View className="bg-white p-md mb-md">
          <View className="text-xl font-bold mb-md">案例报价</View>

          <View className="bg-gray-50 p-md rounded">
            <View className="flex justify-between items-center">
              <Text className="text-gray-500">总计</Text>
              <Text className="text-2xl font-bold text-brand">¥{quote.totalAmount.toLocaleString()}</Text>
            </View>
          </View>
        </View>

        <View className="bg-white">
          <View className="px-md py-sm border-b border-gray-100">
            <Text className="font-bold">报价明细</Text>
          </View>

          {quote.items && quote.items.length > 0 ? (
            <View>
              {quote.items.map((item, index) => (
                <Cell
                  key={index}
                  title={item.name}
                  description={item.description || `${item.quantity} ${item.unit} × ¥${item.unitPrice.toLocaleString()}`}
                  extra={
                    <View className="text-right">
                      <View className="font-bold">¥{item.totalPrice.toLocaleString()}</View>
                    </View>
                  }
                />
              ))}
            </View>
          ) : (
            <View className="p-md text-center text-gray-400">暂无报价明细</View>
          )}
        </View>

        {quote.notes && (
          <View className="bg-white mt-md p-md">
            <View className="text-sm font-bold mb-xs">备注</View>
            <Text className="text-sm text-gray-500">{quote.notes}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

export default CaseQuotePage;
