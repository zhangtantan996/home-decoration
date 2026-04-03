import { request } from '@/utils/request';

import type { PageData } from './types';

export type PaymentChannel = 'alipay' | 'wechat';
export type PaymentLaunchMode = 'redirect' | 'qr_code' | 'wechat_jsapi';
export type OrderCenterEntryKind = 'payable' | 'refund';
export type OrderCenterSourceKind =
  | 'survey_deposit'
  | 'design_order'
  | 'construction_order'
  | 'material_order'
  | 'refund_record'
  | 'merchant_bond';
export type OrderCenterStatusGroup = 'pending_payment' | 'paid' | 'refund' | 'cancelled';

export interface SurveyDepositPaymentOption {
  channel: PaymentChannel;
  label: string;
  launchMode: PaymentLaunchMode;
}

export interface OrderCenterProviderSummary {
  id: number;
  name: string;
  providerType?: string;
  avatar?: string;
  verified?: boolean;
}

export interface OrderCenterProjectRiskSummary {
  pausedAt?: string;
  resumedAt?: string;
  pauseReason?: string;
  pauseInitiator?: string;
  disputedAt?: string;
  disputeReason?: string;
  disputeEvidence?: string[];
  auditId?: number;
  auditStatus?: string;
  escrowFrozen?: boolean;
  escrowStatus?: number;
  frozenAmount?: number;
}

export interface OrderCenterProjectSummary {
  id: number;
  name: string;
  address?: string;
  businessStage?: string;
  flowSummary?: string;
  riskSummary?: OrderCenterProjectRiskSummary;
}

export interface OrderCenterBookingSummary {
  id: number;
  providerId?: number;
  address?: string;
  preferredDate?: string;
  status?: number;
  intentFee?: number;
  surveyDeposit?: number;
  surveyDepositPaid?: boolean;
  surveyDepositPaidAt?: string;
  surveyDepositRefunded?: boolean;
  surveyRefundNotice?: string;
  proposalId?: number;
  createdAt?: string;
}

export interface OrderCenterPaymentPlanItem {
  id: number;
  orderId: number;
  seq: number;
  name: string;
  amount: number;
  dueAt?: string;
  status: string;
  paidAt?: string;
}

export interface OrderCenterTimelineItem {
  title: string;
  description?: string;
  status?: string;
  at?: string;
}

export interface OrderCenterDescriptionSectionItem {
  label: string;
  value: string;
}

export interface OrderCenterDescriptionSection {
  key: string;
  title: string;
  items: OrderCenterDescriptionSectionItem[];
}

export interface OrderCenterOrderRecord {
  id: number;
  orderNo: string;
  orderType: string;
  status: number;
  totalAmount: number;
  paidAmount: number;
  discount: number;
  expireAt?: string;
  paidAt?: string;
  createdAt: string;
  bookingId?: number;
  proposalId?: number;
  projectId?: number;
}

export interface OrderCenterRefundSummary {
  canApplyRefund: boolean;
  latestRefundId?: number;
  latestRefundStatus?: string;
  refundableAmount: number;
}

export interface OrderCenterEntrySummary {
  entryKey: string;
  entryKind: OrderCenterEntryKind;
  sourceKind: OrderCenterSourceKind;
  statusGroup: OrderCenterStatusGroup;
  statusText: string;
  title: string;
  subtitle?: string;
  referenceNo?: string;
  amount: number;
  payableAmount: number;
  createdAt?: string;
  expireAt?: string;
  provider?: OrderCenterProviderSummary;
  project?: OrderCenterProjectSummary;
  booking?: OrderCenterBookingSummary;
  availablePaymentOptions?: SurveyDepositPaymentOption[];
}

export interface OrderCenterEntryDetail extends OrderCenterEntrySummary {
  businessStage?: string;
  flowSummary?: string;
  descriptionSections?: OrderCenterDescriptionSection[];
  paymentPlans?: OrderCenterPaymentPlanItem[];
  nextPayablePlan?: OrderCenterPaymentPlanItem;
  refundSummary?: OrderCenterRefundSummary;
  timeline?: OrderCenterTimelineItem[];
  legacyActionPath?: string;
  order?: OrderCenterOrderRecord;
}

export interface OrderCenterListQuery {
  statusGroup?: OrderCenterStatusGroup;
  sourceKind?: OrderCenterSourceKind;
  page?: number;
  pageSize?: number;
}

export async function listOrderCenterEntries(query: OrderCenterListQuery = {}) {
  return request<PageData<OrderCenterEntrySummary>>({
    url: '/order-center/entries',
    data: query,
  });
}

export async function getOrderCenterEntryDetail(entryKey: string) {
  return request<OrderCenterEntryDetail>({
    url: `/order-center/entries/${encodeURIComponent(entryKey)}`,
  });
}

export async function startOrderCenterEntryPayment(
  entryKey: string,
  payload: { channel: PaymentChannel; terminalType: string },
) {
  return request<{
    paymentId: number;
    channel: PaymentChannel;
    launchMode: PaymentLaunchMode;
    launchUrl?: string;
    qrCodeImageUrl?: string;
    expiresAt?: string;
  }>({
    url: `/order-center/entries/${encodeURIComponent(entryKey)}/payments`,
    method: 'POST',
    data: payload,
    showLoading: true,
  });
}
