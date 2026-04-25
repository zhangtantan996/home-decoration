// Legacy compatibility only: quote-pk 主链已退役。
// 当前页面不在运行时入口，仅保留历史代码供兼容排查。
import React, { useEffect, useState } from 'react';
import { Image, Text, View } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Empty } from '@/components/Empty';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import { getQuoteComparison, selectQuote, type QuoteComparisonItem } from '@/services/quote-pk';
import { useAuthStore } from '@/store/auth';
import { showErrorToast } from '@/utils/error';

const QuoteComparisonPage: React.FC = () => {
  const auth = useAuthStore();
  const [taskId, setTaskId] = useState(0);
  const [items, setItems] = useState<QuoteComparisonItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(false);

  useLoad((options) => {
    if (options.id) {
      setTaskId(Number(options.id));
    }
  });

  useEffect(() => {
    if (!taskId || !auth.token) {
      setLoading(false);
      return;
    }

    const fetchComparison = async () => {
      setLoading(true);
      try {
        const data = await getQuoteComparison(taskId);
        setItems(data);
      } catch (error) {
        showErrorToast(error, '加载失败');
      } finally {
        setLoading(false);
      }
    };

    void fetchComparison();
  }, [auth.token, taskId]);

  const handleSelect = async (submissionId: number) => {
    if (selecting) return;

    Taro.showModal({
      title: '确认选择',
      content: '选择后将无法更改，确定选择此报价吗？',
      success: async (res) => {
        if (!res.confirm) return;

        setSelecting(true);
        try {
          await selectQuote(taskId, submissionId);
          Taro.showToast({ title: '选择成功', icon: 'success' });
          setTimeout(() => {
            Taro.navigateBack();
          }, 800);
        } catch (error) {
          showErrorToast(error, '选择失败');
        } finally {
          setSelecting(false);
        }
      },
    });
  };

  if (loading) {
    return (
      <View className="min-h-screen bg-gray-50 p-4">
        <Skeleton row={3} />
      </View>
    );
  }

  if (!items.length) {
    return (
      <View className="min-h-screen bg-gray-50">
        <Empty description="暂无报价，请等待工长提交报价" />
      </View>
    );
  }

  return (
    <View className="min-h-screen bg-gray-50 p-4">
      <Text className="text-lg font-semibold mb-4">报价对比</Text>
      <Text className="text-sm text-gray-600 mb-4">
        已收到 {items.length} 个报价，请选择最合适的方案
      </Text>

      {items.map((item) => (
        <Card key={item.submissionId} className="mb-4">
          <View className="flex items-center mb-4">
            <Image
              src={item.providerAvatar}
              className="w-12 h-12 rounded-full mr-3"
            />
            <View className="flex-1">
              <Text className="text-base font-semibold">{item.providerName}</Text>
              <View className="flex items-center mt-1">
                <Tag variant="warning">
                  评分 {item.rating.toFixed(1)}
                </Tag>
                <Tag variant="secondary" className="ml-2">
                  {item.yearsExperience}年经验
                </Tag>
                <Tag variant="success" className="ml-2">
                  完成{item.completedCnt}单
                </Tag>
              </View>
            </View>
          </View>

          <View className="border-t pt-4">
            <View className="flex justify-between mb-2">
              <Text className="text-gray-600">总价</Text>
              <Text className="text-xl font-bold text-primary">
                ¥{item.totalPrice.toLocaleString()}
              </Text>
            </View>
            <View className="flex justify-between mb-2">
              <Text className="text-gray-600">工期</Text>
              <Text className="text-base">{item.duration}天</Text>
            </View>
            {item.materials && (
              <View className="mb-2">
                <Text className="text-gray-600">材料清单</Text>
                <Text className="text-sm text-gray-700 mt-1">{item.materials}</Text>
              </View>
            )}
            {item.description && (
              <View className="mb-2">
                <Text className="text-gray-600">报价说明</Text>
                <Text className="text-sm text-gray-700 mt-1">{item.description}</Text>
              </View>
            )}
            <Text className="text-xs text-gray-500">
              提交时间：{item.submittedAt}
            </Text>
          </View>

          {item.status === 'pending' && (
            <Button
              type="primary"
              size="small"
              onClick={() => handleSelect(item.submissionId)}
              disabled={selecting}
              className="mt-4 w-full"
            >
              选择此报价
            </Button>
          )}
          {item.status === 'selected' && (
            <Tag variant="success" className="mt-4">
              已选择
            </Tag>
          )}
          {item.status === 'rejected' && (
            <Tag variant="default" className="mt-4">
              未选择
            </Tag>
          )}
        </Card>
      ))}
    </View>
  );
};

export default QuoteComparisonPage;
