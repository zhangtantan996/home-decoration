import api, { MerchantRequestError } from './api';
import { toSafeUserFacingText } from '../utils/userFacingText';

const quoteApi = api;

export interface ApiEnvelope<T> {
    code: number;
    message?: string;
    data?: T;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

const unwrapEnvelope = <T,>(payload: unknown): ApiEnvelope<T> => {
    if (isRecord(payload) && 'code' in payload) {
        return payload as unknown as ApiEnvelope<T>;
    }

    if (isRecord(payload) && 'data' in payload && isRecord(payload.data) && 'code' in payload.data) {
        return payload.data as unknown as ApiEnvelope<T>;
    }

    throw new Error('接口返回格式异常');
};

export class QuoteApiError<T = unknown> extends MerchantRequestError<T> {
    code: number;

    constructor(code: number, message: string, data?: T, status?: number, errorCode?: string) {
        super(message, { status, code, errorCode, data });
        this.name = 'QuoteApiError';
        this.code = code;
    }
}

const unwrapData = <T,>(payload: unknown, fallbackMessage: string): T => {
    const envelope = unwrapEnvelope<T>(payload);
    if (envelope.code !== 0) {
        const errorCode = isRecord(envelope.data) && 'errorCode' in envelope.data
            ? String(envelope.data.errorCode || '')
            : undefined;
        throw new QuoteApiError(envelope.code, toSafeUserFacingText(envelope.message, fallbackMessage), envelope.data, 200, errorCode);
    }
    return (envelope.data as T) ?? ({} as T);
};

export interface QuoteListSummary {
    id: number;
    title: string;
    status: string;
    projectId?: number;
    proposalId?: number;
    proposalVersion?: number;
    quantityBaseId?: number;
    quantityBaseVersion?: number;
    sourceType?: string;
    sourceId?: number;
    pricingMode?: string;
    materialIncluded?: boolean;
    paymentPlanGeneratedFlag?: boolean;
    deadlineAt?: string;
    currency?: string;
    updatedAt?: string;
    mySubmissionStatus?: string;
    myTotalCent?: number;
    userConfirmationStatus?: string;
    activeSubmissionId?: number;
    businessStage?: string;
    flowSummary?: string;
    availableActions?: string[];
    submissionHealth?: SubmissionHealthSummary;
    quoteTruthSummary?: QuoteTruthSummary;
    financialClosureStatus?: string;
    nextPendingAction?: string;
}

export interface QuoteTruthSummary {
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

export interface CommercialExplanation {
    baselineSummary?: {
        title?: string;
        sourceStage?: string;
        submittedAt?: string;
        itemCount?: number;
        highlights?: string[];
        readyForUser?: boolean;
    };
    scopeIncluded?: string[];
    scopeExcluded?: string[];
    teamSize?: number;
    workTypes?: string[];
    constructionMethodNote?: string;
    siteVisitRequired?: boolean;
    paymentPlanSummary?: Array<{
        id: number;
        orderId: number;
        milestoneId?: number;
        type: string;
        seq: number;
        name: string;
        amount: number;
        status: number;
        dueAt?: string;
        paidAt?: string;
    }>;
}

export interface SubmissionHealthSummary {
    missingPriceCount: number;
    deviationItemCount: number;
    platformReviewStatus?: string;
    lastRevisionNo?: number;
    lastChangeReason?: string;
    canSubmit: boolean;
    blockingReasons?: string[];
}

export interface ChangeOrderSummary {
    totalCount: number;
    pendingUserConfirmCount: number;
    pendingSettlementCount: number;
    settledCount: number;
    netAmountCent: number;
    latestChangeOrderId?: number;
}

export interface SettlementSummary {
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

export interface PayoutSummary {
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

export interface QuoteListItem {
    id: number;
    quantityBaseItemId?: number;
    lineNo?: number;
    categoryL1?: string;
    categoryL2?: string;
    name: string;
    unit: string;
    quantity: number;
    baselineQuantity?: number;
    pricingNote?: string;
    sortOrder?: number;
    sourceStage?: string;
    quantityAdjustableFlag?: boolean;
    missingMappingFlag?: boolean;
    extensionsJson?: string;
    required?: boolean;
}

export interface QuoteSubmissionItem {
    id?: number;
    quoteListItemId: number;
    generatedUnitPriceCent?: number;
    unitPriceCent?: number;
    quotedQuantity?: number;
    amountCent?: number;
    adjustedFlag?: boolean;
    missingPriceFlag?: boolean;
    missingMappingFlag?: boolean;
    minChargeAppliedFlag?: boolean;
    quantityChangeReason?: string;
    deviationFlag?: boolean;
    requiresUserConfirmation?: boolean;
    platformReviewFlag?: boolean;
    baselineQuantity?: number;
    itemName?: string;
    unit?: string;
    remark?: string;
}

export interface QuoteSubmission {
    status: string;
    taskStatus?: string;
    generationStatus?: string;
    reviewStatus?: string;
    totalCent?: number;
    currency?: string;
    generatedFromPriceBookId?: number;
    items?: QuoteSubmissionItem[];
    estimatedDays?: number;
    remark?: string;
}

export interface QuantityBaseSnapshot {
    id: number;
    proposalId?: number;
    proposalVersion?: number;
    sourceType?: string;
    sourceId?: number;
    status?: string;
    version: number;
    title?: string;
    activatedAt?: string;
}

export interface QuantityBaseItemSnapshot {
    id: number;
    quantityBaseId: number;
    standardItemId?: number;
    sourceLineNo?: number;
    sourceItemCode?: string;
    sourceItemName: string;
    unit: string;
    quantity: number;
    baselineNote?: string;
    categoryL1?: string;
    categoryL2?: string;
    sortOrder?: number;
}

export interface MerchantQuoteListDetail {
  quoteList: {
    id: number;
    projectId?: number;
    proposalId?: number;
    proposalVersion?: number;
    quantityBaseId?: number;
    quantityBaseVersion?: number;
    sourceType?: string;
    sourceId?: number;
    title: string;
    status: string;
    pricingMode?: string;
    materialIncluded?: boolean;
    paymentPlanGeneratedFlag?: boolean;
    deadlineAt?: string;
    currency?: string;
    updatedAt?: string;
    };
    items: QuoteListItem[];
    invitation?: { status?: string; invitedAt?: string };
    submission?: QuoteSubmission;
    quantityBase?: QuantityBaseSnapshot;
    quantityItems: QuantityBaseItemSnapshot[];
    paymentPlanSummary?: Array<{
        id: number;
        orderId: number;
        milestoneId?: number;
        type: string;
        seq: number;
        name: string;
        amount: number;
        status: number;
        dueAt?: string;
        paidAt?: string;
    }>;
    businessStage?: string;
    flowSummary?: string;
    availableActions?: string[];
    bridgeConversionSummary?: {
        constructionSubjectComparison?: Array<{
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
        }>;
        quoteBaselineSummary?: {
            title?: string;
            sourceStage?: string;
            submittedAt?: string;
            itemCount?: number;
            highlights?: string[];
            readyForUser?: boolean;
        };
        responsibilityBoundarySummary?: { title?: string; items?: string[] };
        scheduleAndAcceptanceSummary?: { title?: string; items?: string[] };
        platformGuaranteeSummary?: { title?: string; items?: string[] };
        trustSignals?: {
            rating?: number;
            reviewCount?: number;
            completedCnt?: number;
            caseCount?: number;
            highlightTags?: string[];
            officialReviewHint?: string;
        };
        bridgeNextStep?: {
            title?: string;
            owner?: string;
            reason?: string;
            actionHint?: string;
        };
    };
    quoteTruthSummary?: QuoteTruthSummary;
    commercialExplanation?: CommercialExplanation;
    submissionHealth?: SubmissionHealthSummary;
    changeOrderSummary?: ChangeOrderSummary;
    settlementSummary?: SettlementSummary;
    payoutSummary?: PayoutSummary;
    financialClosureStatus?: string;
    nextPendingAction?: string;
}

export interface QuotePriceBookItem {
    id?: number;
    standardItemId: number;
    standardCode?: string;
    standardItemName?: string;
    categoryL1?: string;
    categoryL2?: string;
    priceTierId?: number;
    unit: string;
    unitPriceCent: number;
    minChargeCent: number;
    remark?: string;
    status?: number;
    required?: boolean;
    applicable?: boolean;
}

export interface QuotePriceBookDetail {
    book: {
        id?: number;
        providerId?: number;
        status?: string;
        version?: number;
        effectiveFrom?: string;
        effectiveTo?: string;
        remark?: string;
    };
    items: QuotePriceBookItem[];
}

export const merchantQuoteApi = {
    getPriceBook: async () =>
        unwrapData<QuotePriceBookDetail>(
            await quoteApi.get('/merchant/price-book'),
            '获取工长价格库失败'
        ),
    savePriceBook: async (payload: { remark?: string; items: QuotePriceBookItem[] }) =>
        unwrapData<QuotePriceBookDetail>(
            await quoteApi.put('/merchant/price-book', payload),
            '保存工长价格库失败'
        ),
    publishPriceBook: async () =>
        unwrapData<QuotePriceBookDetail>(
            await quoteApi.post('/merchant/price-book/publish'),
            '发布工长价格库失败'
        ),
    listQuoteLists: async () =>
        unwrapData<{ list: QuoteListSummary[]; total?: number; page?: number; pageSize?: number }>(
            await quoteApi.get('/merchant/quote-lists'),
            '获取报价清单失败'
        ),
    listQuoteTasks: async () =>
        unwrapData<{ list: QuoteListSummary[]; total?: number; page?: number; pageSize?: number }>(
            await quoteApi.get('/merchant/quote-tasks'),
            '获取报价任务失败'
        ),
    getQuoteListDetail: async (id: number) =>
        unwrapData<MerchantQuoteListDetail>(
            await quoteApi.get(`/merchant/quote-lists/${id}`),
            '获取报价清单详情失败'
        ),
    getQuoteTaskDetail: async (id: number) =>
        unwrapData<MerchantQuoteListDetail>(
            await quoteApi.get(`/merchant/quote-tasks/${id}`),
            '获取报价任务详情失败'
        ),
    saveSubmissionDraft: async (
        quoteListId: number,
        payload: { items: QuoteSubmissionItem[] }
    ) =>
        unwrapData<{ status?: string }>(
            await quoteApi.put(`/merchant/quote-lists/${quoteListId}/submission`, payload),
            '保存报价草稿失败'
        ),
    submitSubmission: async (
        quoteListId: number,
        payload: { items: QuoteSubmissionItem[] }
    ) =>
        unwrapData<{ status?: string }>(
            await quoteApi.post(`/merchant/quote-lists/${quoteListId}/submission/submit`, payload),
            '提交报价失败'
        ),
};
