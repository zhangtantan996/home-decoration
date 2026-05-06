import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View } from '@tarojs/components';
import Taro, { useDidShow, useLoad } from '@tarojs/taro';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Empty } from '@/components/Empty';
import { NotificationActionBar } from '@/components/NotificationActionBar';
import { NotificationFactRows } from '@/components/NotificationFactRows';
import { NotificationSurfaceShell } from '@/components/NotificationSurfaceShell';
import { PullToRefreshNotice } from '@/components/PullToRefreshNotice';
import { Skeleton } from '@/components/Skeleton';
import { SurveyDepositQrDialog } from '@/components/SurveyDepositQrDialog';
import { Tag } from '@/components/Tag';
import { getBusinessStageStatus, getRefundStatus } from '@/constants/status';
import { usePullToRefreshFeedback } from '@/hooks/usePullToRefreshFeedback';
import { useSurveyDepositPaymentFlow } from '@/hooks/useSurveyDepositPaymentFlow';
import { getBookingDetail, type SurveyDepositPaymentOption } from '@/services/bookings';
import {
  cancelOrderCenterEntry,
  getOrderCenterEntryDetail,
  payOrderCenterEntry,
  type OrderCenterEntryDetail,
} from '@/services/orderCenter';
import type { PaymentChannel, PaymentLaunchMode } from '@/services/payments';
import { useAuthStore } from '@/store/auth';
import { showErrorToast } from '@/utils/error';
import { getPageBottomSpacerStyle } from '@/utils/fixedLayout';
import { deriveOrderEntryActions } from '@/utils/orderEntryActions';
import { consumePaymentRefreshNotice } from '@/utils/paymentRefresh';
import { buildSurveyDepositDetailUrl, formatSurveyDepositOrderNo } from '@/utils/orderRoutes';
import { formatServerDateTime } from '@/utils/serverTime';
import {
  normalizeSurveyDepositPaymentAction,
  resolveSurveyDepositTerminalType,
  type SurveyDepositPaymentAction,
} from '@/utils/surveyDepositPayment';

import '../detail/index.scss';
import './index.scss';

const formatCurrency = (amount?: number) => `¥${Number(amount || 0).toLocaleString()}`;

const buildSurveyDepositEntryKey = (bookingId?: number) => (
  bookingId ? `survey_deposit:${bookingId}` : ''
);

const getOrderStatusMeta = (detail: OrderCenterEntryDetail) => {
  if (detail.refundSummary?.latestRefundStatus === 'completed' || detail.booking?.surveyDepositRefunded) {
    return { label: '已退款', variant: 'brand' as const };
  }
  if (detail.refundSummary?.latestRefundStatus === 'pending' || detail.refundSummary?.latestRefundStatus === 'approved') {
    return { label: '退款中', variant: 'brand' as const };
  }

  switch (detail.statusGroup) {
    case 'paid':
      return {
        label: detail.statusText || '已支付',
        variant: 'success' as const,
      };
    case 'cancelled':
      return {
        label: detail.statusText || '已取消',
        variant: 'default' as const,
      };
    case 'refund':
      return {
        label: detail.statusText || '退款中',
        variant: 'brand' as const,
      };
    default:
      return {
        label: detail.statusText || '待支付',
        variant: 'warning' as const,
      };
  }
};

interface DetailRowProps {
  label: string;
  value?: string;
  extra?: React.ReactNode;
  multiline?: boolean;
  onClick?: () => void;
}

const DetailRow: React.FC<DetailRowProps> = ({
  label,
  value = '-',
  extra,
  multiline = false,
  onClick,
}) => (
  <View
    className={`order-detail-page__row${multiline ? ' order-detail-page__row--multiline' : ''}${onClick ? ' order-detail-page__row--clickable' : ''}`}
    onClick={onClick}
    hoverClass={onClick ? 'order-detail-page__row--pressed' : 'none'}
  >
    <View className="order-detail-page__row-main">
      <Text className="order-detail-page__row-label">{label}</Text>
      <View className="order-detail-page__row-value-wrap">
        <Text className="order-detail-page__row-value">{value || '-'}</Text>
        {extra}
      </View>
    </View>
  </View>
);

