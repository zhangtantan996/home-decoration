import { useCallback, useEffect, useState } from 'react';
import { Text, View } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Empty } from '@/components/Empty';
import { ListItem } from '@/components/ListItem';
import { PullToRefreshNotice } from '@/components/PullToRefreshNotice';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import { getBusinessStageStatus, getRefundStatus } from '@/constants/status';
import { usePullToRefreshFeedback } from '@/hooks/usePullToRefreshFeedback';
import {
  getBookingDetail,
  type BookingBudgetConfirmSummary,
  type BookingDetailResponse,
  type BookingSiteSurveySummary,
} from '@/services/bookings';
import { useAuthStore } from '@/store/auth';
import { showErrorToast } from '@/utils/error';
import { navigateToSurveyDepositPaymentWithOptions } from '@/utils/surveyDepositPayment';

import './index.scss';

const getStatusMeta = (status: number) => {
  switch (status) {
    case 1:
      return { label: '待确认', variant: 'warning' as const };
    case 2:
      return { label: '已确认', variant: 'primary' as const };
    case 3:
      return { label: '已完成', variant: 'success' as const };
    case 4:
      return { label: '已取消', variant: 'default' as const };
    default:
      return { label: '未知状态', variant: 'default' as const };
  }
};

const getSurveyStatusMeta = (status?: string) => {
  switch (status) {
    case 'submitted':
      return { label: '待确认', variant: 'warning' as const };
    case 'confirmed':
      return { label: '已确认', variant: 'success' as const };
    case 'revision_requested':
      return { label: '待重提', variant: 'default' as const };
    default:
      return { label: '待量房', variant: 'default' as const };
  }
};

const getBudgetStatusMeta = (status?: string) => {
  switch (status) {
    case 'submitted':
      return { label: '待处理', variant: 'warning' as const };
    case 'accepted':
      return { label: '已确认', variant: 'success' as const };
    case 'rejected':
      return { label: '已退回', variant: 'default' as const };
    default:
      return { label: '待提交', variant: 'default' as const };
  }
};

const formatCurrency = (amount: number) => `¥${amount.toLocaleString()}`;

const getSurveyDepositAmount = (detail: BookingDetailResponse) => {
  const surveyDeposit = Number(detail.booking.surveyDeposit || 0);
  if (surveyDeposit > 0) {
    return surveyDeposit;
  }
  const fallbackIntentFee = Number(detail.booking.intentFee || 0);
  return fallbackIntentFee > 0 ? fallbackIntentFee : 0;
};

const getSiteSurveyDescription = (siteSurveySummary?: BookingSiteSurveySummary) => {
  if (!siteSurveySummary) {
    return '商家确认后将安排上门量房';
  }
  if (siteSurveySummary.status === 'revision_requested') {
    return siteSurveySummary.revisionRequestReason || '已退回量房记录，等待商家重新提交';
  }
  if (siteSurveySummary.notes) {
    return siteSurveySummary.notes;
  }
  return '量房记录已生成';
};

const getBudgetDescription = (budgetConfirmSummary?: BookingBudgetConfirmSummary) => {
  if (!budgetConfirmSummary) {
    return '量房完成后商家会提交预算确认';
  }
  const hasBudgetRange =
    typeof budgetConfirmSummary.budgetMin === 'number' &&
    typeof budgetConfirmSummary.budgetMax === 'number' &&
    budgetConfirmSummary.budgetMax > 0;

  if (budgetConfirmSummary.status === 'rejected' && budgetConfirmSummary.rejectionReason) {
    return budgetConfirmSummary.rejectionReason;
  }

  if (hasBudgetRange) {
    return `${formatCurrency(budgetConfirmSummary.budgetMin || 0)} - ${formatCurrency(budgetConfirmSummary.budgetMax || 0)}`;
  }

  return budgetConfirmSummary.notes || budgetConfirmSummary.designIntent || '预算确认信息已更新';
};

