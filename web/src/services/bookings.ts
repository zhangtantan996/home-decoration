import type {
  BookingBudgetConfirmVM,
  BookingDesignDeliverableSummaryVM,
  BookingDesignFeeQuoteSummaryVM,
  BookingDetailVM,
  BookingInfoFieldVM,
  BookingListItemVM,
  BookingStageOverviewVM,
  BookingSiteSurveyVM,
  BookingTimelineItemVM,
  ProviderRole,
} from '../types/viewModels';
import {
  BOOKING_STATUS_LABELS,
  BUDGET_CONFIRM_STATUS_LABELS,
  SITE_SURVEY_STATUS_LABELS,
} from '../constants/statuses';
import { formatArea, formatCurrency, formatDate, formatDateTime } from '../utils/format';
import { buildProviderAvatarPlaceholder, getProviderRatingMeta, parseTextArray } from '../utils/provider';
import { detectTerminalType } from '../utils/terminal';
import { adaptBridgeConversionSummary } from './bridgeSummary';
import { requestJson } from './http';
import type { PaymentLaunchPayload, PaymentLaunchRequest } from './payments';

interface CreateBookingPayload {
  providerId: number;
  providerType: ProviderRole;
  address: string;
  area: number;
  renovationType: string;
  budgetRange: string;
  preferredDate: string;
  phone: string;
  notes: string;
}

interface BookingDTO {
  id: number;
  providerId?: number;
  address?: string;
  area?: number;
  preferredDate?: string;
  renovationType?: string;
  budgetRange?: string;
  notes?: string;
  intentFee?: number;
  intentFeePaid?: boolean;
  surveyDeposit?: number;
  surveyDepositPaid?: boolean;
  surveyDepositSource?: string;
  surveyRefundNotice?: string;
  status?: number;
  providerType?: string;
  updatedAt?: string;
}

interface BookingDetailResponse {
  booking: BookingDTO;
  provider?: {
    id?: number;
    name?: string;
    avatar?: string;
    rating?: number;
    reviewCount?: number;
    completedCnt?: number;
    yearsExperience?: number;
    specialty?: string;
    providerType?: string;
    verified?: boolean;
  };
  proposalId?: number;
  flowSummary?: string;
  availableActions?: string[];
  currentStage?: string;
  currentStageText?: string;
  surveyDepositPaymentId?: number;
  siteSurveySummary?: SiteSurveyDTO | null;
  budgetConfirmSummary?: BudgetConfirmDTO | null;
  designFeeQuoteSummary?: {
    id?: number;
    status?: string;
    netAmount?: number;
    expireAt?: string;
    orderId?: number;
    orderStatus?: number;
  } | null;
  designDeliverableSummary?: DesignDeliverableSummaryDTO | null;
  baselineStatus?: string;
  baselineSubmittedAt?: string;
  constructionSubjectType?: string;
  constructionSubjectId?: number;
  constructionSubjectDisplayName?: string;
  kickoffStatus?: string;
  plannedStartDate?: string;
  supervisorSummary?: BridgeSupervisorSummaryDTO | null;
  bridgeConversionSummary?: unknown;
}

interface BridgeSupervisorSummaryDTO {
  plannedStartDate?: string;
  latestLogAt?: string;
  latestLogTitle?: string;
  unhandledRiskCount?: number;
}

interface SiteSurveyDTO {
  id: number;
  status: string;
  notes?: string;
  photos?: string[];
  dimensions?: Record<string, { length?: number; width?: number; height?: number; unit?: string }>;
  submittedAt?: string;
  confirmedAt?: string;
  revisionRequestedAt?: string;
  revisionRequestReason?: string;
}

interface BudgetConfirmDTO {
  id: number;
  status: string;
  budgetMin?: number;
  budgetMax?: number;
  notes?: string;
  designIntent?: string;
  styleDirection?: string;
  spaceRequirements?: string;
  expectedDurationDays?: number;
  specialRequirements?: string;
  includes?: Record<string, boolean>;
  submittedAt?: string;
  acceptedAt?: string;
  rejectedAt?: string;
  lastRejectedAt?: string;
  rejectionReason?: string;
  rejectCount?: number;
  rejectLimit?: number;
  canResubmit?: boolean;
}

interface DesignDeliverableSummaryDTO {
  id?: number;
  status?: string;
  submittedAt?: string;
  acceptedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
}

