import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Text, View } from '@tarojs/components';
import Taro, { useDidHide, useDidShow, useLoad } from '@tarojs/taro';

import { Button } from '@/components/Button';
import BridgeConversionPanel from '@/components/BridgeConversionPanel';
import { Empty } from '@/components/Empty';
import { PullToRefreshNotice } from '@/components/PullToRefreshNotice';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import { getBusinessStageStatus } from '@/constants/status';
import { usePullToRefreshFeedback } from '@/hooks/usePullToRefreshFeedback';
import {
  acceptBookingBudgetConfirm,
  cancelBooking,
  getBookingDetail,
  rejectBookingBudgetConfirm,
  type BookingBudgetConfirmSummary,
  type BookingDetailResponse,
  type BookingSiteSurveySummary,
} from '@/services/bookings';
import { useAuthStore } from '@/store/auth';
import { showErrorToast } from '@/utils/error';
import { consumePaymentRefreshNotice } from '@/utils/paymentRefresh';
import { formatServerDateTime } from '@/utils/serverTime';
import { navigateToSurveyDepositPaymentWithOptions } from '@/utils/surveyDepositPayment';

import './index.scss';

const formatCurrency = (amount: number) => `¥${amount.toLocaleString()}`;

const PanelTitle: React.FC<{ title: string }> = ({ title }) => (
  <View className="booking-detail-page__panel-head">
    <Text className="booking-detail-page__panel-title">{title}</Text>
  </View>
);

const DetailTile: React.FC<{ label: string; value?: string; secondary?: string; full?: boolean }> = ({
  label,
  value = '-',
  secondary,
  full = false,
}) => (
  <View className={`booking-detail-page__tile ${full ? 'booking-detail-page__tile--full' : ''}`}>
    <Text className="booking-detail-page__tile-label">{label}</Text>
    <Text className="booking-detail-page__tile-value">{value || '-'}</Text>
    {secondary ? <Text className="booking-detail-page__tile-secondary">{secondary}</Text> : null}
  </View>
);

const ProgressItem: React.FC<{
  title: string;
  description: string;
  tagLabel?: string;
  tagVariant?: 'default' | 'primary' | 'secondary' | 'brand' | 'success' | 'warning' | 'error';
}> = ({ title, description, tagLabel, tagVariant = 'default' }) => (
  <View className="booking-detail-page__progress-item">
    <View className="booking-detail-page__progress-rail">
      <View className="booking-detail-page__progress-dot" />
      <View className="booking-detail-page__progress-line" />
    </View>
    <View className="booking-detail-page__progress-main">
      <View className="booking-detail-page__progress-top">
        <Text className="booking-detail-page__progress-title">{title}</Text>
        {tagLabel ? <Tag variant={tagVariant}>{tagLabel}</Tag> : null}
      </View>
      <Text className="booking-detail-page__progress-copy">{description}</Text>
    </View>
  </View>
);

const getStatusMeta = (detail: BookingDetailResponse) => {
  switch (detail.statusGroup || detail.booking.statusGroup) {
    case 'pending_confirmation':
      return { label: detail.statusText || detail.booking.statusText || '待商家确认', variant: 'warning' as const };
    case 'pending_payment':
      return { label: detail.statusText || detail.booking.statusText || '待支付量房费', variant: 'primary' as const };
    case 'in_service':
      return { label: detail.statusText || detail.booking.statusText || '服务推进中', variant: 'primary' as const };
    case 'completed':
      return { label: detail.statusText || detail.booking.statusText || '已进入后续阶段', variant: 'success' as const };
    case 'cancelled':
      return { label: detail.statusText || detail.booking.statusText || '已取消', variant: 'default' as const };
    default:
      return { label: detail.statusText || detail.booking.statusText || '处理中', variant: 'default' as const };
  }
};

