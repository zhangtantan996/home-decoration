import type {
  ChangeOrderSummaryVM,
  CommercialExplanationVM,
  PayoutSummaryVM,
  QuoteTruthSummaryVM,
  SettlementSummaryVM,
} from '../types/viewModels';
import {
  adaptChangeOrderSummary,
  adaptCommercialExplanation,
  adaptPayoutSummary,
  adaptQuoteTruthSummary,
  adaptSettlementSummary,
} from './bridgeSummary';
import type { PaymentLaunchPayload, PaymentLaunchRequest } from './payments';
import { requestJson } from './http';

export type OrderCenterEntryKind = 'payable' | 'refund';
export type OrderCenterSourceKind =
  | 'survey_deposit'
  | 'design_order'
  | 'construction_order'
  | 'material_order'
  | 'refund_record'
  | 'merchant_bond';
export type OrderCenterStatusGroup = 'pending_payment' | 'paid' | 'refund' | 'cancelled';

export interface OrderCenterProviderSummary {
  id: number;
  name: string;
  providerType?: string;
  avatar?: string;
  verified?: boolean;
}

export interface OrderCenterProjectSummary {
  id: number;
  name: string;
  address?: string;
  businessStage?: string;
  flowSummary?: string;
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
  expiresAt?: string;
  status: string;
  paidAt?: string;
  payableReason?: string;
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
  canCancel?: boolean;
}

export interface OrderCenterEntryDetail extends OrderCenterEntrySummary {
  businessStage?: string;
  flowSummary?: string;
  quoteTruthSummary?: QuoteTruthSummaryVM;
  commercialExplanation?: CommercialExplanationVM;
  changeOrderSummary?: ChangeOrderSummaryVM;
  settlementSummary?: SettlementSummaryVM;
  payoutSummary?: PayoutSummaryVM;
  financialClosureStatus?: string;
  nextPendingAction?: string;
  descriptionSections?: OrderCenterDescriptionSection[];
  paymentPlans?: OrderCenterPaymentPlanItem[];
  nextPayablePlan?: OrderCenterPaymentPlanItem;
  refundSummary?: OrderCenterRefundSummary;
  timeline?: OrderCenterTimelineItem[];
  legacyActionPath?: string;
  order?: OrderCenterOrderRecord;
}

interface OrderCenterEntryDetailDTO extends Omit<OrderCenterEntryDetail, 'quoteTruthSummary' | 'commercialExplanation' | 'changeOrderSummary' | 'settlementSummary' | 'payoutSummary'> {
  quoteTruthSummary?: unknown;
  commercialExplanation?: unknown;
  changeOrderSummary?: unknown;
  settlementSummary?: unknown;
  payoutSummary?: unknown;
}

export async function getOrderCenterEntryDetail(entryKey: string) {
  const detail = await requestJson<OrderCenterEntryDetailDTO>(`/order-center/entries/${encodeURIComponent(entryKey)}`);
  return {
    ...detail,
    quoteTruthSummary: adaptQuoteTruthSummary(detail.quoteTruthSummary),
    commercialExplanation: adaptCommercialExplanation(detail.commercialExplanation),
    changeOrderSummary: adaptChangeOrderSummary(detail.changeOrderSummary),
    settlementSummary: adaptSettlementSummary(detail.settlementSummary),
    payoutSummary: adaptPayoutSummary(detail.payoutSummary),
    financialClosureStatus: detail.financialClosureStatus || undefined,
    nextPendingAction: detail.nextPendingAction || undefined,
  };
}

export async function startOrderCenterEntryPayment(entryKey: string, request: PaymentLaunchRequest) {
  return requestJson<PaymentLaunchPayload>(`/order-center/entries/${encodeURIComponent(entryKey)}/payments`, {
    method: 'POST',
    body: request,
  });
}
