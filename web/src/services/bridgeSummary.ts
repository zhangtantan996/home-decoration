import type {
  BridgeChecklistSummaryVM,
  BridgeConversionSummaryVM,
  ChangeOrderSummaryVM,
  CommercialExplanationVM,
  PayoutSummaryVM,
  ProjectClosureSummaryVM,
  QuoteTruthSummaryVM,
  SettlementSummaryVM,
} from '../types/viewModels';
import { formatCurrency, formatDateTime } from '../utils/format';

interface ConstructionSubjectComparisonItemDTO {
  providerId?: number;
  subjectType?: string;
  displayName?: string;
  rating?: number;
  reviewCount?: number;
  completedCnt?: number;
  caseCount?: number;
  highlightTags?: string[];
  priceHint?: string;
  deliveryHint?: string;
  trustSummary?: string;
  selected?: boolean;
}

interface BridgeChecklistSummaryDTO {
  title?: string;
  items?: string[];
}

interface BridgeQuoteBaselineSummaryDTO {
  title?: string;
  sourceStage?: string;
  submittedAt?: string;
  itemCount?: number;
  highlights?: string[];
  readyForUser?: boolean;
}

interface BridgeTrustSignalsDTO {
  rating?: number;
  reviewCount?: number;
  completedCnt?: number;
  caseCount?: number;
  highlightTags?: string[];
  officialReviewHint?: string;
}

interface BridgeNextStepDTO {
  title?: string;
  owner?: string;
  reason?: string;
  actionHint?: string;
}

interface BridgeConversionSummaryDTO {
  constructionSubjectComparison?: ConstructionSubjectComparisonItemDTO[];
  quoteBaselineSummary?: BridgeQuoteBaselineSummaryDTO | null;
  responsibilityBoundarySummary?: BridgeChecklistSummaryDTO | null;
  scheduleAndAcceptanceSummary?: BridgeChecklistSummaryDTO | null;
  platformGuaranteeSummary?: BridgeChecklistSummaryDTO | null;
  trustSignals?: BridgeTrustSignalsDTO | null;
  bridgeNextStep?: BridgeNextStepDTO | null;
}

interface ProjectClosureSummaryDTO {
  completionStatus?: string;
  archiveStatus?: string;
  settlementStatus?: string;
  payoutStatus?: string;
  caseDraftStatus?: string;
  financialClosureStatus?: string;
  nextPendingAction?: string;
}

interface QuotePaymentPlanSummaryDTO {
  id: number;
  orderId: number;
  milestoneId?: number;
  type: string;
  seq: number;
  name: string;
  amount?: number;
  status: number;
  dueAt?: string;
  paidAt?: string;
}

