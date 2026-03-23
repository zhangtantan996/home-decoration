import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from '@tarojs/components';
import Taro, { usePullDownRefresh, useReachBottom } from '@tarojs/taro';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Empty } from '@/components/Empty';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import { getOrderStatus, getOrderTypeLabel } from '@/constants/status';
import { listOrders, type OrderItem } from '@/services/orders';
import { useAuthStore } from '@/store/auth';
import { showErrorToast } from '@/utils/error';
import { formatServerDate } from '@/utils/serverTime';

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
      setInit(false);
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
        setList((prev) => [...prev, ...newItems]);
      }

      setHasMore(newItems.length === 10);
      setPage(pageNum + 1);
    } catch (error) {
      showErrorToast(error, '加载失败');
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

  const openOrderDetail = (id: number) => {
    Taro.navigateTo({ url: `/pages/orders/detail/index?id=${id}` });
  };

  const handlePay = (event: { stopPropagation: () => void }, item: OrderItem) => {
    event.stopPropagation();

    if (item.orderType === 'design') {
      Taro.navigateTo({ url: '/pages/orders/pending/index?type=design_fee' });
      return;
    }

    if (item.orderType === 'construction') {
      Taro.navigateTo({ url: '/pages/orders/pending/index?type=construction_fee' });
      return;
    }

    openOrderDetail(item.id);
  };

  return (
    <View className="page bg-gray-50 min-h-screen p-md">
      {!auth.token ? (
        <Empty
          description="登录后查看订单"
          action={{ text: '去登录', onClick: () => Taro.switchTab({ url: '/pages/profile/index' }) }}
        />
      ) : init && loading ? (
        <View>
          <Skeleton height={180} className="mb-md" />
          <Skeleton height={180} className="mb-md" />
          <Skeleton height={180} className="mb-md" />
        </View>
      ) : list.length > 0 ? (
        <View>
          {list.map((item) => {
            const statusConfig = getOrderStatus(item.status);
            return (
              <Card
                key={item.id}
                title={`订单号 ${item.orderNo}`}
                extra={<Tag variant={statusConfig.variant}>{statusConfig.label}</Tag>}
                className="mb-md"
                onClick={() => openOrderDetail(item.id)}
              >
                <View className="flex flex-col gap-sm mt-sm">
                  <View className="flex justify-between text-sm">
                    <Text className="text-gray-500">下单时间</Text>
                    <Text>{formatServerDate(item.createdAt)}</Text>
                  </View>
                  <View className="flex justify-between text-sm">
                    <Text className="text-gray-500">订单类型</Text>
                    <Text>{getOrderTypeLabel(item.orderType)}</Text>
                  </View>

                  <View className="mt-sm pt-sm border-t border-gray-100 flex justify-between items-center">
                    <View>
                      <Text className="text-gray-500 text-sm mr-xs">应付金额</Text>
                      <Text className="text-lg font-bold">¥{Math.max(0, item.totalAmount - item.discount).toLocaleString()}</Text>
                    </View>
                    {item.status === 0 ? (
                      <Button size="sm" variant="primary" onClick={(event) => handlePay(event, item)}>
                        去支付
                      </Button>
                    ) : null}
                  </View>
                </View>
              </Card>
            );
          })}

          {loading ? (
            <View className="p-md text-center text-gray-500 text-sm">
              加载中...
            </View>
          ) : null}
          {!hasMore && list.length > 0 ? (
            <View className="p-md text-center text-gray-400 text-sm">
              没有更多了
            </View>
          ) : null}
        </View>
      ) : (
        <Empty description="暂无订单" />
      )}
    </View>
  );
};

export default OrdersList;
