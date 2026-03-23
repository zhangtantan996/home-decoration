import api from './api';

const merchantApi = api;

export interface ApiEnvelope<T> {
    code: number;
    message?: string;
    data?: T;
}

export class MerchantApiError<T = unknown> extends Error {
    code: number;
    data?: T;

    constructor(code: number, message: string, data?: T) {
        super(message);
        this.name = 'MerchantApiError';
        this.code = code;
        this.data = data;
    }
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

const unwrapData = <T,>(payload: unknown, fallbackMessage: string): T => {
    const envelope = unwrapEnvelope<T>(payload);
    if (envelope.code !== 0) {
        throw new MerchantApiError(envelope.code, envelope.message || fallbackMessage, envelope.data);
    }
    return (envelope.data as T) ?? ({} as T);
};

export type MerchantApplicantType = 'personal' | 'studio' | 'company' | 'foreman';
export type MerchantProviderSubType = 'designer' | 'company' | 'foreman';
export type MerchantKind = 'provider' | 'material_shop';
export type MerchantRole = 'designer' | 'foreman' | 'company' | 'material_shop';
export type MerchantEntityType = 'personal' | 'company' | 'individual_business';
export type MerchantLoginNextAction = 'APPLY' | 'PENDING' | 'RESUBMIT' | 'CHANGE_ROLE' | 'REAPPLY';

export interface MerchantLoginApplyStatus {
    kind?: MerchantKind;
    applicationId?: number;
    status?: number;
    rejectReason?: string;
    role?: MerchantRole;
    entityType?: MerchantEntityType;
    applicantType?: MerchantApplicantType;
}

export interface MerchantLoginGuideData {
    nextAction: MerchantLoginNextAction;
    applyStatus?: MerchantLoginApplyStatus;
}

export interface MerchantProviderSession {
    id: number;
    name: string;
    avatar?: string;
    providerType: number;
    merchantKind?: MerchantKind;
    role?: MerchantRole;
    entityType?: MerchantEntityType;
    applicantType?: MerchantApplicantType;
    providerSubType?: MerchantProviderSubType;
    phone: string;
    verified: boolean;
}

export interface MerchantLoginData {
    token: string;
    merchantKind?: MerchantKind;
    role?: MerchantRole;
    entityType?: MerchantEntityType;
    provider: MerchantProviderSession;
    tinodeToken?: string;
}

export interface MerchantProviderInfo {
    id: number;
    sourceApplicationId?: number;
    name: string;
    avatar?: string;
    providerType: number;
    merchantKind?: MerchantKind;
    role?: MerchantRole;
    entityType?: MerchantEntityType;
    applicantType?: MerchantApplicantType;
    providerSubType?: MerchantProviderSubType;
    companyName: string;
    rating: number;
    completedCnt: number;
    verified: boolean;
    yearsExperience: number;
    specialty: string[];
    highlightTags?: string[];
    pricing?: Record<string, number>;
    graduateSchool?: string;
    designPhilosophy?: string;
    serviceArea: string[];
    serviceAreaCodes?: string[];
    introduction: string;
    teamSize: number;
    officeAddress: string;
    companyAlbum?: string[];
    surveyDepositPrice?: number;
}

export interface MerchantServiceSetting {
    acceptBooking: boolean;
    autoConfirmHours: number;
    responseTimeDesc: string;
    priceRangeMin: number;
    priceRangeMax: number;
    serviceStyles: string[];
    servicePackages: Array<Record<string, unknown>>;
    surveyDepositAmount?: number;
    designPaymentMode?: string;
}

// 商家认证
export const merchantAuthApi = {
    login: async (data: { phone: string; code: string }) =>
        unwrapData<MerchantLoginData>(await merchantApi.post('/merchant/login', data), '登录失败'),
    getInfo: async () =>
        unwrapData<MerchantProviderInfo>(await merchantApi.get('/merchant/info'), '获取商家信息失败'),
    updateInfo: async (data: Record<string, unknown>) =>
        unwrapData<{ status?: string }>(await merchantApi.put('/merchant/info', data), '更新商家信息失败'),
    sendCode: async (
        phone: string,
        purpose: 'login' | 'register' | 'merchant_withdraw' | 'merchant_bank_bind' | 'identity_apply' = 'login',
        captchaToken?: string,
    ) =>
        unwrapData<{ expiresIn?: number; requestId?: string; debugCode?: string; debugOnly?: boolean }>(
            await merchantApi.post('/auth/send-code', { phone, purpose, captchaToken }),
            '发送验证码失败'
        ),
    getServiceSettings: async () =>
        unwrapData<MerchantServiceSetting>(await merchantApi.get('/merchant/service-settings'), '获取服务设置失败'),
    updateServiceSettings: async (data: MerchantServiceSetting) =>
        unwrapData<{ status?: string }>(await merchantApi.put('/merchant/service-settings', data), '更新服务设置失败'),
};

export interface MerchantPortfolioCase {
    title: string;
    description: string;
    images: string[];
    category?: 'water' | 'electric' | 'wood' | 'masonry' | 'paint' | 'other';
    style?: string;
    area?: string;
}

export interface BusinessHoursRange {
    day: number;
    start: string;
    end: string;
}

export interface MerchantLegalAcceptancePayload {
    accepted: boolean;
    onboardingAgreementVersion: string;
    platformRulesVersion: string;
    privacyDataProcessingVersion: string;
}

export interface OnboardingValidateLicensePayload {
    licenseNo: string;
    companyName?: string;
}

export interface OnboardingValidateIdCardPayload {
    idNo: string;
    realName: string;
}

export interface OnboardingValidateResult {
    ok: boolean;
    message?: string;
    normalizedValue?: string;
}

export interface MerchantApplyPayload {
    phone: string;
    code: string;
    verificationToken?: string;
    resubmitToken?: string;
    role: Exclude<MerchantRole, 'material_shop'>;
    entityType: Exclude<MerchantEntityType, 'individual_business'>;
    applicantType?: MerchantApplicantType; // 兼容旧接口
    realName: string;
    avatar: string;
    idCardNo: string;
    idCardFront: string;
    idCardBack: string;
    companyName?: string;
    licenseNo?: string;
    licenseImage?: string;
    legalPersonName?: string;
    legalPersonIdCardNo?: string;
    legalPersonIdCardFront?: string;
    legalPersonIdCardBack?: string;
    teamSize?: number;
    officeAddress: string;
    yearsExperience?: number;
    highlightTags?: string[];
    pricing?: Record<string, number>;
    graduateSchool?: string;
    designPhilosophy?: string;
    serviceArea: string[];
    styles?: string[];
    introduction?: string;
    companyAlbum?: string[];
    portfolioCases: MerchantPortfolioCase[];
    legalAcceptance: MerchantLegalAcceptancePayload;
}

export interface MerchantApplyStatusData {
    applicationId: number;
    role?: Exclude<MerchantRole, 'material_shop'>;
    entityType?: Exclude<MerchantEntityType, 'individual_business'>;
    applicantType?: MerchantApplicantType;
    status: number;
    statusText: string;
    rejectReason?: string;
    createdAt: string;
    auditedAt?: string;
}

export interface OnboardingVerifyPhonePayload {
    phone: string;
    code: string;
    merchantKind: MerchantKind;
    mode: 'apply' | 'resubmit';
    applicationId?: number;
    allowReapply?: boolean;
}

export interface OnboardingVerifyPhoneResponse<TForm = unknown> {
    ok: boolean;
    verificationToken: string;
    verifiedPhone: string;
    expiresAt: string;
    merchantKind?: MerchantKind;
    rejectReason?: string;
    resubmitEditable?: Record<string, boolean>;
    form?: TForm;
}

export interface MerchantApplyDetailData extends MerchantApplyStatusData {
    phone?: string;
    realName?: string;
    avatar?: string;
    idCardNo?: string;
    idCardFront?: string;
    idCardBack?: string;
    companyName?: string;
    licenseNo?: string;
    licenseImage?: string;
    legalPersonName?: string;
    legalPersonIdCardNo?: string;
    legalPersonIdCardFront?: string;
    legalPersonIdCardBack?: string;
    teamSize?: number;
    officeAddress?: string;
    yearsExperience?: number;
    highlightTags?: string[];
    pricing?: Record<string, number>;
    graduateSchool?: string;
    designPhilosophy?: string;
    serviceArea?: string[];
    serviceAreaCodes?: string[];
    styles?: string[];
    introduction?: string;
    companyAlbum?: string[];
    portfolioCases?: MerchantPortfolioCase[];
}

export interface ResubmitEditableMap {
    phone?: boolean;
    role?: boolean;
    merchantKind?: boolean;
}

export interface MerchantApplyDetailForResubmitData {
    applicationId: number;
    merchantKind: 'provider';
    resubmitToken: string;
    rejectReason?: string;
    resubmitEditable?: ResubmitEditableMap;
    form: MerchantApplyDetailData;
}

export interface ResubmitDetailRequestPayload {
    phone: string;
    code: string;
}

export const merchantApplyApi = {
    apply: async (data: MerchantApplyPayload) =>
        unwrapData<{ applicationId: number; message?: string }>(await merchantApi.post('/merchant/apply', data), '提交申请失败'),
    status: async (phone: string) =>
        unwrapData<MerchantApplyStatusData>(await merchantApi.get(`/merchant/apply/${encodeURIComponent(phone)}/status`), '查询申请状态失败'),
    detail: async (id: number, data: ResubmitDetailRequestPayload) =>
        unwrapData<MerchantApplyDetailForResubmitData>(await merchantApi.post(`/merchant/apply/${id}/detail-for-resubmit`, data), '获取申请详情失败'),
    resubmit: async (id: number, data: MerchantApplyPayload) =>
        unwrapData<{ applicationId: number; message?: string }>(await merchantApi.post(`/merchant/apply/${id}/resubmit`, data), '重新提交申请失败'),
};

export interface MaterialShopApplyProductPayload {
    name: string;
    unit: string;
    description: string;
    price: number;
    images: string[];
}

export interface MaterialShopApplyPayload {
    phone: string;
    code: string;
    verificationToken?: string;
    resubmitToken?: string;
    entityType: 'company' | 'individual_business';
    avatar: string;
    shopName: string;
    shopDescription?: string;
    companyName: string;
    businessLicenseNo: string;
    businessLicense: string;
    legalPersonName: string;
    legalPersonIdCardNo: string;
    legalPersonIdCardFront: string;
    legalPersonIdCardBack: string;
    businessHours: string;
    businessHoursRanges: BusinessHoursRange[];
    contactPhone: string;
    contactName?: string;
    address: string;
    products: MaterialShopApplyProductPayload[];
    legalAcceptance: MerchantLegalAcceptancePayload;
}

export interface MaterialShopApplyStatusData {
    applicationId: number;
    merchantKind: 'material_shop';
    role: 'material_shop';
    entityType: 'company' | 'individual_business';
    status: number;
    statusText: string;
    rejectReason?: string;
    productCount?: number;
    createdAt: string;
    auditedAt?: string;
}

export interface MaterialShopApplyDetailData extends MaterialShopApplyStatusData {
    phone?: string;
    avatar?: string;
    shopName?: string;
    shopDescription?: string;
    companyName?: string;
    businessLicenseNo?: string;
    businessLicense?: string;
    legalPersonName?: string;
    legalPersonIdCardNo?: string;
    legalPersonIdCardFront?: string;
    legalPersonIdCardBack?: string;
    businessHours?: string;
    businessHoursRanges?: BusinessHoursRange[];
    contactPhone?: string;
    contactName?: string;
    address?: string;
    products?: MaterialShopApplyProductPayload[];
}

export interface MaterialShopApplyDetailForResubmitData {
    applicationId: number;
    merchantKind: 'material_shop';
    resubmitToken: string;
    rejectReason?: string;
    resubmitEditable?: ResubmitEditableMap;
    form: MaterialShopApplyDetailData;
}

export const onboardingValidationApi = {
    validateLicense: async (data: OnboardingValidateLicensePayload) =>
        unwrapData<OnboardingValidateResult>(await merchantApi.post('/merchant/onboarding/validate-license', data), '营业执照号校验失败'),
    validateIdCard: async (data: OnboardingValidateIdCardPayload) =>
        unwrapData<OnboardingValidateResult>(await merchantApi.post('/merchant/onboarding/validate-id-card', data), '身份证号校验失败'),
    verifyPhone: async <TForm = unknown>(data: OnboardingVerifyPhonePayload) =>
        unwrapData<OnboardingVerifyPhoneResponse<TForm>>(await merchantApi.post('/merchant/onboarding/verify-phone', data), '手机号验证码校验失败'),
};

export const materialShopApplyApi = {
    apply: async (data: MaterialShopApplyPayload) =>
        unwrapData<{ applicationId: number; message?: string }>(await merchantApi.post('/material-shop/apply', data), '提交主材商入驻失败'),
    status: async (phone: string) =>
        unwrapData<MaterialShopApplyStatusData>(await merchantApi.get(`/material-shop/apply/${encodeURIComponent(phone)}/status`), '查询主材商申请状态失败'),
    detail: async (id: number, data: ResubmitDetailRequestPayload) =>
        unwrapData<MaterialShopApplyDetailForResubmitData>(await merchantApi.post(`/material-shop/apply/${id}/detail-for-resubmit`, data), '获取主材商申请详情失败'),
    resubmit: async (id: number, data: MaterialShopApplyPayload) =>
        unwrapData<{ applicationId: number; message?: string }>(await merchantApi.post(`/material-shop/apply/${id}/resubmit`, data), '重新提交主材商申请失败'),
};

export interface MaterialShopProfile {
    id: number;
    sourceApplicationId?: number;
    merchantKind: 'material_shop';
    entityType: 'company' | 'individual_business';
    avatar?: string;
    shopName: string;
    shopDescription?: string;
    companyName?: string;
    businessLicenseNo?: string;
    businessLicense?: string;
    legalPersonName?: string;
    businessHours?: string;
    businessHoursRanges?: BusinessHoursRange[];
    contactPhone?: string;
    contactName?: string;
    address?: string;
    serviceArea?: string[];
    mainBrands?: string[];
    mainCategories?: string[];
    deliveryCapability?: string;
    installationCapability?: string;
    afterSalesPolicy?: string;
    invoiceCapability?: string;
    isVerified?: boolean;
}

export interface MaterialShopProduct {
    id: number;
    name: string;
    unit: string;
    description: string;
    price: number;
    images: string[];
    coverImage?: string;
    status?: number;
    sortOrder?: number;
    createdAt?: string;
    updatedAt?: string;
}

export const materialShopCenterApi = {
    getMe: async () =>
        unwrapData<MaterialShopProfile>(await merchantApi.get('/material-shop/me'), '获取主材商资料失败'),
    updateMe: async (data: Partial<MaterialShopProfile>) =>
        unwrapData<{ status?: string }>(await merchantApi.put('/material-shop/me', data), '更新主材商资料失败'),
    getServiceSettings: async () =>
        unwrapData<MerchantServiceSetting>(await merchantApi.get('/material-shop/service-settings'), '获取主材商服务设置失败'),
    updateServiceSettings: async (data: MerchantServiceSetting) =>
        unwrapData<{ status?: string }>(await merchantApi.put('/material-shop/service-settings', data), '更新主材商服务设置失败'),
    listProducts: async () =>
        unwrapData<{ list: MaterialShopProduct[]; total: number }>(await merchantApi.get('/material-shop/me/products'), '获取主材商商品失败'),
    createProduct: async (data: Omit<MaterialShopProduct, 'id'>) =>
        unwrapData<{ id: number; message?: string }>(await merchantApi.post('/material-shop/me/products', data), '创建主材商商品失败'),
    updateProduct: async (id: number, data: Omit<MaterialShopProduct, 'id'>) =>
        unwrapData<{ message?: string }>(await merchantApi.put(`/material-shop/me/products/${id}`, data), '更新主材商商品失败'),
    deleteProduct: async (id: number) =>
        unwrapData<{ message?: string }>(await merchantApi.delete(`/material-shop/me/products/${id}`), '删除主材商商品失败'),
};

export interface MerchantUploadResult {
    url: string;
    path?: string;
    thumbnailUrl?: string;
    thumbnailPath?: string;
    width?: number;
    height?: number;
}

// 文件上传
export const merchantUploadApi = {
    uploadImage: (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        return merchantApi.post('/merchant/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 60000,
        });
    },
    uploadImageData: async (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        return unwrapData<MerchantUploadResult>(
            await merchantApi.post('/merchant/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 60000,
            }),
            '上传失败'
        );
    },
    uploadAvatarData: async (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        return unwrapData<MerchantUploadResult>(
            await merchantApi.post('/merchant/avatar', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 60000,
            }),
            '头像上传失败'
        );
    },
    uploadOnboardingImageData: async (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        return unwrapData<MerchantUploadResult>(
            await merchantApi.post('/merchant/upload-public', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 60000,
            }),
            '上传失败'
        );
    },
};

