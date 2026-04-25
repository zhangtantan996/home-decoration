import { adminFinanceApi, adminProjectApi, api, type AdminApiResponse, type AdminListData } from './api';

export interface AdminBusinessFlowActor {
  userId?: number;
  providerId?: number;
  displayName: string;
  phone?: string;
  providerType?: number;
  role?: string;
}

export interface AdminBusinessFlowAction {
  key: string;
  label: string;
  kind: 'mutation' | 'navigate' | string;
  permission?: string;
  method?: string;
  apiPath?: string;
  route?: string;
  payload?: Record<string, unknown>;
  danger?: boolean;
  requiresReason: boolean;
}

export interface AdminBusinessFlowOrderSnapshot {
  id: number;
  orderNo: string;
  orderType?: string;
  status?: number | string;
  totalAmount?: number;
  paidAmount?: number;
  discount?: number;
  projectId?: number;
  proposalId?: number;
  bookingId?: number;
  expireAt?: string;
  paidAt?: string;
  paymentPlans?: AdminBusinessFlowPaymentPlan[];
}

export interface AdminBusinessFlowPaymentPlan {
  id: number;
  orderId?: number;
  type?: string;
  seq?: number;
  name?: string;
  amount?: number;
  percentage?: number;
  status?: number | string;
  activatedAt?: string;
  dueAt?: string;
  expiresAt?: string;
  paidAt?: string;
  milestoneId?: number;
  payable?: boolean;
  payableReason?: string;
  planType?: string;
}

export interface AdminBusinessFlowRiskSnapshot {
  status?: string;
  paymentPaused?: boolean;
  paymentPausedReason?: string;
  hasDispute?: boolean;
  hasOpenWarning?: boolean;
  hasOpenArbitration?: boolean;
  hasOpenAudit?: boolean;
  hasPendingRefund?: boolean;
  summary?: string;
  warningTypes?: string[];
}

export interface AdminBusinessFlowListItem {
  flowId: string;
  sourceType: string;
  sourceId: number;
  currentStage: string;
  flowSummary: string;
  ownerUser?: AdminBusinessFlowActor;
  provider?: AdminBusinessFlowActor;
  bookingId?: number;
  proposalId?: number;
  quoteTaskId?: number;
  projectId?: number;
  primaryOrderNo?: string;
  orderStatus?: number | string;
  paymentPlanStatus?: number | string;
  settlementStatus?: string;
  payoutStatus?: string;
  refundStatus?: string;
  riskStatus?: string;
  paymentPaused?: boolean;
  stageChangedAt?: string;
  availableAdminActions: AdminBusinessFlowAction[];
}

export interface AdminBusinessFlowBookingSnapshot {
  id: number;
  userId?: number;
  providerId?: number;
  address?: string;
  area?: number;
  status?: number;
  budgetRange?: string;
  renovationType?: string;
  preferredDate?: string;
  createdAt?: string;
}

export interface AdminBusinessFlowProposalSnapshot {
  id: number;
  sourceType?: string;
  bookingId?: number;
  demandId?: number;
  designerId?: number;
  summary?: string;
  designFee?: number;
  constructionFee?: number;
  materialFee?: number;
  estimatedDays?: number;
  status?: number;
  version?: number;
  rejectionReason?: string;
  confirmedAt?: string;
  rejectedAt?: string;
  submittedAt?: string;
}

export interface AdminBusinessFlowQuoteTaskSnapshot {
  id: number;
  projectId?: number;
  proposalId?: number;
  status?: string;
  userConfirmationStatus?: string;
  activeSubmissionId?: number;
  awardedProviderId?: number;
  title?: string;
  submittedToUserAt?: string;
  userConfirmedAt?: string;
}

export interface AdminBusinessFlowQuoteSubmissionSnapshot {
  id: number;
  quoteListId?: number;
  providerId?: number;
  providerType?: number;
  status?: string;
  taskStatus?: string;
  totalCent?: number;
  estimatedDays?: number;
  remark?: string;
  userConfirmedAt?: string;
  reviewStatus?: string;
  reviewReason?: string;
}

export interface AdminBusinessFlowChangeOrder {
  id: number;
  projectId: number;
  initiatorType?: string;
  initiatorId?: number;
  changeType?: string;
  title?: string;
  reason?: string;
  description?: string;
  amountImpact?: number;
  timelineImpact?: number;
  status?: string;
  evidenceUrls?: string[];
  createdAt?: string;
  updatedAt?: string;
  userRejectReason?: string;
  settlementReason?: string;
  payablePlanId?: number;
}

export interface AdminQuoteTruthSummary {
  quoteListId?: number;
  sourceType?: string;
  sourceId?: number;
  quantityBaseId?: number;
  quantityBaseVersion?: number;
  activeSubmissionId?: number;
  awardedProviderId?: number;
  confirmedAt?: string;
  totalCent?: number;
  estimatedDays?: number;
  revisionCount?: number;
}

