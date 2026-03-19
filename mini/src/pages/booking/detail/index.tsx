import React, { useEffect, useState } from 'react';
import { Text, View } from '@tarojs/components';
import Taro, { useLoad, usePullDownRefresh } from '@tarojs/taro';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Empty } from '@/components/Empty';
import { ListItem } from '@/components/ListItem';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import { getBookingDetail, payIntentFee, type BookingDetailResponse } from '@/services/bookings';
import { useAuthStore } from '@/store/auth';
import { showErrorToast } from '@/utils/error';

const getStatusMeta = (status: number) => {
  switch (status) {
    case 1:
      return { label: '待确认', variant: 'warning' as const };
    case 2:
      return { label: '已确认', variant: 'primary' as const };
    case 3:
      return { label: '已完成', variant: 'success' as const };
    case 4:
      return { label: '已取消', variant: 'default' as const };
    default:
      return { label: '未知状态', variant: 'default' as const };
  }
};

const BookingDetailPage: React.FC = () => {
  const auth = useAuthStore();
  const [id, setId] = useState<number>(0);
  const [detail, setDetail] = useState<BookingDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  useLoad((options) => {
    if (options.id) {
      setId(Number(options.id));
    }
  });

  const fetchDetail = async () => {
    if (!id) {
      return;
    }
    if (!auth.token) {
      setDetail(null);
      setLoading(false);
      Taro.stopPullDownRefresh();
      return;
    }

    setLoading(true);
    try {
      const res = await getBookingDetail(id);
      setDetail(res);
    } catch (error) {
      showErrorToast(error, '加载失败');
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

  const handlePayIntent = async () => {
    if (!detail?.booking || paying) {
      return;
    }
    setPaying(true);
    try {
      await payIntentFee(detail.booking.id);
      Taro.showToast({ title: '支付成功', icon: 'success' });
      await fetchDetail();
    } catch (error) {
      showErrorToast(error, '支付失败');
    } finally {
      setPaying(false);
    }
  };

  if (!auth.token) {
    return (
      <View className="page bg-gray-50 min-h-screen p-md">
        <Empty
          description="登录后查看预约详情"
          action={{ text: '去登录', onClick: () => Taro.switchTab({ url: '/pages/profile/index' }) }}
        />
      </View>
    );
  }

  if (loading) {
    return (
      <View className="page bg-gray-50 min-h-screen p-md">
        <Skeleton height={180} className="mb-md" />
        <Skeleton height={200} className="mb-md" />
      </View>
    );
  }

  if (!detail?.booking) {
    return <View className="p-md text-center text-gray-500">未找到预约信息</View>;
  }

  const booking = detail.booking;
  const status = getStatusMeta(booking.status);

  return (
    <View className="page bg-gray-50 min-h-screen p-md">
      <Card
        title={`预约 #${booking.id}`}
        extra={<Tag variant={status.variant}>{status.label}</Tag>}
        className="mb-md"
      >
        <View className="flex flex-col gap-sm mt-sm">
          <ListItem title="项目地址" description={booking.address || '-'} />
          <ListItem title="房屋面积" description={booking.area ? `${booking.area} m²` : '-'} />
          <ListItem title="期望量房日期" description={booking.preferredDate || '-'} />
          <ListItem title="联系电话" description={booking.phone || '-'} />
          {booking.notes ? <ListItem title="备注需求" description={booking.notes} /> : null}
        </View>
      </Card>

      {detail.provider ? (
        <Card title="服务商信息" className="mb-md">
          <ListItem
            title={detail.provider.name || `服务商 #${detail.provider.id}`}
            description={detail.provider.specialty || '暂无服务介绍'}
            extra={detail.provider.rating ? <Text className="text-brand">{detail.provider.rating.toFixed(1)} 分</Text> : undefined}
          />
        </Card>
      ) : null}

      <Card title="下一步" className="mb-md">
        {!booking.intentFeePaid ? (
          <View className="flex items-center justify-between">
            <View>
              <Text className="text-sm text-gray-500">意向金</Text>
              <Text className="text-lg font-bold text-brand">¥{booking.intentFee?.toLocaleString() || '0'}</Text>
            </View>
            <Button variant="primary" size="sm" onClick={handlePayIntent} loading={paying} disabled={paying}>
              支付意向金
            </Button>
          </View>
        ) : detail.proposalId ? (
          <Button
            variant="primary"
            className="w-full"
            onClick={() => Taro.navigateTo({ url: `/pages/proposals/detail/index?id=${detail.proposalId}` })}
          >
            查看设计方案
          </Button>
        ) : (
          <Text className="text-sm text-gray-500">已支付意向金，等待商家提交方案。</Text>
        )}
      </Card>
    </View>
  );
};

export default BookingDetailPage;