// 预约管理
export const merchantBookingApi = {
    list: () => merchantApi.get('/merchant/bookings'),
    detail: (id: number) => merchantApi.get(`/merchant/bookings/${id}`),
    handle: (id: number, action: 'confirm' | 'reject') => merchantApi.put(`/merchant/bookings/${id}/handle`, { action }),
};

export interface MerchantSiteSurveyPayload {
    photos: string[];
    dimensions: Record<string, { length?: number; width?: number; height?: number; unit?: string }>;
    notes: string;
}
export interface MerchantSiteSurveySummary extends MerchantSiteSurveyPayload {
    status: 'submitted' | 'confirmed' | 'revision_requested';
    submittedAt?: string;
    confirmedAt?: string;
    revisionRequestedAt?: string;
    revisionRequestReason?: string;
}

export const merchantSiteSurveyApi = {
    get: (bookingId: number) => unwrapData<{ siteSurvey: MerchantSiteSurveySummary | null }>(
        merchantApi.get(`/merchant/bookings/${bookingId}/site-survey`),
        '获取量房记录失败'
    ),
    submit: async (bookingId: number, payload: MerchantSiteSurveyPayload) =>
        unwrapData<{ siteSurvey: MerchantSiteSurveySummary }>(
            await merchantApi.post(`/merchant/bookings/${bookingId}/site-survey`, payload),
            '提交量房记录失败'
        ),
};

