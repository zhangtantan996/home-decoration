import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Text, View } from '@tarojs/components';
import Taro, { useDidHide, useDidShow, useLoad } from '@tarojs/taro';

import { Empty } from '@/components/Empty';
import { Icon } from '@/components/Icon';
import MiniPageNav from '@/components/MiniPageNav';
import { PullToRefreshNotice } from '@/components/PullToRefreshNotice';
import { Skeleton } from '@/components/Skeleton';
import { usePullToRefreshFeedback } from '@/hooks/usePullToRefreshFeedback';
import { cancelBooking, getBookingDetail, type BookingDetailResponse } from '@/services/bookings';
import { useAuthStore } from '@/store/auth';
import { showErrorToast } from '@/utils/error';
import { consumePaymentRefreshNotice } from '@/utils/paymentRefresh';
import { normalizeProviderMediaUrl } from '@/utils/providerMedia';
import { formatServerDateTime } from '@/utils/serverTime';
import { navigateToSurveyDepositPaymentWithOptions } from '@/utils/surveyDepositPayment';

import './index.scss';

type BookingStepState = 'done' | 'current' | 'upcoming';

const normalizeText = (value?: string, fallback = '-') => {
  const text = String(value || '').trim();
  return text || fallback;
};

const maskPhone = (value?: string) => {
  const phone = String(value || '').replace(/\s+/g, '');
  if (/^1\d{10}$/.test(phone)) {
    return `${phone.slice(0, 3)}****${phone.slice(7)}`;
  }
  return phone || '-';
};

const resolveStatusTone = (detail: BookingDetailResponse) => {
  const statusGroup = detail.statusGroup || detail.booking.statusGroup;
  if (statusGroup === 'pending_confirmation' || statusGroup === 'pending_payment') {
    return { label: '待处理', tone: 'pending' as const };
  }
  if (statusGroup === 'completed') {
    return { label: '已完成', tone: 'success' as const };
  }
  if (statusGroup === 'cancelled') {
    return { label: '已取消', tone: 'muted' as const };
  }
  return { label: '服务中', tone: 'active' as const };
};

const canPromptSurveyDepositPayment = (detail: BookingDetailResponse) => (
  !detail.booking.surveyDepositPaid
  && (detail.booking.status === 2 || (detail.surveyDepositPaymentOptions?.length ?? 0) > 0)
  && (detail.statusGroup || detail.booking.statusGroup) !== 'cancelled'
);

const resolveSummaryTitle = (detail: BookingDetailResponse) => {
  const statusGroup = detail.statusGroup || detail.booking.statusGroup;
  if (statusGroup === 'pending_confirmation') {
    return '量房服务待确认';
  }
  if (statusGroup === 'pending_payment') {
    return '量房费用待支付';
  }
  if (statusGroup === 'completed') {
    return '量房服务已完成';
  }
  if (statusGroup === 'cancelled') {
    return '预约服务已取消';
  }
  return '量房服务进行中';
};

const resolveProgressStepIndex = (detail: BookingDetailResponse) => {
  const statusGroup = detail.statusGroup || detail.booking.statusGroup;
  if (statusGroup === 'completed') {
    return 4;
  }
  if (statusGroup === 'pending_payment' || statusGroup === 'in_service') {
    return 3;
  }
  if (statusGroup === 'pending_confirmation') {
    return 2;
  }
  return 1;
};

const resolvePrimaryAction = (detail: BookingDetailResponse) => {
  if (canPromptSurveyDepositPayment(detail)) {
    return { label: '去支付', action: 'pay' as const };
  }
  if (detail.siteSurveySummary) {
    return { label: '查看量房', action: 'site-survey' as const };
  }
  if (detail.provider?.id) {
    return { label: '查看服务方', action: 'provider' as const };
  }
  return null;
};

const resolveSecondaryAction = (detail: BookingDetailResponse) => {
  const availableActions = detail.availableActions || detail.booking.availableActions || [];
  if (availableActions.includes('cancel')) {
    return { label: '取消预约', action: 'cancel' as const };
  }
  if (detail.provider?.id) {
    return { label: '查看服务方', action: 'provider' as const };
  }
  return null;
};

