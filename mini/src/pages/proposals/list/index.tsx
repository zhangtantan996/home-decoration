import React, { useEffect, useState } from 'react';
import { View, Text } from '@tarojs/components';
import Taro, { usePullDownRefresh, useReachBottom } from '@tarojs/taro';
import { Card } from '@/components/Card';
import { Empty } from '@/components/Empty';
import { Tag } from '@/components/Tag';
import { Skeleton } from '@/components/Skeleton';
import { listProposals, type ProposalItem } from '@/services/proposals';
import { useAuthStore } from '@/store/auth';

const ProposalList: React.FC = () => {
  const auth = useAuthStore();
  const [list, setList] = useState<ProposalItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchList = async (reset = false) => {
    if (!auth.token) {
      setList([]);
      setHasMore(false);
      setLoading(false);
      Taro.stopPullDownRefresh();
      return;
    }
    if (loading && !reset) return;
    
    setLoading(true);
    const currentPage = reset ? 1 : page;
    
    try {
      const res = await listProposals(currentPage, 10);
      const newList = res.list || [];
      
      if (reset) {
        setList(newList);
      } else {
        setList(prev => [...prev, ...newList]);
      }
      
      setHasMore(newList.length === 10);
      setPage(currentPage + 1);
    } catch (error) {
      console.error(error);
      Taro.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      setLoading(false);
      Taro.stopPullDownRefresh();
    }
  };

  useEffect(() => {
    fetchList(true);
  }, [auth.token]);

  useEffect(() => {
    if (!auth.token) {
      setList([]);
      setHasMore(false);
    }
  }, [auth.token]);

  usePullDownRefresh(() => {
    fetchList(true);
  });
  
  useReachBottom(() => {
    if (hasMore) fetchList();
  });

  const handleDetail = (id: number) => {
    Taro.navigateTo({
      url: `/pages/proposals/detail/index?id=${id}`
    });
  };

  const getStatusConfig = (status: number) => {
    switch(status) {
      case 0: return { label: '待确认', variant: 'warning' as const };
      case 1: return { label: '已接受', variant: 'success' as const };
      case 2: return { label: '已拒绝', variant: 'error' as const };
      case 3: return { label: '修改中', variant: 'brand' as const };
      default: return { label: '未知状态', variant: 'default' as const };
    }
  };

  return (
    <View className="page bg-gray-50 min-h-screen p-md">
      {!auth.token ? (
        <Empty description="登录后查看设计方案" />
      ) : loading && list.length === 0 ? (
        <View>
          <View className="mb-md"><Skeleton height={200} /></View>
          <View className="mb-md"><Skeleton height={200} /></View>
        </View>
      ) : list.length > 0 ? (
        list.map((item) => {
          const status = getStatusConfig(item.status);
          const totalFee = (item.designFee || 0) + (item.constructionFee || 0) + (item.materialFee || 0);

          return (
            <Card
              key={item.id}
              title={`方案 #${item.id}`}
              extra={<Tag variant={status.variant}>{status.label}</Tag>}
              className="mb-md"
              onClick={() => handleDetail(item.id)}
            >
              <View className="flex flex-col gap-sm mt-sm">
                <View className="text-gray-600 line-clamp-2 text-sm">
                  {item.summary || '暂无方案描述'}
                </View>

                <View className="flex justify-between items-center pt-sm border-t border-gray-100 mt-sm">
                  <View className="flex flex-col">
                    <Text className="text-xs text-gray-500">预估工期</Text>
                    <Text className="text-sm font-medium">{item.estimatedDays || 0} 天</Text>
                  </View>
                  <View className="flex flex-col items-end">
                    <Text className="text-xs text-gray-500">总预算</Text>
                    <Text className="text-lg font-bold text-brand">¥{totalFee.toLocaleString()}</Text>
                  </View>
                </View>
              </View>
            </Card>
          );
        })
      ) : (
        <Empty description="暂无设计方案" />
      )}
      
      {loading && list.length > 0 && (
         <View className="text-center text-gray-400 text-xs py-md">加载中...</View>
      )}
    </View>
  );
};

export default ProposalList;
