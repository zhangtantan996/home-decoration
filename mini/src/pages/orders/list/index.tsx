import React, { useCallback, useEffect, useState } from 'react';
import { View, Text } from '@tarojs/components';
import Taro, { usePullDownRefresh, useReachBottom } from '@tarojs/taro';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Empty } from '@/components/Empty';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import { listOrders, type OrderItem } from '@/services/orders';
import { useAuthStore } from '@/store/auth';

const getStatusConfig = (status: number) => {
  switch (status) {
    case 0:
      return { label: '待付款', variant: 'warning' as const };
    case 1:
      return { label: '进行中', variant: 'brand' as const };
    case 2:
      return { label: '已完成', variant: 'success' as const };
    case 3:
      return { label: '已取消', variant: 'default' as const };
    default:
      return { label: '未知状态', variant: 'default' as const };
  }
};

const OrdersList: React.FC = () => {
  const auth = useAuthStore();
  const [list, setList] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [init, setInit] = useState(true);

  const fetchList = useCallback(async (pageNum: number, reset = false) => {
    if (!auth.token) {
      setList([]);
      setLoading(false);
      setHasMore(false);
      Taro.stopPullDownRefresh();
      return;
    }

    setLoading(true);
    try {
      const res = await listOrders(pageNum, 10);
      const newItems = res.list || [];

      if (reset) {
        setList(newItems);
      } else {
        setList(prev => [...prev, ...newItems]);
      }

      setHasMore(newItems.length === 10);
      setPage(pageNum + 1);
    } catch (error) {
      console.error(error);
      Taro.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      setLoading(false);
      setInit(false);
      Taro.stopPullDownRefresh();
    }
  }, [auth.token]);

  useEffect(() => {
    fetchList(1, true);
  }, [fetchList]);

  usePullDownRefresh(() => {
    setHasMore(true);
    fetchList(1, true);
  });

  useReachBottom(() => {
    if (hasMore && !loading) {
      fetchList(page);
    }
  });

  const handlePay = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    Taro.navigateTo({ url: '/pages/orders/pending/index' });
  };

  const handleCardClick = (id: number) => {
    Taro.navigateTo({ url: `/pages/orders/detail/index?id=${id}` });
  };

  return (

    <View className="page bg-gray-50 min-h-screen p-md">
      {!auth.token ? (
        <Empty description="登录后查看订单" />
      ) : init && loading ? (
        <View>
          <Skeleton height={180} className="mb-md" />
          <Skeleton height={180} className="mb-md" />
          <Skeleton height={180} className="mb-md" />
        </View>
      ) : list.length > 0 ? (
        <View>
          {list.map((item) => {
            const statusConfig = getStatusConfig(item.status);
            return (
              <Card
                key={item.id}
                title={`订单号 ${item.orderNo}`}
                extra={<Tag variant={statusConfig.variant}>{statusConfig.label}</Tag>}
                className="mb-md"
                onClick={() => handleCardClick(item.id)}
              >

                <View className="flex flex-col gap-sm mt-sm">
                  <View className="flex justify-between text-sm">
                    <Text className="text-gray-500">下单时间</Text>
                    <Text>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '-'}</Text>
                  </View>
                  <View className="flex justify-between text-sm">
                    <Text className="text-gray-500">订单类型</Text>
                    <Text>{item.orderType || '普通订单'}</Text>
                  </View>

                  <View className="mt-sm pt-sm border-t border-gray-100 flex justify-between items-center">
                    <View>
                      <Text className="text-gray-500 text-sm mr-xs">总金额</Text>
                      <Text className="text-lg font-bold">¥{item.totalAmount.toLocaleString()}</Text>
                    </View>
                    {item.status === 0 && (
                      <Button size="sm" variant="primary" onClick={handlePay}>
                        去支付
                      </Button>
                    )}
                  </View>
                </View>
              </Card>
            );
          })}
          {loading && (
            <View className="p-md text-center text-gray-500 text-sm">
              加载中...
            </View>
          )}
          {!hasMore && list.length > 0 && (
            <View className="p-md text-center text-gray-400 text-sm">
              没有更多了
            </View>
          )}
        </View>
      ) : (
        <Empty description="暂无订单" />
      )}
    </View>
  );
};

export default OrdersList;