const getSurveyStatusMeta = (status?: string) => {
  switch (status) {
    case 'submitted':
      return { label: '已上传', variant: 'primary' as const };
    case 'confirmed':
      return { label: '已完成', variant: 'success' as const };
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

const getDeliverableStatusMeta = (status?: string) => {
  switch (status) {
    case 'submitted':
      return { label: '待确认', variant: 'warning' as const };
    case 'accepted':
      return { label: '已确认', variant: 'success' as const };
    case 'rejected':
      return { label: '已退回', variant: 'default' as const };
    default:
      return { label: '待提交', variant: 'default' as const };
  }
};

const getProposalStatusMeta = (detail: BookingDetailResponse) => {
  const currentStage = detail.currentStage || detail.booking.currentStage || detail.businessStage;
  const bridgeStarted = [
    'construction_party_pending',
    'construction_quote_pending',
    'ready_to_start',
    'in_construction',
    'node_acceptance_in_progress',
    'completed',
    'archived',
    'disputed',
    'payment_paused',
  ].includes(String(currentStage || '').trim());

  if (bridgeStarted) {
    return { label: '已完成', variant: 'success' as const };
  }
  if (detail.proposalId) {
    return { label: '待确认', variant: 'warning' as const };
  }
  return { label: '待生成', variant: 'default' as const };
};

const getSurveyDepositAmount = (detail: BookingDetailResponse) => (
  Number(detail.surveyDepositAmount || detail.booking.surveyDepositAmount || detail.booking.surveyDeposit || 0)
);

const canPromptSurveyDepositPayment = (detail: BookingDetailResponse) => (
  !detail.booking.surveyDepositPaid
  && (detail.booking.status === 2 || (detail.surveyDepositPaymentOptions?.length ?? 0) > 0)
  && (detail.statusGroup || detail.booking.statusGroup) !== 'cancelled'
);

const getCurrentStageText = (detail: BookingDetailResponse) => {
  if (canPromptSurveyDepositPayment(detail)) {
    return '待支付量房费';
  }
  if (detail.currentStageText || detail.booking.currentStageText) {
    return detail.currentStageText || detail.booking.currentStageText || '-';
  }
  const stageRaw = detail.businessStage || detail.currentStage || detail.booking.currentStage;
  return stageRaw ? getBusinessStageStatus(stageRaw).label : '-';
};

const getSiteSurveyDescription = (siteSurveySummary?: BookingSiteSurveySummary) => {
  if (!siteSurveySummary) {
    return '量房费支付后，商家会安排量房并提交量房记录。';
  }
  if (siteSurveySummary.status === 'revision_requested') {
    return siteSurveySummary.revisionRequestReason || '量房记录已退回，等待商家重新量房。';
  }
  if (siteSurveySummary.notes) {
    return siteSurveySummary.notes;
  }
  return '量房记录已更新';
};

const getBudgetDescription = (budgetConfirmSummary?: BookingBudgetConfirmSummary) => {
  if (!budgetConfirmSummary) {
    return '量房资料上传后，商家会继续提交沟通确认。';
  }

  const hasBudgetRange =
    typeof budgetConfirmSummary.budgetMin === 'number'
    && typeof budgetConfirmSummary.budgetMax === 'number'
    && budgetConfirmSummary.budgetMax > 0;

  if (budgetConfirmSummary.status === 'rejected' && budgetConfirmSummary.rejectionReason) {
    return budgetConfirmSummary.rejectionReason;
  }

  if (hasBudgetRange) {
    return `${formatCurrency(budgetConfirmSummary.budgetMin || 0)} - ${formatCurrency(budgetConfirmSummary.budgetMax || 0)}`;
  }

  return budgetConfirmSummary.notes || budgetConfirmSummary.designIntent || '预算确认信息已更新';
};

const getBudgetRejectProgress = (budgetConfirmSummary?: BookingBudgetConfirmSummary) => {
  if (!budgetConfirmSummary) return '';
  const rejectCount = Number(budgetConfirmSummary.rejectCount || 0);
  const rejectLimit = Number(budgetConfirmSummary.rejectLimit || 0);
  if (rejectCount <= 0 && rejectLimit <= 0) return '';
  return rejectLimit > 0 ? `${rejectCount}/${rejectLimit}` : `${rejectCount}`;
};

const getBridgeBaselineText = (status?: string) => {
  switch (String(status || '').trim()) {
    case 'submitted':
      return '报价基线已提交';
    case 'ready_for_selection':
      return '报价基线已就绪，可进入施工主体选择';
    case 'pending_submission':
      return '待提交报价基线';
    default:
      return '报价基线状态待同步';
  }
};

const getConstructionSubjectText = (type?: string, name?: string) => {
  if (type === 'company') {
    return name ? `装修公司主体 · ${name}` : '装修公司主体';
  }
  if (type === 'foreman') {
    return name ? `独立工长主体 · ${name}` : '独立工长主体';
  }
  return '待确认施工主体';
};

const getBridgeGuide = (detail: BookingDetailResponse) => {
  const currentStage = detail.currentStage || detail.booking.currentStage || detail.businessStage;
  const kickoffStatus = String(detail.kickoffStatus || '').trim();
  if (kickoffStatus === 'scheduled') {
    return `施工主体已确认（${getConstructionSubjectText(
      detail.constructionSubjectType,
      detail.constructionSubjectDisplayName,
    )}），监理已登记计划进场时间。`;
  }
  switch (String(currentStage || '').trim()) {
    case 'construction_party_pending':
      return '报价基线已提交，当前在对比装修公司主体或独立工长。';
    case 'construction_quote_pending':
      return `施工主体已确认（${getConstructionSubjectText(
        detail.constructionSubjectType,
        detail.constructionSubjectDisplayName,
      )}），当前等待施工报价确认。`;
    case 'ready_to_start':
      return '施工报价已确认，下一步由监理协调计划进场时间。';
    default:
      return '正式方案确认后，会依次进入报价基线数据、施工主体选择、施工报价确认，再进入待监理协调开工。';
  }
};

const getDesignDeliverableDescription = (detail: BookingDetailResponse) => {
  const summary = detail.designDeliverableSummary;
  if (!summary) {
    return '设计费支付完成后，设计师会先提交设计交付供你确认。';
  }
  if (summary.status === 'rejected') {
    return summary.rejectionReason || '设计交付已退回，等待设计师重新提交。';
  }
  if (summary.status === 'accepted') {
    return '设计交付已确认，设计师会继续整理正式方案。';
  }
  return '设计交付已提交，确认通过后才会继续进入正式方案确认。';
};

const getProposalDescription = (detail: BookingDetailResponse) => {
  const currentStage = detail.currentStage || detail.booking.currentStage || detail.businessStage;
  const bridgeStarted = [
    'construction_party_pending',
    'construction_quote_pending',
    'ready_to_start',
    'in_construction',
    'node_acceptance_in_progress',
    'completed',
    'archived',
    'disputed',
    'payment_paused',
  ].includes(String(currentStage || '').trim());

  if (bridgeStarted) {
    return detail.flowSummary || detail.booking.flowSummary || '施工桥接推进中，等待下一责任人处理。';
  }
  if (detail.proposalId) {
    return '正式方案已提交，当前由你确认方案后进入报价基线整理与施工主体选择。';
  }
  if (detail.designDeliverableSummary?.status === 'accepted') {
    return '设计交付已确认，等待设计师生成正式方案。';
  }
  return '设计交付确认通过后，才会进入正式方案确认。';
};

const getNextStep = (detail: BookingDetailResponse) => {
  const statusGroup = detail.statusGroup || detail.booking.statusGroup;
  const flowSummary = detail.flowSummary || detail.booking.flowSummary;
  const amount = getSurveyDepositAmount(detail);
  const availableActions = detail.availableActions || detail.booking.availableActions || [];
  const designFeeQuoteStatus = String(detail.designFeeQuoteSummary?.status || '').trim();
  const designFeeOrderStatus = typeof detail.designFeeQuoteSummary?.orderStatus === 'number'
    ? Number(detail.designFeeQuoteSummary.orderStatus)
    : null;
  const designDeliverableStatus = String(detail.designDeliverableSummary?.status || '').trim();
  const currentStage = detail.currentStage || detail.booking.currentStage || detail.businessStage;
  const bridgeStarted = [
    'construction_party_pending',
    'construction_quote_pending',
    'ready_to_start',
    'in_construction',
    'node_acceptance_in_progress',
    'completed',
    'archived',
    'disputed',
    'payment_paused',
  ].includes(String(currentStage || '').trim());

  if (canPromptSurveyDepositPayment(detail)) {
    return {
      title: '去支付',
      description: amount > 0
        ? `请先支付 ${formatCurrency(amount)}，支付完成后商家才会继续量房与预算。`
        : '请先支付量房费，支付完成后商家才会继续量房与预算。',
      amount,
      amountLabel: '待支付量房费',
      actionKey: 'pay_survey_deposit' as const,
    };
  }

  if (designFeeQuoteStatus === 'pending') {
    return {
      title: '待确认并支付设计费',
      description: '设计师已提交设计费报价，确认后再继续推进设计交付。',
      actionText: '查看报价',
      actionKey: 'view_design_quote' as const,
    };
  }

  if (designFeeQuoteStatus === 'confirmed' && designFeeOrderStatus === 0) {
    return {
      title: '待支付设计费',
      description: '设计费订单已生成，完成支付后设计师才会继续提交设计交付。',
      actionText: '去支付设计费',
      actionKey: 'view_design_quote' as const,
    };
  }

  if (designFeeQuoteStatus === 'confirmed' && designFeeOrderStatus === 1) {
    if (bridgeStarted) {
      return {
        title: currentStage === 'construction_quote_pending'
          ? '待确认施工报价'
          : currentStage === 'ready_to_start'
            ? '待监理协调开工'
            : '施工桥接中',
        description: getProposalDescription(detail),
      };
    }

    if (designDeliverableStatus === 'submitted' || designDeliverableStatus === 'rejected') {
      return {
        title: '查看设计交付',
        description: getDesignDeliverableDescription(detail),
        actionText: '查看交付',
        actionKey: 'view_deliverable' as const,
      };
    }

    if (detail.proposalId) {
      return {
        title: '查看正式方案',
        description: getProposalDescription(detail),
        actionText: '查看方案',
        actionKey: 'view_proposal' as const,
      };
    }
  }

  switch (statusGroup) {
    case 'pending_confirmation':
      return {
        title: '等待商家确认',
        description: flowSummary || '预约已提交，商家确认后才会进入量房费支付。',
      };
    case 'pending_payment':
      return {
        title: '支付量房费',
        description: flowSummary || '商家已确认预约，请先支付量房费后继续推进量房与预算。',
        amount,
        amountLabel: '待支付量房费',
        actionKey: 'pay_survey_deposit' as const,
      };
    case 'cancelled':
      return {
        title: '预约已取消',
        description: flowSummary || '当前预约流程已结束，如需继续服务请重新发起预约。',
      };
    case 'completed':
      if (detail.proposalId) {
        return {
          title: '查看设计方案',
          description: flowSummary || '预约前置服务已完成，当前已进入方案阶段。',
          actionText: '查看设计方案',
          actionKey: 'view_proposal' as const,
        };
      }
      return {
        title: '查看详情',
        description: flowSummary || '预约已进入后续阶段。',
      };
    default:
      if (availableActions.includes('submit_budget')) {
        return {
          title: '等待预算确认',
          description: flowSummary || '量房资料已上传，等待商家继续提交沟通确认。',
        };
      }
      if (availableActions.includes('create_proposal')) {
        return {
          title: '等待商家提交方案',
          description: flowSummary || '预算确认已完成，待商家继续提交方案。',
        };
      }
      return {
        title: '查看服务进展',
        description: flowSummary || '量房费已支付，预约前置服务正在推进中。',
      };
  }
};

const getSummaryCopy = (detail: BookingDetailResponse, nextStep: ReturnType<typeof getNextStep>) => {
  const statusGroup = detail.statusGroup || detail.booking.statusGroup;
  if (canPromptSurveyDepositPayment(detail)) {
    return '';
  }
  switch (statusGroup) {
    case 'pending_confirmation':
      return '预约已提交，等待商家确认承接。';
    case 'pending_payment':
      return '商家已确认，请先完成量房费支付。';
    case 'completed':
      return detail.flowSummary || detail.booking.flowSummary || '预约前置流程已完成，已进入后续阶段。';
    case 'cancelled':
      return '当前预约流程已结束，如需继续服务请重新发起预约。';
    default:
      if (detail.siteSurveySummary?.status === 'submitted') {
        return '量房资料已上传，设计师正在整理沟通确认。';
      }
      if (detail.budgetConfirmSummary?.status === 'submitted') {
        return '沟通确认已提交，等待你确认。';
      }
      return nextStep.description;
  }
};

const getMerchantConfirmMeta = (detail: BookingDetailResponse) => {
  const statusGroup = detail.statusGroup || detail.booking.statusGroup;
  switch (statusGroup) {
    case 'pending_confirmation':
      return {
        label: '待确认',
        variant: 'warning' as const,
        description: '预约已提交，平台正在等待商家确认是否承接本次量房服务。',
      };
    case 'cancelled':
      return {
        label: '已结束',
        variant: 'default' as const,
        description: '当前预约已取消，商家确认流程不再继续。',
      };
    default:
      return {
        label: '已确认',
        variant: 'success' as const,
        description: '商家已确认承接，用户现在可以继续支付量房费或查看后续推进。',
      };
  }
};

const getDepositProgressMeta = (detail: BookingDetailResponse) => {
  const statusGroup = detail.statusGroup || detail.booking.statusGroup;
  const amount = getSurveyDepositAmount(detail);
  if (detail.booking.surveyDepositPaid) {
    return {
      label: '已支付',
      variant: 'success' as const,
      description: detail.booking.surveyDepositPaidAt
        ? `量房费已支付，时间 ${formatServerDateTime(detail.booking.surveyDepositPaidAt)}。`
        : '量房费已完成支付，商家可继续推进量房记录与预算确认。',
    };
  }

  if (statusGroup === 'pending_payment') {
    return {
      label: '待支付',
      variant: 'primary' as const,
      description: amount > 0
        ? `商家已确认预约，当前待支付量房费 ${formatCurrency(amount)}。`
        : '商家已确认预约，等待支付量房费后继续推进。',
    };
  }

  if (statusGroup === 'pending_confirmation') {
    return {
      label: '未开启',
      variant: 'default' as const,
      description: '商家确认前不会展示量房费支付动作。',
    };
  }

  if (statusGroup === 'cancelled') {
    return {
      label: '已结束',
      variant: 'default' as const,
      description: '预约已取消，量房费支付流程同步结束。',
    };
  }

  return {
    label: '处理中',
    variant: 'default' as const,
    description: amount > 0
      ? `量房费 ${formatCurrency(amount)} 已进入后续服务流程。`
      : '量房费流程已进入后续服务阶段。',
  };
};

const getDepositMetric = (detail: BookingDetailResponse) => {
  const amount = getSurveyDepositAmount(detail);
  const statusGroup = detail.statusGroup || detail.booking.statusGroup;

  if (amount > 0) {
    if (canPromptSurveyDepositPayment(detail)) {
      return {
        label: '当前状态',
        value: '商家已确认',
        copy: '',
      };
    }
    return {
      label: '量房费',
      value: formatCurrency(amount),
      copy: detail.booking.surveyDepositPaid
        ? (detail.booking.surveyDepositPaidAt ? `支付于 ${formatServerDateTime(detail.booking.surveyDepositPaidAt)}` : '量房费已支付')
        : '商家确认后即可支付',
    };
  }

  if (canPromptSurveyDepositPayment(detail)) {
    return {
      label: '当前状态',
      value: '商家已确认',
      copy: '',
    };
  }

  if (detail.booking.surveyDepositPaid) {
    return {
      label: '量房费状态',
      value: '已支付',
      copy: '金额未回填，不影响当前服务推进。',
    };
  }

  if (statusGroup === 'pending_confirmation') {
    return {
      label: '量房费状态',
      value: '待确认',
      copy: '商家确认承接后会展示支付金额。',
    };
  }

  if (statusGroup === 'pending_payment') {
    return {
      label: '量房费状态',
      value: '待支付',
      copy: '支付金额待商家配置完成后展示。',
    };
  }

  return {
    label: '量房费状态',
    value: '处理中',
    copy: '当前流程正在推进，金额信息暂未同步。',
  };
};

const getPreferredDateDisplay = (preferredDate?: string) => {
  const normalized = (preferredDate || '').replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return { primary: '-', secondary: undefined as string | undefined };
  }

  const parts = normalized.split(' ');
  if (parts.length >= 3 && /^\d{4}-\d{2}-\d{2}$/.test(parts[0])) {
    return {
      primary: [parts[0], parts[1]].filter(Boolean).join(' '),
      secondary: parts.slice(2).join(' '),
    };
  }

  if (parts.length >= 2) {
    return {
      primary: parts.slice(0, 2).join(' '),
      secondary: parts.slice(2).join(' ') || undefined,
    };
  }

  return { primary: normalized, secondary: undefined as string | undefined };
};

const BookingDetailPage: React.FC = () => {
  const auth = useAuthStore();
  const [id, setId] = useState<number>(0);
  const [routeReady, setRouteReady] = useState(false);
  const [pageVisible, setPageVisible] = useState(false);
  const [detail, setDetail] = useState<BookingDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [budgetSubmitting, setBudgetSubmitting] = useState(false);
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

  const handlePaySurveyDeposit = async () => {
    if (!detail?.booking) {
      return;
    }
    try {
      setPaying(true);
      await navigateToSurveyDepositPaymentWithOptions(
        detail.booking.id,
        detail.surveyDepositPaymentOptions,
      );
    } finally {
      setPaying(false);
    }
  };

  const handleViewProposal = () => {
    if (!detail?.proposalId) {
      return;
    }
    Taro.navigateTo({ url: `/pages/proposals/detail/index?id=${detail.proposalId}` });
  };

  const handleViewDesignDeliverable = () => {
    if (!detail?.booking?.id) {
      return;
    }
    Taro.navigateTo({ url: `/pages/booking/design-deliverable/index?id=${detail.booking.id}` });
  };

  const handleViewDesignQuote = () => {
    if (!detail?.booking?.id) {
      return;
    }
    Taro.navigateTo({ url: `/pages/booking/design-quote/index?id=${detail.booking.id}` });
  };

  const handleViewSiteSurvey = () => {
    if (!detail?.booking?.id) {
      return;
    }
    Taro.navigateTo({ url: `/pages/booking/site-survey/index?id=${detail.booking.id}` });
  };

  const handleCancelBooking = async () => {
    if (!detail?.booking?.id || canceling) {
      return;
    }

    Taro.showModal({
      title: '取消预约',
      content: '确定要取消当前预约吗？取消后流程会立即结束。',
      success: async (res) => {
        if (!res.confirm) {
          return;
        }

        setCanceling(true);
        try {
          await cancelBooking(detail.booking.id);
          Taro.showToast({ title: '已取消', icon: 'success' });
          await fetchDetail();
        } catch (error) {
          showErrorToast(error, '取消失败');
        } finally {
          setCanceling(false);
        }
      },
    });
  };

  const handleAcceptBudgetConfirm = async () => {
    if (!detail?.booking?.id || budgetSubmitting) {
      return;
    }
    try {
      setBudgetSubmitting(true);
      await acceptBookingBudgetConfirm(detail.booking.id);
      Taro.showToast({ title: '已确认', icon: 'success' });
      await fetchDetail();
    } catch (error) {
      showErrorToast(error, '确认失败');
    } finally {
      setBudgetSubmitting(false);
    }
  };

  const handleRejectBudgetConfirm = async () => {
    if (!detail?.booking?.id || budgetSubmitting) {
      return;
    }
    Taro.showModal({
      title: '驳回沟通确认',
      content: '请补充驳回原因',
      editable: true,
      placeholderText: '请输入驳回原因',
      success: async (res: { confirm: boolean; content?: string }) => {
        if (!res.confirm) {
          return;
        }
        try {
          setBudgetSubmitting(true);
          await rejectBookingBudgetConfirm(detail.booking.id, res.content || '用户要求调整沟通确认');
          Taro.showToast({ title: '已退回', icon: 'success' });
          await fetchDetail();
        } catch (error) {
          showErrorToast(error, '退回失败');
        } finally {
          setBudgetSubmitting(false);
        }
      },
    } as any);
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
        <Skeleton height={220} className="mb-md" />
        <Skeleton height={220} className="mb-md" />
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
  const status = getStatusMeta(detail);
  const stageText = getCurrentStageText(detail);
  const nextStep = getNextStep(detail);
  const surveyStatus = getSurveyStatusMeta(detail.siteSurveySummary?.status);
  const budgetStatus = getBudgetStatusMeta(detail.budgetConfirmSummary?.status);
  const deliverableStatus = getDeliverableStatusMeta(detail.designDeliverableSummary?.status);
  const proposalStatus = getProposalStatusMeta(detail);
  const surveyDepositAmount = getSurveyDepositAmount(detail);
  const showSurveyDepositAction = nextStep.actionKey === 'pay_survey_deposit';
  const showProgressSection = (detail.statusGroup || booking.statusGroup) === 'in_service'
    || (detail.statusGroup || booking.statusGroup) === 'completed'
    || Boolean(detail.siteSurveySummary || detail.budgetConfirmSummary);
  const providerInitial = (detail.provider?.name || '服').slice(0, 1);
  const summaryCopy = getSummaryCopy(detail, nextStep);
  const depositMetric = getDepositMetric(detail);
  const nextActionLabel = showSurveyDepositAction
    ? '去支付'
    : nextStep.actionKey === 'view_design_quote'
      ? (nextStep.actionText || '查看报价')
    : nextStep.actionKey === 'view_deliverable'
      ? (nextStep.actionText || '查看交付')
    : nextStep.actionKey === 'view_proposal'
      ? (nextStep.actionText || '查看设计方案')
      : '';
  const merchantConfirmMeta = getMerchantConfirmMeta(detail);
  const depositProgressMeta = getDepositProgressMeta(detail);
  const preferredDateDisplay = getPreferredDateDisplay(booking.preferredDate);
  const availableActions = detail.availableActions || booking.availableActions || [];
  const canCancelBooking = availableActions.includes('cancel');
  const showBudgetConfirmActions = detail.budgetConfirmSummary?.status === 'submitted';
  const bridgeStarted = proposalStatus.label === '已完成';
  const budgetRejectProgress = getBudgetRejectProgress(detail.budgetConfirmSummary);
  const showBridgeGuide = Boolean(detail.proposalId || bridgeStarted);

  return (
    <View className="page booking-detail-page bg-gray-50 min-h-screen p-md" {...bindPullToRefresh}>
      <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />
      <View className="booking-detail-page__stack">
        <View className="booking-detail-page__hero">
          <View className="booking-detail-page__hero-top">
            <View className="booking-detail-page__hero-badge">预约流程</View>
            <Tag variant={status.variant}>{status.label}</Tag>
          </View>
          <Text className="booking-detail-page__hero-title">{stageText}</Text>
          {summaryCopy ? (
            <Text className="booking-detail-page__hero-copy">{summaryCopy}</Text>
          ) : null}

          <View className="booking-detail-page__hero-metrics">
            <View className="booking-detail-page__metric booking-detail-page__metric--accent">
              <Text className="booking-detail-page__metric-label">{depositMetric.label}</Text>
              <Text className="booking-detail-page__metric-value">
                {depositMetric.value}
              </Text>
              {depositMetric.copy ? (
                <Text className="booking-detail-page__metric-copy">{depositMetric.copy}</Text>
              ) : null}
            </View>
            <View className="booking-detail-page__metric">
              <Text className="booking-detail-page__metric-label">下一步</Text>
              <Text className="booking-detail-page__metric-value booking-detail-page__metric-value--dark">
                {nextStep.title}
              </Text>
              {!showSurveyDepositAction && nextStep.description ? (
                <Text className="booking-detail-page__metric-copy">{nextStep.description}</Text>
              ) : null}
            </View>
          </View>

          {(canCancelBooking || nextActionLabel) ? (
            <View className={`booking-detail-page__hero-actions${canCancelBooking && nextActionLabel ? '' : ' booking-detail-page__hero-actions--single'}`}>
              {canCancelBooking ? (
                <Button
                  variant="outline"
                  className="booking-detail-page__hero-secondary-button"
                  loading={canceling}
                  disabled={canceling || paying}
                  onClick={handleCancelBooking}
                >
                  取消预约
                </Button>
              ) : null}
              {showSurveyDepositAction ? (
                <Button variant="primary" className="w-full" loading={paying} disabled={paying || canceling} onClick={handlePaySurveyDeposit}>
                  {nextActionLabel}
                </Button>
              ) : nextActionLabel ? (
                <Button
                  variant="primary"
                  className="w-full"
                  disabled={canceling}
                  onClick={
                    nextStep.actionKey === 'view_design_quote'
                      ? handleViewDesignQuote
                      : nextStep.actionKey === 'view_deliverable'
                        ? handleViewDesignDeliverable
                        : handleViewProposal
                  }
                >
                  {nextActionLabel}
                </Button>
              ) : null}
            </View>
          ) : null}
        </View>

        {detail.provider ? (
          <View className="booking-detail-page__panel">
            <PanelTitle title="服务商信息" />
            <View className="booking-detail-page__provider">
              {detail.provider.avatar ? (
                <Image
                  className="booking-detail-page__provider-avatar"
                  src={detail.provider.avatar}
                  mode="aspectFill"
                />
              ) : (
                <View className="booking-detail-page__provider-avatar booking-detail-page__provider-avatar--fallback">
                  <Text className="booking-detail-page__provider-avatar-text">{providerInitial}</Text>
                </View>
              )}
              <View className="booking-detail-page__provider-main">
                <View className="booking-detail-page__provider-head">
                  <Text className="booking-detail-page__provider-name">
                    {detail.provider.name || `服务商 #${detail.provider.id}`}
                  </Text>
                  <View className="booking-detail-page__provider-tags">
                    {detail.provider.verified ? <Tag variant="success">已认证</Tag> : null}
                    {detail.provider.rating ? <Tag variant="brand">{detail.provider.rating.toFixed(1)} 分</Tag> : null}
                  </View>
                </View>
                <Text className="booking-detail-page__provider-copy">
                  {detail.provider.specialty || '平台已为你匹配对应服务商，后续会继续围绕量房与预算推进。'}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        <View className="booking-detail-page__panel">
          <PanelTitle title="预约信息" />
          <View className="booking-detail-page__address-card">
            <Text className="booking-detail-page__address-label">项目地址</Text>
            <Text className="booking-detail-page__address-value">{booking.address || '-'}</Text>
          </View>
          <View className="booking-detail-page__tile-grid">
            <DetailTile label="房屋面积" value={booking.area ? `${booking.area} ㎡` : '-'} />
            <DetailTile label="房屋户型" value={booking.houseLayout || '-'} />
            <DetailTile label="装修类型" value={booking.renovationType || '-'} />
            <DetailTile label="预算范围" value={booking.budgetRange || '-'} />
            <DetailTile label="量房时间" value={preferredDateDisplay.primary} secondary={preferredDateDisplay.secondary} />
            <DetailTile label="联系电话" value={booking.phone || '-'} />
            {booking.notes ? <DetailTile label="备注需求" value={booking.notes} full /> : null}
          </View>
        </View>

        <View className="booking-detail-page__panel booking-detail-page__panel--progress">
          <PanelTitle title="预约进展" />
          <ProgressItem
            title="商家确认"
            description={merchantConfirmMeta.description}
            tagLabel={merchantConfirmMeta.label}
            tagVariant={merchantConfirmMeta.variant}
          />
          <ProgressItem
            title="量房费支付"
            description={depositProgressMeta.description}
            tagLabel={depositProgressMeta.label}
            tagVariant={depositProgressMeta.variant}
          />
          <ProgressItem
            title="量房记录"
            description={showProgressSection ? getSiteSurveyDescription(detail.siteSurveySummary) : '支付量房费后，商家会安排量房并提交量房记录。'}
            tagLabel={showProgressSection ? surveyStatus.label : '待推进'}
            tagVariant={showProgressSection ? surveyStatus.variant : 'default'}
          />
          {detail.siteSurveySummary ? (
            <View className="booking-detail-page__budget-actions">
              <View className="booking-detail-page__budget-actions-row">
                <Button
                  variant="primary"
                  className="booking-detail-page__budget-actions-button"
                  onClick={handleViewSiteSurvey}
                >
                  查看量房资料
                </Button>
              </View>
            </View>
          ) : null}
          <ProgressItem
            title="预算确认"
            description={showProgressSection ? getBudgetDescription(detail.budgetConfirmSummary) : '量房资料上传后，商家会继续提交沟通确认。'}
            tagLabel={showProgressSection ? budgetStatus.label : '未开始'}
            tagVariant={showProgressSection ? budgetStatus.variant : 'default'}
          />
          {detail.budgetConfirmSummary ? (
            <View className="booking-detail-page__budget-actions">
              <Text className="booking-detail-page__budget-actions-copy">
                风格方向：{detail.budgetConfirmSummary.styleDirection || '暂未填写'}
              </Text>
              <Text className="booking-detail-page__budget-actions-copy">
                空间需求：{detail.budgetConfirmSummary.spaceRequirements || '暂未填写'}
              </Text>
              <Text className="booking-detail-page__budget-actions-copy">
                可接受工期：{detail.budgetConfirmSummary.expectedDurationDays ? `${detail.budgetConfirmSummary.expectedDurationDays} 天` : '暂未填写'}
              </Text>
              <Text className="booking-detail-page__budget-actions-copy">
                特殊要求：{detail.budgetConfirmSummary.specialRequirements || '暂无特殊要求'}
              </Text>
            </View>
          ) : null}
          {budgetRejectProgress ? (
            <View className="booking-detail-page__budget-actions">
              <Text className="booking-detail-page__budget-actions-copy">
                沟通确认驳回次数：{budgetRejectProgress}
                {detail.budgetConfirmSummary?.status === 'rejected'
                  ? detail.budgetConfirmSummary?.canResubmit
                    ? '，当前仍可重提。'
                    : '，已达到关闭/退款阈值。'
                  : ''}
              </Text>
            </View>
          ) : null}
          {showBudgetConfirmActions ? (
            <View className="booking-detail-page__budget-actions">
              <Text className="booking-detail-page__budget-actions-copy">沟通确认已提交，请确认预算区间、设计方向与空间需求是否一致。</Text>
              <View className="booking-detail-page__budget-actions-row">
                <Button
                  variant="secondary"
                  className="booking-detail-page__budget-actions-button"
                  disabled={budgetSubmitting}
                  onClick={handleRejectBudgetConfirm}
                >
                  驳回
                </Button>
                <Button
                  variant="primary"
                  className="booking-detail-page__budget-actions-button"
                  disabled={budgetSubmitting}
                  loading={budgetSubmitting}
                  onClick={handleAcceptBudgetConfirm}
                >
                  确认沟通确认
                </Button>
              </View>
            </View>
          ) : null}
          <ProgressItem
            title="设计交付确认"
            description={getDesignDeliverableDescription(detail)}
            tagLabel={deliverableStatus.label}
            tagVariant={deliverableStatus.variant}
          />
          {(detail.designDeliverableSummary?.status === 'submitted' || detail.designDeliverableSummary?.status === 'rejected') ? (
            <View className="booking-detail-page__budget-actions">
              <View className="booking-detail-page__budget-actions-row">
                <Button
                  variant="primary"
                  className="booking-detail-page__budget-actions-button"
                  onClick={handleViewDesignDeliverable}
                >
                  查看交付
                </Button>
              </View>
            </View>
          ) : null}
          <ProgressItem
            title="正式方案确认"
            description={getProposalDescription(detail)}
            tagLabel={proposalStatus.label}
            tagVariant={proposalStatus.variant}
          />
          {detail.proposalId && !bridgeStarted ? (
            <View className="booking-detail-page__budget-actions">
              <View className="booking-detail-page__budget-actions-row">
                <Button
                  variant="primary"
                  className="booking-detail-page__budget-actions-button"
                  onClick={handleViewProposal}
                >
                  查看方案
                </Button>
              </View>
            </View>
          ) : null}
          {showBridgeGuide ? (
            <View className="booking-detail-page__budget-actions">
              {detail.bridgeConversionSummary ? (
                <BridgeConversionPanel
                  summary={detail.bridgeConversionSummary}
                  title="施工桥接进展"
                  flowSummary={getBridgeGuide(detail)}
                  stageText={getCurrentStageText(detail)}
                />
              ) : (
                <>
                  <Text className="booking-detail-page__budget-actions-copy">
                    施工桥接顺序：报价基线数据 → 施工主体选择 → 施工报价确认 → 待监理协调开工。
                  </Text>
                  <Text className="booking-detail-page__budget-actions-copy">
                    {getBridgeGuide(detail)}
                  </Text>
                  <Text className="booking-detail-page__budget-actions-copy">
                    {getBridgeBaselineText(detail.baselineStatus)}；施工主体：{getConstructionSubjectText(
                      detail.constructionSubjectType,
                      detail.constructionSubjectDisplayName,
                    )}。
                  </Text>
                </>
              )}
              {!detail.bridgeConversionSummary ? (
                <Text className="booking-detail-page__budget-actions-copy">
                  {detail.plannedStartDate
                    ? `计划进场：${formatServerDateTime(detail.plannedStartDate)}`
                    : '计划进场时间待监理登记'}
                  {detail.supervisorSummary?.latestLogTitle ? `；最近监理同步：${detail.supervisorSummary.latestLogTitle}` : ''}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
};

export default BookingDetailPage;