const getNextStep = (detail: BookingDetailResponse) => {
  const booking = detail.booking;
  const depositAmount = getSurveyDepositAmount(detail);
  const siteSurveySummary = detail.siteSurveySummary;
  const budgetConfirmSummary = detail.budgetConfirmSummary;

  if (booking.status === 4) {
    return {
      title: '预约已取消',
      description: '当前预约流程已结束，如需继续服务请重新发起预约。',
    };
  }

  if (booking.status === 1) {
    return {
      title: '等待商家确认',
      description: '预约已提交，商家确认后你再支付量房费，当前无需提前付款。',
    };
  }

  if (booking.status === 2 && !booking.surveyDepositPaid) {
    return {
      title: '支付量房费',
      description: '商家已确认预约，请先支付量房费，再安排上门量房。',
      amount: depositAmount,
      amountLabel: '待支付量房费',
      actionKey: 'pay_survey_deposit' as const,
    };
  }

  if (detail.proposalId) {
    return {
      title: '查看设计方案',
      description: '当前预约已进入方案阶段，可直接查看商家提交的设计方案。',
      actionText: '查看设计方案',
      actionKey: 'view_proposal' as const,
    };
  }

  if (budgetConfirmSummary?.status === 'rejected') {
    return {
      title: '等待商家重新提交预算',
      description: budgetConfirmSummary.rejectionReason || '你已退回预算确认，商家会重新整理后提交。',
    };
  }

  if (budgetConfirmSummary?.status === 'submitted' || budgetConfirmSummary?.status === 'accepted') {
    return {
      title: '等待方案与报价',
      description: '预算确认已推进，商家正在继续整理方案或报价信息。',
    };
  }

  if (siteSurveySummary?.status === 'revision_requested') {
    return {
      title: '等待重新量房',
      description: siteSurveySummary.revisionRequestReason || '量房记录已退回，等待商家重新量房。',
    };
  }

  if (siteSurveySummary) {
    return {
      title: '等待预算确认',
      description: '量房记录已完成，商家接下来会整理预算确认信息。',
    };
  }

  if (booking.surveyDepositPaid) {
    return {
      title: '等待上门量房',
      description: booking.preferredDate
        ? `量房费已支付，商家会按你选择的时间 ${booking.preferredDate} 安排上门量房。`
        : '量房费已支付，商家会尽快安排上门量房。',
    };
  }

  return {
    title: '预约处理中',
    description: '当前预约正在推进中，请留意商家确认和后续量房安排。',
  };
};

