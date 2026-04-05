import { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Empty } from '@/components/Empty';
import { ListItem } from '@/components/ListItem';
import { PullToRefreshNotice } from '@/components/PullToRefreshNotice';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import { getRefundStatus } from '@/constants/status';
import { usePullToRefreshFeedback } from '@/hooks/usePullToRefreshFeedback';
import {
  getOrderCenterEntryDetail,
  type OrderCenterEntryDetail,
  type OrderCenterSourceKind,
} from '@/services/orderCenter';
import { cancelOrder, getOrderDetail } from '@/services/orders';
import { useAuthStore } from '@/store/auth';
import { showErrorToast } from '@/utils/error';
import { getFixedBottomBarStyle, getPageBottomSpacerStyle } from '@/utils/fixedLayout';
import { showMiniUnsupportedPaymentNotice } from '@/utils/paymentNotice';
import { buildSurveyDepositDetailUrl } from '@/utils/orderRoutes';
import { formatServerDate, formatServerDateTime } from '@/utils/serverTime';
import { navigateToSurveyDepositPaymentWithOptions } from '@/utils/surveyDepositPayment';

const formatDate = (dateStr?: string) => {
  if (!dateStr) {
    return '-';
  }
  return formatServerDateTime(dateStr);
};

const getStatusMeta = (detail: OrderCenterEntryDetail) => {
  switch (detail.statusGroup) {
    case 'pending_payment':
      return { label: detail.statusText || '待支付', variant: 'warning' as const, desc: '请尽快完成支付' };
    case 'paid':
      return { label: detail.statusText || '已支付', variant: 'success' as const, desc: '订单已支付，等待履约' };
    case 'refund':
      return { label: detail.statusText || '退款中', variant: 'brand' as const, desc: '退款记录可在下方查看' };
    case 'cancelled':
      return { label: detail.statusText || '已取消', variant: 'default' as const, desc: '订单已取消' };
    default:
      return { label: detail.statusText || '处理中', variant: 'default' as const, desc: '-' };
  }
};

const mapLegacyOrderTypeToSourceKind = (orderType?: string): OrderCenterSourceKind | '' => {
  switch (orderType) {
    case 'design':
      return 'design_order';
    case 'construction':
      return 'construction_order';
    case 'material':
      return 'material_order';
    default:
      return '';
  }
};

const getTimelineTagVariant = (status?: string) => {
  switch (status) {
    case 'completed':
      return 'success' as const;
    case 'pending':
    case 'pending_payment':
      return 'warning' as const;
    case 'rejected':
      return 'error' as const;
    default:
      return 'default' as const;
  }
};