export interface RefundApplicationItem {
  id: number;
  bookingId: number;
  refundType: 'intent_fee' | 'design_fee' | 'construction_fee' | 'full';
  refundAmount: number;
  reason: string;
  evidence: string[];
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  createdAt?: string;
}

function readProviderType(value?: string): ProviderRole {
  if (value === 'company') {
    return 'company';
  }
  if (value === 'worker' || value === 'foreman') {
    return 'foreman';
  }
  return 'designer';
}

function formatProviderTypeText(type: ProviderRole) {
  if (type === 'company') {
    return '装修公司';
  }
  if (type === 'foreman') {
    return '工长';
  }
  return '设计师';
}

function readTimelineState(active: boolean, done: boolean): BookingTimelineItemVM['state'] {
  if (done) {
    return 'done';
  }
  if (active) {
    return 'active';
  }
  return 'pending';
}

function isConstructionBridgeStage(stage?: string) {
  return [
    'construction_party_pending',
    'construction_quote_pending',
    'ready_to_start',
    'in_construction',
    'node_acceptance_in_progress',
    'completed',
    'archived',
    'disputed',
    'payment_paused',
  ].includes(String(stage || '').trim());
}

function buildBookingTimeline(
  dto: BookingDTO,
  providerType: ProviderRole,
  proposalId?: number,
  siteSurveyStatus?: string,
  budgetConfirmStatus?: string,
  designFeeQuote?: BookingDetailResponse['designFeeQuoteSummary'],
  designDeliverable?: DesignDeliverableSummaryDTO | null,
  currentStage?: string,
  flowSummary?: string,
): BookingTimelineItemVM[] {
  const providerTypeText = formatProviderTypeText(providerType);
  const depositPaid = readDepositPaid(dto);
  const bookingStatus = Number(dto.status || 1);
  const isClosed = bookingStatus === 4;
  const hasMerchantConfirmed = bookingStatus >= 2 || Boolean(siteSurveyStatus) || Boolean(budgetConfirmStatus);
  const hasSurveyCompleted = siteSurveyStatus === 'submitted' || siteSurveyStatus === 'confirmed' || Boolean(budgetConfirmStatus);
  const hasBudgetAccepted = budgetConfirmStatus === 'accepted';
  const designFeeQuoteStatus = String(designFeeQuote?.status || '').trim();
  const designFeeOrderStatus = typeof designFeeQuote?.orderStatus === 'number' ? Number(designFeeQuote.orderStatus) : null;
  const designFeeQuoteReady = ['pending', 'confirmed', 'rejected', 'expired'].includes(designFeeQuoteStatus);
  const designFeePaid = designFeeQuoteStatus === 'confirmed' && designFeeOrderStatus === 1;
  const deliverableStatus = String(designDeliverable?.status || '').trim();
  const deliverableSubmitted = deliverableStatus === 'submitted';
  const deliverableAccepted = deliverableStatus === 'accepted';
  const deliverableRejected = deliverableStatus === 'rejected';
  const bridgeStarted = isConstructionBridgeStage(currentStage);
  const confirmStepState: BookingTimelineItemVM['state'] = isClosed ? 'danger' : readTimelineState(!hasMerchantConfirmed, hasMerchantConfirmed);

  return [
    {
      title: '提交预约需求',
      description: '地址、面积、预算和期望时间已保存，预约单已经创建。',
      state: 'done',
    },
    {
      title: `${providerTypeText}确认预约`,
      description: isClosed
        ? `${providerTypeText}已拒绝本次预约，后续支付、量房与方案流程已终止。`
        : hasMerchantConfirmed
          ? `${providerTypeText}已确认预约，接下来由你支付量房定金。`
          : `${providerTypeText}会先判断档期与需求匹配度，也可以拒绝本次预约。`,
      state: confirmStepState,
    },
    {
      title: '支付量房定金',
      description: depositPaid
        ? '量房定金已支付。'
        : hasMerchantConfirmed
          ? `${providerTypeText}确认预约后，再由你完成量房定金支付。`
          : `需等待${providerTypeText}确认预约后，才会进入量房定金支付。`,
      state: readTimelineState(hasMerchantConfirmed && !depositPaid, depositPaid),
    },
    {
      title: '沟通确认',
      description:
        budgetConfirmStatus === 'submitted'
          ? `${providerTypeText}已提交预算区间和设计方向，等待你确认。`
          : budgetConfirmStatus === 'rejected'
            ? '当前沟通确认已被退回，设计师可在同一条记录上重提。'
            : hasBudgetAccepted
              ? '沟通确认已完成。'
              : depositPaid
                ? `${providerTypeText}正在整理量房结果与设计意向，稍后会提交沟通确认。`
                : `${providerTypeText}确认预约并完成量房后，会提交沟通确认结果。`,
      state: readTimelineState(hasSurveyCompleted && !hasBudgetAccepted, hasBudgetAccepted),
    },
    {
      title: '确认并支付设计费',
      description:
        designFeeQuoteStatus === 'pending'
          ? `${providerTypeText}已发送设计费报价，确认后会直接进入支付。`
          : designFeeQuoteStatus === 'confirmed' && designFeeOrderStatus === 0
            ? '设计费订单已生成，请继续完成支付后进入设计交付阶段。'
            : designFeePaid
              ? '设计费已支付。'
              : hasBudgetAccepted
                ? `${providerTypeText}完成设计费报价后，这里会进入确认并支付阶段。`
                : '沟通确认完成后，才会进入设计费确认与支付。',
      state: readTimelineState(designFeeQuoteReady && !designFeePaid, designFeePaid),
    },
    {
      title: '设计交付确认',
      description:
        deliverableSubmitted
          ? `${providerTypeText}已提交设计交付，等待你确认后再进入正式方案生成。`
          : deliverableRejected
            ? '设计交付已退回，等待设计师重新提交。'
            : deliverableAccepted
              ? '设计交付已确认。'
              : designFeePaid
                ? `${providerTypeText}收到设计费后，会先提交设计交付供你确认。`
                : '设计费支付完成后，才会进入设计交付确认。',
      state: deliverableAccepted ? 'done' : readTimelineState(designFeePaid && (deliverableSubmitted || deliverableRejected || !designDeliverable?.id), false),
    },
    {
      title: '正式方案确认',
      description: proposalId
        ? `${providerTypeText}已提交正式方案，你可以查看细节并决定是否确认。`
        : deliverableAccepted
          ? `${providerTypeText}正在基于已确认交付整理正式方案。`
          : '设计交付确认完成后，正式方案才会进入确认阶段。',
      state: bridgeStarted ? 'done' : proposalId ? 'active' : readTimelineState(deliverableAccepted && !proposalId, false),
    },
    {
      title: '施工桥接 / 待监理协调开工',
      description: currentStage === 'construction_party_pending'
        ? (flowSummary || '报价基线已提交，当前进入施工主体选择与施工桥接。')
        : currentStage === 'construction_quote_pending'
          ? (flowSummary || '施工主体已确认，当前等待施工报价确认。')
          : currentStage === 'ready_to_start'
            ? (flowSummary || '施工报价已确认，项目进入待监理协调开工。')
            : bridgeStarted
              ? (flowSummary || '施工桥接已完成，项目已进入监理协调开工或执行阶段。')
              : '正式方案确认完成后，会依次进入报价基线、施工主体选择、施工报价确认与待监理协调开工。',
      state: bridgeStarted ? 'active' : 'pending',
    },
  ];
}

