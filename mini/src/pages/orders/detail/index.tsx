import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View } from '@tarojs/components';
import Taro, { useDidShow, useRouter } from '@tarojs/taro';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Empty } from '@/components/Empty';
import { NotificationActionBar } from '@/components/NotificationActionBar';
import { NotificationFactGrid } from '@/components/NotificationFactGrid';
import { NotificationFactRows } from '@/components/NotificationFactRows';
import { NotificationSurfaceHero } from '@/components/NotificationSurfaceHero';
import { NotificationSurfaceShell } from '@/components/NotificationSurfaceShell';
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
import { getPageBottomSpacerStyle } from '@/utils/fixedLayout';
import { deriveOrderEntryActions } from '@/utils/orderEntryActions';
import { consumePaymentRefreshNotice } from '@/utils/paymentRefresh';
import { buildOrderCenterDetailUrl, buildSurveyDepositDetailUrl } from '@/utils/orderRoutes';
import { formatServerDateTime } from '@/utils/serverTime';
import {
  normalizeSurveyDepositPaymentAction,
  resolveSurveyDepositTerminalType,
  type SurveyDepositPaymentAction,
} from '@/utils/surveyDepositPayment';

import './index.scss';

interface DetailRowProps {
  label: string;
  value?: string;
  extra?: React.ReactNode;
  multiline?: boolean;
  onClick?: () => void;
}

