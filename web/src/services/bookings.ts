import type {
  BookingBudgetConfirmVM,
  BookingDetailVM,
  BookingListItemVM,
  BookingSiteSurveyVM,
  BookingTimelineItemVM,
  ProviderRole,
} from '../types/viewModels';
import { BOOKING_STATUS_LABELS } from '../constants/statuses';
import { formatArea, formatCurrency, formatDate, formatDateTime } from '../utils/format';
import { requestJson } from './http';

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
  address?: string;
  area?: number;
  preferredDate?: string;
  renovationType?: string;
  budgetRange?: string;
  notes?: string;
  intentFee?: number;
  intentFeePaid?: boolean;
  surveyDepositSource?: string;
  surveyRefundNotice?: string;
  status?: number;
  providerType?: string;
  updatedAt?: string;
}

interface BookingDetailResponse {
  booking: BookingDTO;
  provider?: {
    name?: string;
    avatar?: string;
    rating?: number;
    completedCnt?: number;
    yearsExperience?: number;
    specialty?: string;
    providerType?: string;
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
    return '工长施工';
  }
  return '设计师';
}

function buildBookingTimeline(dto: BookingDTO, proposalId?: number): BookingTimelineItemVM[] {
  const currentStatus = Number(dto.status || 1);
  const hasIntentFee = Boolean(dto.intentFeePaid);

  return [
    {
      title: '已提交预约',
      description: '平台已记录你的地址、面积、预算和预约时间。',
      state: 'done',
    },
    {
      title: '意向金确认',
      description: hasIntentFee ? '意向金已支付，服务商可继续推进方案。' : '支付意向金后，预约会进入报价推进阶段。',
      state: hasIntentFee ? 'done' : currentStatus === 1 ? 'active' : 'pending',
    },
    {
      title: '服务商沟通',
      description: proposalId ? '服务商已给出可查看的报价方案。' : '等待服务商响应并确认沟通时间。',
      state: proposalId ? 'done' : currentStatus >= 2 ? 'active' : 'pending',
    },
    {
      title: '进入报价确认',
      description: proposalId ? '继续查看报价详情并决定是否确认。' : '报价生成后会自动显示在这里。',
      state: proposalId ? 'active' : 'pending',
    },
  ];
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

function adaptBookingDetail(response: BookingDetailResponse): BookingDetailVM {
  const providerType = readProviderType(response.provider?.providerType || response.booking.providerType);

  return {
    id: response.booking.id,
    statusText: BOOKING_STATUS_LABELS[Number(response.booking.status || 1)] || '处理中',
    address: response.booking.address || '地址待补充',
    areaText: formatArea(response.booking.area),
    preferredDate: formatDate(response.booking.preferredDate),
    renovationType: response.booking.renovationType || '待确认',
    budgetRange: response.booking.budgetRange || '预算待确认',
    notes: response.booking.notes || '无补充说明',
    intentFeeText: formatCurrency(response.booking.intentFee),
    intentFeePaid: Boolean(response.booking.intentFeePaid),
    proposalId: response.proposalId,
    providerName: response.provider?.name || '服务商',
    providerSummary: response.provider?.specialty || `评分 ${(response.provider?.rating || 0).toFixed(1)} · ${response.provider?.completedCnt || 0} 单成交 · ${response.provider?.yearsExperience || 0} 年经验`,
    providerAvatar: response.provider?.avatar || 'https://placehold.co/120x120/e4e4e7/27272a?text=HZ',
    providerType,
    updatedAt: formatDateTime(response.booking.updatedAt),
    timeline: buildBookingTimeline(response.booking, response.proposalId),
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
  await requestJson(`/bookings/${id}/pay-intent`, {
    method: 'POST',
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
  return requestJson<{ message?: string }>(`/bookings/${bookingId}/pay-survey-deposit`, {
    method: 'POST',
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
