import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from '@tarojs/components';
import Taro, { useDidShow, useLoad } from '@tarojs/taro';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Empty } from '@/components/Empty';
import { PullToRefreshNotice } from '@/components/PullToRefreshNotice';
import { Skeleton } from '@/components/Skeleton';
import { SurveyDepositQrDialog } from '@/components/SurveyDepositQrDialog';
import { Tag } from '@/components/Tag';
import { getBusinessStageStatus, getRefundStatus } from '@/constants/status';
import { usePullToRefreshFeedback } from '@/hooks/usePullToRefreshFeedback';
import { useSurveyDepositPaymentFlow } from '@/hooks/useSurveyDepositPaymentFlow';
import {
  getOrderCenterEntryDetail,
  payOrderCenterEntry,
  type OrderCenterEntryDetail,
} from '@/services/orderCenter';
import type { PaymentChannel, PaymentLaunchMode } from '@/services/payments';
import { useAuthStore } from '@/store/auth';
import { showErrorToast } from '@/utils/error';
import { getFixedBottomBarStyle, getPageBottomSpacerStyle } from '@/utils/fixedLayout';
import { consumePaymentRefreshNotice } from '@/utils/paymentRefresh';
import { formatSurveyDepositOrderNo } from '@/utils/orderRoutes';
import { formatServerDateTime } from '@/utils/serverTime';
import {
  normalizeSurveyDepositPaymentAction,
  resolveSurveyDepositTerminalType,
  type SurveyDepositPaymentAction,
} from '@/utils/surveyDepositPayment';

import './index.scss';

const formatCurrency = (amount?: number) => `¥${Number(amount || 0).toLocaleString()}`;

const buildSurveyDepositEntryKey = (bookingId?: number) => (
  bookingId ? `survey_deposit:${bookingId}` : ''
);

const getOrderStatusMeta = (detail: OrderCenterEntryDetail) => {
  if (detail.refundSummary?.latestRefundStatus === 'completed' || detail.booking?.surveyDepositRefunded) {
    return { label: '已退款', variant: 'brand' as const, desc: '退款已完成' };
  }
  if (detail.refundSummary?.latestRefundStatus === 'pending' || detail.refundSummary?.latestRefundStatus === 'approved') {
    return { label: '退款中', variant: 'warning' as const, desc: '退款申请正在处理中' };
  }

  switch (detail.statusGroup) {
    case 'paid':
      return { label: detail.statusText || '已支付', variant: 'success' as const, desc: '订单已支付，等待履约' };
    case 'cancelled':
      return { label: detail.statusText || '已取消', variant: 'default' as const, desc: '订单已取消' };
    default:
      return { label: detail.statusText || '待支付', variant: 'warning' as const, desc: '请尽快完成支付' };
  }
};

interface DetailRowProps {
  label: string;
  value?: string;
  extra?: React.ReactNode;
  multiline?: boolean;
}

const DetailRow: React.FC<DetailRowProps> = ({ label, value = '-', extra, multiline = false }) => (
  <View className={`survey-deposit-page__detail-row${multiline ? ' survey-deposit-page__detail-row--multiline' : ''}`}>
    <View className="survey-deposit-page__detail-main">
      <Text className="survey-deposit-page__detail-label">{label}</Text>
      <Text className="survey-deposit-page__detail-value">{value || '-'}</Text>
    </View>
    {extra ? <View className="survey-deposit-page__detail-extra">{extra}</View> : null}
  </View>
);

