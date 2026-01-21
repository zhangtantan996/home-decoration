import React, { useEffect, useState } from 'react';
import { View, Text } from '@tarojs/components';
import Taro, { usePullDownRefresh, useRouter } from '@tarojs/taro';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Empty } from '@/components/Empty';
import { Skeleton } from '@/components/Skeleton';
import { listPendingPayments, payOrder, type PendingPaymentItem } from '@/services/orders';
import { useAuthStore } from '@/store/auth';

const PendingOrders: React.FC = () => {
  const auth = useAuthStore();
  const router = useRouter();
  const [list, setList] = useState<PendingPaymentItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchList = async () => {
    if (!auth.token) {
      setList([]);
      setLoading(false);
      Taro.stopPullDownRefresh();
      return;
    }
    setLoading(true);
    try {
      const res = await listPendingPayments();
      const items = res.items || [];
      const filterType = router.params?.type;
      const filtered = filterType ? items.filter((item) => item.type === filterType) : items;
      setList(filtered);
    } catch (error) {
      console.error(error);
      Taro.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      setLoading(false);
      Taro.stopPullDownRefresh();
    }
  };

  useEffect(() => {
    fetchList();
  }, [auth.token]);

  useEffect(() => {
    if (!auth.token) {
      setList([]);
    }
  }, [auth.token]);

  usePullDownRefresh(() => {
    fetchList();
  });

  const handlePay = async (id: number) => {
    Taro.showLoading({ title: '支付中...' });
    try {
      await payOrder(id);
      Taro.hideLoading();
      Taro.showToast({ title: '支付成功', icon: 'success' });
      fetchList();
    } catch (error) {
      Taro.hideLoading();
      Taro.showToast({ title: '支付失败', icon: 'none' });
    }
  };

  return (
    <View className="page bg-gray-50 min-h-screen p-md">
      {!auth.token ? (
        <Empty description="登录后查看待付款订单" />
      ) : loading && list.length === 0 ? (
        <View>
          <Skeleton height={150} className="mb-md" />
          <Skeleton height={150} className="mb-md" />
        </View>
      ) : list.length > 0 ? (
        list.map((item) => (
            <Card
              key={item.id}
              title={item.type === 'intent_fee' ? '意向金' : '设计首付款'}
              extra={<Text className="text-brand font-bold">¥{item.amount.toLocaleString()}</Text>}
              className="mb-md"
              onClick={() => Taro.navigateTo({ url: `/pages/orders/detail/index?id=${item.id}` })}
            >

            <View className="flex flex-col gap-sm mt-sm">
              <View className="flex justify-between text-sm">
                <Text className="text-gray-500">订单编号</Text>
                <Text>{item.orderNo}</Text>
              </View>
              <View className="flex justify-between text-sm">
                <Text className="text-gray-500">服务商</Text>
                <Text>{item.providerName}</Text>
              </View>
              {item.address && (
                <View className="flex justify-between text-sm">
                  <Text className="text-gray-500">项目地址</Text>
                  <Text className="text-right max-w-xs">{item.address}</Text>
                </View>
              )}
              {item.expireAt && (
                <View className="flex justify-between text-sm">
                  <Text className="text-gray-500">截止时间</Text>
                  <Text className="text-error">{new Date(item.expireAt).toLocaleDateString()}</Text>
                </View>
              )}

              <View className="mt-md pt-md border-t border-gray-100 flex justify-end">
                <Button
                  size="sm"
                  variant="primary"
                  onClick={(event) => {
                    event.stopPropagation();
                    handlePay(item.id);
                  }}
                >
                  立即支付
                </Button>
              </View>
            </View>
          </Card>
        ))
      ) : (
        <Empty description="暂无待付款订单" />
      )}
    </View>
  );
};

export default PendingOrders;
