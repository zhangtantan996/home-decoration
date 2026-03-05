import React, { useEffect, useState } from 'react';
import { Text, View } from '@tarojs/components';
import Taro, { usePullDownRefresh, useRouter } from '@tarojs/taro';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Empty } from '@/components/Empty';
import { Skeleton } from '@/components/Skeleton';
import { getPendingPaymentTypeLabel } from '@/constants/status';
import { payIntentFee } from '@/services/bookings';
import { listPendingPayments, payOrder, type PendingPaymentItem } from '@/services/orders';
import { useAuthStore } from '@/store/auth';
import { showErrorToast } from '@/utils/error';

const PendingOrders: React.FC = () => {
  const auth = useAuthStore();
  const router = useRouter();
  const [list, setList] = useState<PendingPaymentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [payingId, setPayingId] = useState<number | null>(null);

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
      showErrorToast(error, '加载失败');
    } finally {
      setLoading(false);
      Taro.stopPullDownRefresh();
    }
  };
  useEffect(() => {
    fetchList();
  }, [auth.token, router.params?.type]); // eslint-disable-line react-hooks/exhaustive-deps

  usePullDownRefresh(() => {
    fetchList();
  });

  const handleCardClick = (item: PendingPaymentItem) => {
    if (item.type === 'intent_fee') {
      Taro.showToast({ title: '意向金暂无订单详情页', icon: 'none' });
      return;
    }

    Taro.navigateTo({ url: `/pages/orders/detail/index?id=${item.id}` });
  };

  const handlePay = async (item: PendingPaymentItem) => {
    if (payingId !== null) {
      return;
    }

    setPayingId(item.id);
    Taro.showLoading({ title: '支付中...' });

    try {
      if (item.type === 'intent_fee') {
        await payIntentFee(item.id);
      } else {
        await payOrder(item.id);
      }
      Taro.hideLoading();
      Taro.showToast({ title: '支付成功', icon: 'success' });
      await fetchList();
    } catch (error) {
      Taro.hideLoading();
      showErrorToast(error, '支付失败');
    } finally {
      setPayingId(null);
    }
  };

  return (
    <View className="page bg-gray-50 min-h-screen p-md">
      {!auth.token ? (
        <Empty
          description="登录后查看待付款订单"
          action={{ text: '去登录', onClick: () => Taro.navigateTo({ url: '/pages/profile/index' }) }}
        />
      ) : loading && list.length === 0 ? (
        <View>
          <Skeleton height={150} className="mb-md" />
          <Skeleton height={150} className="mb-md" />
        </View>
      ) : list.length > 0 ? (
        list.map((item) => (
          <Card
            key={`${item.type}-${item.id}`}
            title={getPendingPaymentTypeLabel(item.type)}
            extra={<Text className="text-brand font-bold">¥{item.amount.toLocaleString()}</Text>}
            className="mb-md"
            onClick={() => handleCardClick(item)}
          >
            <View className="flex flex-col gap-sm mt-sm">
              <View className="flex justify-between text-sm">
                <Text className="text-gray-500">订单编号</Text>
                <Text>{item.orderNo}</Text>
              </View>
              <View className="flex justify-between text-sm">
                <Text className="text-gray-500">服务商</Text>
                <Text>{item.providerName || '-'}</Text>
              </View>
              {item.address ? (
                <View className="flex justify-between text-sm">
                  <Text className="text-gray-500">项目地址</Text>
                  <Text className="text-right max-w-xs">{item.address}</Text>
                </View>
              ) : null}
              {item.expireAt ? (
                <View className="flex justify-between text-sm">
                  <Text className="text-gray-500">截止时间</Text>
                  <Text className="text-error">{new Date(item.expireAt).toLocaleString()}</Text>
                </View>
              ) : null}

              <View className="mt-md pt-md border-t border-gray-100 flex justify-end">
                <Button
                  size="sm"
                  variant="primary"
                  onClick={(event) => {
                    event.stopPropagation();
                    handlePay(item);
                  }}
                  loading={payingId === item.id}
                  disabled={payingId !== null}
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
