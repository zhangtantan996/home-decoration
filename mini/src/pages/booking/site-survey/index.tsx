import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, Text, View } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';

import { Card } from '@/components/Card';
import { Empty } from '@/components/Empty';
import { NotificationFactRows } from '@/components/NotificationFactRows';
import { NotificationSurfaceHero } from '@/components/NotificationSurfaceHero';
import { NotificationSurfaceShell } from '@/components/NotificationSurfaceShell';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import { getBookingSiteSurvey, type BookingSiteSurveySummary } from '@/services/bookings';
import { showErrorToast } from '@/utils/error';
import { getPageBottomSpacerStyle } from '@/utils/fixedLayout';
import { formatServerDateTime } from '@/utils/serverTime';

const readStatusMeta = (status?: string) => {
  switch (status) {
    case 'submitted':
      return { text: '已上传', variant: 'warning' as const };
    case 'confirmed':
      return { text: '已确认', variant: 'success' as const };
    case 'revision_requested':
      return { text: '待补充', variant: 'error' as const };
    default:
      return { text: status || '待上传', variant: 'default' as const };
  }
};

const readDimension = (value?: number) => {
  if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) {
    return '-';
  }
  return `${value}`;
};

const BookingSiteSurveyPage: React.FC = () => {
  const [bookingId, setBookingId] = useState(0);
  const [detail, setDetail] = useState<BookingSiteSurveySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const pageBottomStyle = useMemo(() => getPageBottomSpacerStyle(), []);

  useLoad((options) => {
    if (options.id) {
      setBookingId(Number(options.id));
    }
  });

  const fetchDetail = useCallback(async () => {
    if (!bookingId) {
      setLoading(false);
      setDetail(null);
      return;
    }
    setLoading(true);
    try {
      const result = await getBookingSiteSurvey(bookingId);
      setDetail(result.siteSurvey || null);
    } catch (error) {
      showErrorToast(error, '加载量房资料失败');
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  if (loading) {
    return (
      <View className="p-md bg-gray-50 min-h-screen">
        <Skeleton height={220} className="mb-md" />
        <Skeleton height={220} className="mb-md" />
        <Skeleton height={180} />
      </View>
    );
  }

  if (!detail) {
    return (
      <NotificationSurfaceShell className="p-md bg-gray-50 min-h-screen" style={pageBottomStyle}>
        <View className="notification-surface-state-card">
          <Empty
            description="当前预约还没有量房资料"
            action={{
              text: '返回预约详情',
              onClick: () => Taro.redirectTo({ url: `/pages/booking/detail/index?id=${bookingId}` }),
            }}
          />
        </View>
      </NotificationSurfaceShell>
    );
  }

  const status = readStatusMeta(detail.status);
  const photos = detail.photos || [];
  const dimensions = Object.entries(detail.dimensions || {});

  return (
    <NotificationSurfaceShell className="page bg-gray-50 min-h-screen" style={pageBottomStyle}>
      <ScrollView scrollY className="h-full">
        <View className="notification-surface-shell__body">
          <NotificationSurfaceHero
            eyebrow="量房资料"
            title={status.text}
            subtitle={`预约单 #${bookingId}`}
            status={<Tag variant={status.variant}>{status.text}</Tag>}
            summary={detail.revisionRequestReason || detail.notes || '查看已提交的量房资料'}
            metrics={[
              { label: '照片数量', value: `${photos.length} 张` },
              { label: '提交时间', value: formatServerDateTime(detail.submittedAt, '待提交'), emphasis: true },
            ]}
          />

          <Card className="notification-surface-card" title="资料状态">
            <NotificationFactRows
              items={[
                { label: '当前状态', value: status.text },
                { label: '提交时间', value: formatServerDateTime(detail.submittedAt, '待提交') },
                { label: '补充时间', value: formatServerDateTime(detail.revisionRequestedAt, '无') },
                { label: '照片数量', value: `${photos.length} 张` },
                detail.revisionRequestReason
                  ? { label: '补充原因', value: detail.revisionRequestReason, danger: true, multiline: true }
                  : { label: '备注', value: detail.notes || '暂无补充说明', multiline: true },
              ]}
            />
          </Card>

          <Card className="notification-surface-card" title="空间尺寸">
            {dimensions.length === 0 ? (
              <Text className="notification-section-row__note">暂无尺寸明细</Text>
            ) : (
              <View className="notification-section-list">
                {dimensions.map(([space, dimension]) => (
                  <View key={space} className="notification-section-row">
                    <View className="notification-section-row__head">
                      <Text className="notification-section-row__title">{space}</Text>
                      <Text className="notification-section-row__value">{dimension.unit || 'cm'}</Text>
                    </View>
                    <Text className="notification-section-row__note">
                      长 {readDimension(dimension.length)} / 宽 {readDimension(dimension.width)} / 高 {readDimension(dimension.height)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </Card>

          <Card className="notification-surface-card" title="量房照片">
            {photos.length === 0 ? (
              <Text className="notification-section-row__note">暂无量房照片</Text>
            ) : (
              <View className="notification-gallery">
                {photos.map((photo, index) => (
                  <Image
                    key={`${photo}-${index}`}
                    className="notification-gallery__item"
                    mode="aspectFill"
                    src={photo}
                    style={{ height: '220rpx' }}
                    onClick={() => {
                      Taro.previewImage({
                        current: photo,
                        urls: photos,
                      });
                    }}
                  />
                ))}
              </View>
            )}
          </Card>
        </View>
      </ScrollView>
    </NotificationSurfaceShell>
  );
};

export default BookingSiteSurveyPage;
