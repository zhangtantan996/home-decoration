import dayjs from 'dayjs';
import { adminProviderApi, type AdminApiResponse, type AdminListData, type AdminProviderListItem } from './api';
import api from './api';

export interface QuoteLibraryItem {
    id: number;
    categoryId?: number;
    erpItemCode: string;
    standardCode?: string;
    name: string;
    unit: string;
    categoryL1: string;
    categoryL2: string;
    categoryL3?: string;
    erpSeqNo?: string;
    referencePriceCent: number;
    pricingNote: string;
    hasTiers?: boolean;
    quantityFormulaJson?: string;
    status: number;
    keywordsJson?: string;
    erpMappingJson?: string;
    sourceMetaJson?: string;
    extensionsJson?: string;
    required?: boolean;
}

export interface QuoteCategory {
    id: number;
    code: string;
    name: string;
    parentId: number;
    sortOrder: number;
    status: number;
}

export interface QuotePriceTier {
    id: number;
    libraryItemId: number;
    tierKey: string;
    tierLabel: string;
    conditionJson?: string;
    sortOrder: number;
}

export interface QuoteTemplate {
    id: number;
    name: string;
    roomType: string;
    renovationType: string;
    description?: string;
    status: number;
    itemCount?: number;
}

export interface QuoteTemplateItem {
    id: number;
    templateId: number;
    libraryItemId: number;
    defaultQuantity: number;
    sortOrder: number;
    required: boolean;
}

export interface QuoteTemplateEnsureResult {
    template: QuoteTemplate;
    items: QuoteTemplateItem[];
    created: boolean;
    repaired: boolean;
}

export interface QuantitySuggestion {
    itemId: number;
    itemName: string;
    currentQuantity: number;
    suggestedQuantity: number;
    formulaType: string;
}

export interface ERPQuoteRow {
    seqNo: string;
    name: string;
    quantity: number;
    unit: string;
    total: number;
    remark: string;
}

export interface QuoteListSummary {
    id: number;
    projectId: number;
    proposalId?: number;
    proposalVersion?: number;
    quantityBaseId?: number;
    quantityBaseVersion?: number;
    sourceType?: string;
    sourceId?: number;
    designerProviderId?: number;
    customerId: number;
    houseId: number;
    ownerUserId: number;
    scenarioType: string;
    title: string;
    status: string;
    currency: string;
    pricingMode?: string;
    materialIncluded?: boolean;
    paymentPlanGeneratedFlag?: boolean;
    deadlineAt?: string;
    awardedProviderId?: number;
    prerequisiteStatus?: string;
    userConfirmationStatus?: string;
    activeSubmissionId?: number;
    prerequisiteSnapshotJson?: string;
    itemCount: number;
    invitationCount: number;
    submissionCount: number;
    updatedAt: string;
    businessStage?: string;
    flowSummary?: string;
    availableActions?: string[];
    baselineStatus?: string;
    baselineSubmittedAt?: string;
    constructionSubjectType?: string;
    constructionSubjectId?: number;
    constructionSubjectDisplayName?: string;
    kickoffStatus?: string;
    plannedStartDate?: string;
    supervisorSummary?: {
        plannedStartDate?: string;
        latestLogAt?: string;
        latestLogTitle?: string;
        unhandledRiskCount?: number;
    };
}

export interface QuoteListItem {
    id: number;
    standardItemId: number;
    quantityBaseItemId?: number;
    lineNo: number;
    name: string;
    unit: string;
    quantity: number;
    baselineQuantity?: number;
    pricingNote?: string;
    categoryL1?: string;
    categoryL2?: string;
    sortOrder?: number;
    sourceType?: string;
    sourceStage?: string;
    quantityAdjustableFlag?: boolean;
    matchedStandardItemId?: number;
    missingMappingFlag?: boolean;
    extensionsJson?: string;
    required?: boolean;
}

export interface QuoteInvitation {
    id: number;
    quoteListId: number;
    providerId: number;
    status: string;
    invitedAt?: string;
    respondedAt?: string;
}

