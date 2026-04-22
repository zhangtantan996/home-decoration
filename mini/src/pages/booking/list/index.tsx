import { useEffect, useMemo, useState } from 'react';
import { View } from '@tarojs/components';
import Taro from '@tarojs/taro';

import { Empty } from '@/components/Empty';
import { NotificationInboxCell } from '@/components/NotificationInboxCell';
import { NotificationSurfaceShell } from '@/components/NotificationSurfaceShell';
import { PullToRefreshNotice } from '@/components/PullToRefreshNotice';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import { usePullToRefreshFeedback } from '@/hooks/usePullToRefreshFeedback';
import { listBookings, type BookingItem } from '@/services/bookings';
import { useAuthStore } from '@/store/auth';
import { showErrorToast } from '@/utils/error';
import { formatServerDateTime } from '@/utils/serverTime';
import { navigateToSurveyDepositPaymentWithOptions } from '@/utils/surveyDepositPayment';

type BookingStatusTone = 'neutral' | 'brand' | 'success';

const sectionStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '16rpx',
};

const cellCardStyle = {
  overflow: 'hidden',
  borderRadius: '28rpx',
  background: 'rgba(255, 255, 255, 0.98)',
  border: '1rpx solid rgba(226, 232, 240, 0.96)',
  boxShadow: '0 10rpx 24rpx rgba(15, 23, 42, 0.04)',
};

const badgeRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '8rpx',
  flexWrap: 'wrap' as const,
};

const formatCurrency = (amount: number) => `¥${amount.toLocaleString()}`;

const getSurveyDepositAmount = (booking: BookingItem) => Number(booking.surveyDepositAmount || booking.surveyDeposit || 0);

const getStatusTone = (statusGroup?: BookingItem['statusGroup']): BookingStatusTone => {
  switch (statusGroup) {
    case 'pending_payment':
      return 'brand';
    case 'completed':
      return 'success';
    default:
      return 'neutral';
  }
};

const getActionLabel = (booking: BookingItem) => {
  switch (booking.statusGroup) {
    case 'pending_payment':
      return '支付量房费';
    case 'in_service':
      return '查看进度';
    default:
      return '查看详情';
  }
};

const getStatusLabel = (booking: BookingItem) => {
  if (booking.statusGroup === 'pending_payment') {
    const amount = getSurveyDepositAmount(booking);
    return amount > 0 ? `待支付 ${formatCurrency(amount)}` : '待支付量房费';
  }

  return booking.statusText || booking.currentStageText || '预约推进中';
};

const getSummary = (booking: BookingItem) => {
  const parts = [
    booking.currentStageText || booking.flowSummary || '预约推进中',
    booking.preferredDate ? `期望量房 ${booking.preferredDate}` : '',
    booking.area > 0 ? `${booking.area}㎡` : '',
    booking.houseLayout || '',
  ].filter(Boolean);

  return parts.join(' · ');
};

const getTimeLabel = (booking: BookingItem) => {
  if (booking.preferredDate) {
    return booking.preferredDate;
  }

  return booking.createdAt ? formatServerDateTime(booking.createdAt, '') : '';
};

const BookingListPage: React.FC = () => {
  const auth = useAuthStore();
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingBookingId, setActingBookingId] = useState<number | null>(null);

  const pendingCount = useMemo(
    () => bookings.filter((item) => item.statusGroup === 'pending_payment').length,
    [bookings],
  );

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
      <NotificationSurfaceShell className="page bg-gray-50 min-h-screen flex items-center justify-center" {...bindPullToRefresh}>
        <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />
        <Empty
          description="登录后查看预约列表"
          action={{ text: '去登录', onClick: () => Taro.switchTab({ url: '/pages/profile/index' }) }}
        />
      </NotificationSurfaceShell>
    );
  }

  if (loading && bookings.length === 0) {
    return (
      <NotificationSurfaceShell className="page bg-gray-50 min-h-screen" {...bindPullToRefresh}>
        <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />
        <View style={sectionStyle}>
          <Skeleton height={148} />
          <Skeleton height={148} />
          <Skeleton height={148} />
        </View>
      </NotificationSurfaceShell>
    );
  }

  if (bookings.length === 0) {
    return (
      <NotificationSurfaceShell className="page bg-gray-50 min-h-screen flex items-center justify-center" {...bindPullToRefresh}>
        <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />
        <Empty description="暂无预约记录" />
      </NotificationSurfaceShell>
    );
  }

  return (
    <NotificationSurfaceShell className="page bg-gray-50 min-h-screen" {...bindPullToRefresh}>
      <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />
      <View style={sectionStyle}>
        {pendingCount > 0 ? (
          <View style={cellCardStyle}>
            <NotificationInboxCell
              title="待处理预约"
              summary={`当前有 ${pendingCount} 条预约等待继续处理`}
              statusLabel="优先处理待支付与待确认记录"
              statusTone="brand"
              typeBadge={
                <View style={badgeRowStyle}>
                  <Tag variant="warning">待处理</Tag>
                </View>
              }
            />
          </View>
        ) : null}

        {bookings.map((booking) => (
          <View key={booking.id} style={cellCardStyle}>
            <NotificationInboxCell
              title={booking.address || `预约 #${booking.id}`}
              summary={getSummary(booking)}
              timeLabel={getTimeLabel(booking)}
              statusLabel={getStatusLabel(booking)}
              statusTone={getStatusTone(booking.statusGroup)}
              typeBadge={
                <View style={badgeRowStyle}>
                  <Tag variant={booking.statusGroup === 'pending_payment' ? 'warning' : 'default'}>
                    {booking.statusGroup === 'pending_payment' ? '待处理' : '预约'}
                  </Tag>
                </View>
              }
              actionText={actingBookingId === booking.id ? '处理中...' : getActionLabel(booking)}
              actionSecondary={booking.statusGroup !== 'pending_payment'}
              actionTone={booking.statusGroup === 'pending_payment' ? 'payment' : 'project'}
              onClick={() => openDetail(booking.id)}
              onActionClick={(event) => {
                event.stopPropagation?.();
                if (actingBookingId === booking.id) {
                  return;
                }
                void handlePrimaryAction(booking);
              }}
            />
          </View>
        ))}
      </View>
    </NotificationSurfaceShell>
  );
};

export default BookingListPage;