const SurveyDepositOrderPage: React.FC = () => {
  const auth = useAuthStore();
  const [entryKey, setEntryKey] = useState('');
  const [fallbackBookingId, setFallbackBookingId] = useState(0);
  const [autoLaunchAction, setAutoLaunchAction] = useState<SurveyDepositPaymentAction | null>(null);
  const [entryOrderNo, setEntryOrderNo] = useState('');
  const [detail, setDetail] = useState<OrderCenterEntryDetail | null>(null);
  const [fallbackPaymentOptions, setFallbackPaymentOptions] = useState<SurveyDepositPaymentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const didFirstShowRef = useRef(true);

  const pageBottomStyle = useMemo(() => getPageBottomSpacerStyle(120), []);

  useLoad((options) => {
    const bookingId = Number(options.id || 0);
    const nextEntryKey = options.entryKey
      ? decodeURIComponent(options.entryKey)
      : buildSurveyDepositEntryKey(bookingId);

    setFallbackBookingId(bookingId);
    setEntryKey(nextEntryKey);
    setEntryOrderNo(options.orderNo ? decodeURIComponent(options.orderNo) : '');
    setAutoLaunchAction(normalizeSurveyDepositPaymentAction({
      channel: options.autoPayChannel as PaymentChannel | undefined,
      launchMode: options.autoPayLaunchMode as PaymentLaunchMode | undefined,
    }));
  });

  const fetchDetail = useCallback(async () => {
    if (!entryKey) {
      return;
    }

    if (!auth.token) {
      setDetail(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await getOrderCenterEntryDetail(entryKey);
      setDetail(res);
      setFallbackPaymentOptions([]);
    } catch (error) {
      setDetail(null);
      setFallbackPaymentOptions([]);
      showErrorToast(error, '加载失败');
    } finally {
      setLoading(false);
    }
  }, [auth.token, entryKey]);

  const { refreshStatus, drawerHeight, drawerProgress, bindPullToRefresh, runReload } =
    usePullToRefreshFeedback(fetchDetail);

  useEffect(() => {
    void runReload();
  }, [auth.token, entryKey, runReload]);

  useDidShow(() => {
    if (!fallbackBookingId) {
      return;
    }
    if (didFirstShowRef.current) {
      didFirstShowRef.current = false;
      return;
    }
    if (auth.token && consumePaymentRefreshNotice()) {
      void runReload();
    }
  });

  useEffect(() => {
    if (!auth.token || !detail?.booking?.id) {
      return;
    }
    if (detail.statusGroup !== 'pending_payment') {
      return;
    }
    const bookingId = detail.booking.id;
    const paymentOptionCount = detail.availablePaymentOptions?.length ?? 0;

    if (paymentOptionCount > 0) {
      return;
    }

    let cancelled = false;

    const loadFallbackPaymentOptions = async () => {
      try {
        const bookingDetail = await getBookingDetail(bookingId);
        if (!cancelled) {
          setFallbackPaymentOptions(bookingDetail.surveyDepositPaymentOptions || []);
        }
      } catch {
        if (!cancelled) {
          setFallbackPaymentOptions([]);
        }
      }
    };

    void loadFallbackPaymentOptions();

    return () => {
      cancelled = true;
    };
  }, [auth.token, detail?.availablePaymentOptions?.length, detail?.booking?.id, detail?.statusGroup]);

  const resolvedPaymentOptions = useMemo(
    () => ((detail?.availablePaymentOptions?.length ?? 0) > 0
      ? detail?.availablePaymentOptions
      : fallbackPaymentOptions),
    [detail?.availablePaymentOptions, fallbackPaymentOptions],
  );

  const launchPayment = useCallback((action: SurveyDepositPaymentAction) => (
    payOrderCenterEntry(entryKey, {
      channel: action.channel,
      terminalType: resolveSurveyDepositTerminalType(action),
    })
  ), [entryKey]);

  const {
    launchingChannel,
    qrPayment,
    qrConfirmLoading,
    remainingSeconds,
    closeQrPayment,
    confirmQrPayment,
    retryQrPayment,
    launchPreferredChannel,
    chooseAndLaunch,
    canPay,
    canPayWithWechat,
    canPayWithAlipay,
  } = useSurveyDepositPaymentFlow({
    bookingId: detail?.booking?.id,
    amount: detail?.amount || 0,
    paymentOptions: resolvedPaymentOptions,
    autoLaunchAction,
    isPaid: detail?.statusGroup === 'paid',
    onPaid: fetchDetail,
    launchPayment,
    source: fallbackBookingId ? {
      returnUrl: buildSurveyDepositDetailUrl(fallbackBookingId, { entryKey, orderNo: entryOrderNo || detail?.referenceNo }),
      bookingId: fallbackBookingId,
      entryKey,
    } : undefined,
    amountLabel: '待支付量房费',
  });

  const handleCancel = async () => {
    if (!entryKey || submitting) {
      return;
    }

    Taro.showModal({
      title: '取消预约',
      content: '确定要取消当前量房费订单吗？取消后预约会同步关闭。',
      success: async (res) => {
        if (!res.confirm) {
          return;
        }
        setSubmitting(true);
        try {
          await cancelOrderCenterEntry(entryKey);
          Taro.showToast({ title: '已取消', icon: 'success' });
          await fetchDetail();
        } catch (error) {
          showErrorToast(error, '取消失败');
        } finally {
          setSubmitting(false);
        }
      },
    });
  };

  const handleCopy = (value: string) => {
    Taro.setClipboardData({
      data: value,
      success: () => Taro.showToast({ title: '已复制', icon: 'none' }),
    });
  };

  const handleViewRefundRecords = useCallback(() => {
    if (!detail?.booking?.id) {
      return;
    }
    Taro.navigateTo({ url: `/pages/refunds/list/index?bookingId=${detail.booking.id}` });
  }, [detail?.booking?.id]);

  const handleApplyRefund = useCallback(() => {
    if (!detail?.booking?.id) {
      return;
    }
    Taro.navigateTo({ url: `/pages/bookings/refund/index?id=${detail.booking.id}` });
  }, [detail?.booking?.id]);

  if (!auth.token) {
    return (
      <View className="page bg-gray-50 min-h-screen p-md" {...bindPullToRefresh}>
        <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />
        <Empty
          description="登录后查看量房费详情"
          action={{ text: '去登录', onClick: () => Taro.switchTab({ url: '/pages/profile/index' }) }}
        />
      </View>
    );
  }

  if (loading) {
    return (
      <View className="page bg-gray-50 min-h-screen p-md" {...bindPullToRefresh}>
        <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />
        <Skeleton height={380} className="mb-md" />
        <Skeleton height={220} className="mb-md" />
        <Skeleton height={220} className="mb-md" />
      </View>
    );
  }

  if (!detail?.booking) {
    return (
      <View className="page bg-gray-50 min-h-screen p-md flex items-center justify-center" {...bindPullToRefresh}>
        <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />
        <Empty description="未找到量房费订单" />
      </View>
    );
  }

  const booking = detail.booking;
  const orderStatus = getOrderStatusMeta(detail);
  const stageMeta = detail.businessStage
    ? getBusinessStageStatus(detail.businessStage)
    : null;
  const refundStatus = detail.refundSummary?.latestRefundStatus
    ? getRefundStatus(detail.refundSummary.latestRefundStatus)
    : detail.statusGroup === 'refund'
      ? { label: detail.statusText || '退款中', variant: 'brand' as const }
      : getRefundStatus(undefined);
  const amount = Number(detail.amount || detail.booking.surveyDeposit || 0);
  const payableAmount = Number(detail.payableAmount || amount);
  const orderNo = detail.referenceNo || formatSurveyDepositOrderNo(booking.id || fallbackBookingId, entryOrderNo);
  const entryActions = deriveOrderEntryActions({
    statusGroup: detail.statusGroup,
    refundSummary: detail.refundSummary,
    canPay,
    canCancel: Boolean(detail.canCancel),
  });
  const showPayBar = detail.statusGroup === 'pending_payment' && entryActions.showFooterPayBar;
  const showCancelButton = showPayBar && entryActions.showFooterCancel;
  const showRefundSection = Boolean(
    detail.refundSummary?.latestRefundId
      || detail.refundSummary?.latestRefundStatus
      || detail.statusGroup === 'refund'
      || booking.surveyDepositRefunded,
  );
  const detailActions = entryActions.detailActions.filter((action) => {
    if (action.key === 'view_refund') {
      return Boolean(booking.id && entryActions.hasRefundRecord);
    }
    if (action.key === 'apply_refund') {
      return Boolean(booking.id && entryActions.canApplyRefund);
    }
    return false;
  });
  const actionCount = showPayBar
    ? [showCancelButton, true, canPayWithAlipay].filter(Boolean).length
    : detailActions.length;
  const showActionBar = showPayBar || detailActions.length > 0;
  const providerName = detail.provider?.name || '待分配';
  const orderAddress = booking.address || detail.project?.address || '地址待同步';
  const refundAmount = Math.min(
    Number(detail.refundSummary?.refundableAmount || 0) || amount,
    amount || Number(detail.refundSummary?.refundableAmount || 0),
  );
  const summaryRows = [
    { label: '当前进展', value: stageMeta?.label || detail.statusText || '待同步' },
    { label: '预约量房', value: booking.preferredDate || '待同步' },
    ...(booking.surveyDepositPaidAt ? [{ label: '支付时间', value: formatServerDateTime(booking.surveyDepositPaidAt) }] : []),
    { label: '下单时间', value: formatServerDateTime(detail.createdAt) },
  ];

  return (
    <View
      className="order-detail-page survey-deposit-page page"
      style={showActionBar ? pageBottomStyle : undefined}
      {...bindPullToRefresh}
    >
      <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />

      <NotificationSurfaceShell className="order-detail-page__shell">
        <ScrollView scrollY className="h-full">
          <Card className="order-detail-page__summary-card">
            <View className="order-detail-page__summary-head">
              <View className="order-detail-page__summary-main">
                <Text className="order-detail-page__summary-eyebrow">量房费订单</Text>
                <Text className="order-detail-page__summary-amount">{formatCurrency(showPayBar ? payableAmount : amount)}</Text>
                <Text className="order-detail-page__summary-title">{detail.title || '量房费'}</Text>
              </View>
              <Tag variant={orderStatus.variant}>{orderStatus.label}</Tag>
            </View>

            <View className="order-detail-page__summary-facts">
              <View className="order-detail-page__summary-fact">
                <Text className="order-detail-page__summary-fact-label">服务商</Text>
                <Text className="order-detail-page__summary-fact-value">{providerName}</Text>
              </View>
              <View className="order-detail-page__summary-fact">
                <Text className="order-detail-page__summary-fact-label">地址</Text>
                <Text className="order-detail-page__summary-fact-value">{orderAddress}</Text>
              </View>
            </View>

            <View className="order-detail-page__summary-rows">
              {summaryRows.map((item) => (
                <DetailRow key={item.label} label={item.label} value={item.value} />
              ))}
              <DetailRow
                label="订单编号"
                value={orderNo}
                extra={(
                  <View className="order-detail-page__row-link" onClick={() => handleCopy(orderNo)}>
                    <Text className="order-detail-page__row-link-text">复制</Text>
                  </View>
                )}
              />
            </View>
          </Card>

          {showRefundSection ? (
            <Card className="notification-surface-card" title="退款进度">
              <NotificationFactRows
                compact
                items={[
                  { label: '当前状态', value: refundStatus.label },
                  { label: '涉及金额', value: formatCurrency(refundAmount) },
                ]}
              />
            </Card>
          ) : null}
        </ScrollView>
      </NotificationSurfaceShell>

      {showActionBar ? (
        <NotificationActionBar single={actionCount <= 1}>
          {showPayBar && showCancelButton ? (
            <Button
              variant="outline"
              disabled={submitting || !!launchingChannel}
              onClick={() => {
                void handleCancel();
              }}
            >
              取消预约
            </Button>
          ) : null}
          {showPayBar ? (
            <Button
              variant="primary"
              loading={!!launchingChannel}
              disabled={submitting || !!launchingChannel}
              onClick={() => {
                void (canPayWithWechat ? launchPreferredChannel('wechat') : chooseAndLaunch());
              }}
            >
              {canPayWithWechat ? '微信支付' : '去支付'}
            </Button>
          ) : null}
          {showPayBar && canPayWithAlipay ? (
            <Button
              variant="outline"
              size="sm"
              disabled={submitting || !!launchingChannel}
              onClick={() => {
                void launchPreferredChannel('alipay');
              }}
            >
              支付宝扫码
            </Button>
          ) : null}
          {!showPayBar ? detailActions.map((action) => (
            <Button
              key={action.key}
              variant={action.variant}
              onClick={() => {
                if (action.key === 'view_refund') {
                  handleViewRefundRecords();
                  return;
                }
                handleApplyRefund();
              }}
            >
              {action.label}
            </Button>
          )) : null}
        </NotificationActionBar>
      ) : null}

      {qrPayment ? (
        <SurveyDepositQrDialog
          amount={qrPayment.amount}
          amountLabel="待支付量房费"
          classNamePrefix="survey-deposit-page"
          onClose={closeQrPayment}
          onConfirmPaid={() => {
            void confirmQrPayment();
          }}
          onRetry={() => {
            void retryQrPayment();
          }}
          phase={qrPayment.phase}
          confirmLoading={qrConfirmLoading}
          qrCodeImageUrl={qrPayment.qrCodeImageUrl}
          remainingSeconds={remainingSeconds}
          statusText={qrPayment.statusText}
          statusTone={qrPayment.statusTone}
        />
      ) : null}
    </View>
  );
};

export default SurveyDepositOrderPage;