export interface MerchantBudgetConfirmPayload {
    budgetMin: number;
    budgetMax: number;
    includes: Record<'design_fee' | 'construction_fee' | 'material_fee' | 'furniture_fee', boolean>;
    notes: string;
    designIntent: string;
}
export interface MerchantBudgetSummary extends MerchantBudgetConfirmPayload {
    status: 'submitted' | 'accepted' | 'rejected';
    submittedAt?: string;
    acceptedAt?: string;
    rejectedAt?: string;
    rejectionReason?: string;
}

export const merchantBudgetApi = {
    get: (bookingId: number) => unwrapData<{ budgetConfirmation: MerchantBudgetSummary | null }>(
        merchantApi.get(`/merchant/bookings/${bookingId}/budget-confirm`),
        '获取预算确认失败'
    ),
    submit: async (bookingId: number, payload: MerchantBudgetConfirmPayload) =>
        unwrapData<{ budgetConfirmation: MerchantBudgetSummary }>(
            await merchantApi.post(`/merchant/bookings/${bookingId}/budget-confirm`, payload),
            '提交预算确认失败'
        ),
};

// 方案管理
export const merchantProposalApi = {
    list: () => merchantApi.get('/merchant/proposals'),
    detail: (id: number) => merchantApi.get(`/merchant/proposals/${id}`),
    submit: (data: {
        sourceType?: 'booking' | 'demand';
        bookingId?: number;
        demandMatchId?: number;
        summary: string;
        designFee: number;
        constructionFee: number;
        materialFee: number;
        estimatedDays: number;
        attachments?: string;
    }) => merchantApi.post('/merchant/proposals', data),
    update: (id: number, data: {
        sourceType?: 'booking' | 'demand';
        bookingId?: number;
        demandMatchId?: number;
        summary: string;
        designFee: number;
        constructionFee: number;
        materialFee: number;
        estimatedDays: number;
        attachments?: string;
    }) => merchantApi.put(`/merchant/proposals/${id}`, data),
    cancel: (id: number) => merchantApi.delete(`/merchant/proposals/${id}`),
    reopen: (id: number) => merchantApi.post(`/merchant/proposals/${id}/reopen`),
    // 重新提交方案（生成新版本）
    resubmit: (data: {
        proposalId: number;
        summary: string;
        designFee: number;
        constructionFee: number;
        materialFee: number;
        estimatedDays: number;
        attachments?: string;
    }) => merchantApi.post('/merchant/proposals/resubmit', data),
    // 获取拒绝信息
    getRejectionInfo: (id: number) => merchantApi.get(`/merchant/proposals/${id}/rejection-info`),
};

