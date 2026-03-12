import dayjs from 'dayjs';
import { adminProviderApi, type AdminApiResponse, type AdminListData, type AdminProviderListItem } from './api';
import api from './api';

export interface QuoteLibraryItem {
    id: number;
    erpItemCode: string;
    name: string;
    unit: string;
    categoryL1: string;
    categoryL2: string;
    referencePriceCent: number;
    pricingNote: string;
    status: number;
}

export interface QuoteListSummary {
    id: number;
    projectId: number;
    customerId: number;
    houseId: number;
    ownerUserId: number;
    scenarioType: string;
    title: string;
    status: string;
    currency: string;
    deadlineAt?: string;
    awardedProviderId?: number;
    itemCount: number;
    invitationCount: number;
    submissionCount: number;
    updatedAt: string;
}

export interface QuoteListItem {
    id: number;
    standardItemId: number;
    lineNo: number;
    name: string;
    unit: string;
    quantity: number;
    pricingNote?: string;
    categoryL1?: string;
    categoryL2?: string;
    sortOrder?: number;
}

export interface QuoteInvitation {
    id: number;
    quoteListId: number;
    providerId: number;
    status: string;
    invitedAt?: string;
    respondedAt?: string;
}

export interface QuoteComparisonSubmission {
    submissionId: number;
    providerId: number;
    providerName: string;
    providerType: number;
    providerSubType: string;
    status: string;
    totalCent: number;
    missingItemIds: number[];
    abnormalItemIds: number[];
    categoryTotals: Array<{ category: string; totalCent: number }>;
}

export interface QuoteComparisonResponse {
    quoteList: QuoteListSummary;
    items: QuoteListItem[];
    submissions: QuoteComparisonSubmission[];
}

export interface AdminQuoteListDetail {
    quoteList: QuoteListSummary;
    items: QuoteListItem[];
    invitations: QuoteInvitation[];
    submissionCount: number;
}

const unwrapEnvelope = <T,>(payload: unknown, fallbackMessage: string): T => {
    const envelope = payload as AdminApiResponse<T>;
    if (!envelope || typeof envelope !== 'object') {
        throw new Error(fallbackMessage);
    }
    if (envelope.code !== 0) {
        throw new Error(envelope.message || fallbackMessage);
    }
    return (envelope.data as T) ?? ({} as T);
};

export const adminQuoteApi = {
    importLibrary: async (filePath?: string) =>
        unwrapEnvelope<{ imported: number; updated: number; skipped: number; filePath: string }>(
            await api.post('/admin/quote-library/import', filePath ? { filePath } : {}),
            '导入报价库失败'
        ),
    listLibraryItems: async (params?: { page?: number; pageSize?: number; keyword?: string; categoryL1?: string; status?: number }) =>
        unwrapEnvelope<{ list: QuoteLibraryItem[]; total: number; page: number; pageSize: number }>(
            await api.get('/admin/quote-library/items', { params }),
            '获取报价库失败'
        ),
    listQuoteLists: async (params?: { page?: number; pageSize?: number; keyword?: string; status?: string }) =>
        unwrapEnvelope<{ list: QuoteListSummary[]; total: number; page: number; pageSize: number }>(
            await api.get('/admin/quote-lists', { params }),
            '获取报价清单失败'
        ),
    getQuoteListDetail: async (id: number) =>
        unwrapEnvelope<AdminQuoteListDetail>(
            await api.get(`/admin/quote-lists/${id}`),
            '获取报价清单详情失败'
        ),
    createQuoteList: async (payload: {
        projectId?: number;
        customerId?: number;
        houseId?: number;
        ownerUserId?: number;
        scenarioType?: string;
        title: string;
        currency?: string;
        deadlineAt?: string;
    }) =>
        unwrapEnvelope<QuoteListSummary>(
            await api.post('/admin/quote-lists', payload),
            '创建报价清单失败'
        ),
    batchUpsertItems: async (quoteListId: number, items: Array<{
        standardItemId?: number;
        lineNo?: number;
        name?: string;
        unit?: string;
        quantity?: number;
        pricingNote?: string;
        categoryL1?: string;
        categoryL2?: string;
        sortOrder?: number;
    }>) =>
        unwrapEnvelope<{ items: QuoteListItem[] }>(
            await api.post(`/admin/quote-lists/${quoteListId}/items/batch-upsert`, { items }),
            '保存清单项目失败'
        ),
    inviteProviders: async (quoteListId: number, providerIds: number[]) =>
        unwrapEnvelope<{ invitations: QuoteInvitation[] }>(
            await api.post(`/admin/quote-lists/${quoteListId}/invitations`, { providerIds }),
            '邀请服务商失败'
        ),
    startQuoteList: async (quoteListId: number) =>
        unwrapEnvelope<QuoteListSummary>(
            await api.post(`/admin/quote-lists/${quoteListId}/start`),
            '发起报价失败'
        ),
    getComparison: async (quoteListId: number) =>
        unwrapEnvelope<QuoteComparisonResponse>(
            await api.get(`/admin/quote-lists/${quoteListId}/comparison`),
            '获取报价对比失败'
        ),
    awardQuote: async (quoteListId: number, submissionId: number) =>
        unwrapEnvelope<QuoteListSummary>(
            await api.post(`/admin/quote-lists/${quoteListId}/award`, { submissionId }),
            '定标失败'
        ),
    listProviders: async () => {
        const providerTypes = [2, 3];
        const results = await Promise.all(providerTypes.map((type) =>
            adminProviderApi.list({ page: 1, pageSize: 100, type })
        ));
        const merged: AdminProviderListItem[] = [];
        results.forEach((result) => {
            const payload = result as AdminApiResponse<AdminListData<AdminProviderListItem>>;
            if (payload.code === 0) {
                merged.push(...(payload.data?.list || []));
            }
        });
        return merged
            .filter((item, index, array) => array.findIndex((candidate) => candidate.id === item.id) === index)
            .sort((left, right) => left.id - right.id);
    },
    normalizeDeadlineInput: (value?: dayjs.Dayjs | null) => value ? value.toISOString() : undefined,
};