interface QuoteTruthSummaryDTO {
  quoteListId: number;
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

interface CommercialExplanationDTO {
  baselineSummary?: BridgeQuoteBaselineSummaryDTO | null;
  scopeIncluded?: string[];
  scopeExcluded?: string[];
  teamSize?: number;
  workTypes?: string[];
  constructionMethodNote?: string;
  siteVisitRequired?: boolean;
  paymentPlanSummary?: QuotePaymentPlanSummaryDTO[];
}

interface ChangeOrderSummaryDTO {
  totalCount?: number;
  pendingUserConfirmCount?: number;
  pendingSettlementCount?: number;
  settledCount?: number;
  netAmountCent?: number;
  latestChangeOrderId?: number;
}

interface SettlementSummaryDTO {
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

interface PayoutSummaryDTO {
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

function hasFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function formatOptionalCurrency(value: number | null | undefined) {
  return hasFiniteNumber(value) ? formatCurrency(value) : undefined;
}

function formatOptionalCentCurrency(value: number | null | undefined) {
  return hasFiniteNumber(value) ? formatCurrency(value / 100) : undefined;
}

function adaptBridgeChecklistSummary(dto?: BridgeChecklistSummaryDTO | null): BridgeChecklistSummaryVM | undefined {
  if (!dto) return undefined;
  return {
    title: dto.title || undefined,
    items: (dto.items || []).filter(Boolean),
  };
}

export function adaptBridgeConversionSummary(raw?: unknown): BridgeConversionSummaryVM | undefined {
  const dto = raw as BridgeConversionSummaryDTO | null | undefined;
  if (!dto) return undefined;
  return {
    constructionSubjectComparison: (dto.constructionSubjectComparison || []).map((item) => ({
      providerId: Number(item.providerId || 0),
      subjectType: item.subjectType || undefined,
      displayName: item.displayName || '施工主体',
      rating: Number(item.rating || 0),
      reviewCount: Number(item.reviewCount || 0),
      completedCnt: Number(item.completedCnt || 0),
      caseCount: Number(item.caseCount || 0),
      highlightTags: item.highlightTags || [],
      priceHint: item.priceHint || undefined,
      deliveryHint: item.deliveryHint || undefined,
      trustSummary: item.trustSummary || undefined,
      selected: Boolean(item.selected),
    })),
    quoteBaselineSummary: dto.quoteBaselineSummary
      ? {
          title: dto.quoteBaselineSummary.title || undefined,
          sourceStage: dto.quoteBaselineSummary.sourceStage || undefined,
          submittedAt: formatDateTime(dto.quoteBaselineSummary.submittedAt),
          itemCount: Number(dto.quoteBaselineSummary.itemCount || 0),
          highlights: dto.quoteBaselineSummary.highlights || [],
          readyForUser: Boolean(dto.quoteBaselineSummary.readyForUser),
        }
      : undefined,
    responsibilityBoundarySummary: adaptBridgeChecklistSummary(dto.responsibilityBoundarySummary),
    scheduleAndAcceptanceSummary: adaptBridgeChecklistSummary(dto.scheduleAndAcceptanceSummary),
    platformGuaranteeSummary: adaptBridgeChecklistSummary(dto.platformGuaranteeSummary),
    trustSignals: dto.trustSignals
      ? {
          rating: Number(dto.trustSignals.rating || 0),
          reviewCount: Number(dto.trustSignals.reviewCount || 0),
          completedCnt: Number(dto.trustSignals.completedCnt || 0),
          caseCount: Number(dto.trustSignals.caseCount || 0),
          highlightTags: dto.trustSignals.highlightTags || [],
          officialReviewHint: dto.trustSignals.officialReviewHint || undefined,
        }
      : undefined,
    bridgeNextStep: dto.bridgeNextStep
      ? {
          title: dto.bridgeNextStep.title || undefined,
          owner: dto.bridgeNextStep.owner || undefined,
          reason: dto.bridgeNextStep.reason || undefined,
          actionHint: dto.bridgeNextStep.actionHint || undefined,
        }
      : undefined,
  };
}

export function adaptProjectClosureSummary(raw?: unknown): ProjectClosureSummaryVM | undefined {
  const detail = raw as ProjectClosureSummaryDTO | null | undefined;
  if (!detail) return undefined;
  return {
    completionStatus: detail.completionStatus || undefined,
    archiveStatus: detail.archiveStatus || undefined,
    settlementStatus: detail.settlementStatus || undefined,
    payoutStatus: detail.payoutStatus || undefined,
    caseDraftStatus: detail.caseDraftStatus || undefined,
    financialClosureStatus: detail.financialClosureStatus || undefined,
    nextPendingAction: detail.nextPendingAction || undefined,
  };
}

export function adaptQuoteTruthSummary(raw?: unknown): QuoteTruthSummaryVM | undefined {
  const detail = raw as QuoteTruthSummaryDTO | null | undefined;
  if (!detail) return undefined;
  return {
    quoteListId: Number(detail.quoteListId || 0),
    sourceType: detail.sourceType || undefined,
    sourceId: detail.sourceId || undefined,
    quantityBaseId: detail.quantityBaseId || undefined,
    quantityBaseVersion: detail.quantityBaseVersion || undefined,
    activeSubmissionId: detail.activeSubmissionId || undefined,
    awardedProviderId: detail.awardedProviderId || undefined,
    confirmedAt: formatDateTime(detail.confirmedAt),
    totalAmountText: formatOptionalCentCurrency(detail.totalCent),
    estimatedDays: Number(detail.estimatedDays || 0) || undefined,
    revisionCount: Number(detail.revisionCount || 0) || undefined,
  };
}

export function adaptCommercialExplanation(raw?: unknown): CommercialExplanationVM | undefined {
  const detail = raw as CommercialExplanationDTO | null | undefined;
  if (!detail) return undefined;
  return {
    baselineSummary: detail.baselineSummary ? adaptBridgeConversionSummary({ quoteBaselineSummary: detail.baselineSummary })?.quoteBaselineSummary : undefined,
    scopeIncluded: (detail.scopeIncluded || []).filter(Boolean),
    scopeExcluded: (detail.scopeExcluded || []).filter(Boolean),
    teamSize: Number(detail.teamSize || 0) || undefined,
    workTypes: (detail.workTypes || []).filter(Boolean),
    constructionMethodNote: detail.constructionMethodNote || undefined,
    siteVisitRequired: Boolean(detail.siteVisitRequired),
    paymentPlanSummary: (detail.paymentPlanSummary || []).map((item) => ({
      id: item.id,
      orderId: item.orderId,
      milestoneId: item.milestoneId || undefined,
      type: item.type,
      seq: item.seq,
      name: item.name,
      amountText: formatOptionalCurrency(item.amount) || '待同步',
      status: item.status,
      dueAt: formatDateTime(item.dueAt),
      paidAt: formatDateTime(item.paidAt),
    })),
  };
}

export function adaptChangeOrderSummary(raw?: unknown): ChangeOrderSummaryVM | undefined {
  const detail = raw as ChangeOrderSummaryDTO | null | undefined;
  if (!detail) return undefined;
  return {
    totalCount: Number(detail.totalCount || 0),
    pendingUserConfirmCount: Number(detail.pendingUserConfirmCount || 0),
    pendingSettlementCount: Number(detail.pendingSettlementCount || 0),
    settledCount: Number(detail.settledCount || 0),
    netAmountText: formatOptionalCentCurrency(detail.netAmountCent),
    latestChangeOrderId: detail.latestChangeOrderId || undefined,
  };
}

export function adaptSettlementSummary(raw?: unknown): SettlementSummaryVM | undefined {
  const detail = raw as SettlementSummaryDTO | null | undefined;
  if (!detail) return undefined;
  return {
    latestSettlementId: detail.latestSettlementId || undefined,
    status: detail.status || undefined,
    grossAmountText: formatOptionalCurrency(detail.grossAmount),
    netAmountText: formatOptionalCurrency(detail.netAmount),
    totalGrossAmountText: formatOptionalCurrency(detail.totalGrossAmount),
    totalNetAmountText: formatOptionalCurrency(detail.totalNetAmount),
    settledAmountText: formatOptionalCurrency(detail.settledAmount),
    pendingAmountText: formatOptionalCurrency(detail.pendingAmount),
    failedAmountText: formatOptionalCurrency(detail.failedAmount),
    scheduledAt: formatDateTime(detail.scheduledAt),
    paidAt: formatDateTime(detail.paidAt),
  };
}

export function adaptPayoutSummary(raw?: unknown): PayoutSummaryVM | undefined {
  const detail = raw as PayoutSummaryDTO | null | undefined;
  if (!detail) return undefined;
  return {
    latestPayoutId: detail.latestPayoutId || undefined,
    status: detail.status || undefined,
    channel: detail.channel || undefined,
    totalAmountText: formatOptionalCurrency(detail.totalAmount),
    paidAmountText: formatOptionalCurrency(detail.paidAmount),
    pendingAmountText: formatOptionalCurrency(detail.pendingAmount),
    failedAmountText: formatOptionalCurrency(detail.failedAmount),
    scheduledAt: formatDateTime(detail.scheduledAt),
    paidAt: formatDateTime(detail.paidAt),
    failureReason: detail.failureReason || undefined,
  };
}
