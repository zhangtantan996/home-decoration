import { useEffect, useMemo, useState } from 'react';
import { View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { navigateBackWithFallback } from '@/utils/navigation';

import { Empty } from '@/components/Empty';
import MiniPageNav from '@/components/MiniPageNav';
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
      return '查看预约';
    case 'in_service':
      return '查看跟进';
    default:
      return '查看详情';
  }
};

const getStatusLabel = (booking: BookingItem) => {
  if (booking.statusGroup === 'pending_payment') {
    return '待平台联系';
  }

  return booking.statusText || booking.currentStageText || '预约跟进中';
};

const getSummary = (booking: BookingItem) => {
  const parts = [
    booking.currentStageText || booking.flowSummary || '预约跟进中',
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

  const handleBack = () => {
    navigateBackWithFallback('/pages/profile/index');
  };

  const handlePrimaryAction = (booking: BookingItem) => {
    openDetail(booking.id);
  };

  if (!auth.token) {
    return (
      <NotificationSurfaceShell className="page bg-gray-50 min-h-screen flex items-center justify-center" {...bindPullToRefresh}>
        <MiniPageNav title="我的预约" onBack={handleBack} placeholder />
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
        <MiniPageNav title="我的预约" onBack={handleBack} placeholder />
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
        <MiniPageNav title="我的预约" onBack={handleBack} placeholder />
        <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />
        <Empty description="暂无预约记录" />
      </NotificationSurfaceShell>
    );
  }

  return (
    <NotificationSurfaceShell className="page bg-gray-50 min-h-screen" {...bindPullToRefresh}>
      <MiniPageNav title="我的预约" onBack={handleBack} placeholder />
      <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />
      <View style={sectionStyle}>
        {pendingCount > 0 ? (
          <View style={cellCardStyle}>
            <NotificationInboxCell
              title="待处理预约"
              summary={`当前有 ${pendingCount} 条预约等待继续处理`}
              statusLabel="平台工作人员会线下联系跟进"
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
              actionText={getActionLabel(booking)}
              actionSecondary={booking.statusGroup !== 'pending_payment'}
              actionTone="project"
              onClick={() => openDetail(booking.id)}
              onActionClick={(event) => {
                event.stopPropagation?.();
                handlePrimaryAction(booking);
              }}
            />
          </View>
        ))}
      </View>
    </NotificationSurfaceShell>
  );
};

export default BookingListPage;
