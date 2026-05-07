import api, { MerchantRequestError } from './api';
import { toSafeUserFacingText } from '../utils/userFacingText';

const merchantApi = api;

export interface ApiEnvelope<T> {
    code: number;
    message?: string;
    data?: T;
}

export class MerchantApiError<T = unknown> extends MerchantRequestError<T> {
    code: number;

    constructor(code: number, message: string, data?: T, status?: number, errorCode?: string) {
        super(message, { status, code, errorCode, data });
        this.name = 'MerchantApiError';
        this.code = code;
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
        const errorCode = isRecord(envelope.data) && 'errorCode' in envelope.data
            ? String(envelope.data.errorCode || '')
            : undefined;
        throw new MerchantApiError(envelope.code, toSafeUserFacingText(envelope.message, fallbackMessage), envelope.data, 200, errorCode);
    }
    return (envelope.data as T) ?? ({} as T);
};

export type MerchantApplicantType = 'personal' | 'studio' | 'company' | 'foreman';
export type MerchantProviderSubType = 'designer' | 'company' | 'foreman';
export type MerchantKind = 'provider' | 'material_shop';
export type MerchantRole = 'designer' | 'foreman' | 'company' | 'material_shop';
export type MerchantEntityType = 'personal' | 'company' | 'individual_business';
export type MerchantLoginNextAction = 'APPLY' | 'PENDING' | 'RESUBMIT' | 'CHANGE_ROLE' | 'REAPPLY';
export type MerchantOnboardingStatus = 'required' | 'pending_review' | 'rejected' | 'approved';
export type MerchantDistributionStatus =
    | 'active'
    | 'hidden_by_platform'
    | 'hidden_by_merchant'
    | 'blocked_by_operating'
    | 'blocked_by_qualification';

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
    completionRequired?: boolean;
    onboardingStatus?: MerchantOnboardingStatus;
    completionApplicationId?: number;
    // 统一身份中心字段
    activeRole?: string;
    userId?: number;
    identityId?: number;
    identityRefId?: number;
}

export interface MerchantLoginData {
    token: string;
    merchantKind?: MerchantKind;
    role?: MerchantRole;
    entityType?: MerchantEntityType;
    provider: MerchantProviderSession;
    tinodeToken?: string;
    completionRequired?: boolean;
    onboardingStatus?: MerchantOnboardingStatus;
    completionApplicationId?: number;
    redirectToCompletion?: boolean;
    // 统一身份中心字段
    activeRole?: string;
    identityId?: number;
    identityRefId?: number;
}