const OrderDetail: React.FC = () => {
  const auth = useAuthStore();
  const router = useRouter();
  const entryKeyParam = router.params?.entryKey ? decodeURIComponent(router.params.entryKey) : '';
  const legacyId = Number(router.params?.id || 0);

  const [detail, setDetail] = useState<OrderCenterEntryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [resolvedEntryKey, setResolvedEntryKey] = useState(entryKeyParam);

  const pageBottomStyle = useMemo(() => getPageBottomSpacerStyle(), []);
  const fixedBottomBarStyle = useMemo(() => getFixedBottomBarStyle(), []);

  const resolveEntryKey = useCallback(async () => {
    if (entryKeyParam) {
      return entryKeyParam;
    }
    if (!legacyId) {
      return '';
    }
    const legacyOrder = await getOrderDetail(legacyId);
    const sourceKind = mapLegacyOrderTypeToSourceKind(legacyOrder.orderType);
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

  const handlePay = async () => {
    if (!detail || submitting) {
      return;
    }

    if (detail.sourceKind === 'survey_deposit' && detail.booking?.id) {
      await navigateToSurveyDepositPaymentWithOptions(
        detail.booking.id,
        detail.availablePaymentOptions,
        detail.referenceNo,
        detail.entryKey,
      );
      return;
    }

    await showMiniUnsupportedPaymentNotice('当前小程序仅开放量房费支付；设计费、施工费与分期支付暂未开放小程序支付。');
  };

  const handleCancel = async () => {
    if (!detail?.order?.id || submitting) {
      return;
    }

    Taro.showModal({
      title: '取消订单',
      content: '确定要取消该订单吗？取消后需重新下单。',
      success: async (res) => {
        if (!res.confirm) {
          return;
        }

        setSubmitting(true);
        try {
          await cancelOrder(detail.order!.id);
          Taro.showToast({ title: '已取消', icon: 'success' });
          await fetchDetail();
        } catch (error) {
          showErrorToast(error, '取消失败');
        } finally {
          setSubmitting(false);
        }
      }
    });
  };

  const handleCopy = (text: string) => {
    Taro.setClipboardData({
      data: text,
      success: () => Taro.showToast({ title: '已复制', icon: 'none' })
    });
  };

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
        <Skeleton height={200} className="mb-md" />
        <Skeleton height={150} className="mb-md" />
        <Skeleton height={300} className="mb-md" />
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

  if (surveyDepositRedirectUrl) {
    return (
      <View className="page bg-gray-50 min-h-screen p-md" {...bindPullToRefresh}>
        <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />
        <Skeleton height={160} className="mb-md" />
        <Skeleton height={220} className="mb-md" />
      </View>
    );
  }

  const statusConfig = getStatusMeta(detail);
  const totalAmount = Number(detail.order?.totalAmount || detail.amount || 0);
  const discountAmount = Number(detail.order?.discount || 0);
  const paidAmount = Number(
    detail.order?.paidAmount || (detail.statusGroup === 'paid' || detail.statusGroup === 'refund' ? detail.amount : 0),
  );
  const payableAmount = Math.max(0, Number(detail.payableAmount || totalAmount - discountAmount - paidAmount || detail.amount || 0));
  const projectRisk = detail.project?.riskSummary;
  const bookingRefund = detail.refundSummary;
  const hasRisk = Boolean(projectRisk?.pausedAt || projectRisk?.disputedAt || projectRisk?.escrowFrozen);
  const refundStatus = getRefundStatus(bookingRefund?.latestRefundStatus);
  const paymentPlans = detail.paymentPlans || [];
  const orderNo = detail.referenceNo || detail.order?.orderNo || resolvedEntryKey;
  const showPendingFooter = detail.statusGroup === 'pending_payment';
  const showCancelButton = showPendingFooter && Boolean(detail.order?.id);
  const showBookingLink = detail.booking?.id && detail.sourceKind === 'survey_deposit';

  return (
    <View className="page bg-gray-50 min-h-screen" style={pageBottomStyle} {...bindPullToRefresh}>
      <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />
      <View className="bg-white p-md mb-md flex justify-between items-center">
        <View>
          <View className="text-xl font-bold mb-xs flex items-center gap-xs">
            <Text>{statusConfig.label}</Text>
          </View>
          <Text className="text-gray-500 text-sm">{statusConfig.desc}</Text>
        </View>
        <Tag variant={statusConfig.variant}>{statusConfig.label}</Tag>
      </View>

      <View className="px-md">
        {(detail.provider || detail.booking || detail.project) ? (
          <Card className="mb-md" title="关联信息">
            <View className="flex flex-col">
              {detail.provider ? (
                <ListItem
                  title="服务商"
                  description={detail.provider.name}
                  arrow
                  onClick={() =>
                    Taro.navigateTo({
                      url: `/pages/providers/detail/index?id=${detail.provider?.id}&type=${detail.provider?.providerType || 'designer'}`
                    })
                  }
                />
              ) : null}

              {detail.project ? (
                <ListItem
                  title="项目详情"
                  description={detail.project.name}
                  arrow
                  onClick={() => Taro.navigateTo({ url: `/pages/projects/detail/index?id=${detail.project?.id}` })}
                />
              ) : null}

              {showBookingLink ? (
                <ListItem
                  title="预约详情"
                  description={detail.booking?.address || `预约 #${detail.booking?.id}`}
                  arrow
                  onClick={() => Taro.navigateTo({ url: `/pages/booking/detail/index?id=${detail.booking?.id}` })}
                />
              ) : null}

              {!detail.provider && detail.booking?.providerId ? (
                <ListItem title="服务商" description={`ID ${detail.booking.providerId}`} />
              ) : null}
              {!detail.project && detail.booking?.address && !showBookingLink ? (
                <ListItem title="项目地址" description={detail.booking.address} />
              ) : null}
            </View>
          </Card>
        ) : null}

        {(detail.businessStage || detail.flowSummary) ? (
          <Card className="mb-md" title="服务进展">
            <View className="flex flex-col gap-sm py-sm">
              {detail.businessStage ? (
                <ListItem title="当前阶段" description={detail.businessStage} />
              ) : null}
              {detail.flowSummary ? (
                <View className="text-sm text-gray-500 px-lg">{detail.flowSummary}</View>
              ) : null}
            </View>
          </Card>
        ) : null}

        {hasRisk ? (
          <Card className="mb-md" title="项目异常状态">
            <View className="flex flex-col gap-sm py-sm">
              {projectRisk?.pausedAt ? (
                <ListItem
                  title="项目暂停"
                  description={projectRisk.pauseReason || '项目已暂停，等待恢复'}
                  extra={<Tag variant="warning">已暂停</Tag>}
                />
              ) : null}
              {projectRisk?.disputedAt ? (
                <ListItem
                  title="争议处理中"
                  description={projectRisk.disputeReason || '平台正在处理中'}
                  extra={<Tag variant="error">{projectRisk.auditStatus || '待仲裁'}</Tag>}
                />
              ) : null}
              {projectRisk?.escrowFrozen ? (
                <ListItem
                  title="托管状态"
                  description={projectRisk.frozenAmount ? `当前冻结 ¥${Number(projectRisk.frozenAmount).toLocaleString()}` : '托管资金已冻结'}
                  extra={<Tag variant="brand">已冻结</Tag>}
                />
              ) : null}
              {detail.project ? (
                <Button variant="outline" block onClick={() => Taro.navigateTo({ url: `/pages/projects/detail/index?id=${detail.project?.id}` })}>
                  查看项目异常详情
                </Button>
              ) : null}
            </View>
          </Card>
        ) : null}

        {bookingRefund ? (
          <Card className="mb-md" title="退款进度">
            <View className="flex flex-col gap-sm py-sm">
              <ListItem
                title="退款状态"
                description={bookingRefund.latestRefundId ? `申请单 #${bookingRefund.latestRefundId}` : '当前未发起退款'}
                extra={<Tag variant={refundStatus.variant}>{refundStatus.label}</Tag>}
              />
              <ListItem
                title="可退金额"
                description={`¥${bookingRefund.refundableAmount.toLocaleString()}`}
              />
              <View className="flex gap-sm">
                <View className="flex-1">
                  <Button
                    variant="outline"
                    block
                    onClick={() => Taro.navigateTo({ url: `/pages/refunds/list/index?bookingId=${detail.booking?.id}` })}
                  >
                    查看记录
                  </Button>
                </View>
                <View className="flex-1">
                  <Button
                    block
                    disabled={!bookingRefund.canApplyRefund}
                    onClick={() => Taro.navigateTo({ url: `/pages/bookings/refund/index?id=${detail.booking?.id}` })}
                  >
                    申请退款
                  </Button>
                </View>
              </View>
            </View>
          </Card>
        ) : null}

        <Card className="mb-md" title="金额信息">
          <View className="flex flex-col gap-md py-sm">
            <View className="flex justify-between items-center">
              <Text className="text-gray-500">订单总额</Text>
              <Text className="font-bold text-lg">¥{totalAmount.toLocaleString()}</Text>
            </View>
            {discountAmount > 0 ? (
              <View className="flex justify-between items-center text-sm">
                <Text className="text-gray-500">优惠金额</Text>
                <Text className="text-red-500">-¥{discountAmount.toLocaleString()}</Text>
              </View>
            ) : null}
            <View className="flex justify-between items-center">
              <Text className="text-gray-900 font-medium">应付金额</Text>
              <Text className="text-xl font-bold text-brand">¥{payableAmount.toLocaleString()}</Text>
            </View>
            <View className="h-px bg-gray-100 my-xs" />
            <View className="flex justify-between items-center text-sm">
              <Text className="text-gray-500">已支付金额</Text>
              <Text>¥{paidAmount.toLocaleString()}</Text>
            </View>
          </View>
        </Card>

        {paymentPlans.length > 0 ? (
          <Card className="mb-md" title="分期付款计划">
            <View className="flex flex-col gap-md py-sm">
              {paymentPlans.map((plan) => {
                const isPaid = plan.status === 'paid';
                const isOverdue = plan.status === 'overdue';
                const isPending = plan.status === 'pending_payment' || plan.status === 'pending';

                return (
                  <View key={plan.id} className="border border-gray-100 rounded p-md">
                    <View className="flex justify-between items-start mb-sm">
                      <View>
                        <Text className="font-medium">第 {plan.seq} 期</Text>
                        <Text className="text-sm text-gray-500 mt-xs">
                          到期日: {formatServerDate(plan.dueAt)}
                        </Text>
                      </View>
                      <Tag variant={isPaid ? 'success' : isOverdue ? 'error' : 'warning'}>
                        {isPaid ? '已支付' : isOverdue ? '已逾期' : '待支付'}
                      </Tag>
                    </View>

                    <View className="flex justify-between items-center pt-sm border-t border-gray-100">
                      <Text className="text-lg font-bold">¥{plan.amount.toLocaleString()}</Text>
                      {isPending ? <Text className="text-xs text-gray-400">待支付</Text> : null}
                      {isPaid && plan.paidAt ? (
                        <Text className="text-xs text-gray-400">
                          支付时间: {formatServerDate(plan.paidAt)}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          </Card>
        ) : null}

        {detail.timeline?.length ? (
          <Card className="mb-md" title="订单时间线">
            <View className="flex flex-col gap-md py-sm">
              {detail.timeline.map((item, index) => (
                <View key={`${item.title}-${index}`} className="flex justify-between items-start gap-md">
                  <View className="flex-1 min-w-0">
                    <Text className="font-medium text-gray-900">{item.title}</Text>
                    {item.description ? (
                      <View className="text-sm text-gray-500 mt-xs">{item.description}</View>
                    ) : null}
                    {item.at ? (
                      <View className="text-xs text-gray-400 mt-xs">{formatDate(item.at)}</View>
                    ) : null}
                  </View>
                  {item.status ? (
                    <Tag variant={getTimelineTagVariant(item.status)}>{item.status}</Tag>
                  ) : null}
                </View>
              ))}
            </View>
          </Card>
        ) : null}

        <Card className="mb-md" title="订单信息">
          <View className="flex flex-col gap-sm py-sm text-sm">
            <View className="flex justify-between">
              <Text className="text-gray-500">订单编号</Text>
              <View className="flex items-center" onClick={() => handleCopy(orderNo)}>
                <Text>{orderNo}</Text>
                <Text className="text-brand text-xs ml-xs">复制</Text>
              </View>
            </View>
            <View className="flex justify-between">
              <Text className="text-gray-500">订单类型</Text>
              <Text>{detail.title || '订单'}</Text>
            </View>
            <View className="flex justify-between">
              <Text className="text-gray-500">下单时间</Text>
              <Text>{formatDate(detail.createdAt)}</Text>
            </View>
            {detail.order?.paidAt ? (
              <View className="flex justify-between">
                <Text className="text-gray-500">支付时间</Text>
                <Text>{formatDate(detail.order.paidAt)}</Text>
              </View>
            ) : null}
            {detail.expireAt && detail.statusGroup === 'pending_payment' ? (
              <View className="flex justify-between">
                <Text className="text-gray-500">过期时间</Text>
                <Text className="text-warning">{formatDate(detail.expireAt)}</Text>
              </View>
            ) : null}
          </View>
        </Card>
      </View>

      {showPendingFooter ? (
        <View className="flex gap-md" style={fixedBottomBarStyle}>
          {showCancelButton ? (
            <Button
              variant="outline"
              size="lg"
              onClick={handleCancel}
              className="flex-1"
              disabled={submitting}
            >
              取消订单
            </Button>
          ) : null}
          <Button
            variant="primary"
            size="lg"
            onClick={() => void handlePay()}
            className="flex-1"
            loading={submitting}
            disabled={submitting}
          >
            去支付
          </Button>
        </View>
      ) : null}
    </View>
  );
};

export default OrderDetail;
