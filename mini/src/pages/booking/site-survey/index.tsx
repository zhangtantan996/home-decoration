import { useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, Text, View } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';

import { Empty } from '@/components/Empty';
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

  const fetchDetail = async () => {
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
  };

  useEffect(() => {
    void fetchDetail();
  }, [bookingId]);

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
      <View className="p-md bg-gray-50 min-h-screen" style={pageBottomStyle}>
        <Empty
          description="当前预约还没有量房资料"
          action={{
            text: '返回预约详情',
            onClick: () => Taro.redirectTo({ url: `/pages/booking/detail/index?id=${bookingId}` }),
          }}
        />
      </View>
    );
  }

  const status = readStatusMeta(detail.status);
  const photos = detail.photos || [];
  const dimensions = Object.entries(detail.dimensions || {});

  return (
    <View className="page bg-gray-50 min-h-screen" style={pageBottomStyle}>
      <ScrollView scrollY className="h-full">
        <View className="bg-white p-md mb-sm flex justify-between items-center">
          <View>
            <View className="text-lg font-bold mb-xs">量房资料</View>
            <View className="text-sm text-gray-500">预约单 #{bookingId}</View>
          </View>
          <Tag variant={status.variant}>{status.text}</Tag>
        </View>

        <View className="bg-white p-md mb-sm">
          <View className="font-bold mb-md text-base">记录摘要</View>
          <View className="space-y-sm text-sm text-gray-700">
            <View className="flex justify-between py-xs border-b border-gray-100">
              <Text className="text-gray-500">提交时间</Text>
              <Text>{formatServerDateTime(detail.submittedAt, '待提交')}</Text>
            </View>
            <View className="flex justify-between py-xs border-b border-gray-100">
              <Text className="text-gray-500">补充时间</Text>
              <Text>{formatServerDateTime(detail.revisionRequestedAt, '无')}</Text>
            </View>
            <View className="flex justify-between py-xs">
              <Text className="text-gray-500">图片数量</Text>
              <Text>{photos.length} 张</Text>
            </View>
          </View>
        </View>

        <View className="bg-white p-md mb-sm">
          <View className="font-bold mb-md text-base">量房备注</View>
          <View className="text-sm text-gray-700 leading-relaxed">{detail.notes || '暂无备注说明'}</View>
          {detail.revisionRequestReason ? (
            <View className="text-sm text-red-500 mt-md">补充说明：{detail.revisionRequestReason}</View>
          ) : null}
        </View>

        <View className="bg-white p-md mb-sm">
          <View className="font-bold mb-md text-base">空间尺寸</View>
          {dimensions.length === 0 ? (
            <View className="text-sm text-gray-500">暂无尺寸明细</View>
          ) : (
            <View className="space-y-sm">
              {dimensions.map(([space, dimension]) => (
                <View key={space} className="border border-gray-100 rounded-lg p-sm">
                  <View className="flex justify-between items-center mb-xs">
                    <Text className="font-medium">{space}</Text>
                    <Tag variant="default">{dimension.unit || 'cm'}</Tag>
                  </View>
                  <View className="text-sm text-gray-600">
                    长：{readDimension(dimension.length)} / 宽：{readDimension(dimension.width)} / 高：{readDimension(dimension.height)}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        <View className="bg-white p-md mb-xl">
          <View className="font-bold mb-md text-base">量房照片</View>
          {photos.length === 0 ? (
            <View className="text-sm text-gray-500">暂无量房照片</View>
          ) : (
            <View className="space-y-sm">
              {photos.map((photo, index) => (
                <View key={`${photo}-${index}`} className="border border-gray-100 rounded-lg overflow-hidden">
                  <Image
                    className="w-full"
                    mode="widthFix"
                    src={photo}
                    onClick={() => {
                      Taro.previewImage({
                        current: photo,
                        urls: photos,
                      });
                    }}
                  />
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

export default BookingSiteSurveyPage;