const SurveyDepositOrderPage: React.FC = () => {
  const auth = useAuthStore();
  const [entryKey, setEntryKey] = useState('');
  const [fallbackBookingId, setFallbackBookingId] = useState(0);
  const [autoLaunchAction, setAutoLaunchAction] = useState<SurveyDepositPaymentAction | null>(null);
  const [entryOrderNo, setEntryOrderNo] = useState('');
  const [detail, setDetail] = useState<OrderCenterEntryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const didFirstShowRef = useRef(true);

  const pageBottomStyle = useMemo(() => getPageBottomSpacerStyle(), []);
  const fixedBottomBarStyle = useMemo(() => getFixedBottomBarStyle(), []);

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
    } catch (error) {
      setDetail(null);
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

  const launchPayment = useCallback((action: SurveyDepositPaymentAction) => (
    payOrderCenterEntry(entryKey, {
      channel: action.channel,
      terminalType: resolveSurveyDepositTerminalType(action),
    })
  ), [entryKey]);

  const {
    launchingChannel,
    qrPayment,
    remainingSeconds,
    closeQrPayment,
    chooseAndLaunch,
    canPay,
  } = useSurveyDepositPaymentFlow({
    bookingId: detail?.booking?.id,
    amount: detail?.amount || 0,
    paymentOptions: detail?.availablePaymentOptions,
    autoLaunchAction,
    isPaid: detail?.statusGroup === 'paid',
    onPaid: fetchDetail,
    launchPayment,
    source: fallbackBookingId ? {
      sourceType: 'survey_deposit_order',
      bookingId: fallbackBookingId,
      entryKey,
    } : undefined,
  });

  const handleCopy = (value: string) => {
    Taro.setClipboardData({
      data: value,
      success: () => Taro.showToast({ title: '已复制', icon: 'none' }),
    });
  };

  const handleRefundAction = () => {
    if (!detail?.booking?.id) {
      return;
    }

    const refundSummary = detail.refundSummary;
    if (refundSummary?.canApplyRefund) {
      Taro.navigateTo({ url: `/pages/bookings/refund/index?id=${detail.booking.id}` });
      return;
    }

    if (refundSummary?.latestRefundId) {
      Taro.navigateTo({ url: `/pages/refunds/list/index?bookingId=${detail.booking.id}` });
      return;
    }

    const reason = refundSummary?.refundableAmount && refundSummary.refundableAmount > 0
      ? '当前退款条件未满足，请稍后再试。'
      : '当前预约暂无可退金额。';

    Taro.showModal({
      title: '暂不可退款',
      content: reason,
      showCancel: false,
      confirmText: '知道了',
    });
  };

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
        <Skeleton height={156} className="mb-md" />
        <Skeleton height={220} className="mb-md" />
        <Skeleton height={180} className="mb-md" />
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
  const refundStatus = getRefundStatus(detail.refundSummary?.latestRefundStatus);
  const amount = Number(detail.amount || detail.booking.surveyDeposit || detail.booking.intentFee || 0);
  const orderNo = detail.referenceNo || formatSurveyDepositOrderNo(booking.id || fallbackBookingId, entryOrderNo);
  const canApplyRefund = Boolean(detail.refundSummary?.canApplyRefund);
  const showPayBar = canPay && detail.statusGroup !== 'cancelled';
  const paidAmount = detail.statusGroup === 'paid' || detail.statusGroup === 'refund'
    ? amount
    : 0;
  const refundActionLabel = canApplyRefund
    ? '申请退款'
    : detail.refundSummary?.latestRefundId
      ? '查看进度'
      : '退款说明';

  return (
    <View
      className="survey-deposit-page page bg-gray-50 min-h-screen"
      style={showPayBar ? pageBottomStyle : undefined}
      {...bindPullToRefresh}
    >
      <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />
      <View className="survey-deposit-page__container">
        <View className="survey-deposit-page__status-card">
          <View className="survey-deposit-page__status-main">
            <Text className="survey-deposit-page__status-title">{orderStatus.label}</Text>
            <Text className="survey-deposit-page__status-desc">{orderStatus.desc}</Text>
          </View>
          <Tag variant={orderStatus.variant}>{orderStatus.label}</Tag>
        </View>

        <Card className="mb-md" title="关联信息">
          <View className="survey-deposit-page__section">
            <DetailRow label="服务商" value={detail.provider?.name || '待分配'} />
            <DetailRow label="项目地址" value={booking.address || detail.project?.address || '-'} multiline />
            {stageMeta ? (
              <DetailRow
                label="当前进展"
                value={stageMeta.label}
                extra={<Tag variant={stageMeta.variant}>{stageMeta.label}</Tag>}
              />
            ) : null}
          </View>
        </Card>

        <Card className="mb-md" title="金额信息">
          <View className="survey-deposit-page__section">
            <View className="survey-deposit-page__amount-row">
              <Text className="survey-deposit-page__amount-row-label">订单总额</Text>
              <Text className="survey-deposit-page__amount-row-value">{formatCurrency(amount)}</Text>
            </View>
            <View className="survey-deposit-page__amount-row">
              <Text className="survey-deposit-page__amount-row-label">应付金额</Text>
              <Text className="survey-deposit-page__amount-row-value survey-deposit-page__amount-row-value--highlight">
                {formatCurrency(detail.payableAmount || amount)}
              </Text>
            </View>
            <View className="survey-deposit-page__amount-divider" />
            <View className="survey-deposit-page__amount-row survey-deposit-page__amount-row--compact">
              <Text className="survey-deposit-page__amount-row-label">已支付金额</Text>
              <Text className="survey-deposit-page__amount-row-value">{formatCurrency(paidAmount)}</Text>
            </View>
          </View>
        </Card>

        <Card className="mb-md" title="订单信息">
          <View className="survey-deposit-page__section">
            <DetailRow
              label="订单编号"
              value={orderNo}
              extra={<Text className="survey-deposit-page__copy" onClick={() => handleCopy(orderNo)}>复制</Text>}
            />
            <DetailRow label="下单时间" value={formatServerDateTime(detail.createdAt)} />
            <DetailRow label="预约量房时间" value={booking.preferredDate || '-'} />
            {booking.surveyDepositPaidAt ? (
              <DetailRow label="支付时间" value={formatServerDateTime(booking.surveyDepositPaidAt)} />
            ) : null}
          </View>
        </Card>

        <Card className="mb-md" title="退款与售后">
          <View className="survey-deposit-page__section">
            <DetailRow
              label="退款状态"
              value={detail.refundSummary?.latestRefundId ? `申请单 #${detail.refundSummary.latestRefundId}` : '当前未发起退款'}
              extra={<Tag variant={refundStatus.variant}>{refundStatus.label}</Tag>}
            />
            <DetailRow label="可退金额" value={formatCurrency(detail.refundSummary?.refundableAmount || 0)} />
            {booking.surveyRefundNotice ? (
              <View className="survey-deposit-page__refund-note">{booking.surveyRefundNotice}</View>
            ) : null}
            <View className="survey-deposit-page__action-row">
              <Button
                variant="outline"
                block
                onClick={() => Taro.navigateTo({ url: `/pages/refunds/list/index?bookingId=${booking.id}` })}
              >
                查看记录
              </Button>
              <Button
                block
                variant={canApplyRefund ? 'primary' : 'outline'}
                onClick={handleRefundAction}
              >
                {refundActionLabel}
              </Button>
            </View>
          </View>
        </Card>
      </View>

      {showPayBar ? (
        <View className="survey-deposit-page__bottom-bar" style={fixedBottomBarStyle}>
          <Button
            variant="primary"
            size="lg"
            block
            loading={!!launchingChannel}
            disabled={!!launchingChannel}
            onClick={() => {
              void chooseAndLaunch();
            }}
          >
            去支付
          </Button>
        </View>
      ) : null}

      {qrPayment ? (
        <SurveyDepositQrDialog
          amount={qrPayment.amount}
          classNamePrefix="survey-deposit-page"
          expired={qrPayment.expired}
          onClose={closeQrPayment}
          qrCodeImageUrl={qrPayment.qrCodeImageUrl}
          remainingSeconds={remainingSeconds}
          statusText={qrPayment.statusText}
        />
      ) : null}
    </View>
  );
};

export default SurveyDepositOrderPage;