const BookingDetailPage: React.FC = () => {
  const auth = useAuthStore();
  const [id, setId] = useState<number>(0);
  const [routeReady, setRouteReady] = useState(false);
  const [pageVisible, setPageVisible] = useState(false);
  const [detail, setDetail] = useState<BookingDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const didFirstShowRef = useRef(true);
  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useLoad((options) => {
    setId(Number(options.id || 0));
    setRouteReady(true);
  });

  const fetchDetail = useCallback(async () => {
    if (!id) {
      setDetail(null);
      setLoading(false);
      return;
    }
    if (!auth.token) {
      setDetail(null);
      setLoading(false);
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
    }
  }, [auth.token, id]);

  const { refreshStatus, drawerHeight, drawerProgress, bindPullToRefresh, runReload } =
    usePullToRefreshFeedback(fetchDetail);

  useEffect(() => {
    if (!routeReady) {
      return;
    }
    if (!id) {
      setDetail(null);
      setLoading(false);
      return;
    }
    void runReload();
  }, [auth.token, id, routeReady, runReload]);

  useDidShow(() => {
    setPageVisible(true);
    if (didFirstShowRef.current) {
      didFirstShowRef.current = false;
      return;
    }
    if (!routeReady || !id || !auth.token) {
      return;
    }
    consumePaymentRefreshNotice();
    void runReload();
  });

  useDidHide(() => {
    setPageVisible(false);
  });

  useEffect(() => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }

    const statusGroup = detail?.statusGroup || detail?.booking?.statusGroup;
    if (!pageVisible || !routeReady || !id || !auth.token) {
      return;
    }
    if (statusGroup !== 'pending_confirmation' && statusGroup !== 'pending_payment') {
      return;
    }

    pollingTimerRef.current = setInterval(() => {
      void runReload();
    }, 10000);

    return () => {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
    };
  }, [auth.token, detail?.booking?.statusGroup, detail?.statusGroup, id, pageVisible, routeReady, runReload]);

  const handleBack = useCallback(() => {
    if (Taro.getCurrentPages().length > 1) {
      void Taro.navigateBack();
      return;
    }
    void Taro.switchTab({ url: '/pages/messages/index' });
  }, []);

  const handleOpenProvider = useCallback(() => {
    if (!detail?.provider?.id) {
      Taro.showToast({ title: '暂无服务方详情', icon: 'none' });
      return;
    }
    void Taro.navigateTo({
      url: `/pages/providers/detail/index?id=${detail.provider.id}&type=${detail.provider.providerType || 'designer'}`,
    });
  }, [detail?.provider?.id, detail?.provider?.providerType]);

  const handleMoreAction = useCallback(async () => {
    const items = ['刷新页面'];
    if (detail?.provider?.id) {
      items.push('查看服务方');
    }
    try {
      const res = await Taro.showActionSheet({ itemList: items });
      if (res.tapIndex === 0) {
        await runReload();
        return;
      }
      handleOpenProvider();
    } catch {
      return;
    }
  }, [detail?.provider?.id, handleOpenProvider, runReload]);

  const handleCancelBooking = useCallback(async () => {
    if (!detail?.booking?.id || actionLoading) {
      return;
    }
    Taro.showModal({
      title: '取消预约',
      content: '确定取消当前预约吗？',
      success: async (res) => {
        if (!res.confirm) {
          return;
        }
        try {
          setActionLoading(true);
          await cancelBooking(detail.booking.id);
          Taro.showToast({ title: '已取消', icon: 'success' });
          await fetchDetail();
        } catch (error) {
          showErrorToast(error, '取消失败');
        } finally {
          setActionLoading(false);
        }
      },
    });
  }, [actionLoading, detail?.booking?.id, fetchDetail]);

  const handleOpenSiteSurvey = useCallback(() => {
    if (!detail?.booking?.id) {
      return;
    }
    void Taro.navigateTo({ url: `/pages/booking/site-survey/index?id=${detail.booking.id}` });
  }, [detail?.booking?.id]);

  const handlePaySurveyDeposit = useCallback(async () => {
    if (!detail?.booking?.id) {
      return;
    }
    try {
      setActionLoading(true);
      await navigateToSurveyDepositPaymentWithOptions(
        detail.booking.id,
        detail.surveyDepositPaymentOptions,
      );
    } finally {
      setActionLoading(false);
    }
  }, [detail?.booking?.id, detail?.surveyDepositPaymentOptions]);

  const handlePrimaryAction = useCallback(async () => {
    if (!detail) {
      return;
    }
    const action = resolvePrimaryAction(detail);
    if (!action) {
      return;
    }
    if (action.action === 'pay') {
      await handlePaySurveyDeposit();
      return;
    }
    if (action.action === 'site-survey') {
      handleOpenSiteSurvey();
      return;
    }
    handleOpenProvider();
  }, [detail, handleOpenProvider, handleOpenSiteSurvey, handlePaySurveyDeposit]);

  const handleSecondaryAction = useCallback(async () => {
    if (!detail) {
      return;
    }
    const action = resolveSecondaryAction(detail);
    if (!action) {
      return;
    }
    if (action.action === 'cancel') {
      await handleCancelBooking();
      return;
    }
    handleOpenProvider();
  }, [detail, handleCancelBooking, handleOpenProvider]);

  if (!auth.token) {
    return (
      <View className="page booking-detail-page" {...bindPullToRefresh}>
        <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />
        <MiniPageNav title="预约详情" onBack={handleBack} placeholder />
        <Empty
          description="登录后查看预约详情"
          action={{ text: '去登录', onClick: () => Taro.switchTab({ url: '/pages/profile/index' }) }}
        />
      </View>
    );
  }

  if (loading) {
    return (
      <View className="page booking-detail-page" {...bindPullToRefresh}>
        <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />
        <MiniPageNav title="预约详情" onBack={handleBack} placeholder />
        <View className="booking-detail-page__loading">
          <Skeleton height={220} className="booking-detail-page__section" />
          <Skeleton height={150} className="booking-detail-page__section" />
          <Skeleton height={120} className="booking-detail-page__section" />
          <Skeleton height={220} className="booking-detail-page__section" />
        </View>
      </View>
    );
  }

  if (!detail?.booking) {
    return (
      <View className="page booking-detail-page" {...bindPullToRefresh}>
        <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />
        <MiniPageNav title="预约详情" onBack={handleBack} placeholder />
        <Empty
          description="未找到预约信息"
          action={{ text: '返回上一页', onClick: handleBack }}
        />
      </View>
    );
  }

  const booking = detail.booking;
  const status = resolveStatusTone(detail);
  const progressStepIndex = resolveProgressStepIndex(detail);
  const providerAvatar = normalizeProviderMediaUrl(detail.provider?.avatar || '', '');
  const canRenderProviderAvatar = /^https:\/\//i.test(providerAvatar);
  const providerInitial = (detail.provider?.name || '服').slice(0, 1);
  const providerSummary = [
    detail.provider?.specialty || '',
    detail.provider?.yearsExperience ? `从业${detail.provider.yearsExperience}年` : '',
    detail.provider?.completedCnt ? `服务${detail.provider.completedCnt}+户` : '',
  ].filter(Boolean).join(' · ') || '服务信息待补充';
  const infoRows = [
    { label: '预约单号', value: `#${booking.id}` },
    { label: '服务类型', value: '量房服务' },
    { label: '房屋信息', value: [normalizeText(booking.houseLayout, ''), booking.area ? `${booking.area}㎡` : ''].filter(Boolean).join(' ｜ ') || '-' },
    { label: '联系电话', value: maskPhone(booking.phone) },
    { label: '备注', value: normalizeText(booking.notes) },
  ];
  const primaryAction = resolvePrimaryAction(detail);
  const secondaryActionRaw = resolveSecondaryAction(detail);
  const secondaryAction = secondaryActionRaw && primaryAction && secondaryActionRaw.action === primaryAction.action
    ? null
    : secondaryActionRaw;
  const showFooter = Boolean(primaryAction || secondaryAction);

  return (
    <View className={`page booking-detail-page ${showFooter ? 'booking-detail-page--with-footer' : ''}`} {...bindPullToRefresh}>
      <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />

      <MiniPageNav
        title="预约详情"
        onBack={handleBack}
        placeholder
        rightSlot={(
          <View className="booking-detail-page__nav-action" onClick={handleMoreAction}>
            <Icon name="more-horizontal" size={22} color="#111111" />
          </View>
        )}
      />

      <View className="booking-detail-page__content">
        <View className="booking-detail-page__card booking-detail-page__summary-card">
          <View className="booking-detail-page__summary-head">
            <Text className="booking-detail-page__summary-title">{resolveSummaryTitle(detail)}</Text>
            <View className={`booking-detail-page__summary-badge booking-detail-page__summary-badge--${status.tone}`}>
              <Text className={`booking-detail-page__summary-badge-text booking-detail-page__summary-badge-text--${status.tone}`}>{status.label}</Text>
            </View>
          </View>

          <View className="booking-detail-page__summary-facts">
            <View className="booking-detail-page__summary-fact">
              <View className="booking-detail-page__summary-fact-icon">
                <Icon name="calendar" size={20} color="#9CA3AF" />
              </View>
              <View className="booking-detail-page__summary-fact-main">
                <Text className="booking-detail-page__summary-fact-label">预约时间</Text>
                <Text className="booking-detail-page__summary-fact-value">{normalizeText(booking.preferredDate)}</Text>
              </View>
            </View>
            <View className="booking-detail-page__summary-fact">
              <View className="booking-detail-page__summary-fact-icon">
                <Icon name="location-pin" size={20} color="#9CA3AF" />
              </View>
              <View className="booking-detail-page__summary-fact-main">
                <Text className="booking-detail-page__summary-fact-label">上门地址</Text>
                <Text className="booking-detail-page__summary-fact-value">{normalizeText(booking.address)}</Text>
              </View>
            </View>
          </View>
        </View>

        <View className="booking-detail-page__card">
          <Text className="booking-detail-page__card-title">预约进展</Text>
          <View className="booking-detail-page__progress">
            {[
              { label: '提交预约', subLabel: formatServerDateTime(booking.createdAt, '--').replace(`${new Date().getFullYear()}-`, '') },
              { label: '确认时间' },
              { label: '上门量房' },
              { label: '服务完成' },
            ].map((step, index) => {
              const stepNo = index + 1;
              const state: BookingStepState =
                progressStepIndex > stepNo ? 'done' : progressStepIndex === stepNo ? 'current' : 'upcoming';
              return (
                <View key={step.label} className="booking-detail-page__progress-item">
                  <View className={`booking-detail-page__progress-node booking-detail-page__progress-node--${state}`}>
                    <Text className={`booking-detail-page__progress-node-text booking-detail-page__progress-node-text--${state}`}>
                      {state === 'done' ? '✓' : stepNo}
                    </Text>
                  </View>
                  {stepNo < 4 ? (
                    <View className={`booking-detail-page__progress-line booking-detail-page__progress-line--${progressStepIndex > stepNo ? 'done' : 'upcoming'}`} />
                  ) : null}
                  <Text className={`booking-detail-page__progress-label booking-detail-page__progress-label--${state}`}>{step.label}</Text>
                  {step.subLabel ? <Text className="booking-detail-page__progress-sublabel">{step.subLabel}</Text> : null}
                </View>
              );
            })}
          </View>
        </View>

        {detail.provider ? (
          <View className="booking-detail-page__card">
            <Text className="booking-detail-page__card-title">服务方信息</Text>
            <View className="booking-detail-page__provider-row" onClick={handleOpenProvider}>
              <View className="booking-detail-page__provider-main">
                {canRenderProviderAvatar ? (
                  <Image className="booking-detail-page__provider-avatar" src={providerAvatar} mode="aspectFill" />
                ) : (
                  <View className="booking-detail-page__provider-avatar booking-detail-page__provider-avatar--fallback">
                    <Text className="booking-detail-page__provider-avatar-text">{providerInitial}</Text>
                  </View>
                )}
                <View className="booking-detail-page__provider-copy">
                  <Text className="booking-detail-page__provider-name">{normalizeText(detail.provider.name)}</Text>
                  <Text className="booking-detail-page__provider-meta">{providerSummary}</Text>
                </View>
              </View>
              <View className="booking-detail-page__provider-call">
                <Icon name="phone" size={22} color="#111111" />
              </View>
            </View>
          </View>
        ) : null}

        <View className="booking-detail-page__card">
          <Text className="booking-detail-page__card-title">预约信息</Text>
          <View className="booking-detail-page__info-list">
            {infoRows.map((row) => (
              <View key={row.label} className="booking-detail-page__info-row">
                <Text className="booking-detail-page__info-label">{row.label}</Text>
                <Text className="booking-detail-page__info-value">{row.value}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {showFooter ? (
        <View className="booking-detail-page__footer">
          {secondaryAction ? (
            <View className="booking-detail-page__footer-button booking-detail-page__footer-button--secondary" onClick={handleSecondaryAction}>
              <Text className="booking-detail-page__footer-button-text booking-detail-page__footer-button-text--secondary">{secondaryAction.label}</Text>
            </View>
          ) : null}
          {primaryAction ? (
            <View className="booking-detail-page__footer-button booking-detail-page__footer-button--primary" onClick={handlePrimaryAction}>
              <Text className="booking-detail-page__footer-button-text booking-detail-page__footer-button-text--primary">
                {actionLoading ? '处理中...' : primaryAction.label}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
};

export default BookingDetailPage;
