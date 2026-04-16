import { request } from '@/utils/request';
import type { MiniPaymentLaunchResponse, PaymentChannel, PaymentLaunchMode } from './payments';
import type { RefundSummaryDTO } from './dto';

export type ProviderType = 'designer' | 'company' | 'foreman';

export interface CreateBookingPayload {
  providerId: number;
  providerType: ProviderType;
  address: string;
  area: number;
  renovationType?: string;
  budgetRange?: string;
  preferredDate: string;
  phone: string;
  notes?: string;
  houseLayout?: string;
}

export interface BookingItem {
  id: number;
  providerId: number;
  providerType: string | number;
  address: string;
  area: number;
  houseLayout?: string;
  renovationType?: string;
  budgetRange?: string;
  preferredDate: string;
  phone: string;
  notes?: string;
  status: number;
  intentFee: number;
  intentFeePaid: boolean;
  statusGroup?: 'pending_confirmation' | 'pending_payment' | 'in_service' | 'completed' | 'cancelled';
  statusText?: string;
  currentStage?: string;
  currentStageText?: string;
  flowSummary?: string;
  availableActions?: string[];
  surveyDepositAmount?: number;
  surveyDeposit?: number;
  surveyDepositPaid?: boolean;
  surveyDepositPaidAt?: string;
  surveyRefundNotice?: string;
  surveyDepositRefunded?: boolean;
  surveyDepositRefundAt?: string;
  proposalId?: number;
  createdAt?: string;
}

export interface SurveyDepositPaymentOption {
  channel: PaymentChannel;
  label: string;
  launchMode: PaymentLaunchMode;
}

export interface BookingSiteSurveySummary {
  id?: number;
  status?: string;
  photos?: string[];
  dimensions?: Record<string, {
    length?: number;
    width?: number;
    height?: number;
    unit?: string;
  }>;
  submittedAt?: string;
  confirmedAt?: string;
  revisionRequestedAt?: string;
  notes?: string;
  revisionRequestReason?: string;
}

export interface BookingBudgetConfirmSummary {
  id?: number;
  status?: string;
  budgetMin?: number;
  budgetMax?: number;
  designIntent?: string;
  styleDirection?: string;
  spaceRequirements?: string;
  expectedDurationDays?: number;
  specialRequirements?: string;
  notes?: string;
  rejectionReason?: string;
  submittedAt?: string;
  acceptedAt?: string;
  rejectedAt?: string;
  lastRejectedAt?: string;
  rejectCount?: number;
  rejectLimit?: number;
  canResubmit?: boolean;
}

export interface BookingDesignFeeQuoteSummary {
  id?: number;
  status?: string;
  netAmount?: number;
  expireAt?: string;
  orderId?: number;
  orderStatus?: number;
}

export interface BookingDesignDeliverableSummary {
  id?: number;
  status?: string;
  submittedAt?: string;
  acceptedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
}

export interface BookingDesignDeliverableDetail {
  id: number;
  bookingId: number;
  projectId?: number;
  orderId?: number;
  colorFloorPlan?: string | string[];
  renderings?: string | string[];
  renderingLink?: string;
  textDescription?: string;
  cadDrawings?: string | string[];
  attachments?: string | string[];
  status?: string;
  submittedAt?: string;
  acceptedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
}

export interface BookingProviderSummary {
  id: number;
  name?: string;
  avatar?: string;
  rating?: number;
  completedCnt?: number;
  yearsExperience?: number;
  specialty?: string;
  verified?: boolean;
  providerType?: string | number;
}

export interface BookingDetailResponse {
  booking: BookingItem;
  provider?: BookingProviderSummary;
  proposalId?: number;
  statusGroup?: BookingItem['statusGroup'];
  statusText?: string;
  businessStage?: string;
  flowSummary?: string;
  availableActions?: string[];
  currentStage?: string;
  currentStageText?: string;
  surveyDepositAmount?: number;
  surveyDepositPaid?: boolean;
  surveyDepositPaidAt?: string;
  siteSurveySummary?: BookingSiteSurveySummary;
  budgetConfirmSummary?: BookingBudgetConfirmSummary;
  designFeeQuoteSummary?: BookingDesignFeeQuoteSummary;
  designDeliverableSummary?: BookingDesignDeliverableSummary;
  refundSummary?: RefundSummaryDTO;
  surveyDepositPaymentOptions?: SurveyDepositPaymentOption[];
  baselineStatus?: string;
  baselineSubmittedAt?: string;
  constructionSubjectType?: string;
  constructionSubjectId?: number;
  constructionSubjectDisplayName?: string;
  kickoffStatus?: string;
  plannedStartDate?: string;
  supervisorSummary?: {
    plannedStartDate?: string;
    latestLogAt?: string;
    latestLogTitle?: string;
    unhandledRiskCount?: number;
  };
}