export interface QuantityBaseSnapshot {
    id: number;
    proposalId?: number;
    proposalVersion?: number;
    ownerUserId?: number;
    designerProviderId?: number;
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

export interface QuotePriceBookItem {
    id: number;
    standardItemId: number;
    standardCode?: string;
    standardItemName?: string;
    categoryL1?: string;
    categoryL2?: string;
    unit: string;
    unitPriceCent: number;
    minChargeCent: number;
    remark?: string;
    status: number;
    required?: boolean;
}

export interface QuotePriceBookDetail {
    book: {
        id: number;
        providerId: number;
        status: string;
        version: number;
        effectiveFrom?: string;
        effectiveTo?: string;
        remark?: string;
    };
    items: QuotePriceBookItem[];
}

export interface QuoteTaskValidationResult {
    ok: boolean;
    status: string;
    missingFields: string[];
}

export interface RecommendedForeman {
    providerId: number;
    providerName: string;
    providerType: number;
    providerSubType: string;
    regionMatched: boolean;
    workTypeMatched: boolean;
    acceptBooking: boolean;
    priceCoverageRate: number;
    matchedItemCount: number;
    missingItemCount: number;
    reasons: string[];
}

export interface QuoteComparisonSubmission {
    submissionId: number;
    providerId: number;
    providerName: string;
    providerType: number;
    providerSubType: string;
    status: string;
    reviewStatus?: string;
    totalCent: number;
    missingItemIds: number[];
    abnormalItemIds: number[];
    categoryTotals: Array<{ category: string; totalCent: number }>;
}

export interface QuotePaymentPlanSummary {
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
}

export interface QuoteComparisonResponse {
    quoteList: QuoteListSummary;
    items: QuoteListItem[];
    submissions: QuoteComparisonSubmission[];
    paymentPlanSummary?: QuotePaymentPlanSummary[];
    businessStage?: string;
    flowSummary?: string;
    availableActions?: string[];
    baselineStatus?: string;
    baselineSubmittedAt?: string;
    constructionSubjectType?: string;
    constructionSubjectId?: number;
    constructionSubjectDisplayName?: string;
    kickoffStatus?: string;
    plannedStartDate?: string;
    supervisorSummary?: {
        plannedStartDate?: string;
        latestLogAt?: string;
        latestLogTitle?: string;
        unhandledRiskCount?: number;
    };
}

export interface QuoteSubmissionRevisionItem {
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
    remark?: string;
}

export interface QuoteSubmissionRevisionRecord {
    id: number;
    quoteSubmissionId: number;
    quoteListId: number;
    providerId: number;
    revisionNo: number;
    action: string;
    previousStatus: string;
    nextStatus: string;
    previousTotalCent: number;
    nextTotalCent: number;
    changeReason?: string;
    createdAt: string;
    previousItems: QuoteSubmissionRevisionItem[];
    nextItems: QuoteSubmissionRevisionItem[];
}

export interface AdminQuoteListDetail {
    quoteList: QuoteListSummary;
    items: QuoteListItem[];
    invitations: QuoteInvitation[];
    submissionCount: number;
    quantityBase?: QuantityBaseSnapshot;
    quantityItems: QuantityBaseItemSnapshot[];
    businessStage?: string;
    flowSummary?: string;
    availableActions?: string[];
    baselineStatus?: string;
    baselineSubmittedAt?: string;
    constructionSubjectType?: string;
    constructionSubjectId?: number;
    constructionSubjectDisplayName?: string;
    kickoffStatus?: string;
    plannedStartDate?: string;
    supervisorSummary?: {
        plannedStartDate?: string;
        latestLogAt?: string;
        latestLogTitle?: string;
        unhandledRiskCount?: number;
    };
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
    listCategories: async () =>
        unwrapEnvelope<{ list: QuoteCategory[] }>(
            await api.get('/admin/quote-categories'),
            '获取报价类目失败'
        ),
    createCategory: async (payload: { code?: string; name: string; parentId?: number; sortOrder?: number; status?: number }) =>
        unwrapEnvelope<QuoteCategory>(
            await api.post('/admin/quote-categories', payload),
            '创建报价类目失败'
        ),
    deleteCategory: async (id: number) =>
        unwrapEnvelope<{ id: number }>(
            await api.delete(`/admin/quote-categories/${id}`),
            '删除报价类目失败'
        ),
    importLibrary: async (filePath?: string) =>
        unwrapEnvelope<{ imported: number; updated: number; skipped: number; filePath: string }>(
            await api.post('/admin/quote-library/import', filePath ? { filePath } : {}),
            '导入报价库失败'
        ),
    importLibraryPreview: async (filePath?: string) =>
        unwrapEnvelope<{ rows: ERPQuoteRow[]; filePath: string; total: number }>(
            await api.post('/admin/quote-library/import-preview', filePath ? { filePath } : {}),
            '预览导入失败'
        ),
    listLibraryItems: async (params?: { page?: number; pageSize?: number; keyword?: string; categoryL1?: string; categoryId?: number; status?: number }) =>
        unwrapEnvelope<{ list: QuoteLibraryItem[]; total: number; page: number; pageSize: number }>(
            await api.get('/admin/quote-library/items', { params }),
            '获取报价库失败'
        ),
    createLibraryItem: async (payload: {
        categoryId?: number;
        standardCode?: string;
        erpItemCode?: string;
        name: string;
        unit: string;
        referencePriceCent?: number;
        pricingNote?: string;
        required?: boolean;
        status?: number;
        keywords?: string[];
        erpMapping?: unknown;
        sourceMeta?: unknown;
    }) =>
        unwrapEnvelope<QuoteLibraryItem>(
            await api.post('/admin/quote-library/items', payload),
            '创建标准项失败'
        ),
    deleteLibraryItem: async (id: number) =>
        unwrapEnvelope<{ id: number }>(
            await api.delete(`/admin/quote-library/items/${id}`),
            '删除标准项失败'
        ),
    updateLibraryItem: async (id: number, payload: {
        categoryId?: number;
        standardCode?: string;
        erpItemCode?: string;
        name: string;
        unit: string;
        referencePriceCent?: number;
        pricingNote?: string;
        required?: boolean;
        status?: number;
        keywords?: string[];
        erpMapping?: unknown;
        sourceMeta?: unknown;
    }) =>
        unwrapEnvelope<QuoteLibraryItem>(
            await api.put(`/admin/quote-library/items/${id}`, payload),
            '更新标准项失败'
        ),
    getProviderPriceBook: async (providerId: number) =>
        unwrapEnvelope<QuotePriceBookDetail>(
            await api.get(`/admin/providers/${providerId}/price-book`),
            '获取施工主体价格库失败'
        ),
    listQuoteLists: async (params?: { page?: number; pageSize?: number; keyword?: string; status?: string }) =>
        unwrapEnvelope<{ list: QuoteListSummary[]; total: number; page: number; pageSize: number }>(
            await api.get('/admin/quote-lists', { params }),
            '获取报价清单失败'
        ),
    listQuoteTasks: async (params?: { page?: number; pageSize?: number; keyword?: string; status?: string }) =>
        unwrapEnvelope<{ list: QuoteListSummary[]; total: number; page: number; pageSize: number }>(
            await api.get('/admin/quote-tasks', { params }),
            '获取报价任务失败'
        ),
    getQuoteListDetail: async (id: number) =>
        unwrapEnvelope<AdminQuoteListDetail>(
            await api.get(`/admin/quote-lists/${id}`),
            '获取报价清单详情失败'
        ),
    getQuoteTaskDetail: async (id: number) =>
        unwrapEnvelope<AdminQuoteListDetail>(
            await api.get(`/admin/quote-tasks/${id}`),
            '获取报价任务详情失败'
        ),
    createQuoteList: async (payload: {
        projectId?: number;
        proposalId?: number;
        proposalVersion?: number;
        designerProviderId?: number;
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
    updateTaskPrerequisites: async (quoteTaskId: number, payload: {
        area?: number;
        layout?: string;
        renovationType?: string;
        constructionScope?: string;
        serviceAreas?: string[];
        workTypes?: string[];
        houseUsage?: string;
        notes?: string;
    }) =>
        unwrapEnvelope<QuoteListSummary>(
            await api.put(`/admin/quote-tasks/${quoteTaskId}/prerequisites`, payload),
            '更新报价前置数据失败'
        ),
    validateTaskPrerequisites: async (quoteTaskId: number) =>
        unwrapEnvelope<QuoteTaskValidationResult>(
            await api.post(`/admin/quote-tasks/${quoteTaskId}/validate-prerequisites`),
            '校验报价前置数据失败'
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
    recommendForemen: async (quoteTaskId: number) =>
        unwrapEnvelope<{ list: RecommendedForeman[] }>(
            await api.post(`/admin/quote-tasks/${quoteTaskId}/recommend-foremen`),
            '推荐施工主体失败'
        ),
    selectForemen: async (quoteTaskId: number, providerIds: number[]) =>
        unwrapEnvelope<{ invitations: QuoteInvitation[] }>(
            await api.post(`/admin/quote-tasks/${quoteTaskId}/select-foremen`, { providerIds }),
            '选择施工主体失败'
        ),
    generateDrafts: async (quoteTaskId: number) =>
        unwrapEnvelope<QuoteComparisonResponse>(
            await api.post(`/admin/quote-tasks/${quoteTaskId}/generate-drafts`),
            '生成报价草稿失败'
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
    getTaskComparison: async (quoteTaskId: number) =>
        unwrapEnvelope<QuoteComparisonResponse>(
            await api.get(`/admin/quote-tasks/${quoteTaskId}/comparison`),
            '获取报价任务对比失败'
        ),
    getSubmissionRevisions: async (submissionId: number) =>
        unwrapEnvelope<{ list: QuoteSubmissionRevisionRecord[] }>(
            await api.get(`/admin/quote-submissions/${submissionId}/revisions`),
            '获取报价改动历史失败'
        ),
    reviewSubmission: async (submissionId: number, payload: { approved: boolean; reason?: string }) =>
        unwrapEnvelope<{ reviewStatus: string }>(
            await api.post(`/admin/quote-submissions/${submissionId}/review`, payload),
            '更新报价复核失败'
        ),
    submitTaskToUser: async (quoteTaskId: number, submissionId: number) =>
        unwrapEnvelope<QuoteListSummary>(
            await api.post(`/admin/quote-tasks/${quoteTaskId}/submit-to-user`, { submissionId }),
            '提交用户确认失败'
        ),
    requoteTask: async (quoteTaskId: number) =>
        unwrapEnvelope<QuoteListSummary>(
            await api.post(`/admin/quote-tasks/${quoteTaskId}/requote`),
            '发起重报价失败'
        ),
    awardQuote: async (quoteListId: number, submissionId: number) =>
        unwrapEnvelope<QuoteListSummary>(
            await api.post(`/admin/quote-lists/${quoteListId}/award`, { submissionId }),
            '定标失败'
        ),

    // Price Tier 阶梯价
    listPriceTiers: async (libraryItemId: number) =>
        unwrapEnvelope<{ tiers: QuotePriceTier[] }>(
            await api.get(`/admin/quote-library/items/${libraryItemId}/tiers`),
            '获取阶梯价失败'
        ),
    createPriceTier: async (payload: { libraryItemId: number; tierKey: string; tierLabel: string; conditionJson?: string; sortOrder?: number }) =>
        unwrapEnvelope<QuotePriceTier>(
            await api.post('/admin/quote-price-tiers', payload),
            '创建阶梯价失败'
        ),
    updatePriceTier: async (id: number, payload: Partial<QuotePriceTier>) =>
        unwrapEnvelope<{ id: number }>(
            await api.put(`/admin/quote-price-tiers/${id}`, payload),
            '更新阶梯价失败'
        ),
    deletePriceTier: async (id: number) =>
        unwrapEnvelope<{ id: number }>(
            await api.delete(`/admin/quote-price-tiers/${id}`),
            '删除阶梯价失败'
        ),

    // 报价模板
    listTemplates: async (params?: { roomType?: string; renovationType?: string }) =>
        unwrapEnvelope<{ list: QuoteTemplate[] }>(
            await api.get('/admin/quote-templates', { params }),
            '获取报价模板失败'
        ),
    getTemplateDetail: async (id: number) =>
        unwrapEnvelope<{ template: QuoteTemplate; items: QuoteTemplateItem[] }>(
            await api.get(`/admin/quote-templates/${id}`),
            '获取模板详情失败'
        ),
    createTemplate: async (payload: { name: string; roomType?: string; renovationType?: string; description?: string }) =>
        unwrapEnvelope<QuoteTemplate>(
            await api.post('/admin/quote-templates', payload),
            '创建报价模板失败'
        ),
    updateTemplate: async (id: number, payload: Partial<QuoteTemplate>) =>
        unwrapEnvelope<{ id: number }>(
            await api.put(`/admin/quote-templates/${id}`, payload),
            '更新报价模板失败'
        ),
    batchUpsertTemplateItems: async (templateId: number, items: Array<{ libraryItemId: number; defaultQuantity?: number; sortOrder?: number; required?: boolean }>) =>
        unwrapEnvelope<{ templateId: number }>(
            await api.post(`/admin/quote-templates/${templateId}/items`, { items }),
            '保存模板项目失败'
        ),
    ensureTemplate: async (payload: { roomType?: string; renovationType?: string; repair?: boolean }) =>
        unwrapEnvelope<QuoteTemplateEnsureResult>(
            await api.post('/admin/quote-templates/ensure', payload),
            '生成施工报价模板失败'
        ),

    // 模板导入 & 智能计算
    applyTemplate: async (quoteTaskId: number, templateId: number) =>
        unwrapEnvelope<{ items: QuoteListItem[] }>(
            await api.post(`/admin/quote-tasks/${quoteTaskId}/apply-template`, { templateId }),
            '应用模板失败'
        ),
    autoCalculateQuantities: async (quoteTaskId: number) =>
        unwrapEnvelope<{ suggestions: QuantitySuggestion[] }>(
            await api.post(`/admin/quote-tasks/${quoteTaskId}/auto-calculate`),
            '智能计算数量失败'
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