const BookingDetailPage: React.FC = () => {
  const auth = useAuthStore();
  const [id, setId] = useState<number>(0);
  const [detail, setDetail] = useState<BookingDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useLoad((options) => {
    if (options.id) {
      setId(Number(options.id));
    }
  });

  const fetchDetail = useCallback(async () => {
    if (!id) {
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
    void runReload();
  }, [auth.token, id, runReload]);

  const handlePaySurveyDeposit = async () => {
    if (!detail?.booking) {
      return;
    }
    await navigateToSurveyDepositPaymentWithOptions(
      detail.booking.id,
      detail.surveyDepositPaymentOptions,
    );
  };

  if (!auth.token) {
    return (
      <View className="page bg-gray-50 min-h-screen p-md" {...bindPullToRefresh}>
        <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />
        <Empty
          description="登录后查看预约详情"
          action={{ text: '去登录', onClick: () => Taro.switchTab({ url: '/pages/profile/index' }) }}
        />
      </View>
    );
  }

  if (loading) {
    return (
      <View className="page bg-gray-50 min-h-screen p-md" {...bindPullToRefresh}>
        <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />
        <Skeleton height={180} className="mb-md" />
        <Skeleton height={200} className="mb-md" />
      </View>
    );
  }

  if (!detail?.booking) {
    return (
      <View className="page bg-gray-50 min-h-screen p-md text-center text-gray-500" {...bindPullToRefresh}>
        <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />
        未找到预约信息
      </View>
    );
  }

  const booking = detail.booking;
  const status = getStatusMeta(booking.status);
  const refundSummary = detail.refundSummary;
  const refundStatus = getRefundStatus(refundSummary?.latestRefundStatus);
  const stageRaw = detail.businessStage || detail.currentStage;
  const stageMeta = stageRaw ? getBusinessStageStatus(stageRaw) : null;
  const nextStep = getNextStep(detail);
  const surveyStatus = getSurveyStatusMeta(detail.siteSurveySummary?.status);
  const budgetStatus = getBudgetStatusMeta(detail.budgetConfirmSummary?.status);
  const surveyDepositAmount = getSurveyDepositAmount(detail);
  const showSurveyDepositAction = nextStep.actionKey === 'pay_survey_deposit';

  return (
    <View className="page booking-detail-page bg-gray-50 min-h-screen p-md" {...bindPullToRefresh}>
      <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />
      <Card
        title={`预约 #${booking.id}`}
        extra={<Tag variant={status.variant}>{status.label}</Tag>}
        className="mb-md"
      >
        <View className="flex flex-col gap-sm mt-sm">
          <ListItem title="项目地址" description={booking.address || '-'} />
          <ListItem title="房屋面积" description={booking.area ? `${booking.area} ㎡` : '-'} />
          <ListItem title="房屋户型" description={booking.houseLayout || '-'} />
          <ListItem title="期望量房日期" description={booking.preferredDate || '-'} />
          <ListItem title="联系电话" description={booking.phone || '-'} />
          {booking.notes ? <ListItem title="备注需求" description={booking.notes} /> : null}
        </View>
      </Card>

      {detail.provider ? (
        <Card title="服务商信息" className="mb-md">
          <ListItem
            title={detail.provider.name || `服务商 #${detail.provider.id}`}
            description={detail.provider.specialty || '暂无服务介绍'}
            extra={detail.provider.rating ? <Text className="text-brand">{detail.provider.rating.toFixed(1)} 分</Text> : undefined}
          />
        </Card>
      ) : null}

      {(stageMeta || detail.flowSummary) ? (
        <Card title="预约进展" className="mb-md">
          {stageMeta ? (
            <ListItem
              title="当前阶段"
              description={stageMeta.label}
              extra={<Tag variant={stageMeta.variant}>{stageMeta.label}</Tag>}
            />
          ) : null}
          {detail.flowSummary ? <View className="booking-detail-page__copy">{detail.flowSummary}</View> : null}
        </Card>
      ) : null}

      {(detail.siteSurveySummary || detail.budgetConfirmSummary || booking.surveyDepositPaid) ? (
        <Card title="量房与预算" className="mb-md">
          <View className="flex flex-col gap-sm">
            <ListItem
              title="量房费"
              description={booking.surveyDepositPaid ? '已支付，等待或正在推进量房' : '商家确认后需支付'}
              extra={
                <Text
                  className={booking.surveyDepositPaid ? 'font-medium' : 'text-brand font-medium'}
                  style={booking.surveyDepositPaid ? { color: '#16A34A' } : undefined}
                >
                  {surveyDepositAmount > 0 ? formatCurrency(surveyDepositAmount) : '-'}
                </Text>
              }
            />
            <ListItem
              title="量房记录"
              description={getSiteSurveyDescription(detail.siteSurveySummary)}
              extra={<Tag variant={surveyStatus.variant}>{surveyStatus.label}</Tag>}
            />
            <ListItem
              title="预算确认"
              description={getBudgetDescription(detail.budgetConfirmSummary)}
              extra={<Tag variant={budgetStatus.variant}>{budgetStatus.label}</Tag>}
            />
          </View>
        </Card>
      ) : null}

      {refundSummary ? (
        <Card title="退款与售后" className="mb-md">
          <View className="flex flex-col gap-sm">
            <ListItem
              title="申请状态"
              description={refundSummary.latestRefundId ? `申请单 #${refundSummary.latestRefundId}` : '当前未发起退款'}
              extra={<Tag variant={refundStatus.variant}>{refundStatus.label}</Tag>}
            />
            <ListItem
              title="可退金额"
              description={`¥${refundSummary.refundableAmount.toLocaleString()}`}
            />
            {refundSummary.canApplyRefund ? (
              <View className="booking-detail-page__copy">当前可发起退款申请，提交后可在“退款记录”查看审核进度。</View>
            ) : (
              <View className="booking-detail-page__copy">当前已有退款处理记录，请先查看处理结果。</View>
            )}
            <View className="flex gap-sm mt-sm">
              <View className="flex-1">
                <Button
                  variant="outline"
                  block
                  onClick={() => Taro.navigateTo({ url: `/pages/refunds/list/index?bookingId=${booking.id}` })}
                >
                  查看记录
                </Button>
              </View>
              <View className="flex-1">
                <Button
                  block
                  disabled={!refundSummary.canApplyRefund}
                  onClick={() => Taro.navigateTo({ url: `/pages/bookings/refund/index?id=${booking.id}` })}
                >
                  申请退款
                </Button>
              </View>
            </View>
          </View>
        </Card>
      ) : null}

      <Card title="下一步" className="mb-md">
        <View className="flex flex-col gap-sm">
          <View>
            <Text className="booking-detail-page__next-title">{nextStep.title}</Text>
            <View className="booking-detail-page__copy">{nextStep.description}</View>
          </View>
          {typeof nextStep.amount === 'number' && nextStep.amount > 0 ? (
            <View className="booking-detail-page__amount">
              <Text className="booking-detail-page__amount-label">{nextStep.amountLabel || '当前金额'}</Text>
              <Text className="booking-detail-page__amount-value">{formatCurrency(nextStep.amount)}</Text>
            </View>
          ) : null}
          {showSurveyDepositAction ? (
            <Button variant="primary" className="w-full" onClick={handlePaySurveyDeposit}>
              去支付
            </Button>
          ) : null}
          {!showSurveyDepositAction && nextStep.actionText ? (
            <Button
              variant="primary"
              className="w-full"
              onClick={() => {
                if (nextStep.actionKey === 'view_proposal' && detail.proposalId) {
                  Taro.navigateTo({ url: `/pages/proposals/detail/index?id=${detail.proposalId}` });
                }
              }}
            >
              {nextStep.actionText}
            </Button>
          ) : null}
        </View>
      </Card>
    </View>
  );
};

export default BookingDetailPage;
