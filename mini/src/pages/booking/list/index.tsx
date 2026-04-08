import { useEffect, useState } from 'react';
import { Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Empty } from '@/components/Empty';
import { PullToRefreshNotice } from '@/components/PullToRefreshNotice';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import { usePullToRefreshFeedback } from '@/hooks/usePullToRefreshFeedback';
import { listBookings, type BookingItem } from '@/services/bookings';
import { useAuthStore } from '@/store/auth';
import { showErrorToast } from '@/utils/error';
import { navigateToSurveyDepositPaymentWithOptions } from '@/utils/surveyDepositPayment';

type BookingStatusVariant = 'default' | 'primary' | 'success' | 'warning';

const formatCurrency = (amount: number) => `¥${amount.toLocaleString()}`;

const getSurveyDepositAmount = (booking: BookingItem) => (
  Number(booking.surveyDepositAmount || booking.surveyDeposit || 0)
);

const getStatusVariant = (statusGroup?: BookingItem['statusGroup']): BookingStatusVariant => {
  switch (statusGroup) {
    case 'pending_confirmation':
      return 'warning';
    case 'pending_payment':
      return 'primary';
    case 'in_service':
      return 'primary';
    case 'completed':
      return 'success';
    case 'cancelled':
    default:
      return 'default';
  }
};

const getActionLabel = (booking: BookingItem) => {
  switch (booking.statusGroup) {
    case 'pending_payment':
      return '支付量房费';
    case 'in_service':
      return '查看进度';
    case 'completed':
      return '查看详情';
    case 'cancelled':
    case 'pending_confirmation':
    default:
      return '查看详情';
  }
};

const getSummary = (booking: BookingItem) => {
  if (booking.statusGroup === 'pending_payment') {
    return {
      title: '待支付量房费',
      value: getSurveyDepositAmount(booking) > 0 ? formatCurrency(getSurveyDepositAmount(booking)) : '待商家设置',
      highlight: true,
    };
  }

  return {
    title: '当前阶段',
    value: booking.currentStageText || booking.flowSummary || '预约推进中',
    highlight: false,
  };
};

const BookingListPage: React.FC = () => {
  const auth = useAuthStore();
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingBookingId, setActingBookingId] = useState<number | null>(null);

  const fetchBookings = async () => {
    if (!auth.token) {
      setBookings([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await listBookings();
      setBookings(Array.isArray(res) ? res : []);
    } catch (error) {
      showErrorToast(error, '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const { refreshStatus, drawerHeight, drawerProgress, bindPullToRefresh, runReload } =
    usePullToRefreshFeedback(fetchBookings);

  useEffect(() => {
    void runReload();
  }, [auth.token, runReload]);

  const openDetail = (bookingId: number) => {
    Taro.navigateTo({ url: `/pages/booking/detail/index?id=${bookingId}` });
  };

  const handlePrimaryAction = async (booking: BookingItem) => {
    if (booking.statusGroup === 'pending_payment') {
      try {
        setActingBookingId(booking.id);
        await navigateToSurveyDepositPaymentWithOptions(booking.id);
      } finally {
        setActingBookingId(null);
      }
      return;
    }

    openDetail(booking.id);
  };

  if (!auth.token) {
    return (
      <View className="page bg-gray-50 min-h-screen p-md flex items-center justify-center" {...bindPullToRefresh}>
        <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />
        <Empty
          description="登录后查看预约列表"
          action={{ text: '去登录', onClick: () => Taro.switchTab({ url: '/pages/profile/index' }) }}
        />
      </View>
    );
  }

  if (loading && bookings.length === 0) {
    return (
      <View className="page bg-gray-50 min-h-screen p-md" {...bindPullToRefresh}>
        <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />
        <Skeleton height={180} className="mb-md" />
        <Skeleton height={180} className="mb-md" />
        <Skeleton height={180} />
      </View>
    );
  }

  if (bookings.length === 0) {
    return (
      <View className="page bg-gray-50 min-h-screen p-md flex items-center justify-center" {...bindPullToRefresh}>
        <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />
        <Empty description="暂无预约记录" />
      </View>
    );
  }

  return (
    <View className="page bg-gray-50 min-h-screen pb-md" {...bindPullToRefresh}>
      <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />
      <View className="p-md flex flex-col gap-md">
        {bookings.map((booking) => {
          const summary = getSummary(booking);

          return (
            <Card key={booking.id} className="mb-md" onClick={() => openDetail(booking.id)}>
              <View className="flex items-start justify-between mb-sm">
                <View className="min-w-0 flex-1">
                  <Text className="font-bold text-base">{`预约 #${booking.id}`}</Text>
                  <View className="text-sm text-gray-500 mt-xs">{booking.address || '未填写地址'}</View>
                </View>
                <Tag variant={getStatusVariant(booking.statusGroup)}>
                  {booking.statusText || '处理中'}
                </Tag>
              </View>

              <View className="flex flex-col gap-xs text-sm">
                <View className="flex justify-between">
                  <Text className="text-gray-400">期望量房日期</Text>
                  <Text>{booking.preferredDate || '-'}</Text>
                </View>
                <View className="flex justify-between">
                  <Text className="text-gray-400">当前阶段</Text>
                  <Text>{booking.currentStageText || '-'}</Text>
                </View>
                <View className="flex justify-between items-start gap-sm">
                  <Text className="text-gray-400">{summary.title}</Text>
                  <Text
                    className={summary.highlight ? 'text-brand font-medium' : 'text-gray-600'}
                    style={{ textAlign: 'right' }}
                  >
                    {summary.value}
                  </Text>
                </View>
              </View>

              {booking.flowSummary ? (
                <View className="text-sm text-gray-500 mt-sm">{booking.flowSummary}</View>
              ) : null}

              <View className="flex justify-end mt-md">
                <View
                  onClick={(event) => {
                    event.stopPropagation?.();
                  }}
                >
                  <Button
                    size="small"
                    variant={booking.statusGroup === 'pending_payment' ? 'primary' : 'outline'}
                    loading={actingBookingId === booking.id}
                    onClick={() => {
                      void handlePrimaryAction(booking);
                    }}
                  >
                    {getActionLabel(booking)}
                  </Button>
                </View>
              </View>
            </Card>
          );
        })}
      </View>
    </View>
  );
};

export default BookingListPage;