function buildProviderFacts(
  providerName: string,
  providerType: ProviderRole,
  specialty: string | undefined,
  yearsExperience: number | undefined,
  completedCnt: number | undefined,
  ratingText: string,
): BookingInfoFieldVM[] {
  const specialties = parseTextArray(specialty).slice(0, 3);

  return [
    { label: '姓名', value: providerName },
    { label: '身份', value: formatProviderTypeText(providerType) },
    { label: '擅长风格', value: specialties.length ? specialties.join(' / ') : '待补充' },
    { label: '口碑参考', value: ratingText },
    { label: '从业经验', value: yearsExperience && yearsExperience > 0 ? `${yearsExperience} 年` : '待补充' },
    { label: '完成项目', value: completedCnt && completedCnt > 0 ? `${completedCnt} 单` : '待补充' },
  ];
}

function buildStageOverview(response: BookingDetailResponse): BookingStageOverviewVM {
  const providerType = readProviderType(response.provider?.providerType || response.booking.providerType);
  const providerTypeText = formatProviderTypeText(providerType);
  const bookingStatus = Number(response.booking.status || 1);
  const siteSurveyStatus = response.siteSurveySummary?.status;
  const budgetConfirmStatus = response.budgetConfirmSummary?.status;
  const hasMerchantConfirmed = bookingStatus >= 2 || Boolean(siteSurveyStatus) || Boolean(budgetConfirmStatus);
  const depositPaid = readDepositPaid(response.booking);
  const designFeeQuote = response.designFeeQuoteSummary;
  const designFeeQuoteStatus = String(designFeeQuote?.status || '').trim();
  const designFeeOrderStatus = typeof designFeeQuote?.orderStatus === 'number' ? Number(designFeeQuote.orderStatus) : null;
  const designDeliverableStatus = String(response.designDeliverableSummary?.status || '').trim();
  const bridgeStarted = isConstructionBridgeStage(response.currentStage);

  if (bookingStatus === 4 || response.currentStage === 'cancelled') {
    return {
      title: '预约已关闭',
      description: '该预约已取消或被服务商拒绝，当前不会继续往下推进。',
      helperText: '如仍有需求，可重新发起预约并选择新的服务商或沟通时间。',
    };
  }

  if (!hasMerchantConfirmed) {
    return {
      title: `待${providerTypeText}确认预约`,
      description: `${providerTypeText}正在确认是否接单和档期安排，确认前无需支付量房定金。`,
      helperText: `${providerTypeText}确认预约后，你再支付量房定金并进入量房安排。`,
    };
  }

  if (!depositPaid) {
    return {
      title: '待支付量房定金',
      description: `${providerTypeText}已确认预约，完成支付后才会正式安排量房与后续沟通。`,
      helperText: '这一步由业主支付，支付完成后才会进入沟通确认与后续报价。',
    };
  }

  if (bridgeStarted) {
    if (response.currentStage === 'construction_party_pending') {
      const baselineStatus = String(response.baselineStatus || '').trim();
      return {
        title: '施工桥接中',
        description: response.flowSummary
          || (baselineStatus === 'submitted' || baselineStatus === 'ready_for_selection'
            ? '报价基线已提交，当前进入施工主体选择与桥接准备。'
            : '正式方案已确认，当前待提交报价基线并进入施工桥接。'),
        helperText: '下一步会对比装修公司主体或独立工长，并继续推进施工报价。',
      };
    }
    if (response.currentStage === 'construction_quote_pending') {
      const subjectText = response.constructionSubjectType === 'company'
        ? `装修公司主体${response.constructionSubjectDisplayName ? `（${response.constructionSubjectDisplayName}）` : ''}`
        : response.constructionSubjectType === 'foreman'
          ? `独立工长主体${response.constructionSubjectDisplayName ? `（${response.constructionSubjectDisplayName}）` : ''}`
          : '施工主体';
      return {
        title: '待确认施工报价',
        description: response.flowSummary || `${subjectText}已确认，当前等待施工报价提交与确认。`,
        helperText: '施工报价确认后，项目会直接进入待监理协调开工。',
      };
    }
    if (response.currentStage === 'ready_to_start') {
      return {
        title: '待监理协调开工',
        description: response.flowSummary || '施工报价已确认，监理正在协同计划进场时间。',
        helperText: response.plannedStartDate
          ? `计划进场时间已登记：${formatDateTime(response.plannedStartDate)}。`
          : '待监理同步进场安排后，项目再进入正式开工。',
      };
    }
    return {
      title: '施工报价推进中',
      description: response.flowSummary || '设计阶段已结束，当前进入施工桥接与履约推进。',
      helperText: '监理会持续同步待开工协同、施工执行与节点进展。',
    };
  }

  if (designFeeQuoteStatus === 'pending') {
    return {
      title: '待确认并支付设计费',
      description: `${providerTypeText}已发送设计费报价，确认后会直接进入支付。`,
      helperText: '先查看报价明细与抵扣说明，确认后直接完成本次设计费支付。',
    };
  }

  if (designFeeQuoteStatus === 'confirmed' && designFeeOrderStatus === 0) {
    return {
      title: '待继续支付设计费',
      description: '设计费订单已生成，请继续完成支付后再进入设计交付阶段。',
      helperText: '支付完成后，设计师才能继续提交正式方案。',
    };
  }

  if (designFeeQuoteStatus === 'confirmed' && designFeeOrderStatus === 1 && !response.proposalId) {
    if (designDeliverableStatus === 'submitted') {
      return {
        title: '待确认设计交付',
        description: `${providerTypeText}已提交设计交付，确认通过后才会继续生成正式方案。`,
        helperText: '先确认设计交付，再进入正式方案确认。',
      };
    }
    if (designDeliverableStatus === 'accepted') {
      return {
        title: `待${providerTypeText}生成正式方案`,
        description: '设计交付已确认，当前由设计师继续整理正式方案。',
        helperText: '正式方案提交后，你会在这里继续确认方案。',
      };
    }
    if (designDeliverableStatus === 'rejected') {
      return {
        title: `待${providerTypeText}重新提交设计交付`,
        description: '你已退回设计交付，当前等待设计师重新提交。',
        helperText: '设计交付重新提交后，这里会再次出现查看交付入口。',
      };
    }
    return {
      title: `待${providerTypeText}提交设计交付`,
      description: '设计费已支付，当前由设计师先提交设计交付供你确认。',
      helperText: '设计交付确认通过后，才会继续生成正式方案。',
    };
  }

  if (response.proposalId) {
    return {
      title: '待确认正式方案',
      description: `${providerTypeText}已提交正式方案，当前由你查看细节并决定是否确认。`,
      helperText: '确认正式方案后，才会进入施工桥接。',
    };
  }

  if (budgetConfirmStatus === 'submitted') {
    return {
      title: '待确认沟通结果',
      description: `${providerTypeText}已提交预算区间和设计方向，确认后才会进入设计费报价。`,
      helperText: `沟通确认完成后，${providerTypeText}会继续发起设计费报价。`,
    };
  }

  if (budgetConfirmStatus === 'accepted') {
    return {
      title: `待${providerTypeText}发起报价`,
      description: `沟通确认已经完成，${providerTypeText}下一步会发起设计费报价。`,
      helperText: '设计费确认并支付完成后，才会进入设计交付。',
    };
  }

  if (budgetConfirmStatus === 'rejected') {
    const rejectCount = Number(response.budgetConfirmSummary?.rejectCount || 0);
    const rejectLimit = Number(response.budgetConfirmSummary?.rejectLimit || 0);
    const rejectProgress = rejectLimit > 0 ? `${rejectCount}/${rejectLimit}` : `${rejectCount}`;
    return {
      title: '沟通确认未通过',
      description: response.budgetConfirmSummary?.canResubmit
        ? `你已退回当前沟通结果，设计师可在同一条记录上继续重提（${rejectProgress}）。`
        : `沟通确认已达到驳回上限（${rejectProgress}），预约将进入关闭/退款链。`,
      helperText: response.budgetConfirmSummary?.canResubmit
        ? '如果还想继续合作，请围绕预算范围、风格方向和空间诉求继续沟通。'
        : '如需继续合作，请重新发起预约。',
    };
  }

  if (siteSurveyStatus === 'submitted') {
    return {
      title: '待提交沟通确认',
      description: `${providerTypeText}已经上传量房资料，正在整理预算区间和设计意向。`,
      helperText: '量房资料只读查看，正式确认从沟通确认开始。',
    };
  }

  if (siteSurveyStatus === 'revision_requested') {
    return {
      title: '待重新整理沟通结果',
      description: `${providerTypeText}需要重新整理量房与沟通结果后，预约才会继续推进。`,
      helperText: '新的沟通结果提交后，本页会自动更新下一步状态。',
    };
  }

  if (siteSurveyStatus === 'confirmed') {
    return {
      title: '待提交沟通确认',
      description: `量房已经完成，${providerTypeText}下一步会给出预算区间和设计方向。`,
      helperText: '沟通确认完成后，才会进入设计费报价阶段。',
    };
  }

  if (bookingStatus === 2) {
    return {
      title: '待安排量房',
      description: `${providerTypeText}已确认预约，正在安排首次沟通与上门量房时间。`,
      helperText: '量房完成后，会直接进入沟通确认阶段。',
    };
  }

  return {
    title: `待${providerTypeText}确认预约`,
    description: `${providerTypeText}正在确认是否接单和档期安排，确认前无需支付量房定金。`,
    helperText: `${providerTypeText}确认预约后，你再支付量房定金并进入量房安排。`,
  };
}

