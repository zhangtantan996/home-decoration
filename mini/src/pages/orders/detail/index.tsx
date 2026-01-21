import React, { useEffect, useState } from 'react';
import { View, Text } from '@tarojs/components';
import Taro, { useRouter, usePullDownRefresh } from '@tarojs/taro';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Empty } from '@/components/Empty';
import { ListItem } from '@/components/ListItem';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import { cancelOrder, getOrderDetail, payOrder, type OrderItem } from '@/services/orders';
import { getBookingDetail } from '@/services/bookings';
import { getProjectDetail } from '@/services/projects';
import { getProviderDetail, type ProviderType } from '@/services/providers';

const getStatusConfig = (status: number) => {
  switch (status) {
    case 0:
      return { label: '待付款', variant: 'warning' as const, desc: '请尽快完成支付' };
    case 1:
      return { label: '已支付', variant: 'brand' as const, desc: '订单已确认' };
    case 2:
      return { label: '已完成', variant: 'success' as const, desc: '服务已完成' };
    case 3:
      return { label: '已取消', variant: 'default' as const, desc: '订单已失效' };
    default:
      return { label: '未知状态', variant: 'default' as const, desc: '-' };
  }
};

type ProviderSummary = {
  id: number;
  name: string;
  providerType: ProviderType;
};

type BookingDetail = {
  id: number;
  providerId: number;
  providerType: ProviderType | number | string;
  address?: string;
  intentFee?: number;
  provider?: {
    id?: number;
    name?: string;
    providerType?: number | string;
  };
};

type ProjectSummary = {
  id: number;
  name: string;
  address?: string;
};

const normalizeProviderType = (value?: string | number): ProviderType => {
  if (value === 'designer' || value === 'company' || value === 'foreman') {
    return value;
  }
  if (value === 'worker') {
    return 'foreman';
  }
  if (value === 1 || value === '1') {
    return 'designer';
  }
  if (value === 2 || value === '2') {
    return 'company';
  }
  if (value === 3 || value === '3') {
    return 'foreman';
  }
  return 'designer';
};

