import type {
  BookingBudgetConfirmVM,
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
import { getProviderRatingMeta, parseTextArray } from '../utils/provider';
import { detectTerminalType } from '../utils/terminal';
import { requestJson } from './http';
import type { PaymentLaunchPayload } from './payments';

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
  siteSurveySummary?: SiteSurveyDTO | null;
  budgetConfirmSummary?: BudgetConfirmDTO | null;
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
  includes?: Record<string, boolean>;
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

function buildBookingTimeline(
  dto: BookingDTO,
  providerType: ProviderRole,
  proposalId?: number,
  siteSurveyStatus?: string,
  budgetConfirmStatus?: string,
): BookingTimelineItemVM[] {
  const providerTypeText = formatProviderTypeText(providerType);
  const depositPaid = readDepositPaid(dto);
  const bookingStatus = Number(dto.status || 1);
  const isClosed = bookingStatus === 4;
  const hasMerchantConfirmed = bookingStatus >= 2 || Boolean(siteSurveyStatus) || Boolean(budgetConfirmStatus) || Boolean(proposalId);
  const hasSurveyConfirmed = siteSurveyStatus === 'confirmed' || Boolean(budgetConfirmStatus) || Boolean(proposalId);
  const hasBudgetAccepted = budgetConfirmStatus === 'accepted' || Boolean(proposalId);
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
        ? '量房定金已支付，预约正式进入量房与后续沟通阶段。'
        : hasMerchantConfirmed
          ? `${providerTypeText}确认预约后，再由你完成量房定金支付。`
          : `需等待${providerTypeText}确认预约后，才会进入量房定金支付。`,
      state: readTimelineState(hasMerchantConfirmed && !depositPaid, depositPaid),
    },
    {
      title: '量房记录确认',
      description:
        siteSurveyStatus === 'submitted'
          ? `${providerTypeText}已上传量房照片与尺寸，等待你确认。`
          : siteSurveyStatus === 'revision_requested'
            ? `你已要求重新量房，等待${providerTypeText}重新提交现场记录。`
            : hasSurveyConfirmed
              ? '量房记录已确认，接下来进入预算与设计意向确认。'
              : `${providerTypeText}确认预约后，会先安排量房并同步现场记录。`,
      state: readTimelineState(hasMerchantConfirmed && !hasSurveyConfirmed, hasSurveyConfirmed),
    },
    {
      title: '预算与意向确认',
      description:
        budgetConfirmStatus === 'submitted'
          ? `${providerTypeText}已提交预算区间和设计方向，等待你确认。`
          : budgetConfirmStatus === 'rejected'
            ? '当前预算方案未确认，需要重新沟通后才能继续。'
            : hasBudgetAccepted
              ? '预算与设计方向已确认，正在准备正式方案。'
              : `量房确认后，${providerTypeText}会提交预算区间和设计方向。`,
      state: readTimelineState(hasSurveyConfirmed && !hasBudgetAccepted, hasBudgetAccepted),
    },
    {
      title: '查看并确认方案',
      description: proposalId ? `${providerTypeText}已提交方案或报价，可继续查看详情并决定是否确认。` : `${providerTypeText}提交正式方案后，会自动显示在这里。`,
      state: proposalId ? 'active' : 'pending',
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
  const hasMerchantConfirmed = bookingStatus >= 2 || Boolean(siteSurveyStatus) || Boolean(budgetConfirmStatus) || Boolean(response.proposalId);
  const depositPaid = readDepositPaid(response.booking);

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
      helperText: '这一步由业主支付，支付完成后才会进入量房记录与预算确认。',
    };
  }

  if (response.proposalId) {
    return {
      title: '待查看并确认方案',
      description: `${providerTypeText}已经提交方案或报价，当前由你查看细节并决定是否确认。`,
      helperText: '如需调整方向，建议先沟通修改，再决定是否继续。',
    };
  }

  if (budgetConfirmStatus === 'submitted') {
    return {
      title: '待确认预算与设计意向',
      description: `${providerTypeText}已提交预算区间和设计方向，确认后才会继续深化正式方案。`,
      helperText: `预算确认完成后，${providerTypeText}会继续提交正式方案或报价。`,
    };
  }

  if (budgetConfirmStatus === 'accepted') {
    return {
      title: `待${providerTypeText}提交方案`,
      description: `预算范围与设计方向已经确认，${providerTypeText}正在准备下一版正式方案。`,
      helperText: '方案提交后会直接出现在本页，无需额外查找。',
    };
  }

  if (budgetConfirmStatus === 'rejected') {
    return {
      title: '预算未确认',
      description: '你已拒绝当前预算与设计方向，需要重新沟通后才能继续推进。',
      helperText: '如果还想继续合作，请先和服务商重新确认预算范围与设计需求。',
    };
  }

  if (siteSurveyStatus === 'submitted') {
    return {
      title: '待确认量房记录',
      description: `${providerTypeText}已经上传量房照片与尺寸，确认后会进入预算与设计方向确认。`,
      helperText: `如果现场记录不完整，可以要求${providerTypeText}重新量房。`,
    };
  }

  if (siteSurveyStatus === 'revision_requested') {
    return {
      title: '待重新量房',
      description: `你已提出重测要求，${providerTypeText}需要重新提交量房记录后，预约才会继续推进。`,
      helperText: '新的量房记录提交后，本页会自动更新下一步状态。',
    };
  }

  if (siteSurveyStatus === 'confirmed') {
    return {
      title: '待提交预算与设计意向',
      description: `量房记录已经确认，${providerTypeText}下一步会给出预算区间和设计方向。`,
      helperText: '预算与设计意向确认完成后，才会进入正式方案阶段。',
    };
  }

  if (bookingStatus === 2) {
    return {
      title: '待安排量房',
      description: `${providerTypeText}已确认预约，正在安排首次沟通与上门量房时间。`,
      helperText: '量房完成并经你确认后，才会进入预算与设计意向确认。',
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
    providerAvatar: response.provider?.avatar || 'https://placehold.co/120x120/e4e4e7/27272a?text=HZ',
    providerType,
    updatedAt: formatDateTime(response.booking.updatedAt),
    timeline: buildBookingTimeline(
      response.booking,
      providerType,
      response.proposalId,
      response.siteSurveySummary?.status,
      response.budgetConfirmSummary?.status,
    ),
    stageOverview: buildStageOverview(response),
    flowSummary: response.flowSummary || undefined,
    availableActions: response.availableActions || [],
    currentStage: response.currentStage || undefined,
    surveyDepositSource: response.booking.surveyDepositSource || undefined,
    surveyRefundNotice: response.booking.surveyRefundNotice || undefined,
    siteSurveySummary: response.siteSurveySummary ? adaptSiteSurvey(response.siteSurveySummary) : null,
    budgetConfirmSummary: response.budgetConfirmSummary ? adaptBudgetConfirm(response.budgetConfirmSummary) : null,
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
    includes: dto.includes || {},
    submittedAt: formatDateTime(dto.submittedAt),
    acceptedAt: formatDateTime(dto.acceptedAt),
    rejectedAt: formatDateTime(dto.rejectedAt),
    rejectionReason: dto.rejectionReason || undefined,
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

export async function payIntentFee(id: number) {
  return requestJson<PaymentLaunchPayload>(`/bookings/${id}/pay-intent`, {
    method: 'POST',
    body: { terminalType: detectTerminalType() },
  });
}

export async function getBookingSiteSurvey(id: number) {
  const data = await requestJson<{ siteSurvey: SiteSurveyDTO | null }>(`/bookings/${id}/site-survey`);
  return data.siteSurvey ? adaptSiteSurvey(data.siteSurvey) : null;
}

export async function confirmBookingSiteSurvey(id: number) {
  const data = await requestJson<{ siteSurvey: SiteSurveyDTO }>(`/bookings/${id}/site-survey/confirm`, {
    method: 'POST',
  });
  return adaptSiteSurvey(data.siteSurvey);
}

export async function rejectBookingSiteSurvey(id: number, reason: string) {
  const data = await requestJson<{ siteSurvey: SiteSurveyDTO }>(`/bookings/${id}/site-survey/reject`, {
    method: 'POST',
    body: { reason },
  });
  return adaptSiteSurvey(data.siteSurvey);
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

export async function paySurveyDeposit(bookingId: number) {
  return requestJson<PaymentLaunchPayload>(`/bookings/${bookingId}/pay-survey-deposit`, {
    method: 'POST',
    body: { terminalType: detectTerminalType() },
  });
}

export async function refundSurveyDeposit(bookingId: number) {
  return requestJson<{ message?: string }>(`/bookings/${bookingId}/survey-deposit/refund`, {
    method: 'POST',
  });
}

export async function getDesignFeeQuote(bookingId: number) {
  return requestJson<{ quote: DesignFeeQuoteVM | null }>(`/bookings/${bookingId}/design-fee-quote`);
}

export async function confirmDesignFeeQuote(quoteId: number) {
  return requestJson<{ message?: string }>(`/design-quotes/${quoteId}/confirm`, {
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
  return requestJson<{ deliverable: DesignDeliverableVM }>(`/projects/${projectId}/design-deliverable`);
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
