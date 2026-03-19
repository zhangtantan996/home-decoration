import api from './api';

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

export class QuoteApiError<T = unknown> extends Error {
    code: number;
    data?: T;

    constructor(code: number, message: string, data?: T) {
        super(message);
        this.name = 'QuoteApiError';
        this.code = code;
        this.data = data;
    }
}

const unwrapData = <T,>(payload: unknown, fallbackMessage: string): T => {
    const envelope = unwrapEnvelope<T>(payload);
    if (envelope.code !== 0) {
        throw new QuoteApiError(envelope.code, envelope.message || fallbackMessage, envelope.data);
    }
    return (envelope.data as T) ?? ({} as T);
};

export interface QuoteListSummary {
    id: number;
    title: string;
    status: string;
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
}

export interface QuoteListItem {
    id: number;
    lineNo?: number;
    categoryL1?: string;
    categoryL2?: string;
    name: string;
    unit: string;
    quantity: number;
    pricingNote?: string;
    sortOrder?: number;
    missingMappingFlag?: boolean;
    extensionsJson?: string;
    required?: boolean;
}

export interface QuoteSubmissionItem {
    id?: number;
    quoteListItemId: number;
    generatedUnitPriceCent?: number;
    unitPriceCent?: number;
    amountCent?: number;
    adjustedFlag?: boolean;
    missingPriceFlag?: boolean;
    missingMappingFlag?: boolean;
    minChargeAppliedFlag?: boolean;
    remark?: string;
}

export interface QuoteSubmission {
    status: string;
    taskStatus?: string;
    generationStatus?: string;
    totalCent?: number;
    currency?: string;
    generatedFromPriceBookId?: number;
    items?: QuoteSubmissionItem[];
    estimatedDays?: number;
    remark?: string;
}

export interface MerchantQuoteListDetail {
  quoteList: {
    id: number;
    projectId?: number;
    title: string;
    status: string;
        deadlineAt?: string;
        currency?: string;
        updatedAt?: string;
    };
    items: QuoteListItem[];
    invitation?: { status?: string; invitedAt?: string };
    submission?: QuoteSubmission;
    businessStage?: string;
    flowSummary?: string;
    availableActions?: string[];
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