export async function createBooking(payload: CreateBookingPayload) {
  return request<BookingItem>({
    url: '/bookings',
    method: 'POST',
    data: payload,
    showLoading: true
  });
}

export async function listBookings(statusGroup?: BookingItem['statusGroup']) {
  return request<BookingItem[]>({
    url: '/bookings',
    data: statusGroup ? { statusGroup } : undefined
  });
}

export async function getBookingDetail(id: number) {
  return request<BookingDetailResponse>({
    url: `/bookings/${id}`
  });
}

export async function getBookingSiteSurvey(id: number) {
  return request<{ siteSurvey: BookingSiteSurveySummary | null }>({
    url: `/bookings/${id}/site-survey`,
  });
}

export async function getBookingBudgetConfirm(id: number) {
  return request<{ budgetConfirmation: BookingBudgetConfirmSummary | null }>({
    url: `/bookings/${id}/budget-confirm`,
  });
}

export async function acceptBookingBudgetConfirm(id: number) {
  return request<{ budgetConfirmation: BookingBudgetConfirmSummary }>({
    url: `/bookings/${id}/budget-confirm/accept`,
    method: 'POST',
    showLoading: true,
  });
}

export async function rejectBookingBudgetConfirm(id: number, reason: string) {
  return request<{ budgetConfirmation: BookingBudgetConfirmSummary }>({
    url: `/bookings/${id}/budget-confirm/reject`,
    method: 'POST',
    data: { reason },
    showLoading: true,
  });
}

export async function getBookingDesignDeliverable(id: number) {
  return request<BookingDesignDeliverableDetail>({
    url: `/bookings/${id}/design-deliverable`,
  });
}

export interface BookingDesignFeeQuoteDetail {
  id: number;
  bookingId: number;
  totalFee: number;
  depositDeduction: number;
  netAmount: number;
  paymentMode: string;
  stagesJson?: string;
  description?: string;
  status: string;
  expireAt?: string;
  confirmedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  orderId?: number;
  orderStatus?: number;
}

export async function getBookingDesignFeeQuote(id: number) {
  return request<{ quote: BookingDesignFeeQuoteDetail | null; order?: { id?: number; status?: number } | null }>({
    url: `/bookings/${id}/design-fee-quote`,
  });
}

export async function confirmBookingDesignFeeQuote(quoteId: number) {
  return request<{ id: number; bookingId?: number; status?: number }>({
    url: `/design-quotes/${quoteId}/confirm`,
    method: 'POST',
    showLoading: true,
  });
}

export async function rejectBookingDesignFeeQuote(quoteId: number, reason: string) {
  return request<{ message?: string }>({
    url: `/design-quotes/${quoteId}/reject`,
    method: 'POST',
    data: { reason },
    showLoading: true,
  });
}

export async function acceptBookingDesignDeliverable(deliverableId: number) {
  return request<BookingDesignDeliverableDetail>({
    url: `/design-deliverables/${deliverableId}/accept`,
    method: 'POST',
    showLoading: true,
  });
}

export async function rejectBookingDesignDeliverable(deliverableId: number, reason: string) {
  return request<BookingDesignDeliverableDetail>({
    url: `/design-deliverables/${deliverableId}/reject`,
    method: 'POST',
    data: { reason },
    showLoading: true,
  });
}

export async function startSurveyDepositPayment(
  id: number,
  channel: PaymentChannel,
  terminalType: string,
) {
  return request<MiniPaymentLaunchResponse>({
    url: `/bookings/${id}/pay-survey-deposit`,
    method: 'POST',
    data: { channel, terminalType },
    showLoading: true,
  });
}

export const paySurveyDeposit = startSurveyDepositPayment;

export async function cancelBooking(id: number) {
  return request<{ message: string }>({
    url: `/bookings/${id}/cancel`,
    method: 'DELETE',
    showLoading: true
  });
}

export async function deleteBooking(id: number) {
  return request<{ message: string }>({
    url: `/bookings/${id}`,
    method: 'DELETE',
    showLoading: true
  });
}