function toBookingListItem(dto: BookingDTO): BookingListItemVM {
  const providerType = readProviderType(dto.providerType);

  return {
    id: dto.id,
    title: dto.address || `预约 #${dto.id}`,
    statusText: BOOKING_STATUS_LABELS[Number(dto.status || 1)] || '处理中',
    preferredDate: formatDate(dto.preferredDate),
    budgetRange: dto.budgetRange || '预算待确认',
    address: dto.address || '地址待补充',
    href: `/bookings/${dto.id}`,
    providerType,
    providerTypeText: formatProviderTypeText(providerType),
    updatedAt: formatDateTime(dto.updatedAt),
  };
}

function readDepositPaid(dto: BookingDTO) {
  return Boolean(dto.surveyDepositPaid || dto.intentFeePaid);
}

function readDepositAmount(dto: BookingDTO) {
  if (typeof dto.surveyDeposit === 'number' && dto.surveyDeposit > 0) {
    return dto.surveyDeposit;
  }
  return dto.intentFee;
}

function adaptBookingDetail(response: BookingDetailResponse): BookingDetailVM {
  const providerType = readProviderType(response.provider?.providerType || response.booking.providerType);
  const ratingMeta = getProviderRatingMeta(response.provider?.rating || 0, response.provider?.reviewCount || 0);
  const providerName = response.provider?.name || '服务商';
  const providerTags = parseTextArray(response.provider?.specialty).slice(0, 3);
  const depositPaid = readDepositPaid(response.booking);

  return {
    id: response.booking.id,
    statusCode: Number(response.booking.status || 1),
    statusText: BOOKING_STATUS_LABELS[Number(response.booking.status || 1)] || '处理中',
    providerId: Number(response.provider?.id || response.booking.providerId || 0),
    address: response.booking.address || '地址待补充',
    areaText: formatArea(response.booking.area),
    preferredDate: formatDate(response.booking.preferredDate),
    renovationType: response.booking.renovationType || '待确认',
    budgetRange: response.booking.budgetRange || '预算待确认',
    notes: response.booking.notes || '无补充说明',
    depositAmountText: formatCurrency(readDepositAmount(response.booking)),
    depositPaid,
    proposalId: response.proposalId,
    providerName,
    providerSummary: providerTags.length ? `擅长 ${providerTags.join('、')}` : '可根据你的户型、预算与时间安排继续沟通方案方向。',
    providerTags,
    providerFacts: buildProviderFacts(
      providerName,
      providerType,
      response.provider?.specialty,
      response.provider?.yearsExperience,
      response.provider?.completedCnt,
      ratingMeta.inlineText,
    ),
    providerAvatar: response.provider?.avatar || buildProviderAvatarPlaceholder(providerName),
    providerType,
    updatedAt: formatDateTime(response.booking.updatedAt),
    timeline: buildBookingTimeline(
      response.booking,
      providerType,
      response.proposalId,
      response.siteSurveySummary?.status,
      response.budgetConfirmSummary?.status,
      response.designFeeQuoteSummary,
      response.designDeliverableSummary,
      response.currentStage,
      response.flowSummary,
    ),
    stageOverview: buildStageOverview(response),
    flowSummary: response.flowSummary || undefined,
    availableActions: response.availableActions || [],
    currentStage: response.currentStage || undefined,
    baselineStatus: response.baselineStatus || undefined,
    baselineSubmittedAt: formatDateTime(response.baselineSubmittedAt),
    constructionSubjectType: response.constructionSubjectType || undefined,
    constructionSubjectId: response.constructionSubjectId ? Number(response.constructionSubjectId) : undefined,
    constructionSubjectDisplayName: response.constructionSubjectDisplayName || undefined,
    kickoffStatus: response.kickoffStatus || undefined,
    plannedStartDate: formatDateTime(response.plannedStartDate),
    supervisorSummary: response.supervisorSummary
      ? {
          plannedStartDate: formatDateTime(response.supervisorSummary.plannedStartDate),
          latestLogAt: formatDateTime(response.supervisorSummary.latestLogAt),
          latestLogTitle: response.supervisorSummary.latestLogTitle || undefined,
          unhandledRiskCount: Number(response.supervisorSummary.unhandledRiskCount || 0),
        }
      : undefined,
    bridgeConversionSummary: adaptBridgeConversionSummary(response.bridgeConversionSummary),
    surveyDepositSource: response.booking.surveyDepositSource || undefined,
    surveyRefundNotice: response.booking.surveyRefundNotice || undefined,
    surveyDepositPaymentId: response.surveyDepositPaymentId ? Number(response.surveyDepositPaymentId) : undefined,
    siteSurveySummary: response.siteSurveySummary ? adaptSiteSurvey(response.siteSurveySummary) : null,
    budgetConfirmSummary: response.budgetConfirmSummary ? adaptBudgetConfirm(response.budgetConfirmSummary) : null,
    designFeeQuoteSummary: adaptDesignFeeQuoteSummary(response.designFeeQuoteSummary),
    designDeliverableSummary: adaptDesignDeliverableSummary(response.designDeliverableSummary),
  };
}

