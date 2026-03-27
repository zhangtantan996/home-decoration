import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';

import { Button } from '@/components/Button';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import {
  confirmQuoteTaskSubmission,
  getQuoteTaskDetail,
  rejectQuoteTaskSubmission,
  type QuoteTaskDetail,
} from '@/services/quoteTasks';
import { useAuthStore } from '@/store/auth';
import { showErrorToast } from '@/utils/error';

const QuoteTaskDetailPage: React.FC = () => {
  const auth = useAuthStore();
  const [id, setId] = useState(0);
  const [detail, setDetail] = useState<QuoteTaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useLoad((options) => {
    if (options.id) {
      setId(Number(options.id));
    }
  });

  const fetchDetail = async () => {
    if (!id) return;
    if (!auth.token) {
      setDetail(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await getQuoteTaskDetail(id);
      setDetail(res);
    } catch (error) {
      showErrorToast(error, '加载施工报价失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchDetail();
  }, [id, auth.token]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConfirm = async () => {
    if (!detail || submitting) return;
    try {
      setSubmitting(true);
      const result = await confirmQuoteTaskSubmission(detail.submissionId);
      Taro.showToast({ title: result.message || '已确认施工报价', icon: 'success' });
      Taro.switchTab({ url: '/pages/progress/index' });
    } catch (error) {
      showErrorToast(error, '确认失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!detail || submitting) return;

    Taro.showModal({
      title: '驳回施工报价',
      content: '如需重新报价，请补充原因。',
      editable: true,
      placeholderText: '请输入驳回原因',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          setSubmitting(true);
          await rejectQuoteTaskSubmission(detail.submissionId, res.content || '用户要求重新报价');
          Taro.showToast({ title: '已退回重报', icon: 'success' });
          await fetchDetail();
        } catch (error) {
          showErrorToast(error, '驳回失败');
        } finally {
          setSubmitting(false);
        }
      },
    });
  };

  if (!auth.token) {
    return <View className="p-md text-center text-gray-500">登录后查看施工报价</View>;
  }

  if (loading) {
    return (
      <View className="p-md bg-gray-50 min-h-screen">
        <Skeleton height={220} className="mb-md" />
        <Skeleton height={220} className="mb-md" />
        <Skeleton height={120} />
      </View>
    );
  }

  if (!detail) {
    return <View className="p-md text-center text-gray-500">未找到施工报价任务</View>;
  }

  return (
    <View className="page bg-gray-50 min-h-screen pb-xl">
      <ScrollView scrollY className="h-full">
        <View className="bg-white p-md mb-sm flex justify-between items-center">
          <View>
            <View className="text-lg font-bold mb-xs">{detail.title}</View>
            <View className="text-sm text-gray-500">施工报价确认页，确认后才会创建项目。</View>
          </View>
          <Tag variant="warning">{detail.status}</Tag>
        </View>

        {detail.flowSummary ? (
          <View className="bg-amber-50 border border-amber-200 rounded-lg p-md mx-md mb-sm">
            <Text className="text-sm text-amber-800">{detail.flowSummary}</Text>
          </View>
        ) : null}

        <View className="bg-white p-md mb-sm">
          <View className="font-bold mb-md text-base">任务摘要</View>
          <View className="space-y-sm">
            <View className="flex justify-between text-sm py-xs border-b border-gray-100">
              <Text className="text-gray-500">施工总价</Text>
              <Text>¥{detail.totalAmount.toLocaleString()}</Text>
            </View>
            <View className="flex justify-between text-sm py-xs border-b border-gray-100">
              <Text className="text-gray-500">预计工期</Text>
              <Text>{detail.estimatedDays > 0 ? `${detail.estimatedDays} 天` : '待补充'}</Text>
            </View>
            <View className="flex justify-between text-sm py-xs border-b border-gray-100">
              <Text className="text-gray-500">面积</Text>
              <Text>{detail.taskSummary.area ? `${detail.taskSummary.area}㎡` : '待补充'}</Text>
            </View>
            <View className="flex justify-between text-sm py-xs">
              <Text className="text-gray-500">户型</Text>
              <Text>{detail.taskSummary.layout || '待补充'}</Text>
            </View>
          </View>
        </View>

        <View className="bg-white p-md mb-xl">
          <View className="font-bold mb-md text-base">施工清单</View>
          {detail.items.length === 0 ? (
            <View className="text-sm text-gray-500">暂无施工清单</View>
          ) : (
            <View className="space-y-sm">
              {detail.items.map((item) => (
                <View key={item.id} className="border border-gray-100 rounded-lg p-sm">
                  <View className="flex justify-between items-start mb-xs">
                    <Text className="font-medium">清单项 #{item.quoteListItemId}</Text>
                    <Text className="text-brand font-bold">¥{item.amount.toLocaleString()}</Text>
                  </View>
                  <View className="text-sm text-gray-500">单价：¥{item.unitPrice.toLocaleString()}</View>
                  {item.remark ? <View className="text-sm text-gray-500 mt-xs">{item.remark}</View> : null}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <View className="fixed bottom-0 left-0 right-0 bg-white p-md shadow-top safe-area-bottom flex gap-md">
        <Button variant="secondary" onClick={handleReject} className="flex-1" disabled={submitting}>
          驳回重报
        </Button>
        <Button variant="primary" onClick={handleConfirm} className="flex-1" disabled={submitting} loading={submitting}>
          确认施工报价
        </Button>
      </View>
    </View>
  );
};

export default QuoteTaskDetailPage;
