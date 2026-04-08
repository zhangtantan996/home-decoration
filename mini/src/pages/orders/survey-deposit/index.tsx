import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from '@tarojs/components';
import Taro, { useDidShow, useLoad } from '@tarojs/taro';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Empty } from '@/components/Empty';
import { Icon, type IconName } from '@/components/Icon';
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
import { getFixedBottomBarStyle, getPageBottomSpacerStyle } from '@/utils/fixedLayout';
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
    return { label: '已退款', variant: 'brand' as const, desc: '退款已完成', icon: 'pending' as IconName };
  }
  if (detail.refundSummary?.latestRefundStatus === 'pending' || detail.refundSummary?.latestRefundStatus === 'approved') {
    return { label: '退款中', variant: 'brand' as const, desc: '退款申请正在处理中', icon: 'pending' as IconName };
  }

  switch (detail.statusGroup) {
    case 'paid':
      return {
        label: detail.statusText || '已支付',
        variant: 'success' as const,
        desc: '订单已支付，服务人员将尽快与您联系',
        icon: 'success' as IconName,
      };
    case 'cancelled':
      return {
        label: detail.statusText || '已取消',
        variant: 'default' as const,
        desc: '订单已取消，如有需要请重新发起预约',
        icon: 'about' as IconName,
      };
    default:
      return {
        label: detail.statusText || '待支付',
        variant: 'warning' as const,
        desc: '请尽快完成支付，以免订单失效',
        icon: 'history' as IconName,
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
    className={`order-detail-page__detail-row${multiline ? ' order-detail-page__detail-row--multiline' : ''}${onClick ? ' order-detail-page__detail-row--clickable' : ''}`}
    onClick={onClick}
  >
    <View className="order-detail-page__detail-main">
      <Text className="order-detail-page__detail-label">{label}</Text>
      <View className="flex items-center">
        <Text className="order-detail-page__detail-value">{value || '-'}</Text>
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
    if ((detail.availablePaymentOptions?.length ?? 0) > 0) {
      return;
    }

    let cancelled = false;

    const loadFallbackPaymentOptions = async () => {
      try {
        const bookingDetail = await getBookingDetail(detail.booking!.id);
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
  }, [auth.token, detail?.availablePaymentOptions, detail?.booking?.id, detail?.statusGroup]);

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
    remainingSeconds,
    closeQrPayment,
    chooseAndLaunch,
    canPay,
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
  const orderNo = detail.referenceNo || formatSurveyDepositOrderNo(booking.id || fallbackBookingId, entryOrderNo);
  const entryActions = deriveOrderEntryActions({
    statusGroup: detail.statusGroup,
    refundSummary: detail.refundSummary,
    canPay,
    canCancel: Boolean(detail.canCancel),
  });
  const showPayBar = detail.statusGroup === 'pending_payment';
  const showCancelButton = showPayBar && entryActions.showFooterCancel;
  const showRefundSection = entryActions.showRefundSection && Boolean(detail.refundSummary || detail.statusGroup === 'refund');
  const payableAmount = Number(detail.payableAmount || amount);
  const paidAmount = detail.statusGroup === 'paid' || detail.statusGroup === 'refund'
    ? amount
    : 0;
  const detailActions = entryActions.detailActions.filter((action) => {
    if (action.key === 'view_refund') {
      return Boolean(booking.id && entryActions.hasRefundRecord);
    }
    if (action.key === 'apply_refund') {
      return Boolean(booking.id && entryActions.canApplyRefund);
    }
    return false;
  });
  const reminderNotes = [booking.surveyRefundNotice].filter(Boolean) as string[];

  return (
    <View
      className="order-detail-page survey-deposit-page page"
      style={showPayBar ? pageBottomStyle : undefined}
      {...bindPullToRefresh}
    >
      <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />

      <View className={`order-detail-page__status-header order-detail-page__status-header--${detail.statusGroup}`}>
        <View className="order-detail-page__status-main">
          <Text className="order-detail-page__status-title">{orderStatus.label}</Text>
          <Text className="order-detail-page__status-desc">{orderStatus.desc}</Text>
        </View>
        <View className="order-detail-page__status-icon-wrapper">
          <Icon name={orderStatus.icon} size={64} color="#FFFFFF" />
        </View>
      </View>

      <View className="order-detail-page__container">
        <Card className="order-detail-page__card" title="关联服务信息">
          <View className="order-detail-page__section">
            <DetailRow
              label="服务方"
              value={detail.provider?.name || '待分配'}
              extra={detail.provider?.id ? <Text className="order-detail-page__link">查看</Text> : undefined}
              onClick={detail.provider?.id
                ? () => Taro.navigateTo({
                    url: `/pages/providers/detail/index?id=${detail.provider?.id}&type=${detail.provider?.providerType || 'designer'}`,
                  })
                : undefined}
            />
            <DetailRow label="项目地址" value={booking.address || detail.project?.address || '-'} multiline />
            {stageMeta ? (
              <DetailRow
                label="当前进展"
                value={stageMeta.label}
              />
            ) : null}
          </View>
        </Card>

        {reminderNotes.length > 0 ? (
          <Card className="order-detail-page__card" title="温馨提醒">
            <View className="order-detail-page__section pb-md">
              {reminderNotes.map((note) => (
                <View key={note} className="order-detail-page__note">
                  {note}
                </View>
              ))}
            </View>
          </Card>
        ) : null}

        <Card className="order-detail-page__card" title="费用清单">
          <View className="order-detail-page__section pb-md pt-sm">
            <View className="order-detail-page__amount-row">
              <Text className="order-detail-page__amount-label">订单总额</Text>
              <Text className="order-detail-page__amount-value">{formatCurrency(amount)}</Text>
            </View>
            <View className="order-detail-page__amount-row">
              <Text className="order-detail-page__amount-label">已支付</Text>
              <Text className="order-detail-page__amount-value">{formatCurrency(paidAmount)}</Text>
            </View>
            <View className="order-detail-page__amount-row order-detail-page__amount-row--highlight">
              <Text className="order-detail-page__amount-label">{showPayBar ? '待支付金额' : '合计应付'}</Text>
              <Text className="order-detail-page__amount-value">
                {formatCurrency(showPayBar ? payableAmount : amount)}
              </Text>
            </View>
          </View>
        </Card>

        {showRefundSection ? (
          <Card className="order-detail-page__card" title="退款服务">
            <View className="order-detail-page__section pb-md">
              <DetailRow
                label="当前状态"
                value={refundStatus.label}
                extra={<Tag className="ml-sm" variant={refundStatus.variant}>{refundStatus.label}</Tag>}
              />
              <DetailRow label="可退金额" value={formatCurrency(detail.refundSummary?.refundableAmount || 0)} />
            </View>
          </Card>
        ) : null}

        <Card className="order-detail-page__card" title="订单基础信息">
          <View className="order-detail-page__section pb-md">
            <DetailRow
              label="订单编号"
              value={orderNo}
              extra={<Text className="order-detail-page__link" onClick={() => handleCopy(orderNo)}>复制</Text>}
            />
            <DetailRow label="订单类型" value={detail.title || '量房费订单'} />
            <DetailRow label="下单时间" value={formatServerDateTime(detail.createdAt)} />
            <DetailRow label="预约量房时间" value={booking.preferredDate || '-'} />
            {booking.surveyDepositPaidAt ? (
              <DetailRow label="支付时间" value={formatServerDateTime(booking.surveyDepositPaidAt)} />
            ) : null}
          </View>
        </Card>

        {detailActions.length > 0 ? (
          <View
            className={`order-detail-page__footer-actions${detailActions.length === 1 ? ' order-detail-page__footer-actions--single' : ''}`}
          >
            {detailActions.map((action) => (
              <Button
                key={action.key}
                variant={action.variant}
                className="order-detail-page__footer-action-button"
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
            ))}
          </View>
        ) : null}
      </View>

      {showPayBar ? (
        <View className="order-detail-page__bottom-bar" style={fixedBottomBarStyle}>
          {showCancelButton ? (
            <Button
              variant="outline"
              className="order-detail-page__bottom-button"
              disabled={submitting || !!launchingChannel}
              onClick={() => {
                void handleCancel();
              }}
            >
              取消预约
            </Button>
          ) : (
            <View className="order-detail-page__bottom-amount">
              <Text className="order-detail-page__bottom-amount-label">待支付</Text>
              <Text className="order-detail-page__bottom-amount-value">{formatCurrency(payableAmount)}</Text>
            </View>
          )}
          <Button
            variant="primary"
            className="order-detail-page__bottom-button"
            loading={!!launchingChannel}
            disabled={submitting || !!launchingChannel}
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
          amountLabel="待支付量房费"
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
