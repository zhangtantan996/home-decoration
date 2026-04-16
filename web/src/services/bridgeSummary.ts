import type {
  BridgeChecklistSummaryVM,
  BridgeConversionSummaryVM,
  ProjectClosureSummaryVM,
} from '../types/viewModels';
import { formatDateTime } from '../utils/format';

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