const OrderDetail: React.FC = () => {
  const router = useRouter();
  const { id } = router.params || {};

  const [order, setOrder] = useState<OrderItem | null>(null);
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [provider, setProvider] = useState<ProviderSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchRelatedInfo = async (detail: OrderItem) => {
    const nextBooking: BookingDetail | null = detail.bookingId
      ? await getBookingDetail(detail.bookingId)
      : null;

    if (nextBooking) {
      const providerType = normalizeProviderType(nextBooking.providerType);
      const providerInfo = nextBooking.provider?.name
        ? { id: nextBooking.providerId, name: nextBooking.provider.name, providerType }
        : null;

      setBooking({
        id: nextBooking.id,
        providerId: nextBooking.providerId,
        providerType: nextBooking.providerType,
        address: nextBooking.address,
        intentFee: nextBooking.intentFee,
        provider: nextBooking.provider
      });

      if (providerInfo) {
        setProvider(providerInfo);
      } else if (nextBooking.providerId) {
        const providerRes = await getProviderDetail(providerType, nextBooking.providerId);
        setProvider({
          id: providerRes.id,
          name: providerRes.nickname || providerRes.companyName || '服务商',
          providerType
        });
      }
    } else {
      setBooking(null);
      setProvider(null);
    }

    if (detail.projectId) {
      const projectRes = await getProjectDetail(detail.projectId);
      setProject({
        id: projectRes.id,
        name: projectRes.name,
        address: projectRes.address
      });
    } else {
      setProject(null);
    }
  };

  const fetchDetail = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await getOrderDetail(Number(id));
      setOrder(res);
      await fetchRelatedInfo(res);
    } catch (error) {
      console.error(error);
      Taro.showToast({ title: '获取详情失败', icon: 'none' });
    } finally {
      setLoading(false);
      Taro.stopPullDownRefresh();
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [id]);

  usePullDownRefresh(() => {
    fetchDetail();
  });

  const handlePay = async () => {
    if (!order) return;
    setSubmitting(true);
    try {
      await payOrder(order.id);
      Taro.showToast({ title: '支付成功', icon: 'success' });
      await fetchDetail();
    } catch (error) {
      Taro.showToast({ title: '支付失败', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!order) return;
    Taro.showModal({
      title: '取消订单',
      content: '确定要取消该订单吗？取消后需重新下单。',
      success: async (res) => {
        if (!res.confirm) return;
        setSubmitting(true);
        try {
          await cancelOrder(order.id);
          Taro.showToast({ title: '已取消', icon: 'success' });
          await fetchDetail();
        } catch (error) {
          Taro.showToast({ title: '取消失败', icon: 'none' });
        } finally {
          setSubmitting(false);
        }
      }
    });
  };

  const handleCopy = (text: string) => {
    Taro.setClipboardData({
      data: text,
      success: () => Taro.showToast({ title: '已复制', icon: 'none' })
    });
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString();
  };

  if (loading) {
    return (
      <View className="page bg-gray-50 min-h-screen p-md">
        <Skeleton height={200} className="mb-md" />
        <Skeleton height={150} className="mb-md" />
        <Skeleton height={300} className="mb-md" />
      </View>
    );
  }

  if (!order) {
    return (
      <View className="page bg-gray-50 min-h-screen p-md flex items-center justify-center">
        <Empty description="订单不存在" />
      </View>
    );
  }

  const statusConfig = getStatusConfig(order.status);

  return (
    <View className="page bg-gray-50 min-h-screen pb-xl">
      {/* Header Status */}
      <View className="bg-white p-md mb-md flex justify-between items-center">
        <View>
          <View className="text-xl font-bold mb-xs flex items-center gap-xs">
            <Text>{statusConfig.label}</Text>
          </View>
          <Text className="text-gray-500 text-sm">{statusConfig.desc}</Text>
        </View>
        <Tag variant={statusConfig.variant}>{statusConfig.label}</Tag>
      </View>

      <View className="px-md">
        {(provider || booking || project) && (
          <Card className="mb-md" title="关联信息">
            <View className="flex flex-col">
              {provider && (
                <ListItem
                  title="服务商"
                  description={provider.name}
                  arrow
                  onClick={() =>
                    Taro.navigateTo({
                      url: `/pages/providers/detail/index?id=${provider.id}&type=${provider.providerType}`
                    })
                  }
                />
              )}
              {project && (
                <ListItem
                  title="项目"
                  description={project.name}
                  arrow
                  onClick={() =>
                    Taro.navigateTo({
                      url: `/pages/projects/detail/index?id=${project.id}`
                    })
                  }
                />
              )}
              {!provider && booking?.providerId && (
                <ListItem title="服务商" description={`ID ${booking.providerId}`} />
              )}
              {!project && booking?.address && (
                <ListItem title="项目地址" description={booking.address} />
              )}
            </View>
          </Card>
        )}

        {/* Amount Card */}
        <Card className="mb-md" title="金额信息">
          <View className="flex flex-col gap-md py-sm">
            <View className="flex justify-between items-center">
              <Text className="text-gray-500">订单总额</Text>
              <Text className="font-bold text-lg">¥{order.totalAmount.toLocaleString()}</Text>
            </View>
            <View className="flex justify-between items-center text-sm">
              <Text className="text-gray-500">优惠金额</Text>
              <Text className="text-red-500">-¥{order.discount.toLocaleString()}</Text>
            </View>
            <View className="h-px bg-gray-100 my-xs" />
            <View className="flex justify-between items-center">
              <Text className="text-gray-900 font-medium">实付金额</Text>
              <Text className="text-xl font-bold text-brand">¥{order.paidAmount.toLocaleString()}</Text>
            </View>
          </View>
        </Card>

        {/* Basic Info Card */}
        <Card className="mb-md" title="订单信息">
          <View className="flex flex-col gap-sm py-sm text-sm">
            <View className="flex justify-between">
              <Text className="text-gray-500">订单编号</Text>
              <View className="flex items-center" onClick={() => handleCopy(order.orderNo)}>
                <Text>{order.orderNo}</Text>
                <Text className="text-brand text-xs ml-xs">复制</Text>
              </View>
            </View>
            <View className="flex justify-between">
              <Text className="text-gray-500">订单类型</Text>
              <Text>{order.orderType}</Text>
            </View>
            <View className="flex justify-between">
              <Text className="text-gray-500">下单时间</Text>
              <Text>{formatDate(order.createdAt)}</Text>
            </View>
            {order.paidAt && (
              <View className="flex justify-between">
                <Text className="text-gray-500">支付时间</Text>
                <Text>{formatDate(order.paidAt)}</Text>
              </View>
            )}
            {order.expireAt && order.status === 0 && (
              <View className="flex justify-between">
                <Text className="text-gray-500">过期时间</Text>
                <Text className="text-warning">{formatDate(order.expireAt)}</Text>
              </View>
            )}
          </View>
        </Card>
      </View>

      {order.status === 0 && (
        <View className="fixed bottom-0 left-0 right-0 bg-white p-md border-t border-gray-100 safe-area-bottom flex gap-md">
          <Button
            variant="outline"
            size="lg"
            onClick={handleCancel}
            className="flex-1"
            disabled={submitting}
          >
            取消订单
          </Button>
          <Button
            variant="primary"
            size="lg"
            onClick={handlePay}
            className="flex-1"
            loading={submitting}
          >
            再次支付
          </Button>
        </View>
      )}
    </View>
  );
};

export default OrderDetail;
