import React, { useEffect, useState } from 'react';
import { Text, View } from '@tarojs/components';
import Taro, { usePullDownRefresh, useRouter } from '@tarojs/taro';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Empty } from '@/components/Empty';
import { ListItem } from '@/components/ListItem';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import { getOrderStatus, getOrderTypeLabel } from '@/constants/status';
import { getBookingDetail } from '@/services/bookings';
import { cancelOrder, getOrderDetail, payOrder, getInstallmentPlans, payInstallment, type OrderItem, type InstallmentPlan } from '@/services/orders';
import { getProjectDetail } from '@/services/projects';
import { getProviderDetail, type ProviderType } from '@/services/providers';
import { useAuthStore } from '@/store/auth';
import { showErrorToast } from '@/utils/error';

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

const formatDate = (dateStr?: string) => {
  if (!dateStr) {
    return '-';
  }
  return new Date(dateStr).toLocaleString();
};

const OrderDetail: React.FC = () => {
  const auth = useAuthStore();
  const router = useRouter();
  const { id } = router.params || {};

  const [order, setOrder] = useState<OrderItem | null>(null);
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [provider, setProvider] = useState<ProviderSummary | null>(null);
  const [installmentPlans, setInstallmentPlans] = useState<InstallmentPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchRelatedInfo = async (detail: OrderItem) => {
    setBooking(null);
    setProject(null);
    setProvider(null);

    const bookingPromise = detail.bookingId
      ? getBookingDetail(detail.bookingId).catch(() => null)
      : Promise.resolve(null);

    const projectPromise = detail.projectId
      ? getProjectDetail(detail.projectId).catch(() => null)
      : Promise.resolve(null);

    const [nextBooking, projectRes] = await Promise.all([bookingPromise, projectPromise]);

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
        const providerRes = await getProviderDetail(providerType, nextBooking.providerId).catch(() => null);
        if (providerRes) {
          setProvider({
            id: providerRes.id,
            name: providerRes.nickname || providerRes.companyName || '服务商',
            providerType
          });
        }
      }
    }

    if (projectRes) {
      setProject({
        id: projectRes.id,
        name: projectRes.name,
        address: projectRes.address
      });
    }
  };

  const fetchDetail = async () => {
    if (!id) {
      return;
    }

    if (!auth.token) {
      setOrder(null);
      setLoading(false);
      Taro.stopPullDownRefresh();
      return;
    }

    setLoading(true);
    try {
      const res = await getOrderDetail(Number(id));
      setOrder(res);
      await fetchRelatedInfo(res);

      // 获取分期付款计划
      try {
        const plansRes = await getInstallmentPlans(Number(id));
        if (plansRes && plansRes.plans) {
          setInstallmentPlans(plansRes.plans);
        }
      } catch (error) {
        // 如果没有分期计划，忽略错误
        setInstallmentPlans([]);
      }
    } catch (error) {
      setOrder(null);
      showErrorToast(error, '获取详情失败');
    } finally {
      setLoading(false);
      Taro.stopPullDownRefresh();
    }
  };
  useEffect(() => {
    fetchDetail();
  }, [id, auth.token]); // eslint-disable-line react-hooks/exhaustive-deps

  usePullDownRefresh(() => {
    fetchDetail();
  });

  const handlePay = async () => {
    if (!order || submitting) {
      return;
    }

    setSubmitting(true);
    try {
      await payOrder(order.id);
      Taro.showToast({ title: '支付成功', icon: 'success' });
      await fetchDetail();
    } catch (error) {
      showErrorToast(error, '支付失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!order || submitting) {
      return;
    }

    Taro.showModal({
      title: '取消订单',
      content: '确定要取消该订单吗？取消后需重新下单。',
      success: async (res) => {
        if (!res.confirm) {
          return;
        }

        setSubmitting(true);
        try {
          await cancelOrder(order.id);
          Taro.showToast({ title: '已取消', icon: 'success' });
          await fetchDetail();
        } catch (error) {
          showErrorToast(error, '取消失败');
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

  const handlePayInstallment = async (planId: number) => {
    if (submitting) {
      return;
    }

    Taro.showModal({
      title: '确认支付',
      content: '确定要支付该期款项吗？',
      success: async (res) => {
        if (!res.confirm) {
          return;
        }

        setSubmitting(true);
        try {
          await payInstallment(planId);
          Taro.showToast({ title: '支付成功', icon: 'success' });
          await fetchDetail();
        } catch (error) {
          showErrorToast(error, '支付失败');
        } finally {
          setSubmitting(false);
        }
      }
    });
  };

  if (!auth.token) {
    return (
      <View className="page bg-gray-50 min-h-screen p-md flex items-center justify-center">
        <Empty
          description="登录后查看订单详情"
          action={{ text: '去登录', onClick: () => Taro.navigateTo({ url: '/pages/profile/index' }) }}
        />
      </View>
    );
  }

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

  const statusConfig = getOrderStatus(order.status);
  const payableAmount = Math.max(0, order.totalAmount - order.discount);

  return (
    <View className="page bg-gray-50 min-h-screen pb-xl">
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
        {(provider || booking || project) ? (
          <Card className="mb-md" title="关联信息">
            <View className="flex flex-col">
              {provider ? (
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
              ) : null}

              {project ? (
                <>
                  <ListItem
                    title="项目"
                    description={project.name}
                    arrow
                    onClick={() => Taro.navigateTo({ url: `/pages/projects/detail/index?id=${project.id}` })}
                  />
                  <ListItem
                    title="项目进度"
                    description="查看整体施工进度"
                    arrow
                    onClick={() => Taro.switchTab({ url: '/pages/progress/index' })}
                  />
                </>
              ) : null}

              {!provider && booking?.providerId ? (
                <ListItem title="服务商" description={`ID ${booking.providerId}`} />
              ) : null}
              {!project && booking?.address ? (
                <ListItem title="项目地址" description={booking.address} />
              ) : null}
            </View>
          </Card>
        ) : null}

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
            <View className="flex justify-between items-center">
              <Text className="text-gray-900 font-medium">应付金额</Text>
              <Text className="text-xl font-bold text-brand">¥{payableAmount.toLocaleString()}</Text>
            </View>
            <View className="h-px bg-gray-100 my-xs" />
            <View className="flex justify-between items-center text-sm">
              <Text className="text-gray-500">已支付金额</Text>
              <Text>¥{order.paidAmount.toLocaleString()}</Text>
            </View>
          </View>
        </Card>

        {installmentPlans.length > 0 && (
          <Card className="mb-md" title="分期付款计划">
            <View className="flex flex-col gap-md py-sm">
              {installmentPlans.map((plan) => {
                const isPaid = plan.status === 'paid';
                const isOverdue = plan.status === 'overdue';
                const isPending = plan.status === 'pending';

                return (
                  <View key={plan.id} className="border border-gray-100 rounded p-md">
                    <View className="flex justify-between items-start mb-sm">
                      <View>
                        <Text className="font-medium">第 {plan.seq} 期</Text>
                        <Text className="text-sm text-gray-500 mt-xs">
                          到期日: {new Date(plan.dueDate).toLocaleDateString()}
                        </Text>
                      </View>
                      <Tag variant={isPaid ? 'success' : isOverdue ? 'danger' : 'warning'}>
                        {isPaid ? '已支付' : isOverdue ? '已逾期' : '待支付'}
                      </Tag>
                    </View>

                    <View className="flex justify-between items-center pt-sm border-t border-gray-100">
                      <Text className="text-lg font-bold">¥{plan.amount.toLocaleString()}</Text>
                      {isPending && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handlePayInstallment(plan.id)}
                          disabled={submitting}
                        >
                          立即支付
                        </Button>
                      )}
                      {isPaid && plan.paidAt && (
                        <Text className="text-xs text-gray-400">
                          支付时间: {new Date(plan.paidAt).toLocaleDateString()}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </Card>
        )}

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
              <Text>{getOrderTypeLabel(order.orderType)}</Text>
            </View>
            <View className="flex justify-between">
              <Text className="text-gray-500">下单时间</Text>
              <Text>{formatDate(order.createdAt)}</Text>
            </View>
            {order.paidAt ? (
              <View className="flex justify-between">
                <Text className="text-gray-500">支付时间</Text>
                <Text>{formatDate(order.paidAt)}</Text>
              </View>
            ) : null}
            {order.expireAt && order.status === 0 ? (
              <View className="flex justify-between">
                <Text className="text-gray-500">过期时间</Text>
                <Text className="text-warning">{formatDate(order.expireAt)}</Text>
              </View>
            ) : null}
          </View>
        </Card>
      </View>

      {order.status === 0 ? (
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
            disabled={submitting}
          >
            立即支付
          </Button>
        </View>
      ) : null}
    </View>
  );
};

export default OrderDetail;