export interface MerchantLeadDemandSummary {
    id: number;
    demandType: string;
    title: string;
    city: string;
    district: string;
    area: number;
    budgetMin: number;
    budgetMax: number;
    timeline: string;
    status: string;
    matchedCount: number;
    maxMatch: number;
    reviewNote: string;
    closedReason: string;
    createdAt: string;
    updatedAt: string;
}

export interface MerchantLeadAttachment {
    url: string;
    name: string;
    size: number;
}

export interface MerchantLeadItem {
    id: number;
    status: string;
    assignedAt?: string;
    responseDeadline?: string;
    respondedAt?: string;
    declineReason?: string;
    proposalId?: number;
    demand: MerchantLeadDemandSummary;
    attachments: MerchantLeadAttachment[];
}

export const merchantLeadApi = {
    list: async (params?: { status?: string; page?: number; pageSize?: number }) =>
        unwrapData<MerchantIncomeListData<MerchantLeadItem>>(await merchantApi.get('/merchant/leads', { params }), '获取线索列表失败'),
    accept: async (id: number) =>
        unwrapData<{ id: number; status: string }>(await merchantApi.post(`/merchant/leads/${id}/accept`), '接受线索失败'),
    decline: async (id: number, reason: string) =>
        unwrapData<{ id: number; status: string; declineReason?: string }>(await merchantApi.post(`/merchant/leads/${id}/decline`, { reason }), '拒绝线索失败'),
};

