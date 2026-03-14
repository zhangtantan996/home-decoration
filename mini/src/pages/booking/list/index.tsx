import React, { useEffect, useState } from 'react';
import { View, Text } from '@tarojs/components';
import Taro, { usePullDownRefresh } from '@tarojs/taro';
import { Cell, Empty, Tag } from '@nutui/nutui-react-taro';
import { Skeleton } from '@/components/Skeleton';
import { listBookings, type BookingItem } from '@/services/bookings';
import { useAuthStore } from '@/store/auth';
import { showErrorToast } from '@/utils/error';

const BookingListPage: React.FC = () => {
  const auth = useAuthStore();
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBookings = async () => {
    if (!auth.token) {
      setBookings([]);
      setLoading(false);
      Taro.stopPullDownRefresh();
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
      Taro.stopPullDownRefresh();
    }
  };

  useEffect(() => {
    fetchBookings();
  }, [auth.token]); // eslint-disable-line react-hooks/exhaustive-deps

  usePullDownRefresh(() => {
    fetchBookings();
  });

  const getStatusText = (status: number) => {
    switch (status) {
      case 1: return '待确认';
      case 2: return '已确认';
      case 3: return '已完成';
      case 4: return '已取消';
      default: return '未知';
    }
  };

  const getStatusVariant = (status: number): 'default' | 'primary' | 'success' | 'warning' | 'danger' => {
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
      <View className="page bg-gray-50 min-h-screen p-md flex items-center justify-center">
        <Empty
          description="登录后查看预约列表"
          action={{ text: '去登录', onClick: () => Taro.switchTab({ url: '/pages/profile/index' }) }}
        />
      </View>
    );
  }

  if (loading && bookings.length === 0) {
    return (
      <View className="page bg-gray-50 min-h-screen p-md">
        <Skeleton height={100} className="mb-md" />
        <Skeleton height={100} className="mb-md" />
        <Skeleton height={100} />
      </View>
    );
  }

  if (bookings.length === 0) {
    return (
      <View className="page bg-gray-50 min-h-screen p-md flex items-center justify-center">
        <Empty description="暂无预约记录" />
      </View>
    );
  }

  return (
    <View className="page bg-gray-50 min-h-screen pb-md">
      <View className="p-md">
        {bookings.map((booking) => (
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
                  {booking.intentFee && (
                    <View className="flex justify-between text-sm mt-xs">
                      <Text className="text-gray-400">意向金</Text>
                      <Text className="text-brand font-medium">¥{booking.intentFee.toLocaleString()}</Text>
                    </View>
                  )}
                </View>
              }
              onClick={() => handleViewDetail(booking.id)}
            />
          </View>
        ))}
      </View>
    </View>
  );
};

export default BookingListPage;