function adaptDesignFeeQuoteSummary(
  dto?: BookingDetailResponse['designFeeQuoteSummary'],
): BookingDesignFeeQuoteSummaryVM | null {
  if (!dto?.id) {
    return null;
  }
  return {
    id: Number(dto.id),
    status: String(dto.status || ''),
    netAmount: Number(dto.netAmount || 0),
    expireAt: dto.expireAt || undefined,
    orderId: dto.orderId ? Number(dto.orderId) : undefined,
    orderStatus: typeof dto.orderStatus === 'number' ? Number(dto.orderStatus) : undefined,
  };
}

function adaptSiteSurvey(dto: SiteSurveyDTO): BookingSiteSurveyVM {
  return {
    id: dto.id,
    status: dto.status,
    statusText: SITE_SURVEY_STATUS_LABELS[dto.status] || dto.status || '待更新',
    notes: dto.notes || '',
    photos: dto.photos || [],
    dimensions: dto.dimensions || {},
    submittedAt: formatDateTime(dto.submittedAt),
    confirmedAt: formatDateTime(dto.confirmedAt),
    revisionRequestedAt: formatDateTime(dto.revisionRequestedAt),
    revisionRequestReason: dto.revisionRequestReason || undefined,
  };
}

function adaptBudgetConfirm(dto: BudgetConfirmDTO): BookingBudgetConfirmVM {
  return {
    id: dto.id,
    status: dto.status,
    statusText: BUDGET_CONFIRM_STATUS_LABELS[dto.status] || dto.status || '待更新',
    budgetMin: Number(dto.budgetMin || 0),
    budgetMax: Number(dto.budgetMax || 0),
    notes: dto.notes || '',
    designIntent: dto.designIntent || '',
    styleDirection: dto.styleDirection || '',
    spaceRequirements: dto.spaceRequirements || '',
    expectedDurationDays: Number(dto.expectedDurationDays || 0),
    specialRequirements: dto.specialRequirements || '',
    includes: dto.includes || {},
    submittedAt: formatDateTime(dto.submittedAt),
    acceptedAt: formatDateTime(dto.acceptedAt),
    rejectedAt: formatDateTime(dto.rejectedAt),
    lastRejectedAt: formatDateTime(dto.lastRejectedAt),
    rejectionReason: dto.rejectionReason || undefined,
    rejectCount: Number(dto.rejectCount || 0),
    rejectLimit: Number(dto.rejectLimit || 0),
    canResubmit: Boolean(dto.canResubmit),
  };
}