export interface MerchantComplaintItem {
    id: number;
    projectId: number;
    category: string;
    title: string;
    description: string;
    status: string;
    resolution?: string;
    merchantResponse?: string;
    freezePayment?: boolean;
    createdAt: string;
    updatedAt?: string;
}

export const merchantComplaintApi = {
    list: async () =>
        unwrapData<MerchantComplaintItem[]>(await merchantApi.get('/merchant/complaints'), '获取投诉列表失败'),
    respond: async (id: number, response: string) =>
        unwrapData<MerchantComplaintItem>(await merchantApi.post(`/merchant/complaints/${id}/respond`, { response }), '提交投诉回应失败'),
};

export interface MerchantContractPayload {
    projectId?: number;
    demandId?: number;
    userId?: number;
    title: string;
    totalAmount: number;
    paymentPlan: Array<Record<string, unknown>>;
    attachmentUrls?: string[];
    termsSnapshot?: Record<string, unknown>;
}

export interface MerchantContractRecord {
    id: number;
    contractNo: string;
    status: string;
    title: string;
    totalAmount: number;
    projectId?: number;
    demandId?: number;
    userId?: number;
    paymentPlan?: string;
    attachmentUrls?: string;
    confirmedAt?: string | null;
}

export const merchantContractApi = {
    create: async (data: MerchantContractPayload) =>
        unwrapData<MerchantContractRecord>(await merchantApi.post('/contracts', data), '创建合同失败'),
};

