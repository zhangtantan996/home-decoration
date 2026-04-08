import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from '@tarojs/components';
import Taro, { useDidShow, useRouter } from '@tarojs/taro';

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
import {
  cancelOrderCenterEntry,
  getOrderCenterEntryDetail,
  payOrderCenterEntry,
  type OrderCenterEntryDetail,
} from '@/services/orderCenter';
import { getOrderDetail } from '@/services/orders';
import type { PaymentChannel, PaymentLaunchMode } from '@/services/payments';
import { useAuthStore } from '@/store/auth';
import { showErrorToast } from '@/utils/error';
import { getFixedBottomBarStyle, getPageBottomSpacerStyle } from '@/utils/fixedLayout';
import { deriveOrderEntryActions } from '@/utils/orderEntryActions';
import { consumePaymentRefreshNotice } from '@/utils/paymentRefresh';
import { buildOrderCenterDetailUrl, buildSurveyDepositDetailUrl } from '@/utils/orderRoutes';
import { formatServerDate, formatServerDateTime } from '@/utils/serverTime';
import {
  normalizeSurveyDepositPaymentAction,
  resolveSurveyDepositTerminalType,
  type SurveyDepositPaymentAction,
} from '@/utils/surveyDepositPayment';

import './index.scss';

const formatDate = (dateStr?: string) => {
  if (!dateStr) {
    return '-';
  }
  return formatServerDateTime(dateStr);
};

const formatCurrency = (amount?: number) => `¥${Number(amount || 0).toLocaleString()}`;