export interface AdminCommercialExplanation {
  baselineSummary?: string;
  scopeIncluded?: string[];
  scopeExcluded?: string[];
  teamSize?: number;
  workTypes?: string[];
  constructionMethodNote?: string;
  siteVisitRequired?: boolean;
  paymentPlanSummary?: Array<Record<string, unknown>>;
}

export interface AdminSubmissionHealth {
  missingPriceCount?: number;
  deviationItemCount?: number;
  platformReviewStatus?: string;
  lastRevisionNo?: number;
  lastChangeReason?: string;
  canSubmit?: boolean;
  blockingReasons?: string[];
}

export interface AdminChangeOrderSummary {
  totalCount?: number;
  pendingUserConfirmCount?: number;
  pendingSettlementCount?: number;
  settledCount?: number;
  netAmountCent?: number;
  latestChangeOrderId?: number;
}

export interface AdminSettlementSummary {
  latestSettlementId?: number;
  status?: string;
  grossAmount?: number;
  netAmount?: number;
  totalGrossAmount?: number;
  totalNetAmount?: number;
  settledAmount?: number;
  pendingAmount?: number;
  failedAmount?: number;
  scheduledAt?: string;
  paidAt?: string;
}

export interface AdminPayoutSummary {
  latestPayoutId?: number;
  status?: string;
  channel?: string;
  totalAmount?: number;
  paidAmount?: number;
  pendingAmount?: number;
  failedAmount?: number;
  scheduledAt?: string;
  paidAt?: string;
  failureReason?: string;
}

export interface AdminBusinessFlowProjectSnapshot {
  id: number;
  ownerId?: number;
  providerId?: number;
  proposalId?: number;
  name?: string;
  address?: string;
  area?: number;
  budget?: number;
  status?: number;
  businessStatus?: string;
  currentPhase?: string;
  materialMethod?: string;
  paymentPaused?: boolean;
  paymentPausedReason?: string;
  constructionProviderId?: number;
  foremanId?: number;
  selectedQuoteSubmissionId?: number;
  inspirationCaseDraftId?: number;
  constructionQuote?: number;
  constructionConfirmedAt?: string;
  quoteConfirmedAt?: string;
  startedAt?: string;
  startDate?: string;
  entryStartDate?: string;
  expectedEnd?: string;
  actualEnd?: string;
  pausedAt?: string;
  resumedAt?: string;
  pauseReason?: string;
  disputeReason?: string;
  completionNotes?: string;
  completionSubmittedAt?: string;
  completionRejectionReason?: string;
  completionRejectedAt?: string;
}

export interface AdminBusinessFlowMilestoneSnapshot {
  id: number;
  projectId?: number;
  name?: string;
  seq?: number;
  amount?: number;
  percentage?: number;
  status?: number;
  submittedAt?: string;
  acceptedAt?: string;
  releasedAt?: string;
  releaseScheduledAt?: string;
  rejectionReason?: string;
}

export interface AdminBusinessFlowTransactionSnapshot {
  id: number;
  projectId?: number;
  milestoneId?: number;
  type?: string;
  amount?: number;
  status?: number;
  remark?: string;
  createdAt?: string;
}

export interface AdminBusinessFlowRefundSnapshot {
  id: number;
  bookingId?: number;
  projectId?: number;
  refundType?: string;
  requestedAmount?: number;
  approvedAmount?: number;
  status?: string;
  reason?: string;
  auditNotes?: string;
  createdAt?: string;
}

export interface AdminBusinessFlowProjectAuditSnapshot {
  id: number;
  projectId?: number;
  auditType?: string;
  status?: string;
  conclusion?: string;
  conclusionReason?: string;
  auditNotes?: string;
  createdAt?: string;
  completedAt?: string;
}

export interface AdminBusinessFlowAuditLogSnapshot {
  id: number;
  recordKind?: string;
  operatorType?: string;
  operatorId?: number;
  operationType?: string;
  resourceType?: string;
  resourceId?: number;
  reason?: string;
  result?: string;
  createdAt?: string;
}

export interface AdminBusinessFlowEscrowSnapshot {
  id: number;
  projectId?: number;
  totalAmount?: number;
  availableAmount?: number;
  frozenAmount?: number;
  releasedAmount?: number;
  status?: number | string;
}