export interface MerchantProjectMilestone {
    id: number;
    name: string;
    seq: number;
    amount: number;
    percentage: number;
    status: number;
    criteria?: string;
    rejectionReason?: string;
    submittedAt?: string | null;
    acceptedAt?: string | null;
}

export interface MerchantProjectLog {
    id: number;
    title?: string;
    description?: string;
    logDate?: string;
    photos?: string;
}

export interface MerchantCreateProjectLogPayload {
    title: string;
    description?: string;
    photos?: string;
    logDate?: string;
}

export interface MerchantStartProjectPayload {
    startDate?: string;
}

export interface MerchantProjectExecutionDetail {
    id: number;
    name: string;
    address?: string;
    currentPhase?: string;
    status?: number;
    businessStage?: string;
    flowSummary?: string;
    availableActions?: string[];
    ownerName?: string;
    providerName?: string;
    budget?: number;
    milestones: MerchantProjectMilestone[];
    recentLogs?: MerchantProjectLog[];
    completedPhotos?: string[];
    completionNotes?: string;
    completionSubmittedAt?: string | null;
    completionRejectedAt?: string | null;
    completionRejectionReason?: string;
}

export interface MerchantProjectDisputeDetail {
    projectId: number;
    projectName?: string;
    businessStage?: string;
    flowSummary?: string;
    disputeReason?: string;
    disputeEvidence?: string[];
    complaintId?: number;
    complaintStatus?: string;
    merchantResponse?: string;
    auditStatus?: string;
    escrowFrozen?: boolean;
}

export interface MerchantProjectListParams {
    page?: number;
    pageSize?: number;
    keyword?: string;
    businessStage?: string;
}

export const merchantProjectApi = {
    list: async (params?: MerchantProjectListParams) =>
        unwrapData<{ list: MerchantProjectExecutionDetail[]; total: number; page?: number; pageSize?: number }>(
            await merchantApi.get('/merchant/projects', { params }),
            '获取项目执行列表失败'
        ),
    detail: async (projectId: number) =>
        unwrapData<MerchantProjectExecutionDetail>(await merchantApi.get(`/merchant/projects/${projectId}`), '获取项目详情失败'),
    createLog: async (projectId: number, data: MerchantCreateProjectLogPayload) =>
        unwrapData<{ message?: string }>(await merchantApi.post(`/merchant/projects/${projectId}/logs`, data), '创建施工日志失败'),
    start: async (projectId: number, payload?: MerchantStartProjectPayload) =>
        unwrapData<{ message?: string; project?: MerchantProjectExecutionDetail }>(
            await merchantApi.post(`/merchant/projects/${projectId}/start`, payload || {}),
            '发起开工失败'
        ),
    submitMilestone: async (projectId: number, milestoneId: number) =>
        unwrapData<{ message?: string; milestone?: MerchantProjectMilestone }>(
            await merchantApi.post(`/merchant/projects/${projectId}/milestones/${milestoneId}/submit`),
            '提交节点失败'
        ),
    complete: async (projectId: number, payload: { photos: string[]; notes: string }) =>
        unwrapData<{ message?: string; completion?: MerchantProjectExecutionDetail }>(
            await merchantApi.post(`/merchant/projects/${projectId}/complete`, payload),
            '提交完工材料失败'
        ),
    disputeDetail: async (projectId: number) =>
        unwrapData<MerchantProjectDisputeDetail>(
            await merchantApi.get(`/merchant/projects/${projectId}/dispute`),
            '获取项目争议详情失败'
        ),
    respondDispute: async (projectId: number, response: string) =>
        unwrapData<{ message?: string; detail?: MerchantProjectDisputeDetail }>(
            await merchantApi.post(`/merchant/projects/${projectId}/dispute/respond`, { response }),
            '提交争议回应失败'
        ),
};

