import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Text, View } from '@tarojs/components';
import Taro, { useDidHide, useDidShow, useLoad } from '@tarojs/taro';

import { Button } from '@/components/Button';
import { Empty } from '@/components/Empty';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import { getBookingDetail, type BookingDetailResponse } from '@/services/bookings';
import { useAuthStore } from '@/store/auth';
import { showErrorToast } from '@/utils/error';

import './index.scss';

const ConstructionConfirmWaiting: React.FC = () => {
  const auth = useAuthStore();
  const [bookingId, setBookingId] = useState<number>(0);
  const [providerId, setProviderId] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<BookingDetailResponse | null>(null);
  const [pageVisible, setPageVisible] = useState(false);
  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useLoad((options) => {
    if (options.bookingId) {
      setBookingId(Number(options.bookingId));
    }
    if (options.providerId) {
      setProviderId(Number(options.providerId));
    }
  });

  const fetchDetail = useCallback(async () => {
    if (!bookingId || !auth.token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await getBookingDetail(bookingId);
      setDetail(res);

      // 如果工长已确认，停止轮询
      const currentStage = res.currentStage || res.booking.currentStage || res.businessStage;
      if (currentStage === 'construction_quote_pending' || currentStage === 'ready_to_start') {
        if (pollingTimerRef.current) {
          clearInterval(pollingTimerRef.current);
          pollingTimerRef.current = null;
        }
      }
    } catch (error) {
      showErrorToast(error, '加载失败');
    } finally {
      setLoading(false);
    }
  }, [bookingId, auth.token]);

  useEffect(() => {
    if (!bookingId || !auth.token) {
      return;
    }
    fetchDetail();
  }, [bookingId, auth.token, fetchDetail]);

  useDidShow(() => {
    setPageVisible(true);
  });

  useDidHide(() => {
    setPageVisible(false);
  });

  // 轮询工长确认状态
  useEffect(() => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }

    if (!pageVisible || !bookingId || !auth.token || !detail) {
      return;
    }

    const currentStage = detail.currentStage || detail.booking.currentStage || detail.businessStage;
    // 如果还在施工桥接中，启动轮询
    if (currentStage === 'construction_party_pending') {
      pollingTimerRef.current = setInterval(() => {
        fetchDetail();
      }, 5000); // 每5秒轮询一次
    }

    return () => {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
    };
  }, [pageVisible, bookingId, auth.token, detail, fetchDetail]);

  const handleGoToProject = () => {
    Taro.switchTab({ url: '/pages/progress/index' });
  };

  const handleBackToBooking = () => {
    Taro.navigateBack();
  };

  if (!auth.token) {
    return (
      <View className="page bg-gray-50 min-h-screen p-md">
        <Empty
          description="登录后查看确认状态"
          action={{ text: '去登录', onClick: () => Taro.switchTab({ url: '/pages/profile/index' }) }}
        />
      </View>
    );
  }

  if (loading) {
    return (
      <View className="page bg-gray-50 min-h-screen p-md">
        <Skeleton height={200} className="mb-md" />
        <Skeleton height={150} />
      </View>
    );
  }

  if (!detail) {
    return (
      <View className="page bg-gray-50 min-h-screen p-md">
        <Empty description="未找到预约信息" />
      </View>
    );
  }

  const currentStage = detail.currentStage || detail.booking.currentStage || detail.businessStage;
  const isConfirmed = currentStage === 'construction_quote_pending' || currentStage === 'ready_to_start';
  const isPending = currentStage === 'construction_party_pending';
  const providerName = detail.constructionSubjectDisplayName || '施工方';
  const providerType = detail.constructionSubjectType === 'company' ? '装修公司' : '独立工长';

  return (
    <View className="page construction-waiting-page bg-gray-50 min-h-screen">
      <View className="p-md">
        <View className="construction-waiting-page__card">
          <View className="construction-waiting-page__status-icon">
            {isConfirmed ? (
              <View className="construction-waiting-page__icon construction-waiting-page__icon--success">✓</View>
            ) : (
              <View className="construction-waiting-page__icon construction-waiting-page__icon--pending">
                <View className="construction-waiting-page__spinner" />
              </View>
            )}
          </View>

          <Text className="construction-waiting-page__title">
            {isConfirmed ? '施工主体已确认' : '施工桥接推进中'}
          </Text>

          <Text className="construction-waiting-page__subtitle">
            {isConfirmed
              ? `${providerName} 已确认承接施工任务`
              : `已向 ${providerName} 发送确认请求`}
          </Text>

          <View className="construction-waiting-page__info">
            <View className="construction-waiting-page__info-row">
              <Text className="construction-waiting-page__label">施工主体</Text>
              <View className="construction-waiting-page__value-group">
                <Text className="construction-waiting-page__value">{providerName}</Text>
                <Tag variant="brand">{providerType}</Tag>
              </View>
            </View>

            <View className="construction-waiting-page__info-row">
              <Text className="construction-waiting-page__label">确认状态</Text>
              <Tag variant={isConfirmed ? 'success' : 'warning'}>
                {isConfirmed ? '已确认' : '待确认'}
              </Tag>
            </View>
          </View>

          {isPending ? (
            <View className="construction-waiting-page__notice">
              <Text className="construction-waiting-page__notice-text">
                通常在24小时内确认，请耐心等待
              </Text>
            </View>
          ) : null}

          {isConfirmed ? (
            <View className="construction-waiting-page__success-notice">
              <Text className="construction-waiting-page__success-text">
                工长已确认，接下来将进入施工报价确认阶段
              </Text>
            </View>
          ) : null}

          <View className="construction-waiting-page__actions">
            {isConfirmed ? (
              <Button variant="primary" className="w-full" onClick={handleGoToProject}>
                查看项目进度
              </Button>
            ) : (
              <Button variant="outline" className="w-full" onClick={handleBackToBooking}>
                返回预约详情
              </Button>
            )}
          </View>
        </View>

        {detail.flowSummary ? (
          <View className="construction-waiting-page__flow-summary">
            <Text className="construction-waiting-page__flow-title">流程说明</Text>
            <Text className="construction-waiting-page__flow-text">{detail.flowSummary}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
};

export default ConstructionConfirmWaiting;
