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
}

export interface QuoteSubmissionItem {
    quoteListItemId: number;
    unitPriceCent?: number;
    amountCent?: number;
    remark?: string;
}

export interface QuoteSubmission {
    status: string;
    totalCent?: number;
    currency?: string;
    items?: QuoteSubmissionItem[];
}

export interface MerchantQuoteListDetail {
    quoteList: {
        id: number;
        title: string;
        status: string;
        deadlineAt?: string;
        currency?: string;
        updatedAt?: string;
    };
    items: QuoteListItem[];
    invitation?: { status?: string; invitedAt?: string };
    submission?: QuoteSubmission;
}

export const merchantQuoteApi = {
    listQuoteLists: async () =>
        unwrapData<{ list: QuoteListSummary[]; total?: number; page?: number; pageSize?: number }>(
            await quoteApi.get('/merchant/quote-lists'),
            '获取报价清单失败'
        ),
    getQuoteListDetail: async (id: number) =>
        unwrapData<MerchantQuoteListDetail>(
            await quoteApi.get(`/merchant/quote-lists/${id}`),
            '获取报价清单详情失败'
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
