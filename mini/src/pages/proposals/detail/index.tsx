import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Tag } from '@/components/Tag';
import { Skeleton } from '@/components/Skeleton';
import { getProposalDetail, confirmProposal, rejectProposal, type ProposalItem } from '@/services/proposals';
import { useAuthStore } from '@/store/auth';

const ProposalDetail: React.FC = () => {
  const auth = useAuthStore();
  const [detail, setDetail] = useState<ProposalItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [id, setId] = useState<number>(0);

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
      const res = await getProposalDetail(id);
      setDetail(res);
    } catch (error) {
      console.error(error);
      Taro.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [id, auth.token]);

  const handleConfirm = async () => {
    if (!id) return;
    Taro.showModal({
      title: '确认方案',
      content: '确认接受该设计方案吗？确认后将进入签约流程。',
      success: async (res) => {
        if (res.confirm) {
          try {
            await confirmProposal(id);
            Taro.showToast({ title: '已确认方案', icon: 'success' });
            fetchDetail();
            Taro.switchTab({ url: '/pages/progress/index' });
          } catch (error) {
            Taro.showToast({ title: '操作失败', icon: 'none' });
          }
        }
      }
    });
  };

  const handleReject = async () => {
    if (!id) return;
    Taro.showModal({
      title: '拒绝方案',
      content: '是否拒绝该方案？',
      editable: true,
      placeholderText: '请输入拒绝理由',
      success: async (res) => {
        if (res.confirm) {
          try {
            await rejectProposal(id, res.content || '用户未填写理由');
            Taro.showToast({ title: '已拒绝', icon: 'success' });
            fetchDetail();
          } catch (error) {
            Taro.showToast({ title: '操作失败', icon: 'none' });
          }
        }
      }
    });
  };

  if (!auth.token) {
    return <View className="p-md text-center text-gray-500">登录后查看方案详情</View>;
  }

  if (loading) return (
    <View className="p-md bg-gray-50 min-h-screen">
      <Skeleton height={300} className="mb-md" />
      <Skeleton height={200} className="mb-md" />
      <Skeleton height={100} />
    </View>
  );

  if (!detail) return <View className="p-md text-center text-gray-500">未找到方案</View>;

  const total = (detail.designFee || 0) + (detail.constructionFee || 0) + (detail.materialFee || 0);

  const getStatusConfig = (status: number) => {
    switch(status) {
      case 0: return { label: '待确认', variant: 'warning' as const };
      case 1: return { label: '已接受', variant: 'success' as const };
      case 2: return { label: '已拒绝', variant: 'error' as const };
      case 3: return { label: '修改中', variant: 'brand' as const };
      default: return { label: '未知状态', variant: 'default' as const };
    }
  };
  
  const statusConfig = getStatusConfig(detail.status);

  return (
    <View className="page bg-gray-50 min-h-screen pb-xl">
      <ScrollView scrollY className="h-full">
        {/* Header Status */}
        <View className="bg-white p-md mb-sm flex justify-between items-center">
          <View>
             <View className="text-lg font-bold mb-xs">方案 #{detail.id}</View>
             <View className="text-sm text-gray-500">版本 v{detail.version}</View>
          </View>
          <Tag variant={statusConfig.variant}>{statusConfig.label}</Tag>
        </View>

        {/* Fee Breakdown */}
        <View className="bg-white p-md mb-sm">
          <View className="font-bold mb-md text-base">费用明细</View>
          <View className="space-y-sm">
            <View className="flex justify-between text-sm py-xs border-b border-gray-100">
              <Text className="text-gray-500">设计费</Text>
              <Text>¥{detail.designFee?.toLocaleString()}</Text>
            </View>
            <View className="flex justify-between text-sm py-xs border-b border-gray-100">
              <Text className="text-gray-500">施工费 (预估)</Text>
              <Text>¥{detail.constructionFee?.toLocaleString()}</Text>
            </View>
            <View className="flex justify-between text-sm py-xs border-b border-gray-100">
              <Text className="text-gray-500">材料费 (预估)</Text>
              <Text>¥{detail.materialFee?.toLocaleString()}</Text>
            </View>
            <View className="flex justify-between items-center pt-md mt-sm">
              <Text className="font-bold">总计</Text>
              <Text className="text-xl font-bold text-brand">¥{total.toLocaleString()}</Text>
            </View>
          </View>
        </View>

        {/* Project Plan */}
        <View className="bg-white p-md mb-xl">
          <View className="font-bold mb-md text-base">方案详情</View>
          <View className="mb-md">
            <View className="text-sm text-gray-500 mb-xs">预估工期</View>
            <View className="font-medium">{detail.estimatedDays} 天</View>
          </View>
          <View>
            <View className="text-sm text-gray-500 mb-xs">方案说明</View>
            <View className="text-gray-800 leading-relaxed text-sm bg-gray-50 p-sm rounded">
              {detail.summary || '暂无说明'}
            </View>
          </View>
          {detail.attachments && (
             <View className="mt-md pt-md border-t border-gray-100">
               <View className="text-sm text-gray-500 mb-xs">附件</View>
               <View className="text-brand text-sm">查看附件 (需在PC端查看)</View>
             </View>
          )}
        </View>
      </ScrollView>

      {/* Footer Actions */}
      {detail.status === 0 && (
        <View className="fixed bottom-0 left-0 right-0 bg-white p-md shadow-top safe-area-bottom flex gap-md">
          <Button 
            variant="secondary" 
            onClick={handleReject} 
            className="flex-1"
          >
            拒绝
          </Button>
          <Button 
            variant="primary" 
            onClick={handleConfirm} 
            className="flex-1"
          >
            接受方案
          </Button>
        </View>
      )}
    </View>
  );
};

export default ProposalDetail;