export interface AdminBusinessFlowDetail {
  flowId: string;
  sourceType: string;
  sourceId: number;
  currentStage: string;
  flowSummary: string;
  stageChangedAt?: string;
  ownerUser?: AdminBusinessFlowActor;
  provider?: AdminBusinessFlowActor;
  designerProvider?: AdminBusinessFlowActor;
  constructionProvider?: AdminBusinessFlowActor;
  booking?: AdminBusinessFlowBookingSnapshot;
  demand?: Record<string, unknown>;
  proposal?: AdminBusinessFlowProposalSnapshot;
  quoteTask?: AdminBusinessFlowQuoteTaskSnapshot;
  selectedQuoteSubmission?: AdminBusinessFlowQuoteSubmissionSnapshot;
  project?: AdminBusinessFlowProjectSnapshot;
  milestones?: AdminBusinessFlowMilestoneSnapshot[];
  orders?: AdminBusinessFlowOrderSnapshot[];
  changeOrders?: AdminBusinessFlowChangeOrder[];
  escrowAccount?: AdminBusinessFlowEscrowSnapshot;
  transactions?: AdminBusinessFlowTransactionSnapshot[];
  refundApplications?: AdminBusinessFlowRefundSnapshot[];
  projectAudits?: AdminBusinessFlowProjectAuditSnapshot[];
  riskWarnings?: Array<Record<string, unknown>>;
  arbitrations?: Array<Record<string, unknown>>;
  quoteTruthSummary?: AdminQuoteTruthSummary;
  commercialExplanation?: AdminCommercialExplanation;
  submissionHealth?: AdminSubmissionHealth;
  changeOrderSummary?: AdminChangeOrderSummary;
  settlementSummary?: AdminSettlementSummary;
  payoutSummary?: AdminPayoutSummary;
  financialClosureStatus?: string;
  nextPendingAction?: string;
  risk?: AdminBusinessFlowRiskSnapshot;
  auditLogs?: AdminBusinessFlowAuditLogSnapshot[];
  availableAdminActions: AdminBusinessFlowAction[];
}

export interface AdminBusinessFlowListQuery {
  keyword?: string;
  currentStage?: string;
  ownerUserId?: number;
  providerId?: number;
  bookingId?: number;
  projectId?: number;
  orderStatus?: string | number;
  paymentPlanStatus?: string | number;
  settlementStatus?: string;
  payoutStatus?: string;
  refundStatus?: string;
  riskStatus?: string;
  paymentPaused?: boolean;
  page?: number;
  pageSize?: number;
}

export interface AdminConstructionConfirmInput {
  constructionProviderId?: number;
  foremanId?: number;
  reason: string;
}

export interface AdminConstructionQuoteConfirmInput {
  constructionQuote: number;
  materialMethod?: string;
  plannedStartDate?: string;
  expectedEnd?: string;
  reason: string;
}

export interface AdminStartProjectInput {
  startDate?: string;
  reason: string;
}

const unwrapList = <T>(payload?: AdminApiResponse<AdminListData<T>>) => ({
  list: payload?.data?.list || [],
  total: Number(payload?.data?.total || 0),
});

export const adminOrderCenterApi = {
  async list(params: AdminBusinessFlowListQuery) {
    const res = await api.get<
      AdminApiResponse<AdminListData<AdminBusinessFlowListItem>>,
      AdminApiResponse<AdminListData<AdminBusinessFlowListItem>>
    >('/admin/business-flows', { params });
    return { ...res, data: unwrapList(res) };
  },
  detail: (id: string) => api.get<
    AdminApiResponse<AdminBusinessFlowDetail>,
    AdminApiResponse<AdminBusinessFlowDetail>
  >(`/admin/business-flows/${id}`),
  confirmProposal: (id: number, reason: string) =>
    api.post(`/admin/proposals/${id}/confirm`, { reason }),
  rejectProposal: (id: number, reason: string) =>
    api.post(`/admin/proposals/${id}/reject`, { reason }),
  confirmConstruction: (id: number, data: AdminConstructionConfirmInput) =>
    adminProjectApi.confirmConstruction(id, data),
  confirmConstructionQuote: (id: number, data: AdminConstructionQuoteConfirmInput) =>
    adminProjectApi.confirmConstructionQuote(id, data),
  startProject: (id: number, data: AdminStartProjectInput) =>
    api.post(`/admin/projects/${id}/start`, data),
  pauseProject: (id: number, reason: string) =>
    api.post(`/admin/projects/${id}/pause`, { reason }),
  resumeProject: (id: number, reason: string) =>
    api.post(`/admin/projects/${id}/resume`, { reason }),
  approveMilestone: (projectId: number, milestoneId: number, reason: string) =>
    api.post(`/admin/projects/${projectId}/milestones/${milestoneId}/approve`, { reason }),
  rejectMilestone: (projectId: number, milestoneId: number, reason: string) =>
    api.post(`/admin/projects/${projectId}/milestones/${milestoneId}/reject`, { reason }),
  approveCompletion: (projectId: number, reason: string) =>
    api.post(`/admin/projects/${projectId}/completion/approve`, { reason }),
  rejectCompletion: (projectId: number, reason: string) =>
    api.post(`/admin/projects/${projectId}/completion/reject`, { reason }),
  settleChangeOrder: (changeOrderId: number, reason: string) =>
    api.post(`/admin/change-orders/${changeOrderId}/settle`, { reason }),
  freezeFunds: adminFinanceApi.freeze,
  unfreezeFunds: adminFinanceApi.unfreeze,
  manualReleaseFunds: adminFinanceApi.manualRelease,
};