export async function listBookings() {
  const data = await requestJson<BookingDTO[]>('/bookings');
  return data.map(toBookingListItem);
}

export async function createBooking(payload: CreateBookingPayload) {
  const data = await requestJson<{ id: number }>('/bookings', {
    method: 'POST',
    body: payload,
  });
  return data.id;
}

export async function getBookingDetail(id: number) {
  const data = await requestJson<BookingDetailResponse>(`/bookings/${id}`);
  return adaptBookingDetail(data);
}

export async function payIntentFee(id: number, request?: PaymentLaunchRequest) {
  return requestJson<PaymentLaunchPayload>(`/bookings/${id}/pay-intent`, {
    method: 'POST',
    body: buildAlipayPaymentBody(request),
  });
}

export async function getBookingSiteSurvey(id: number) {
  const data = await requestJson<{ siteSurvey: SiteSurveyDTO | null }>(`/bookings/${id}/site-survey`);
  return data.siteSurvey ? adaptSiteSurvey(data.siteSurvey) : null;
}

export async function getBookingBudgetConfirm(id: number) {
  const data = await requestJson<{ budgetConfirmation: BudgetConfirmDTO | null }>(`/bookings/${id}/budget-confirm`);
  return data.budgetConfirmation ? adaptBudgetConfirm(data.budgetConfirmation) : null;
}