// 订单管理
export const merchantOrderApi = {
    list: () => merchantApi.get('/merchant/orders'),
};

export interface MerchantDashboardStats {
    pendingLeads: number;
    todayBookings: number;
    pendingProposals: number;
    activeProjects: number;
    totalRevenue: number;
    monthRevenue: number;
    bookings?: {
        pending: number;
        confirmed: number;
    };
    proposals?: {
        pending: number;
        confirmed: number;
    };
    orders?: {
        pending: number;
        paid: number;
    };
}

// 仪表盘
export const merchantDashboardApi = {
    stats: async () => unwrapData<MerchantDashboardStats>(await merchantApi.get('/merchant/dashboard'), '获取工作台数据失败'),
};

export interface MerchantIncomeSummary {
    totalIncome: number;
    pendingSettle: number;
    settledAmount: number;
    withdrawnAmount: number;
    availableAmount: number;
}

export interface MerchantIncomeListData<T> {
    list: T[];
    total: number;
    page: number;
    pageSize: number;
}

// 财务管理
export const merchantIncomeApi = {
    summary: async () => unwrapData<MerchantIncomeSummary>(await merchantApi.get('/merchant/income/summary'), '获取收入概览失败'),
    list: async <T = Record<string, unknown>>(params?: Record<string, unknown>) =>
        unwrapData<MerchantIncomeListData<T>>(await merchantApi.get('/merchant/income/list', { params }), '获取收入列表失败'),
};

export interface MerchantWithdrawListData<T> {
    list: T[];
    total: number;
    page: number;
    pageSize: number;
}

export const merchantWithdrawApi = {
    list: async <T = Record<string, unknown>>(params?: Record<string, unknown>) =>
        unwrapData<MerchantWithdrawListData<T>>(await merchantApi.get('/merchant/withdraw/list', { params }), '获取提现记录失败'),
    apply: async (data: { amount: number; bankAccountId: number; verificationCode: string }) =>
        unwrapData<{ withdrawId: number; orderNo: string; message?: string }>(await merchantApi.post('/merchant/withdraw', data), '提交提现申请失败'),
};

export interface MerchantBankAccountInfo {
    id: number;
    accountName: string;
    accountNo: string;
    bankName: string;
    branchName: string;
    isDefault: boolean;
}

export const merchantBankAccountApi = {
    list: async () =>
        unwrapData<{ list: MerchantBankAccountInfo[] }>(await merchantApi.get('/merchant/bank-accounts'), '获取银行账户失败'),
    add: async (data: { accountName: string; accountNo: string; bankName: string; branchName?: string; isDefault?: boolean; verificationCode: string }) =>
        unwrapData<{ id: number; message?: string }>(await merchantApi.post('/merchant/bank-accounts', data), '添加银行账户失败'),
    delete: async (id: number) =>
        unwrapData<{ message?: string }>(await merchantApi.delete(`/merchant/bank-accounts/${id}`), '删除银行账户失败'),
    setDefault: async (id: number) =>
        unwrapData<{ message?: string }>(await merchantApi.put(`/merchant/bank-accounts/${id}/default`), '设置默认账户失败'),
};

// 作品集管理
export const merchantCaseApi = {
    list: (params?: Record<string, unknown>) => merchantApi.get('/merchant/cases', { params }),
    detail: (id: number) => merchantApi.get(`/merchant/cases/${id}`),
    create: (data: MerchantPortfolioCase) => merchantApi.post('/merchant/cases', data),
    update: (id: number, data: Partial<MerchantPortfolioCase>) => merchantApi.put(`/merchant/cases/${id}`, data),
    delete: (id: number) => merchantApi.delete(`/merchant/cases/${id}`),
    reorder: (orders: { id: number; sortOrder: number }[]) => merchantApi.put('/merchant/cases/reorder', { orders }),
    cancelAudit: (auditId: number) => merchantApi.delete(`/merchant/cases/audit/${auditId}`), // 取消审核
};

// 通知系统
export const merchantNotificationApi = {
    list: (params?: { page?: number; pageSize?: number }) =>
        merchantApi.get('/merchant/notifications', { params }),
    getUnreadCount: () =>
        merchantApi.get('/merchant/notifications/unread-count'),
    markAsRead: (id: number) =>
        merchantApi.put(`/merchant/notifications/${id}/read`),
    markAllAsRead: () =>
        merchantApi.put('/merchant/notifications/read-all'),
    delete: (id: number) =>
        merchantApi.delete(`/merchant/notifications/${id}`),
};

export interface MerchantNotificationItem {
    id: number;
    title: string;
    content: string;
    type: string;
    relatedId: number;
    relatedType: string;
    isRead: boolean;
    actionUrl: string;
    createdAt: string;
}

