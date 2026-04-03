import { request } from '@/utils/request';
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
  surveyDeposit?: number;
  surveyDepositPaid?: boolean;
  surveyDepositPaidAt?: string;
  surveyDepositRefunded?: boolean;
  surveyDepositRefundAt?: string;
  proposalId?: number;
  createdAt?: string;
}

export type PaymentChannel = 'alipay' | 'wechat';
export type PaymentLaunchMode = 'redirect' | 'qr_code' | 'wechat_jsapi';

export interface SurveyDepositPaymentOption {
  channel: PaymentChannel;
  label: string;
  launchMode: PaymentLaunchMode;
}

export interface BookingSiteSurveySummary {
  status?: string;
  submittedAt?: string;
  confirmedAt?: string;
  revisionRequestedAt?: string;
  notes?: string;
  revisionRequestReason?: string;
}

export interface BookingBudgetConfirmSummary {
  status?: string;
  budgetMin?: number;
  budgetMax?: number;
  designIntent?: string;
  notes?: string;
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
  businessStage?: string;
  flowSummary?: string;
  availableActions?: string[];
  currentStage?: string;
  siteSurveySummary?: BookingSiteSurveySummary;
  budgetConfirmSummary?: BookingBudgetConfirmSummary;
  refundSummary?: RefundSummaryDTO;
  surveyDepositPaymentOptions?: SurveyDepositPaymentOption[];
}

export async function createBooking(payload: CreateBookingPayload) {
  return request<BookingItem>({
    url: '/bookings',
    method: 'POST',
    data: payload,
    showLoading: true
  });
}

export async function listBookings(paid?: boolean) {
  return request<BookingItem[]>({
    url: '/bookings',
    data: typeof paid === 'boolean' ? { paid } : undefined
  });
}

export async function getBookingDetail(id: number) {
  return request<BookingDetailResponse>({
    url: `/bookings/${id}`
  });
}

export async function payIntentFee(id: number) {
  return request<{ message: string }>({
    url: `/bookings/${id}/pay-intent`,
    method: 'POST',
    showLoading: true
  });
}

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
