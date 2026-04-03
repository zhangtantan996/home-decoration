import { useEffect, useState } from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { Cell } from '@nutui/nutui-react-taro';
import { Empty } from '@/components/Empty';
import { PullToRefreshNotice } from '@/components/PullToRefreshNotice';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import { usePullToRefreshFeedback } from '@/hooks/usePullToRefreshFeedback';
import { listBookings, type BookingItem } from '@/services/bookings';
import { useAuthStore } from '@/store/auth';
import { showErrorToast } from '@/utils/error';

type BookingTagVariant = 'default' | 'primary' | 'success' | 'warning' | 'error';

const getSurveyDepositAmount = (booking: BookingItem) => {
  const surveyDeposit = Number(booking.surveyDeposit || 0);
  if (surveyDeposit > 0) {
    return surveyDeposit;
  }
  const fallbackIntentFee = Number(booking.intentFee || 0);
  return fallbackIntentFee > 0 ? fallbackIntentFee : 0;
};

const getBookingSummary = (booking: BookingItem) => {
  if (booking.status === 4) {
    return { label: '预约状态', value: '已取消' };
  }
  if (booking.status === 1) {
    return { label: '当前进展', value: '待商家确认，确认后再支付量房费' };
  }
  if (booking.status === 2 && !booking.surveyDepositPaid) {
    return { label: '待支付量房费', value: `¥${getSurveyDepositAmount(booking).toLocaleString()}` };
  }
  if (booking.proposalId) {
    return { label: '当前进展', value: '已进入方案阶段' };
  }
  if (booking.surveyDepositPaid) {
    return { label: '当前进展', value: '量房费已支付，等待上门量房' };
  }
  return { label: '当前进展', value: '预约推进中' };
};

const BookingListPage: React.FC = () => {
  const auth = useAuthStore();
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(true);

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

  const getStatusText = (status: number) => {
    switch (status) {
      case 1: return '待确认';
      case 2: return '已确认';
      case 3: return '已完成';
      case 4: return '已取消';
      default: return '未知';
    }
  };

  const getStatusVariant = (status: number): BookingTagVariant => {
    switch (status) {
      case 1: return 'warning';
      case 2: return 'primary';
      case 3: return 'success';
      case 4: return 'default';
      default: return 'default';
    }
  };

  const handleViewDetail = (id: number) => {
    Taro.navigateTo({ url: `/pages/booking/detail/index?id=${id}` });
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
        <Skeleton height={100} className="mb-md" />
        <Skeleton height={100} className="mb-md" />
        <Skeleton height={100} />
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
      <View className="p-md">
        {bookings.map((booking) => {
          const summary = getBookingSummary(booking);

          return (
            <View key={booking.id} className="mb-md">
              <Cell
                title={
                  <View>
                    <View className="flex items-center justify-between mb-xs">
                      <Text className="font-bold">预约 #{booking.id}</Text>
                      <Tag variant={getStatusVariant(booking.status)}>
                        {getStatusText(booking.status)}
                      </Tag>
                    </View>
                    {booking.address && (
                      <Text className="text-sm text-gray-500">{booking.address}</Text>
                    )}
                  </View>
                }
                description={
                  <View className="mt-sm">
                    <View className="flex justify-between text-sm">
                      <Text className="text-gray-400">期望量房日期</Text>
                      <Text>{booking.preferredDate || '-'}</Text>
                    </View>
                    <View className="flex justify-between text-sm mt-xs">
                      <Text className="text-gray-400">{summary.label}</Text>
                      <Text className={summary.value.startsWith('¥') ? 'text-brand font-medium' : 'text-gray-600'}>
                        {summary.value}
                      </Text>
                    </View>
                  </View>
                }
                onClick={() => handleViewDetail(booking.id)}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
};

export default BookingListPage;