export interface MerchantNotificationListData {
    list: MerchantNotificationItem[];
    total: number;
    page: number;
    pageSize: number;
}

export interface MerchantNotificationUnreadData {
    count: number;
}

export const merchantNotificationDataApi = {
    list: async (params?: { page?: number; pageSize?: number }) =>
        unwrapData<MerchantNotificationListData>(
            await merchantNotificationApi.list(params),
            '获取通知列表失败',
        ),
    getUnreadCount: async () =>
        unwrapData<MerchantNotificationUnreadData>(
            await merchantNotificationApi.getUnreadCount(),
            '获取未读数量失败',
        ),
    markAsRead: async (id: number) =>
        unwrapData<{ message?: string }>(
            await merchantNotificationApi.markAsRead(id),
            '标记通知失败',
        ),
    markAllAsRead: async () =>
        unwrapData<{ message?: string }>(
            await merchantNotificationApi.markAllAsRead(),
            '批量已读失败',
        ),
    delete: async (id: number) =>
        unwrapData<{ message?: string }>(
            await merchantNotificationApi.delete(id),
            '删除通知失败',
        ),
};

// 设计工作流API
export interface DesignWorkingDocItem {
    id: number;
    bookingId: number;
    docType: string;
    title: string;
    description: string;
    files: string;
    submittedAt?: string;
    createdAt: string;
}

export interface DesignFeeQuoteItem {
    id: number;
    bookingId: number;
    totalFee: number;
    depositDeduction: number;
    netAmount: number;
    paymentMode: string;
    stagesJson: string;
    description: string;
    status: string;
    expireAt?: string;
    confirmedAt?: string;
    rejectedAt?: string;
    rejectionReason?: string;
    orderId?: number;
    createdAt: string;
}

export interface DesignDeliverableItem {
    id: number;
    bookingId: number;
    projectId: number;
    orderId: number;
    colorFloorPlan: string;
    renderings: string;
    renderingLink: string;
    textDescription: string;
    cadDrawings: string;
    attachments: string;
    status: string;
    submittedAt?: string;
    acceptedAt?: string;
    rejectedAt?: string;
    rejectionReason?: string;
    createdAt: string;
}

export const merchantDesignApi = {
    uploadWorkingDoc: async (bookingId: number, data: { docType: string; title: string; description?: string; files: string }) =>
        unwrapData<{ doc: DesignWorkingDocItem }>(
            await merchantApi.post(`/merchant/bookings/${bookingId}/working-docs`, data),
            '上传工作文档失败'
        ),
    listWorkingDocs: async (bookingId: number) =>
        unwrapData<{ docs: DesignWorkingDocItem[] }>(
            await merchantApi.get(`/merchant/bookings/${bookingId}/working-docs`),
            '获取工作文档失败'
        ),
    createDesignFeeQuote: async (bookingId: number, data: {
        totalFee: number;
        depositDeduction?: number;
        paymentMode?: string;
        stagesJson?: string;
        description?: string;
    }) =>
        unwrapData<{ quote: DesignFeeQuoteItem }>(
            await merchantApi.post(`/merchant/bookings/${bookingId}/design-fee-quote`, data),
            '创建设计费报价失败'
        ),
    getDesignFeeQuote: async (bookingId: number) =>
        unwrapData<{ quote: DesignFeeQuoteItem | null }>(
            await merchantApi.get(`/merchant/bookings/${bookingId}/design-fee-quote`),
            '获取设计费报价失败'
        ),
    submitDeliverable: async (bookingId: number, data: {
        colorFloorPlan?: string;
        renderings?: string;
        renderingLink?: string;
        textDescription?: string;
        cadDrawings?: string;
        attachments?: string;
    }) =>
        unwrapData<{ deliverable: DesignDeliverableItem }>(
            await merchantApi.post(`/merchant/bookings/${bookingId}/deliverable`, data),
            '提交设计交付件失败'
        ),
};

// 导出带有 getIMUserSig 方法的对象
export { merchantApi, unwrapEnvelope, unwrapData };

// 统一导出，方便 MerchantChat 使用
export default {
    ...merchantApi,
    getIMUserSig: () => merchantApi.get('/merchant/im/usersig'),
    // Tinode helper (maps app user identifier -> tinode user id like `usrXXXX`).
    getTinodeUserId: (userIdentifier: number | string) => merchantApi.get(`/merchant/tinode/userid/${encodeURIComponent(String(userIdentifier))}`),
    resolveTinodeUserId: (userIdentifier: number | string) => merchantApi.get(`/merchant/tinode/userid/${encodeURIComponent(String(userIdentifier))}`),
};