const DetailRow: React.FC<DetailRowProps> = ({ label, value = '-', extra, multiline = false, onClick }) => (
  <View
    className={`order-detail-page__row${multiline ? ' order-detail-page__row--multiline' : ''}${onClick ? ' order-detail-page__row--clickable' : ''}`}
    onClick={onClick}
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
        summary: detail.expireAt ? `请在 ${formatDate(detail.expireAt)} 前完成支付` : '当前订单等待支付',
      };
    case 'paid':
      return {
        label: detail.statusText || '已支付',
        variant: 'success' as const,
        summary: '款项已确认，后续由服务流程继续推进',
      };
    case 'refund':
      return {
        label: detail.statusText || '退款中',
        variant: 'brand' as const,
        summary: '退款申请处理中，请留意后续更新',
      };
    case 'cancelled':
      return {
        label: detail.statusText || '已取消',
        variant: 'default' as const,
        summary: '当前订单已结束',
      };
    default:
      return {
        label: detail.statusText || '处理中',
        variant: 'default' as const,
        summary: '订单状态持续更新中',
      };
  }
};

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
    canPayWithWechat,
    canPayWithAlipay,
  } =
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
    if (canPayWithWechat) {
      await launchPreferredChannel('wechat');
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
      <View className="page order-detail-page" {...bindPullToRefresh}>
        <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />
        <NotificationSurfaceShell>
          <Empty
            description="登录后查看订单详情"
            action={{ text: '去登录', onClick: () => Taro.switchTab({ url: '/pages/profile/index' }) }}
          />
        </NotificationSurfaceShell>
      </View>
    );
  }

  if (loading) {
    return (
      <View className="page order-detail-page" {...bindPullToRefresh}>
        <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />
        <View className="order-detail-page__loading">
          <Skeleton height={220} className="order-detail-page__section" />
          <Skeleton height={180} className="order-detail-page__section" />
          <Skeleton height={220} className="order-detail-page__section" />
        </View>
      </View>
    );
  }

  if (!detail) {
    return (
      <View className="page order-detail-page" {...bindPullToRefresh}>
        <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />
        <NotificationSurfaceShell>
          <Empty description="订单不存在" />
        </NotificationSurfaceShell>
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
      ? `托管资金已冻结${projectRisk.frozenAmount ? `（${formatCurrency(projectRisk.frozenAmount)}）` : ''}`
      : '',
  ].filter(Boolean);
  const showActionBar = showPendingFooter || detailActions.length > 0;
  const heroTitle = detail.statusGroup === 'pending_payment'
    ? formatCurrency(payableAmount)
    : detail.statusGroup === 'refund'
      ? formatCurrency(bookingRefund?.refundableAmount || detail.amount || 0)
      : formatCurrency(totalAmount || paidAmount || detail.amount || 0);
  const heroSubtitle = detail.title || '家装服务订单';

  return (
    <View
      className="page order-detail-page"
      style={showActionBar ? pageBottomStyle : undefined}
      {...bindPullToRefresh}
    >
      <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />
      <NotificationSurfaceShell className="order-detail-page__shell">
        <ScrollView scrollY className="h-full">
          <NotificationSurfaceHero
            eyebrow="订单详情"
            title={heroTitle}
            subtitle={heroSubtitle}
            status={<Tag variant={statusConfig.variant}>{statusConfig.label}</Tag>}
            summary={statusConfig.summary}
            metrics={[
              {
                label: showPendingFooter ? '订单总额' : '已支付',
                value: formatCurrency(showPendingFooter ? totalAmount : paidAmount || totalAmount),
                hint: stageMeta?.label || undefined,
              },
              {
                label: '订单编号',
                value: orderNo || '-',
                hint: detail.createdAt ? `下单于 ${formatDate(detail.createdAt)}` : undefined,
                emphasis: true,
              },
            ]}
          />

          <Card className="notification-surface-card" title="关键信息">
            <NotificationFactRows
              items={[
                { label: '当前状态', value: detail.statusText || statusConfig.label },
                { label: '待支付金额', value: formatCurrency(payableAmount), emphasis: showPendingFooter },
                { label: '服务方', value: detail.provider?.name || '-' },
                { label: '当前阶段', value: stageMeta?.label || detail.statusText || '-' },
                { label: '关联项目', value: detail.project?.name || '-' },
                {
                  label: '项目地址',
                  value: detail.project?.address || detail.booking?.address || '-',
                  multiline: true,
                },
                { label: '下单时间', value: formatDate(detail.createdAt) },
                { label: '支付时间', value: formatDate(detail.order?.paidAt) },
              ]}
            />
            <View className="order-detail-page__rows">
              <DetailRow
                label="订单编号"
                value={orderNo}
                extra={<Text className="order-detail-page__row-link" onClick={() => handleCopy(orderNo)}>复制</Text>}
              />
              {detail.provider ? (
                <DetailRow
                  label="服务方详情"
                  value={detail.provider.name}
                  extra={<Text className="order-detail-page__row-link">查看</Text>}
                  onClick={() => {
                    Taro.navigateTo({
                      url: `/pages/providers/detail/index?id=${detail.provider?.id}&type=${detail.provider?.providerType || 'designer'}`,
                    });
                  }}
                />
              ) : null}
              {detail.project ? (
                <DetailRow
                  label="项目详情"
                  value={detail.project.name}
                  extra={<Text className="order-detail-page__row-link">查看</Text>}
                  onClick={() => Taro.navigateTo({ url: `/pages/projects/detail/index?id=${detail.project?.id}` })}
                />
              ) : null}
              {showBookingLink ? (
                <DetailRow
                  label="预约详情"
                  value={detail.booking?.address || `预约 #${detail.booking?.id}`}
                  extra={<Text className="order-detail-page__row-link">查看</Text>}
                  multiline
                  onClick={() => Taro.navigateTo({ url: `/pages/booking/detail/index?id=${detail.booking?.id}` })}
                />
              ) : null}
            </View>
          </Card>

          <Card className="notification-surface-card" title="费用明细">
            <NotificationFactRows
              items={[
                { label: '订单总额', value: formatCurrency(totalAmount) },
                { label: '优惠金额', value: discountAmount > 0 ? `-${formatCurrency(discountAmount)}` : '无优惠' },
                { label: '已支付', value: formatCurrency(paidAmount) },
                {
                  label: showPendingFooter ? '待支付金额' : '合计应付',
                  value: formatCurrency(payableAmount),
                  emphasis: true,
                },
              ]}
            />
          </Card>

          {paymentPlans.length > 0 ? (
            <Card className="notification-surface-card" title="付款计划">
              <View className="notification-section-list">
                {paymentPlans.map((plan) => {
                  const isPaid = plan.status === 'paid';
                  const isOverdue = plan.status === 'overdue';
                  return (
                    <View key={plan.id} className="notification-section-row">
                      <View className="notification-section-row__head">
                        <Text className="notification-section-row__title">{plan.name || `第 ${plan.seq} 期`}</Text>
                        <Tag variant={isPaid ? 'success' : isOverdue ? 'error' : 'warning'}>
                          {isPaid ? '已支付' : isOverdue ? '已逾期' : '待支付'}
                        </Tag>
                      </View>
                      <Text className="notification-section-row__note">到期：{formatDate(plan.dueAt)}</Text>
                      <Text className="notification-section-row__value">{formatCurrency(plan.amount)}</Text>
                    </View>
                  );
                })}
              </View>
            </Card>
          ) : null}

          {riskNotes.length > 0 ? (
            <Card className="notification-surface-card" title="风险状态">
              <View className="notification-section-list">
                {riskNotes.map((note) => (
                  <View key={note} className="notification-section-row">
                    <Text className="notification-section-row__note is-danger">{note}</Text>
                  </View>
                ))}
              </View>
            </Card>
          ) : null}

          {showRefundSection ? (
            <Card className="notification-surface-card" title="退款服务">
              <NotificationFactRows
                items={[
                  { label: '当前状态', value: refundStatus.label },
                  { label: '可退金额', value: formatCurrency(bookingRefund?.refundableAmount || 0) },
                ]}
              />
            </Card>
          ) : null}
        </ScrollView>
      </NotificationSurfaceShell>

      {showActionBar ? (
        <NotificationActionBar single={!showPendingFooter && detailActions.length <= 1}>
          {showPendingFooter && showCancelButton ? (
            <Button
              variant="secondary"
              onClick={handleCancel}
              disabled={submitting || !!launchingChannel}
            >
              取消订单
            </Button>
          ) : null}
          {showPendingFooter ? (
            <Button
              variant="primary"
              onClick={() => void handlePay()}
              loading={!!launchingChannel}
              disabled={submitting || !!launchingChannel}
            >
              {canPayWithWechat ? '微信支付' : '去支付'}
            </Button>
          ) : null}
          {showPendingFooter && canPayWithAlipay ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void launchPreferredChannel('alipay');
              }}
              disabled={submitting || !!launchingChannel}
            >
              支付宝扫码
            </Button>
          ) : null}
          {!showPendingFooter && detailActions.some((action) => action.key === 'view_refund') ? (
            <Button variant="outline" onClick={handleViewRefundRecords}>
              查看退款记录
            </Button>
          ) : null}
          {!showPendingFooter && detailActions.some((action) => action.key === 'apply_refund') ? (
            <Button variant="primary" onClick={handleApplyRefund}>
              申请退款
            </Button>
          ) : null}
        </NotificationActionBar>
      ) : null}

      {qrPayment ? (
        <SurveyDepositQrDialog
          open
          amount={qrPayment.amount}
          qrCode={qrPayment.qrCode}
          channel={qrPayment.channel}
          expiresAt={qrPayment.expiresAt}
          title={qrPayment.title}
          description={qrPayment.description}
          successHint={qrPayment.successHint}
          countdownSeconds={remainingSeconds}
          confirming={qrConfirmLoading}
          onClose={closeQrPayment}
          onConfirm={confirmQrPayment}
          onRetry={retryQrPayment}
        />
      ) : null}
    </View>
  );
};

export default OrderDetail;