export async function acceptBookingBudgetConfirm(id: number) {
  const data = await requestJson<{ budgetConfirmation: BudgetConfirmDTO }>(`/bookings/${id}/budget-confirm/accept`, {
    method: 'POST',
  });
  return adaptBudgetConfirm(data.budgetConfirmation);
}

export async function rejectBookingBudgetConfirm(id: number, reason: string) {
  const data = await requestJson<{ budgetConfirmation: BudgetConfirmDTO }>(`/bookings/${id}/budget-confirm/reject`, {
    method: 'POST',
    body: { reason },
  });
  return adaptBudgetConfirm(data.budgetConfirmation);
}

export async function submitBookingRefund(
  bookingId: number,
  payload: { refundType: RefundApplicationItem['refundType']; reason: string; evidence: string[] },
) {
  return requestJson<{ refundApplication?: RefundApplicationItem; id?: number }>(`/bookings/${bookingId}/refund`, {
    method: 'POST',
    body: payload,
  });
}

export async function listMyRefundApplications() {
  const data = await requestJson<{ list?: RefundApplicationItem[] } | RefundApplicationItem[]>('/refunds/my');
  if (Array.isArray(data)) {
    return data;
  }
  return data.list || [];
}

// ========== 设计阶段用户侧 API ==========

export interface DesignFeeQuoteVM {
  id: number;
  bookingId: number;
  totalFee: number;
  depositDeduction: number;
  netAmount: number;
  paymentMode: string;
  stagesJson: string;
  description: string;
  status: string;
  expireAt?: string;
  confirmedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  orderId?: number;
  orderStatus?: number;
}