export interface MerchantProviderInfo {
    id: number;
    sourceApplicationId?: number;
    name: string;
    avatar?: string;
    coverImage?: string;
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
    merchantDisplayEnabled?: boolean;
    platformDisplayEnabled?: boolean;
    publicVisible?: boolean;
    distributionStatus?: MerchantDistributionStatus;
    primaryBlockerCode?: string;
    primaryBlockerMessage?: string;
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

export interface MerchantCompletionStatusResponse {
    onboardingStatus: MerchantOnboardingStatus;
    completionRequired: boolean;
    applicationId?: number;
    rejectReason?: string;
    form: MerchantApplyDetailData;
    readonly: boolean;
}

export interface MerchantCompletionSubmitPayload extends Omit<MerchantApplyPayload, 'phone' | 'code' | 'verificationToken' | 'resubmitToken'> {}

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

export const merchantCompletionApi = {
    status: async () =>
        unwrapData<MerchantCompletionStatusResponse>(await merchantApi.get('/merchant/onboarding/completion'), '获取补全状态失败'),
    submit: async (data: MerchantCompletionSubmitPayload) =>
        unwrapData<{ applicationId: number; completionRequired: boolean; onboardingStatus: MerchantOnboardingStatus; message?: string }>(
            await merchantApi.post('/merchant/onboarding/completion', data),
            '提交补全资料失败'
        ),
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

export interface MaterialShopCompletionStatusResponse {
    onboardingStatus: MerchantOnboardingStatus;
    completionRequired: boolean;
    applicationId?: number;
    rejectReason?: string;
    form: MaterialShopApplyDetailData;
    readonly: boolean;
}

export interface MaterialShopCompletionSubmitPayload extends Omit<MaterialShopApplyPayload, 'phone' | 'code' | 'verificationToken' | 'resubmitToken'> {}

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

export const materialShopCompletionApi = {
    status: async () =>
        unwrapData<MaterialShopCompletionStatusResponse>(await merchantApi.get('/material-shop/onboarding/completion'), '获取主材商补全状态失败'),
    submit: async (data: MaterialShopCompletionSubmitPayload) =>
        unwrapData<{ applicationId: number; completionRequired: boolean; onboardingStatus: MerchantOnboardingStatus; message?: string }>(
            await merchantApi.post('/material-shop/onboarding/completion', data),
            '提交主材商补全资料失败'
        ),
};

export interface MaterialShopProfile {
    id: number;
    sourceApplicationId?: number;
    merchantKind: 'material_shop';
    entityType: 'company' | 'individual_business';
    avatar?: string;
    coverImage?: string;
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
    merchantDisplayEnabled?: boolean;
    platformDisplayEnabled?: boolean;
    publicVisible?: boolean;
    distributionStatus?: MerchantDistributionStatus;
    primaryBlockerCode?: string;
    primaryBlockerMessage?: string;
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

export type MerchantBookingStatusGroup =
    | 'pending_confirmation'
    | 'pending_payment'
    | 'in_service'
    | 'completed'
    | 'cancelled';

export interface MerchantBookingEntry {
    id: number;
    userId: number;
    providerId?: number;
    providerType?: string | number;
    address: string;
    area: number;
    houseLayout?: string;
    renovationType?: string;
    budgetRange?: string;
    preferredDate?: string;
    phone?: string;
    notes?: string;
    status: number;
    statusGroup?: MerchantBookingStatusGroup;
    statusText?: string;
    currentStage?: string;
    currentStageText?: string;
    businessStage?: string;
    flowSummary?: string;
    availableActions?: string[];
    surveyDepositAmount?: number;
    surveyDepositPaid?: boolean;
    surveyDepositPaidAt?: string;
    userNickname?: string;
    userPhone?: string;
    userPublicId?: string;
    hasProposal?: boolean;
    createdAt?: string;
}

export interface MerchantBookingDetailResponse {
    booking: MerchantBookingEntry;
    hasProposal?: boolean;
    proposal?: Record<string, unknown>;
    statusGroup?: MerchantBookingStatusGroup;
    statusText?: string;
    currentStage?: string;
    currentStageText?: string;
    flowSummary?: string;
    availableActions?: string[];
    surveyDepositAmount?: number;
    surveyDepositPaid?: boolean;
    surveyDepositPaidAt?: string;
    siteSurveySummary?: MerchantSiteSurveySummary | null;
    budgetConfirmSummary?: MerchantBudgetSummary | null;
}

export interface MerchantFlowPrimaryAction {
    kind: 'modal' | 'link' | 'none';
    label?: string;
    modalType?:
        | 'survey_upload'
        | 'budget_confirm'
        | 'design_fee_quote'
        | 'design_deliverable'
        | 'proposal_confirm'
        | 'construction_handoff';
    path?: string;
}

export interface MerchantFlowStepCompleteness {
    completed: number;
    total: number;
    summary?: string;
}

export interface MerchantBridgeConstructionSubjectComparison {
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

export interface MerchantBridgeSectionSummary {
    title?: string;
    items?: string[];
}

export interface MerchantBridgeNextStep {
    actionKey?: string;
    actionText?: string;
    title?: string;
    owner?: string;
    reason?: string;
    actionHint?: string;
    blockingHint?: string;
}

export interface MerchantBridgeQuoteBaselineSummary {
    title?: string;
    sourceStage?: string;
    submittedAt?: string;
    itemCount?: number;
    highlights?: string[];
    readyForUser?: boolean;
}

export interface MerchantBridgeTrustSignals {
    rating?: number;
    reviewCount?: number;
    completedCnt?: number;
    caseCount?: number;
    highlightTags?: string[];
    officialReviewHint?: string;
}

export interface MerchantBridgeConversionSummary {
    constructionSubjectComparison?: MerchantBridgeConstructionSubjectComparison[];
    quoteBaselineSummary?: MerchantBridgeQuoteBaselineSummary;
    responsibilityBoundarySummary?: MerchantBridgeSectionSummary;
    scheduleAndAcceptanceSummary?: MerchantBridgeSectionSummary;
    platformGuaranteeSummary?: MerchantBridgeSectionSummary;
    trustSignals?: MerchantBridgeTrustSignals;
    bridgeNextStep?: MerchantBridgeNextStep;
}

export interface MerchantFlowStep {
    key: 'booking' | 'survey' | 'budget' | 'quote' | 'design' | 'confirm' | 'construction_prep' | 'construction';
    title: string;
    status: 'not_started' | 'pending_submit' | 'pending_user' | 'pending_other' | 'completed' | 'returned';
    merchantTodo: string;
    userState: string;
    summary: string;
    blockedReason?: string;
    completeness?: MerchantFlowStepCompleteness;
    userFacingExplainers?: string[];
    nextAction?: MerchantFlowPrimaryAction;
    primaryAction?: MerchantFlowPrimaryAction;
}

export interface MerchantFlowEvent {
    date: string;
    label: string;
    type: 'success' | 'info' | 'warning';
}

export interface MerchantConstructionHandoffSummary {
    quoteListId?: number;
    quoteListStatus?: string;
    invitedForemanCount?: number;
    awardedProviderId?: number;
    projectId?: number;
    summary?: string;
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

export interface MerchantConstructionPreparationSnapshot {
    area?: number;
    layout?: string;
    renovationType?: string;
    constructionScope?: string;
    serviceAreas?: string[];
    workTypes?: string[];
    houseUsage?: string;
    notes?: string;
}

export interface MerchantConstructionPreparationItem {
    id?: number;
    standardItemId?: number;
    sourceItemCode?: string;
    sourceItemName: string;
    unit: string;
    quantity: number;
    baselineNote?: string;
    categoryL1?: string;
    categoryL2?: string;
    sortOrder?: number;
}

export interface MerchantConstructionTemplateRow {
    standardItemId: number;
    standardCode?: string;
    name: string;
    unit: string;
    categoryL1?: string;
    categoryL2?: string;
    required: boolean;
    applicable: boolean;
    suggestedQuantity?: number;
    inputQuantity?: number;
    baselineNote?: string;
}

export interface MerchantConstructionTemplateSection {
    key: string;
    title: string;
    rows: MerchantConstructionTemplateRow[];
}

export interface MerchantConstructionPreparationInputItem {
    standardItemId: number;
    quantity?: number;
    baselineNote?: string;
}

export interface MerchantRecommendedForeman {
    providerId: number;
    providerName: string;
    providerType?: number;
    providerSubType?: string;
    regionMatched?: boolean;
    workTypeMatched?: boolean;
    acceptBooking?: boolean;
    priceCoverageRate?: number;
    matchedItemCount?: number;
    missingItemCount?: number;
    estimatedTotalCent?: number;
    missingPriceTotalCent?: number;
    reasons?: string[];
}

export interface MerchantConstructionPreparationSummary {
    quoteList?: {
        id?: number;
        title?: string;
        status?: string;
        projectId?: number;
        awardedProviderId?: number;
    };
    quoteListId?: number;
    prerequisiteStatus?: string;
    prerequisiteSnapshot: MerchantConstructionPreparationSnapshot;
    quantityBase?: {
        id?: number;
        version?: number;
        title?: string;
        status?: string;
    } | null;
    templateId?: number;
    templateError?: string;
    templateSections?: MerchantConstructionTemplateSection[];
    quantityItems: MerchantConstructionPreparationItem[];
    missingFields?: string[];
    selectedForemanId?: number;
    recommendedForemen?: MerchantRecommendedForeman[];
    completeness?: MerchantFlowStepCompleteness;
    userFacingExplainers?: string[];
    bridgeConversionSummary?: MerchantBridgeConversionSummary;
}

export interface MerchantDesignerFlowWorkspace {
    booking: MerchantBookingEntry;
    currentStage?: string;
    currentStepKey?: MerchantFlowStep['key'];
    flowSummary?: string;
    steps: MerchantFlowStep[];
    siteSurveySummary?: MerchantSiteSurveySummary | null;
    budgetConfirmSummary?: MerchantBudgetSummary | null;
    designFeeQuote?: DesignFeeQuoteItem | null;
    designDeliverable?: DesignDeliverableItem | null;
    proposal?: MerchantProposalItem | null;
    constructionPreparation?: MerchantConstructionPreparationSummary | null;
    constructionHandoff?: MerchantConstructionHandoffSummary | null;
    events?: MerchantFlowEvent[];
}

// 预约管理
export const merchantBookingApi = {
    list: async () =>
        unwrapData<{ list: MerchantBookingEntry[]; total: number }>(
            await merchantApi.get('/merchant/bookings'),
            '获取预约列表失败'
        ),
    detail: async (id: number) =>
        unwrapData<MerchantBookingDetailResponse>(
            await merchantApi.get(`/merchant/bookings/${id}`),
            '获取预约详情失败'
        ),
    handle: async (id: number, action: 'confirm' | 'reject') =>
        unwrapData<{ message?: string }>(
            await merchantApi.put(`/merchant/bookings/${id}/handle`, { action }),
            '处理预约失败'
        ),
    confirmCrew: async (id: number, payload: { accept: boolean; reason?: string }) =>
        unwrapData<{ message?: string }>(
            await merchantApi.post(`/merchant/bookings/${id}/confirm-crew`, payload),
            '工长确认失败'
        ),
};

export const merchantFlowApi = {
    summary: async (bookingId: number) =>
        unwrapData<MerchantDesignerFlowWorkspace>(
            await merchantApi.get(`/merchant/bookings/${bookingId}/flow-summary`),
            '获取设计流程失败',
        ),
    startConstructionPrep: async (bookingId: number) =>
        unwrapData<MerchantConstructionPreparationSummary>(
            await merchantApi.post(`/merchant/bookings/${bookingId}/construction-prep/start`),
            '启动施工报价准备失败',
        ),
    getConstructionPrep: async (quoteTaskId: number) =>
        unwrapData<MerchantConstructionPreparationSummary>(
            await merchantApi.get(`/merchant/quote-tasks/${quoteTaskId}/preparation`),
            '获取施工报价准备失败',
        ),
    updateConstructionPrerequisites: async (
        quoteTaskId: number,
        payload: MerchantConstructionPreparationSnapshot,
    ) =>
        unwrapData<MerchantConstructionPreparationSummary>(
            await merchantApi.put(`/merchant/quote-tasks/${quoteTaskId}/prerequisites`, payload),
            '更新施工前置资料失败',
        ),
    updateConstructionItems: async (
        quoteTaskId: number,
        items: MerchantConstructionPreparationInputItem[],
    ) =>
        unwrapData<MerchantConstructionPreparationSummary>(
            await merchantApi.put(`/merchant/quote-tasks/${quoteTaskId}/quantity-items`, { items }),
            '更新施工基线失败',
        ),
    recommendForemen: async (quoteTaskId: number) =>
        unwrapData<{ list: MerchantRecommendedForeman[] }>(
            await merchantApi.post(`/merchant/quote-tasks/${quoteTaskId}/recommend-foremen`),
            '获取推荐施工主体失败',
        ),
    selectForeman: async (quoteTaskId: number, providerId: number) =>
        unwrapData<MerchantConstructionPreparationSummary>(
            await merchantApi.post(`/merchant/quote-tasks/${quoteTaskId}/select-foremen`, {
                providerIds: [providerId],
            }),
            '选择施工主体失败',
        ),
};

export interface MerchantSiteSurveyPayload {
    photos: string[];
    dimensions?: Record<string, { length?: number; width?: number; height?: number; unit?: string }>;
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
        '获取量房资料失败'
    ),
    submit: async (bookingId: number, payload: MerchantSiteSurveyPayload) =>
        unwrapData<{ siteSurvey: MerchantSiteSurveySummary }>(
            await merchantApi.post(`/merchant/bookings/${bookingId}/site-survey`, payload),
            '提交量房资料失败'
        ),
};

export interface MerchantBudgetConfirmPayload {
    budgetMin: number;
    budgetMax: number;
    includes: Record<'design_fee' | 'construction_fee' | 'material_fee' | 'furniture_fee', boolean>;
    notes: string;
    designIntent: string;
    styleDirection: string;
    spaceRequirements: string;
    expectedDurationDays: number;
    specialRequirements: string;
}
export interface MerchantBudgetSummary extends MerchantBudgetConfirmPayload {
    status: 'submitted' | 'accepted' | 'rejected';
    submittedAt?: string;
    acceptedAt?: string;
    rejectedAt?: string;
    lastRejectedAt?: string;
    rejectionReason?: string;
    rejectCount?: number;
    rejectLimit?: number;
    canResubmit?: boolean;
}

export const merchantBudgetApi = {
    get: (bookingId: number) => unwrapData<{ budgetConfirmation: MerchantBudgetSummary | null }>(
        merchantApi.get(`/merchant/bookings/${bookingId}/budget-confirm`),
        '获取沟通确认失败'
    ),
    submit: async (bookingId: number, payload: MerchantBudgetConfirmPayload) =>
        unwrapData<{ budgetConfirmation: MerchantBudgetSummary }>(
            await merchantApi.post(`/merchant/bookings/${bookingId}/budget-confirm`, payload),
            '提交沟通确认失败'
        ),
};

export interface MerchantProposalItem {
    id: number;
    sourceType?: 'booking' | 'demand' | string;
    bookingId: number;
    designerId?: number;
    summary: string;
    designFee: number;
    constructionFee: number;
    materialFee: number;
    estimatedDays: number;
    attachments: string;
    internalDraftJson?: string;
    previewPackageJson?: string;
    deliveryPackageJson?: string;
    status: number;
    confirmedAt?: string;
    version?: number;
    parentProposalId?: number;
    rejectionCount?: number;
    rejectionReason?: string;
    rejectedAt?: string;
    submittedAt?: string;
    createdAt?: string;
}

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
        internalDraft?: {
            communicationNotes?: string;
            sketchImages?: string[];
            initialBudgetNotes?: string;
            cadSourceFiles?: string[];
        };
        previewPackage?: {
            summary?: string;
            floorPlanImages?: string[];
            effectPreviewImages?: string[];
            effectPreviewLinks?: string[];
            hasCad?: boolean;
            hasAttachments?: boolean;
        };
        deliveryPackage?: {
            description?: string;
            floorPlanImages?: string[];
            effectImages?: string[];
            effectLinks?: string[];
            cadFiles?: string[];
            attachments?: string[];
        };
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
        internalDraft?: {
            communicationNotes?: string;
            sketchImages?: string[];
            initialBudgetNotes?: string;
            cadSourceFiles?: string[];
        };
        previewPackage?: {
            summary?: string;
            floorPlanImages?: string[];
            effectPreviewImages?: string[];
            effectPreviewLinks?: string[];
            hasCad?: boolean;
            hasAttachments?: boolean;
        };
        deliveryPackage?: {
            description?: string;
            floorPlanImages?: string[];
            effectImages?: string[];
            effectLinks?: string[];
            cadFiles?: string[];
            attachments?: string[];
        };
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
        unwrapData<MerchantContractRecord>(await merchantApi.post('/merchant/contracts', data), '创建合同失败'),
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
    phaseId?: number;
}

export interface MerchantCreateProjectLogPayload {
    phaseId: number;
    title: string;
    description?: string;
    photos?: string;
    logDate?: string;
}

export interface MerchantProjectPhase {
    id: number;
    name?: string;
    phaseType?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
}

export interface MerchantStartProjectPayload {
    startDate?: string;
}

export interface MerchantProjectPaymentPlan {
    id: number;
    orderId?: number;
    seq?: number;
    name?: string;
    amount?: number;
    status?: number;
    activatedAt?: string | null;
    dueAt?: string | null;
    expiresAt?: string | null;
    payable?: boolean;
    payableReason?: string;
    planType?: string;
}

export interface MerchantProjectChangeOrderItem {
    title: string;
    description?: string;
    amountImpact?: number;
}

export interface MerchantProjectChangeOrder {
    id: number;
    projectId: number;
    title?: string;
    changeType?: string;
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
    items?: MerchantProjectChangeOrderItem[];
}

export interface MerchantCreateChangeOrderPayload {
    changeType: string;
    title: string;
    reason: string;
    description?: string;
    amountImpact?: number;
    timelineImpact?: number;
    evidenceUrls?: string[];
    items?: MerchantProjectChangeOrderItem[];
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
    designerName?: string;
    budget?: number;
    plannedStartDate?: string | null;
    supervisorSummary?: {
        plannedStartDate?: string | null;
        latestLogAt?: string | null;
        latestLogTitle?: string;
        unhandledRiskCount?: number;
    };
    riskSummary?: {
        pausedAt?: string | null;
        resumedAt?: string | null;
        pauseReason?: string;
        pauseInitiator?: string;
        disputedAt?: string | null;
        disputeReason?: string;
        disputeEvidence?: string[];
        auditId?: number;
        auditStatus?: string;
        escrowFrozen?: boolean;
        escrowStatus?: number;
        frozenAmount?: number;
    };
    phases?: MerchantProjectPhase[];
    milestones: MerchantProjectMilestone[];
    recentLogs?: MerchantProjectLog[];
    completedPhotos?: string[];
    completionNotes?: string;
    completionSubmittedAt?: string | null;
    completionRejectedAt?: string | null;
    completionRejectionReason?: string;
    bridgeConversionSummary?: MerchantBridgeConversionSummary;
    closureSummary?: {
        completionStatus?: string;
        archiveStatus?: string;
        settlementStatus?: string;
        payoutStatus?: string;
        caseDraftStatus?: string;
        financialClosureStatus?: string;
        nextPendingAction?: string;
    };
    quoteTruthSummary?: {
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
    };
    commercialExplanation?: {
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
    };
    changeOrderSummary?: {
        totalCount: number;
        pendingUserConfirmCount: number;
        pendingSettlementCount: number;
        settledCount: number;
        netAmountCent: number;
        latestChangeOrderId?: number;
    };
    settlementSummary?: {
        latestSettlementId?: number;
        status?: string;
        grossAmount?: number;
        netAmount?: number;
        scheduledAt?: string;
        paidAt?: string;
    };
    payoutSummary?: {
        latestPayoutId?: number;
        status?: string;
        channel?: string;
        scheduledAt?: string;
        paidAt?: string;
        failureReason?: string;
    };
    financialClosureStatus?: string;
    nextPendingAction?: string;
    paymentPlans?: MerchantProjectPaymentPlan[];
    nextPayablePlan?: MerchantProjectPaymentPlan | null;
    changeOrders?: MerchantProjectChangeOrder[];
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
    listChangeOrders: async (projectId: number) =>
        unwrapData<MerchantProjectChangeOrder[]>(
            await merchantApi.get(`/merchant/projects/${projectId}/change-orders`),
            '获取项目变更单失败'
        ),
    createChangeOrder: async (projectId: number, payload: MerchantCreateChangeOrderPayload) =>
        unwrapData<MerchantProjectChangeOrder>(
            await merchantApi.post(`/merchant/projects/${projectId}/change-orders`, payload),
            '创建项目变更单失败'
        ),
    cancelChangeOrder: async (changeOrderId: number, reason?: string) =>
        unwrapData<MerchantProjectChangeOrder>(
            await merchantApi.post(`/merchant/change-orders/${changeOrderId}/cancel`, { reason }),
            '取消项目变更单失败'
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
    pendingQuoteInvitations?: number;
    draftQuoteSubmissions?: number;
    rejectedQuoteSubmissions?: number;
    submittedToUserQuotes?: number;
    missingPriceRequiredCount?: number;
    pendingChangeOrders?: number;
    pendingSettlementAmount?: number;
    failedPayoutCount?: number;
    quoteErp?: {
        pendingQuoteInvitations?: number;
        draftQuoteSubmissions?: number;
        rejectedQuoteSubmissions?: number;
        submittedToUserQuotes?: number;
        missingPriceRequiredCount?: number;
        pendingChangeOrders?: number;
        pendingSettlementAmount?: number;
        failedPayoutCount?: number;
    };
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
    governanceTier?: string;
    riskFlags?: string[];
    recommendedAction?: string;
    scoreSummary?: {
        responseRate?: number;
        proposalRate?: number;
        designConfirmRate?: number;
        constructionConfirmRate?: number;
        completionRate?: number;
        acceptancePassRate?: number;
        complaintRate?: number;
        refundRate?: number;
        caseCount?: number;
        officialReviewCount?: number;
    };
    funnelMetrics?: {
        bookingsTotal?: number;
        respondedBookings?: number;
        proposalSubmittedCount?: number;
        designConfirmedCount?: number;
        constructionConfirmedCount?: number;
        completedProjectCount?: number;
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
    frozenAmount: number;
    abnormalAmount: number;
    pendingPayoutAmount: number;
    rejectedWithdrawAmount: number;
    latestRejectReason: string;
}

export interface MerchantIncomeListData<T> {
    list: T[];
    total: number;
    page: number;
    pageSize: number;
}

export interface MerchantIncomeListParams {
    type?: string;
    status?: string;
    page?: number;
    pageSize?: number;
    projectId?: number;
}

// 财务管理
export const merchantIncomeApi = {
    summary: async () => unwrapData<MerchantIncomeSummary>(await merchantApi.get('/merchant/income/summary'), '获取收入概览失败'),
    list: async <T = Record<string, unknown>>(params?: MerchantIncomeListParams) =>
        unwrapData<MerchantIncomeListData<T>>(await merchantApi.get('/merchant/income/list', { params }), '获取收入列表失败'),
};

export interface MerchantWithdrawListData<T> {
    list: T[];
    total: number;
    page: number;
    pageSize: number;
}

export const merchantSettlementApi = {
    list: async <T = Record<string, unknown>>(params?: Record<string, unknown>) =>
        unwrapData<MerchantWithdrawListData<T>>(await merchantApi.get('/merchant/settlements', { params }), '获取结算/出款记录失败'),
};

export interface MerchantBondAccountInfo {
    id: number;
    providerId: number;
    providerName?: string;
    requiredAmount: number;
    paidAmount: number;
    frozenAmount: number;
    availableAmount: number;
    status: string;
    lastRuleId?: number;
    updatedAt?: string;
}

export interface MerchantBondLedgerItem {
    id: number;
    fundScene: string;
    direction: string;
    amount: number;
    bizType: string;
    bizId: number;
    runtimeType: string;
    runtimeId: number;
    remark?: string;
    metadata?: Record<string, unknown>;
    occurredAt: string;
}

export interface MerchantPaymentLaunchPayload {
    paymentId: number;
    channel: string;
    launchMode: 'redirect';
    launchUrl: string;
    expiresAt?: string;
}

export interface MerchantPaymentStatusPayload {
    paymentId: number;
    status: string;
    channel: string;
    amount: number;
    subject: string;
    paidAt?: string;
    expiresAt?: string;
    terminalType: string;
    returnContext?: Record<string, unknown>;
}

export const merchantBondApi = {
    account: async () =>
        unwrapData<MerchantBondAccountInfo>(await merchantApi.get('/merchant/bond-account'), '获取保证金账户失败'),
    ledger: async (params?: Record<string, unknown>) =>
        unwrapData<MerchantWithdrawListData<MerchantBondLedgerItem>>(await merchantApi.get('/merchant/bond-ledger', { params }), '获取保证金流水失败'),
    pay: async (data?: { terminalType?: string; resultPath?: string }) =>
        unwrapData<MerchantPaymentLaunchPayload>(await merchantApi.post('/merchant/bond-account/pay', data), '发起保证金支付失败'),
};

export const merchantPaymentApi = {
    status: async (paymentId: number) =>
        unwrapData<MerchantPaymentStatusPayload>(await merchantApi.get(`/merchant/payments/${paymentId}/status`), '获取支付状态失败'),
};

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
    typeLabel?: string;
    relatedId: number;
    relatedType: string;
    isRead: boolean;
    actionUrl: string;
    createdAt: string;
    actionRequired?: boolean;
    actionStatus?: 'none' | 'pending' | 'processed' | 'expired';
    actionLabel?: string;
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
    getDeliverable: async (bookingId: number) =>
        unwrapData<{ deliverable: DesignDeliverableItem | null }>(
            await merchantApi.get(`/merchant/bookings/${bookingId}/deliverable`),
            '获取设计交付件失败'
        ),
    submitDeliverable: async (bookingId: number, data: {
        bookingId?: number;
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