const getStatusMeta = (detail: OrderCenterEntryDetail) => {
  switch (detail.statusGroup) {
    case 'pending_payment':
      return {
        label: detail.statusText || '待支付',
        variant: 'warning' as const,
        desc: '请尽快完成支付，以免订单失效',
        icon: 'history' as IconName,
      };
    case 'paid':
      return {
        label: detail.statusText || '已支付',
        variant: 'success' as const,
        desc: '订单已支付，服务人员将尽快与您联系',
        icon: 'success' as IconName,
      };
    case 'refund':
      return {
        label: detail.statusText || '退款中',
        variant: 'brand' as const,
        desc: '退款申请正在处理，请耐心等待',
        icon: 'pending' as IconName,
      };
    case 'cancelled':
      return {
        label: detail.statusText || '已取消',
        variant: 'default' as const,
        desc: '订单已取消，如有需要请重新下单',
        icon: 'about' as IconName,
      };
    default:
      return {
        label: detail.statusText || '处理中',
        variant: 'default' as const,
        desc: '订单正在稳步处理中',
        icon: 'progress' as IconName,
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

const DetailRow: React.FC<DetailRowProps> = ({ label, value = '-', extra, multiline = false, onClick }) => (
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

const OrderDetail: React.FC = () => {
  const auth = useAuthStore();
  const router = useRouter();
  const entryKeyParam = router.params?.entryKey ? decodeURIComponent(router.params.entryKey) : '';
  const legacyId = Number(router.params?.id || 0);
  const didFirstShowRef = useRef(true);

  const [detail, setDetail] = useState<OrderCenterEntryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [resolvedEntryKey, setResolvedEntryKey] = useState(entryKeyParam);

  const pageBottomStyle = useMemo(() => getPageBottomSpacerStyle(), []);
  const fixedBottomBarStyle = useMemo(() => getFixedBottomBarStyle(), []);
  const autoLaunchAction = useMemo(
    () => normalizeSurveyDepositPaymentAction({
      channel: router.params?.autoPayChannel as PaymentChannel | undefined,
      launchMode: router.params?.autoPayLaunchMode as PaymentLaunchMode | undefined,
    }),
    [router.params?.autoPayChannel, router.params?.autoPayLaunchMode],
  );

  const resolveEntryKey = useCallback(async () => {
    if (entryKeyParam) {
      return entryKeyParam;
    }
    if (!legacyId) {
      return '';
    }

    const legacyOrder = await getOrderDetail(legacyId);
    const sourceKind = legacyOrder.orderType === 'design'
      ? 'design_order'
      : legacyOrder.orderType === 'construction'
        ? 'construction_order'
        : legacyOrder.orderType === 'material'
          ? 'material_order'
          : '';

    if (!sourceKind) {
      throw new Error('订单类型不支持订单中心详情');
    }

    return `${sourceKind}:${legacyOrder.id}`;
  }, [entryKeyParam, legacyId]);

  const fetchDetail = useCallback(async () => {
    if (!auth.token) {
      setDetail(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const nextEntryKey = await resolveEntryKey();
      if (!nextEntryKey) {
        setDetail(null);
        return;
      }
      setResolvedEntryKey(nextEntryKey);
      const res = await getOrderCenterEntryDetail(nextEntryKey);
      setDetail(res);
    } catch (error) {
      setDetail(null);
      showErrorToast(error, '获取详情失败');
    } finally {
      setLoading(false);
    }
  }, [auth.token, resolveEntryKey]);

  const { refreshStatus, drawerHeight, drawerProgress, bindPullToRefresh, runReload } =
    usePullToRefreshFeedback(fetchDetail);

  useEffect(() => {
    void runReload();
  }, [auth.token, resolveEntryKey, runReload]);

  useDidShow(() => {
    if (didFirstShowRef.current) {
      didFirstShowRef.current = false;
      return;
    }
    if (auth.token && consumePaymentRefreshNotice()) {
      void runReload();
    }
  });

  const surveyDepositRedirectUrl = useMemo(() => {
    if (detail?.sourceKind !== 'survey_deposit' || !detail.booking?.id) {
      return '';
    }
    return buildSurveyDepositDetailUrl(detail.booking.id, {
      entryKey: detail.entryKey,
      orderNo: detail.referenceNo,
    });
  }, [detail]);

  useEffect(() => {
    if (!surveyDepositRedirectUrl) {
      return;
    }
    void Taro.redirectTo({ url: surveyDepositRedirectUrl });
  }, [surveyDepositRedirectUrl]);

  const entryPaymentSource = useMemo(
    () => (resolvedEntryKey
      ? {
          returnUrl: buildOrderCenterDetailUrl(resolvedEntryKey, legacyId || undefined),
          entryKey: resolvedEntryKey,
          bookingId: detail?.booking?.id,
        }
      : undefined),
    [detail?.booking?.id, legacyId, resolvedEntryKey],
  );

  const launchOrderPayment = useCallback((action: SurveyDepositPaymentAction) => (
    payOrderCenterEntry(resolvedEntryKey, {
      channel: action.channel,
      terminalType: resolveSurveyDepositTerminalType(action),
    })
  ), [resolvedEntryKey]);

  const { launchingChannel, qrPayment, remainingSeconds, closeQrPayment, chooseAndLaunch } =
    useSurveyDepositPaymentFlow({
      bookingId: detail?.booking?.id,
      amount: Number(detail?.payableAmount || detail?.amount || 0),
      paymentOptions: detail?.availablePaymentOptions,
      autoLaunchAction,
      isPaid: detail?.statusGroup !== 'pending_payment',
      launchPayment: launchOrderPayment,
      onPaid: fetchDetail,
      source: entryPaymentSource,
      amountLabel: '待支付金额',
    });

  const handlePay = async () => {
    if (!detail || submitting) {
      return;
    }
    await chooseAndLaunch();
  };

  const handleCancel = async () => {
    if (!resolvedEntryKey || submitting) {
      return;
    }

    Taro.showModal({
      title: '取消订单',
      content: '确定要取消该订单吗？取消后如需继续支付，需要重新发起。',
      success: async (res) => {
        if (!res.confirm) {
          return;
        }

        setSubmitting(true);
        try {
          await cancelOrderCenterEntry(resolvedEntryKey);
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

  const handleCopy = (text: string) => {
    Taro.setClipboardData({
      data: text,
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
      <View className="page bg-gray-50 min-h-screen p-md flex items-center justify-center" {...bindPullToRefresh}>
        <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />
        <Empty
          description="登录后查看订单详情"
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

  if (!detail) {
    return (
      <View className="page bg-gray-50 min-h-screen p-md flex items-center justify-center" {...bindPullToRefresh}>
        <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />
        <Empty description="订单不存在" />
      </View>
    );
  }

  const statusConfig = getStatusMeta(detail);
  const stageMeta = detail.businessStage ? getBusinessStageStatus(detail.businessStage) : null;
  const totalAmount = Number(detail.order?.totalAmount || detail.amount || 0);
  const discountAmount = Number(detail.order?.discount || 0);
  const paidAmount = Number(
    detail.order?.paidAmount || (detail.statusGroup === 'paid' || detail.statusGroup === 'refund' ? detail.amount : 0),
  );
  const payableAmount = Math.max(0, Number(detail.payableAmount || totalAmount - discountAmount - paidAmount || detail.amount || 0));
  const projectRisk = detail.project?.riskSummary;
  const bookingRefund = detail.refundSummary;
  const refundStatus = bookingRefund?.latestRefundStatus
    ? getRefundStatus(bookingRefund.latestRefundStatus)
    : detail.statusGroup === 'refund'
      ? { label: detail.statusText || '退款中', variant: 'brand' as const }
      : getRefundStatus(undefined);
  const paymentPlans = detail.paymentPlans || [];
  const orderNo = detail.referenceNo || detail.order?.orderNo || resolvedEntryKey;
  const showBookingLink = detail.booking?.id && detail.sourceKind !== 'survey_deposit';
  const entryActions = deriveOrderEntryActions({
    statusGroup: detail.statusGroup,
    refundSummary: bookingRefund,
    canPay: true,
    canCancel: Boolean(detail.canCancel),
  });
  const showPendingFooter = detail.statusGroup === 'pending_payment' && entryActions.showFooterPayBar;
  const showCancelButton = showPendingFooter && entryActions.showFooterCancel;
  const showRefundSection = entryActions.showRefundSection && Boolean(bookingRefund || detail.statusGroup === 'refund');
  const detailActions = entryActions.detailActions.filter((action) => {
    if (action.key === 'view_refund') {
      return Boolean(detail.booking?.id && entryActions.hasRefundRecord);
    }
    if (action.key === 'apply_refund') {
      return Boolean(detail.booking?.id && entryActions.canApplyRefund);
    }
    return false;
  });
  const riskNotes = [
    projectRisk?.pausedAt ? `项目暂停：${projectRisk.pauseReason || '等待恢复中'}` : '',
    projectRisk?.disputedAt ? `争议处理中：${projectRisk.disputeReason || '平台处理中'}` : '',
    projectRisk?.escrowFrozen
      ? `托管资金已冻结${projectRisk.frozenAmount ? `（¥${Number(projectRisk.frozenAmount).toLocaleString()}）` : ''}`
      : '',
  ].filter(Boolean);

  return (
    <View className="order-detail-page page" style={showPendingFooter ? pageBottomStyle : undefined} {...bindPullToRefresh}>
      <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />

      <View className={`order-detail-page__status-header order-detail-page__status-header--${detail.statusGroup}`}>
        <View className="order-detail-page__status-main">
          <Text className="order-detail-page__status-title">{statusConfig.label}</Text>
          <Text className="order-detail-page__status-desc">{statusConfig.desc}</Text>
        </View>
        <View className="order-detail-page__status-icon-wrapper">
          <Icon name={statusConfig.icon} size={64} color="#FFFFFF" />
        </View>
      </View>

      <View className="order-detail-page__container">
        {(detail.provider || detail.booking || detail.project || stageMeta) ? (
          <Card className="order-detail-page__card" title="关联服务信息">
            <View className="order-detail-page__section">
              {detail.provider ? (
                <DetailRow
                  label="服务方"
                  value={detail.provider.name}
                  extra={<Text className="order-detail-page__link">查看</Text>}
                  onClick={() => {
                    Taro.navigateTo({
                      url: `/pages/providers/detail/index?id=${detail.provider?.id}&type=${detail.provider?.providerType || 'designer'}`,
                    });
                  }}
                />
              ) : null}
              {detail.project ? (
                <DetailRow
                  label="关联项目"
                  value={detail.project.name}
                  extra={<Text className="order-detail-page__link">查看</Text>}
                  onClick={() => Taro.navigateTo({ url: `/pages/projects/detail/index?id=${detail.project?.id}` })}
                />
              ) : null}
              {showBookingLink ? (
                <DetailRow
                  label="项目地址"
                  value={detail.booking?.address || `预约 #${detail.booking?.id}`}
                  extra={<Text className="order-detail-page__link">查看详情</Text>}
                  multiline
                  onClick={() => Taro.navigateTo({ url: `/pages/booking/detail/index?id=${detail.booking?.id}` })}
                />
              ) : null}
              {!detail.project && detail.booking?.address && !showBookingLink ? (
                <DetailRow label="项目地址" value={detail.booking.address} multiline />
              ) : null}
              {stageMeta ? (
                <DetailRow
                  label="当前进展"
                  value={stageMeta.label}
                />
              ) : null}
            </View>
          </Card>
        ) : null}

        {(detail.flowSummary || riskNotes.length > 0) ? (
          <Card className="order-detail-page__card" title="温馨提醒">
            <View className="order-detail-page__section pb-md">
              {detail.flowSummary ? (
                <View className="order-detail-page__note">{detail.flowSummary}</View>
              ) : null}
              {riskNotes.length > 0 ? (
                <View className="order-detail-page__alerts">
                  {riskNotes.map((note) => (
                    <View key={note} className="order-detail-page__alert">
                      <Icon name="about" size={28} color="#9A3412" />
                      <Text className="order-detail-page__alert-text">{note}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          </Card>
        ) : null}

        <Card className="order-detail-page__card" title="费用清单">
          <View className="order-detail-page__section pb-md pt-sm">
            <View className="order-detail-page__amount-row">
              <Text className="order-detail-page__amount-label">订单总额</Text>
              <Text className="order-detail-page__amount-value">{formatCurrency(totalAmount)}</Text>
            </View>
            {discountAmount > 0 ? (
              <View className="order-detail-page__amount-row">
                <Text className="order-detail-page__amount-label">优惠金额</Text>
                <Text className="order-detail-page__amount-value order-detail-page__amount-value--discount">
                  -{formatCurrency(discountAmount)}
                </Text>
              </View>
            ) : null}
            <View className="order-detail-page__amount-row">
              <Text className="order-detail-page__amount-label">已支付</Text>
              <Text className="order-detail-page__amount-value">{formatCurrency(paidAmount)}</Text>
            </View>
            <View className="order-detail-page__amount-row order-detail-page__amount-row--highlight">
              <Text className="order-detail-page__amount-label">{showPendingFooter ? '待支付金额' : '合计应付'}</Text>
              <Text className="order-detail-page__amount-value">{formatCurrency(payableAmount)}</Text>
            </View>
          </View>
        </Card>

        {paymentPlans.length > 0 ? (
          <Card className="order-detail-page__card" title="付款计划">
            <View className="order-detail-page__plan-list pb-md">
              {paymentPlans.map((plan) => {
                const isPaid = plan.status === 'paid';
                const isOverdue = plan.status === 'overdue';

                return (
                  <View key={plan.id} className="order-detail-page__plan-card">
                    <View className="order-detail-page__plan-header">
                      <View>
                        <Text className="order-detail-page__plan-title">{plan.name || `第 ${plan.seq} 期`}</Text>
                        <Text className="order-detail-page__plan-meta">到期：{formatServerDate(plan.dueAt)}</Text>
                      </View>
                      <Tag variant={isPaid ? 'success' : isOverdue ? 'error' : 'warning'} outline>
                        {isPaid ? '已支付' : isOverdue ? '已逾期' : '待支付'}
                      </Tag>
                    </View>
                    <View className="order-detail-page__plan-footer">
                      <Text className="order-detail-page__plan-amount">{formatCurrency(plan.amount)}</Text>
                      {isPaid && plan.paidAt ? (
                        <Text className="order-detail-page__plan-extra">支付于 {formatServerDate(plan.paidAt)}</Text>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          </Card>
        ) : null}

        {showRefundSection ? (
          <Card className="order-detail-page__card" title="退款服务">
            <View className="order-detail-page__section pb-md">
              <DetailRow
                label="当前状态"
                value={refundStatus.label}
                extra={<Tag className="ml-sm" variant={refundStatus.variant}>{refundStatus.label}</Tag>}
              />
              <DetailRow label="可退金额" value={formatCurrency(bookingRefund?.refundableAmount || 0)} />
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
            <DetailRow label="订单类型" value={detail.title || '家装服务订单'} />
            <DetailRow label="下单时间" value={formatDate(detail.createdAt)} />
            {detail.order?.paidAt ? (
              <DetailRow label="支付时间" value={formatDate(detail.order.paidAt)} />
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

      {showPendingFooter ? (
        <View className="order-detail-page__bottom-bar" style={fixedBottomBarStyle}>
          {showCancelButton ? (
            <Button
              variant="outline"
              onClick={handleCancel}
              className="order-detail-page__bottom-button"
              disabled={submitting || !!launchingChannel}
            >
              取消订单
            </Button>
          ) : (
            <View className="order-detail-page__bottom-amount">
              <Text className="order-detail-page__bottom-amount-label">待支付</Text>
              <Text className="order-detail-page__bottom-amount-value">{formatCurrency(payableAmount)}</Text>
            </View>
          )}
          <Button
            variant="primary"
            onClick={() => void handlePay()}
            className="order-detail-page__bottom-button"
            loading={!!launchingChannel}
            disabled={submitting || !!launchingChannel}
          >
            去支付
          </Button>
        </View>
      ) : null}

      {qrPayment ? (
        <SurveyDepositQrDialog
          amount={qrPayment.amount}
          amountLabel="待支付金额"
          classNamePrefix="order-detail-page"
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

export default OrderDetail;