export interface DesignDeliverableVM {
  id: number;
  bookingId: number;
  projectId: number;
  orderId: number;
  colorFloorPlan: string;
  renderings: string;
  renderingLink: string;
  textDescription: string;
  cadDrawings: string;
  attachments: string;
  status: string;
  submittedAt?: string;
  acceptedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
}

function adaptDesignDeliverableSummary(
  dto?: DesignDeliverableSummaryDTO | null,
): BookingDesignDeliverableSummaryVM | null {
  if (!dto?.id) {
    return null;
  }
  return {
    id: Number(dto.id),
    status: String(dto.status || ''),
    submittedAt: formatDateTime(dto.submittedAt),
    acceptedAt: formatDateTime(dto.acceptedAt),
    rejectedAt: formatDateTime(dto.rejectedAt),
    rejectionReason: dto.rejectionReason || undefined,
  };
}

export async function paySurveyDeposit(bookingId: number, request?: PaymentLaunchRequest) {
  return requestJson<PaymentLaunchPayload>(`/bookings/${bookingId}/pay-survey-deposit`, {
    method: 'POST',
    body: buildAlipayPaymentBody(request),
  });
}

function buildAlipayPaymentBody(request?: PaymentLaunchRequest): PaymentLaunchRequest {
  return request || {
    channel: 'alipay',
    terminalType: detectTerminalType() === 'mobile_h5' ? 'mobile_h5' : 'mini_qr',
  };
}

export async function refundSurveyDeposit(bookingId: number) {
  return requestJson<{ message?: string }>(`/bookings/${bookingId}/survey-deposit/refund`, {
    method: 'POST',
  });
}

export async function getDesignFeeQuote(bookingId: number) {
  return requestJson<{ quote: DesignFeeQuoteVM | null; order?: { id?: number; status?: number } | null }>(`/bookings/${bookingId}/design-fee-quote`);
}

export async function confirmDesignFeeQuote(quoteId: number) {
  return requestJson<{ id: number; bookingId?: number; status?: number }>(`/design-quotes/${quoteId}/confirm`, {
    method: 'POST',
  });
}

export async function rejectDesignFeeQuote(quoteId: number, reason: string) {
  return requestJson<{ message?: string }>(`/design-quotes/${quoteId}/reject`, {
    method: 'POST',
    body: { reason },
  });
}

export async function getDesignDeliverable(projectId: number) {
  return requestJson<DesignDeliverableVM>(`/projects/${projectId}/design-deliverable`);
}

export async function getBookingDesignDeliverable(bookingId: number) {
  return requestJson<DesignDeliverableVM>(`/bookings/${bookingId}/design-deliverable`);
}

export async function acceptDesignDeliverable(deliverableId: number) {
  return requestJson<{ message?: string }>(`/design-deliverables/${deliverableId}/accept`, {
    method: 'POST',
  });
}

export async function rejectDesignDeliverable(deliverableId: number, reason: string) {
  return requestJson<{ message?: string }>(`/design-deliverables/${deliverableId}/reject`, {
    method: 'POST',
    body: { reason },
  });
}
