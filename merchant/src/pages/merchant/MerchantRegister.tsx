import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ArrowLeftOutlined,
    ArrowRightOutlined,
    CheckOutlined,
    DeleteOutlined,
    EnvironmentOutlined,
    IdcardOutlined,
    PhoneOutlined,
    PictureOutlined,
    SafetyOutlined,
    UserOutlined,
} from '@ant-design/icons';
import {
    Alert,
    Button,
    Card,
    Checkbox,
    Col,
    Divider,
    Form,
    Input,
    InputNumber,
    Modal,
    Row,
    Select,
    Typography,
    Upload,
    message,
} from 'antd';
import ImgCrop from 'antd-img-crop';
import type { UploadFile, UploadProps } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    MERCHANT_LEGAL_ROUTES,
    ONBOARDING_AGREEMENT_VERSION,
    PLATFORM_RULES_VERSION,
    PRIVACY_DATA_PROCESSING_VERSION,
} from '../../constants/merchantLegal';
import { getServerTimeMs } from '../../utils/serverTime';
import { dictionaryApi } from '../../services/dictionaryApi';
import {
    MerchantApiError,
    merchantApplyApi,
    merchantAuthApi,
    merchantCompletionApi,
    merchantUploadApi,
    onboardingValidationApi,
    type MerchantApplicantType,
    type MerchantApplyDetailData,
    type MerchantApplyPayload,
    type MerchantCompletionStatusResponse,
    type MerchantCompletionSubmitPayload,
} from '../../services/merchantApi';
import { regionApi, type ServiceCityRegion } from '../../services/regionApi';
import { IMAGE_UPLOAD_SPECS, validateImageUploadBeforeSend } from '../../utils/imageUpload';
import { isValidBusinessLicenseNo, isValidChineseIDCard, normalizeLicenseNo } from '../../utils/onboardingValidation';
import MerchantOnboardingShell from './components/MerchantOnboardingShell';

const { Title, Text } = Typography;
const { TextArea } = Input;

type MerchantApplyRole = 'designer' | 'foreman' | 'company';
type MerchantEntityType = 'personal' | 'company';

interface MerchantRegisterProps {
    mode?: 'apply' | 'completion';
    completionData?: MerchantCompletionStatusResponse | null;
    onCompletionSubmitted?: () => void | Promise<void>;
}

const FOREMAN_HIGHLIGHT_OPTIONS = [
    '工期可控',
    '工地整洁',
    '节点验收',
    '材料透明',
    '自有工班',
    '售后保障',
];
const CASE_AREA_OPTIONS = ['60㎡以下', '60-90㎡', '90-120㎡', '120-150㎡', '150-200㎡', '200㎡以上'];
const PRICING_MIN: number = 1;
const PRICING_MAX: number = 99999;

const DRAFT_STORAGE_KEY = 'merchant_register_draft';
const DRAFT_EXPIRY_MS = 2 * 60 * 60 * 1000;
const VERIFICATION_STORAGE_KEY = 'merchant_register_phone_verification';
const VERIFICATION_EXPIRE_MS = 30 * 60 * 1000;

interface PhoneVerificationState {
    phoneVerified: boolean;
    verifiedPhone: string;
    verificationToken: string;
    verificationExpiresAt: number;
    mode: 'apply' | 'resubmit';
    merchantKind: 'provider' | 'material_shop';
    applicationId?: number;
}

const generatePortfolioCaseId = (): string => {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
        return globalThis.crypto.randomUUID();
    }

    if (typeof globalThis.crypto?.getRandomValues === 'function') {
        const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0'));
        return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`;
    }

    return `case-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
};

type ForemanCaseCategory = 'water' | 'electric' | 'wood' | 'masonry' | 'paint' | 'other';

interface ServiceCityGroupOption {
    label: string;
    options: Array<{ label: string; value: string }>;
}

const buildServiceCityGroups = (cities: ServiceCityRegion[]): ServiceCityGroupOption[] => {
    const grouped = new Map<string, Array<{ label: string; value: string }>>();
    cities.forEach((city) => {
        const provinceName = city.parentName?.trim() || '未分组';
        const bucket = grouped.get(provinceName) || [];
        bucket.push({ label: city.name, value: city.code });
        grouped.set(provinceName, bucket);
    });
    return [...grouped.entries()].map(([label, options]) => ({ label, options }));
};

const FOREMAN_CASE_SECTIONS: Array<{ category: ForemanCaseCategory; title: string; required: boolean }> = [
    { category: 'water', title: '水电工施工展示', required: true },
    { category: 'electric', title: '防水施工展示', required: true },
    { category: 'wood', title: '木作施工展示', required: true },
    { category: 'masonry', title: '瓦工施工展示', required: true },
    { category: 'paint', title: '油漆施工展示', required: true },
    { category: 'other', title: '其他施工展示', required: false },
];

const getForemanCaseImageBounds = (category?: ForemanCaseCategory) => ({
    min: category === 'water' ? 3 : 2,
    max: 6,
});

const createEmptyPortfolioCase = (category?: ForemanCaseCategory): PortfolioCase => ({
    id: generatePortfolioCaseId(),
    title: '',
    description: '',
    images: [],
    style: '',
    area: '',
    category,
});

const createForemanPortfolioCases = (): PortfolioCase[] => FOREMAN_CASE_SECTIONS.map((section) => ({
    ...createEmptyPortfolioCase(section.category),
    title: section.title,
}));

interface PortfolioCase {
    id: string;
    title: string;
    description: string;
    images: string[];
    style: string;
    area: string;
    category?: ForemanCaseCategory;
}

interface ResolvedApplyMeta {
    role: MerchantApplyRole;
    entityType: MerchantEntityType;
    applicantType: MerchantApplicantType;
}

const matchForemanCategory = (value: string): ForemanCaseCategory | undefined => {
    const normalized = value.trim();
    if (!normalized) return undefined;
    if (normalized.includes('水电') || normalized.includes('水工')) return 'water';
    if (normalized.includes('防水') || normalized.includes('电工')) return 'electric';
    if (normalized.includes('木作') || normalized.includes('木工')) return 'wood';
    if (normalized.includes('瓦')) return 'masonry';
    if (normalized.includes('油')) return 'paint';
    if (normalized.includes('其')) return 'other';
    return undefined;
};

const normalizePortfolioCasesForForm = (cases: unknown, isForeman: boolean): PortfolioCase[] => {
    if (!Array.isArray(cases)) {
        return isForeman ? createForemanPortfolioCases() : [];
    }

    if (!isForeman) {
        return cases.map((caseItem) => ({
            id: generatePortfolioCaseId(),
            title: String((caseItem as { title?: unknown })?.title || ''),
            description: String((caseItem as { description?: unknown })?.description || ''),
            images: Array.isArray((caseItem as { images?: unknown[] })?.images)
                ? ((caseItem as { images?: unknown[] }).images || []).map((image) => String(image)).filter(Boolean)
                : [],
            style: String((caseItem as { style?: unknown })?.style || ''),
            area: String((caseItem as { area?: unknown })?.area || ''),
            category: (caseItem as { category?: ForemanCaseCategory }).category,
        }));
    }

    const mapped = new Map<ForemanCaseCategory, PortfolioCase>();
    for (const rawCase of cases) {
        const caseItem = rawCase as Record<string, unknown>;
        const category = (typeof caseItem.category === 'string' ? caseItem.category : matchForemanCategory(String(caseItem.title || ''))) as ForemanCaseCategory | undefined;
        const targetCategory = category || 'other';
        if (mapped.has(targetCategory)) continue;
        const section = FOREMAN_CASE_SECTIONS.find((item) => item.category == targetCategory);
        mapped.set(targetCategory, {
            id: generatePortfolioCaseId(),
            title: section?.title || String(caseItem.title || ''),
            description: String(caseItem.description || ''),
            images: Array.isArray(caseItem.images) ? caseItem.images.map((image) => String(image)).filter(Boolean) : [],
            style: '',
            area: '',
            category: targetCategory,
        });
    }

    return FOREMAN_CASE_SECTIONS.map((section) => mapped.get(section.category) || {
        ...createEmptyPortfolioCase(section.category),
        title: section.title,
    });
};

const getErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message) {
        return error.message;
    }

    const maybeAxiosError = error as {
        response?: {
            data?: {
                message?: string;
            };
        };
    };
    return maybeAxiosError.response?.data?.message || fallback;
};

const resolveApplyMeta = (searchParams: URLSearchParams): ResolvedApplyMeta => {
    const roleParam = (searchParams.get('role') || '').toLowerCase();
    const entityParam = (searchParams.get('entityType') || '').toLowerCase();
    const typeParam = (searchParams.get('type') || '').toLowerCase();

    if (roleParam === 'company') {
        return { role: 'company', entityType: 'company', applicantType: 'company' };
    }

    if (roleParam === 'foreman') {
        const entityType: MerchantEntityType = entityParam === 'company' ? 'company' : 'personal';
        return { role: 'foreman', entityType, applicantType: 'foreman' };
    }

    if (roleParam === 'designer') {
        const entityType: MerchantEntityType = entityParam === 'company' ? 'company' : 'personal';
        const applicantType: MerchantApplicantType = entityType === 'company' ? 'studio' : 'personal';
        return { role: 'designer', entityType, applicantType };
    }

    switch (typeParam) {
        case 'studio':
            return { role: 'designer', entityType: 'company', applicantType: 'studio' };
        case 'company':
            return { role: 'company', entityType: 'company', applicantType: 'company' };
        case 'foreman':
            return { role: 'foreman', entityType: entityParam === 'company' ? 'company' : 'personal', applicantType: 'foreman' };
        default:
            return { role: 'designer', entityType: 'personal', applicantType: 'personal' };
    }
};

const caseImageRuleText = (role: MerchantApplyRole, entityType: MerchantEntityType) => {
    if (role === 'designer') return entityType === 'company' ? '每套 6-12 张图' : '每套 4-12 张图';
    if (role === 'foreman') return '水电工 3-6 张，其余每类 2-6 张图';
    return '每套至少 3 张图';
};

const MerchantRegister: React.FC<MerchantRegisterProps> = ({
    mode = 'apply',
    completionData = null,
    onCompletionSubmitted,
}) => {
    const [searchParams] = useSearchParams();
    const phoneFromUrl = searchParams.get('phone') || '';
    const fromLogin = searchParams.get('from') || '';
    const resubmitId = searchParams.get('resubmit');
    const navigate = useNavigate();
    const isCompletionMode = mode === 'completion';
    const completionForm = completionData?.form;

    const applyMeta = useMemo(() => {
        if (isCompletionMode && completionForm) {
            const role = (completionForm.role || 'designer') as MerchantApplyRole;
            const entityType = (completionForm.entityType || 'personal') as MerchantEntityType;
            const applicantType = (completionForm.applicantType
                || (role === 'company'
                    ? 'company'
                    : role === 'foreman'
                        ? 'foreman'
                        : entityType === 'company'
                            ? 'studio'
                            : 'personal')) as MerchantApplicantType;
            return { role, entityType, applicantType };
        }
        return resolveApplyMeta(searchParams);
    }, [completionForm, isCompletionMode, searchParams]);
    const { role, entityType, applicantType } = applyMeta;

    const [currentStep, setCurrentStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [sendingCode, setSendingCode] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [showRedirectAlert, setShowRedirectAlert] = useState(!isCompletionMode && fromLogin.startsWith('login_'));
    const [form] = Form.useForm();
    const [portfolioCases, setPortfolioCases] = useState<PortfolioCase[]>(
        role === 'foreman' ? createForemanPortfolioCases() : [
            createEmptyPortfolioCase(),
            createEmptyPortfolioCase(),
            createEmptyPortfolioCase(),
        ]
    );
    const [styleOptions, setStyleOptions] = useState<string[]>([]);
    const [areaOptions, setAreaOptions] = useState<ServiceCityGroupOption[]>([]);
    const [uploadingCaseCountMap, setUploadingCaseCountMap] = useState<Record<number, number>>({});
    const [previewVisible, setPreviewVisible] = useState(false);
    const [previewImage, setPreviewImage] = useState('');
    const [resubmitLoading, setResubmitLoading] = useState(false);
    const [resubmitPrefillFailed, setResubmitPrefillFailed] = useState(false);
    const [phoneVerified, setPhoneVerified] = useState(false);
    const [verifiedPhone, setVerifiedPhone] = useState('');
    const [verificationToken, setVerificationToken] = useState('');
    const [verificationExpiresAt, setVerificationExpiresAt] = useState<number | null>(null);
    const [verificationContext, setVerificationContext] = useState<Pick<PhoneVerificationState, 'mode' | 'merchantKind' | 'applicationId'>>({
        mode: 'apply',
        merchantKind: 'provider',
        applicationId: undefined,
    });
    const watchedAvatar = Form.useWatch('avatar', form);
    const countdownTimerRef = useRef<number | null>(null);
    const draftRestoreHandledRef = useRef(false);

    const currentVerificationMode = resubmitId ? 'resubmit' as const : 'apply' as const;
    const currentVerificationApplicationId = resubmitId ? Number(resubmitId) : undefined;
    const currentVerificationMerchantKind = 'provider' as const;

    const draftStorageKey = useMemo(() => {
        if (isCompletionMode) {
            return `${DRAFT_STORAGE_KEY}:completion:${completionData?.applicationId || 'required'}`;
        }
        return resubmitId ? `${DRAFT_STORAGE_KEY}:resubmit:${resubmitId}` : DRAFT_STORAGE_KEY;
    }, [completionData?.applicationId, isCompletionMode, resubmitId]);

    const isForeman = role === 'foreman';
    const isCompanyRole = role === 'company';
    const isCompanyEntity = entityType === 'company' || role === 'company';
    const serviceAreaLabel = isForeman ? '常驻城市' : '服务城市';
    const realNameLabel = isCompanyEntity ? '法人/经营者姓名' : (isForeman ? '工长姓名' : '负责人姓名');
    const phoneLabel = isCompanyEntity ? '联系手机号' : '手机号';
    const idCardLabel = isCompanyEntity ? '法人/经营者身份证号' : '身份证号';
    const companyNameLabel = role === 'designer' ? '工作室/公司名称' : '公司名称';
    const hasPendingCaseUploads = useMemo(
        () => Object.values(uploadingCaseCountMap).some((count) => count > 0),
        [uploadingCaseCountMap],
    );

    useEffect(() => {
        const style = document.createElement('style');
        style.innerHTML = `
            .register-page-bg {
                background: linear-gradient(135deg, #f6f8fb 0%, #e9f0f9 100%);
                position: relative;
                overflow: visible;
                width: 100%;
                min-height: 100vh;
            }
            .register-page-bg::before {
                content: '';
                position: absolute;
                top: -10%;
                left: -10%;
                width: 60%;
                height: 60%;
                border-radius: 50%;
                background: radial-gradient(circle, rgba(24,144,255,0.08) 0%, rgba(24,144,255,0) 70%);
                z-index: 0;
            }
            .register-page-bg::after {
                content: '';
                position: absolute;
                bottom: -10%;
                right: -5%;
                width: 50%;
                height: 70%;
                border-radius: 50%;
                background: radial-gradient(circle, rgba(114,46,209,0.05) 0%, rgba(114,46,209,0) 70%);
                z-index: 0;
            }
            .glassmorphism-card {
                background: rgba(255, 255, 255, 0.75);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border: 1px solid rgba(255, 255, 255, 0.5);
                box-shadow: 0 24px 48px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.6);
                border-radius: 24px;
                position: relative;
                z-index: 1;
            }
            .premium-input .ant-input, .premium-input .ant-input-number-input, .premium-input .ant-select-selector {
                border-radius: 8px !important;
            }
            .glassmorphism-form .ant-form-item-label > label {
                font-weight: 500;
                color: #334155;
            }
            .step-title-gradient {
                background: -webkit-linear-gradient(45deg, #1890ff, #722ed1);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                font-weight: 700;
            }
            .premium-btn {
                border-radius: 8px;
                font-weight: 500;
                box-shadow: 0 4px 12px rgba(24,144,255,0.2);
            }
            .premium-case-card {
                border-radius: 16px;
                box-shadow: 0 8px 24px rgba(0,0,0,0.04);
                border: 1px solid #f0f0f0;
                transition: transform 0.3s;
            }
            .premium-case-card:hover {
                transform: translateY(-4px);
                box-shadow: 0 12px 32px rgba(0,0,0,0.08);
            }
            .animate-fade-in {
                animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
            @keyframes fadeInUp {
                from { opacity: 0; transform: translateY(16px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .premium-steps-dark .ant-steps-item-title {
                color: rgba(255,255,255,0.7) !important;
            }
            .premium-steps-dark .ant-steps-item-process .ant-steps-item-title,
            .premium-steps-dark .ant-steps-item-finish .ant-steps-item-title {
                color: #ffffff !important;
                font-weight: 600;
            }
            .premium-steps-dark .ant-steps-item-process .ant-steps-item-icon {
                background: #fff;
                border-color: #fff;
            }
            .premium-steps-dark .ant-steps-item-process .ant-steps-icon {
                color: #1890ff !important;
            }
            .premium-steps-dark .ant-steps-item-wait .ant-steps-item-icon {
                background: transparent;
                border-color: rgba(255,255,255,0.4);
            }
            .premium-steps-dark .ant-steps-item-wait .ant-steps-icon {
                color: rgba(255,255,255,0.6) !important;
            }
            .premium-form .ant-form-item-label > label {
                font-size: 15px;
            }
            .premium-case-card .ant-card-head {
                background: #f8fafc;
                border-bottom: 1px solid #f1f5f9;
                border-radius: 16px 16px 0 0;
            }
        `;
        document.head.appendChild(style);
        return () => { document.head.removeChild(style); };
    }, []);

    const requiresCompanyLicense = entityType === 'company' || isCompanyRole;
    const caseMinCount = isForeman ? 5 : 3;
    const caseMinImages = role === 'designer' ? (entityType === 'company' ? 6 : 4) : (role === 'foreman' ? 2 : 3);
    const caseMaxImages = role === 'designer' ? 12 : (role === 'foreman' ? 6 : 12);
    const flowSteps = useMemo(() => ([
        { title: '手机号验证' },
        { title: '基础信息' },
        { title: '资质上传' },
        { title: isForeman ? '施工案例' : '案例作品' },
        { title: '服务与报价' },
    ]), [isForeman]);
    const steps = isCompletionMode ? flowSteps.slice(1) : flowSteps;
    const flowStep = isCompletionMode ? currentStep + 1 : currentStep;

    const pageTitle = useMemo(() => {
        if (isCompletionMode) {
            if (role === 'company') return '装修公司正式入驻资料补全';
            if (role === 'foreman') return entityType === 'company' ? '工长正式入驻资料补全（公司主体）' : '工长正式入驻资料补全（个人主体）';
            return entityType === 'company' ? '设计师正式入驻资料补全（公司主体）' : '设计师正式入驻资料补全（个人主体）';
        }
        if (role === 'company') return '装修公司入驻申请';
        if (role === 'foreman') return entityType === 'company' ? '工长入驻申请（公司主体）' : '工长入驻申请（个人主体）';
        return entityType === 'company' ? '设计师入驻申请（公司主体）' : '设计师入驻申请（个人主体）';
    }, [entityType, isCompletionMode, role]);

    const validateLicenseRemote = useCallback(async (licenseNo: string, companyName?: string) => {
        const normalized = normalizeLicenseNo(licenseNo);
        if (!normalized) return;
        if (!isValidBusinessLicenseNo(normalized)) {
            throw new Error('请输入正确的统一社会信用代码/营业执照号');
        }
        const result = await onboardingValidationApi.validateLicense({
            licenseNo: normalized,
            companyName: companyName?.trim() || undefined,
        });
        if (!result.ok) {
            throw new Error(result.message || '统一社会信用代码/营业执照号校验失败');
        }
    }, []);

    const validateIdCardRemote = useCallback(async (idNo: string, realName: string) => {
        const normalizedID = String(idNo || '').trim().toUpperCase();
        const normalizedName = String(realName || '').trim();
        if (!normalizedID) return;
        if (!isValidChineseIDCard(normalizedID)) {
            throw new Error('身份证号校验失败，请检查号码是否有效');
        }
        if (!normalizedName) return;
        const result = await onboardingValidationApi.validateIdCard({ idNo: normalizedID, realName: normalizedName });
        if (!result.ok) {
            throw new Error(result.message || '身份证号校验失败');
        }
    }, []);

    const loadStyleOptions = useCallback(async () => {
        try {
            const options = await dictionaryApi.getOptions('style');
            setStyleOptions(options.map((option) => option.label));
        } catch {
            setStyleOptions(['现代简约', '北欧风格', '新中式', '轻奢风格', '美式风格', '欧式风格', '日式风格', '工业风格']);
        }
    }, []);

    const loadAreaOptions = useCallback(async () => {
        try {
            const cities = await regionApi.getServiceCities();
            setAreaOptions(buildServiceCityGroups(cities));
        } catch {
            setAreaOptions([
                {
                    label: '陕西省',
                    options: [{ label: '西安市', value: '610100' }],
                },
            ]);
        }
    }, []);

    const restoreDraft = useCallback(() => {
        if (draftRestoreHandledRef.current) {
            return;
        }
        draftRestoreHandledRef.current = true;

        const stored = sessionStorage.getItem(draftStorageKey);
        if (!stored) return;

        try {
            const draft = JSON.parse(stored) as {
                timestamp: number;
                currentStep: number;
                formValues: Record<string, unknown>;
                portfolioCases: PortfolioCase[];
            };

            if (Date.now() - draft.timestamp > DRAFT_EXPIRY_MS) {
                sessionStorage.removeItem(draftStorageKey)
                return;
            }

            Modal.confirm({
                title: '检测到未完成的申请',
                content: '是否恢复之前填写的内容？',
                okText: '恢复',
                cancelText: '清除',
                onOk: () => {
                    form.setFieldsValue(draft.formValues);
                    setCurrentStep(resubmitId ? 0 : draft.currentStep);
                    const restoredCases = normalizePortfolioCasesForForm(draft.portfolioCases, isForeman);
                    if (restoredCases.length > 0) {
                        setPortfolioCases(restoredCases);
                    }
                },
                onCancel: () => {
                    sessionStorage.removeItem(draftStorageKey)
                },
            });
        } catch {
            sessionStorage.removeItem(draftStorageKey)
        }
    }, [draftStorageKey, form, isForeman]);

    useEffect(() => {
        const baseValues: Record<string, unknown> = {
            role,
            entityType,
            applicantType,
            phone: phoneFromUrl || completionForm?.phone || undefined,
        };
        if (isCompletionMode && completionForm) {
            baseValues.realName = completionForm.realName;
            baseValues.avatar = completionForm.avatar;
            baseValues.idCardNo = completionForm.idCardNo;
            baseValues.idCardFront = completionForm.idCardFront;
            baseValues.idCardBack = completionForm.idCardBack;
            baseValues.companyName = completionForm.companyName;
            baseValues.licenseNo = completionForm.licenseNo;
            baseValues.licenseImage = completionForm.licenseImage;
            baseValues.legalPersonName = completionForm.legalPersonName;
            baseValues.legalPersonIdCardNo = completionForm.legalPersonIdCardNo;
            baseValues.legalPersonIdCardFront = completionForm.legalPersonIdCardFront;
            baseValues.legalPersonIdCardBack = completionForm.legalPersonIdCardBack;
            baseValues.teamSize = completionForm.teamSize;
            baseValues.officeAddress = completionForm.officeAddress;
            baseValues.yearsExperience = completionForm.yearsExperience;
            baseValues.highlightTags = completionForm.highlightTags;
            baseValues.graduateSchool = completionForm.graduateSchool;
            baseValues.designPhilosophy = completionForm.designPhilosophy;
            baseValues.serviceArea = completionForm.serviceAreaCodes || completionForm.serviceArea;
            baseValues.styles = completionForm.styles;
            baseValues.introduction = completionForm.introduction;
            baseValues.companyAlbum = completionForm.companyAlbum;
            baseValues.priceFlat = completionForm.pricing?.flat;
            baseValues.priceDuplex = completionForm.pricing?.duplex;
            baseValues.priceOther = completionForm.pricing?.other;
            baseValues.pricePerSqm = completionForm.pricing?.perSqm;
            baseValues.priceFullPackage = completionForm.pricing?.fullPackage;
            baseValues.priceHalfPackage = completionForm.pricing?.halfPackage;
        }
        form.setFieldsValue(baseValues);
        if (isCompletionMode && completionForm) {
            const completionCases = normalizePortfolioCasesForForm(completionForm.portfolioCases, isForeman);
            if (completionCases.length > 0) {
                setPortfolioCases(completionCases);
            }
        }
        void loadStyleOptions();
        void loadAreaOptions();
        void restoreDraft();
    }, [applicantType, completionForm, entityType, form, isCompletionMode, isForeman, phoneFromUrl, role, loadStyleOptions, loadAreaOptions, restoreDraft]);

    useEffect(() => {
        return () => {
            if (countdownTimerRef.current !== null) {
                clearInterval(countdownTimerRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (isCompletionMode) {
            setPhoneVerified(false);
            setVerifiedPhone('');
            setVerificationToken('');
            setVerificationExpiresAt(null);
            setVerificationContext({
                mode: currentVerificationMode,
                merchantKind: currentVerificationMerchantKind,
                applicationId: currentVerificationApplicationId,
            });
            sessionStorage.removeItem(VERIFICATION_STORAGE_KEY);
            return;
        }
        if (resubmitId) {
            setPhoneVerified(false);
            setVerifiedPhone('');
            setVerificationToken('');
            setVerificationExpiresAt(null);
            setVerificationContext({
                mode: currentVerificationMode,
                merchantKind: currentVerificationMerchantKind,
                applicationId: currentVerificationApplicationId,
            });
            sessionStorage.removeItem(VERIFICATION_STORAGE_KEY);
            return;
        }
        const stored = sessionStorage.getItem(VERIFICATION_STORAGE_KEY);
        if (!stored) {
            return;
        }
        try {
            const parsed = JSON.parse(stored) as PhoneVerificationState;
            const currentPhone = String(form.getFieldValue('phone') || phoneFromUrl || '').trim();
            const hasResubmitDraft = !resubmitId || Boolean(sessionStorage.getItem(draftStorageKey));
            if (
                hasResubmitDraft
                && parsed.phoneVerified
                && parsed.verifiedPhone === currentPhone
                && parsed.verificationExpiresAt > Date.now()
                && parsed.mode === currentVerificationMode
                && parsed.merchantKind === currentVerificationMerchantKind
                && ((currentVerificationApplicationId ?? 0) === (parsed.applicationId ?? 0))
            ) {
                setPhoneVerified(true);
                setVerifiedPhone(parsed.verifiedPhone);
                setVerificationToken(parsed.verificationToken);
                setVerificationExpiresAt(parsed.verificationExpiresAt);
                setVerificationContext({ mode: parsed.mode, merchantKind: parsed.merchantKind, applicationId: parsed.applicationId });
                return;
            }
        } catch {
            // ignore invalid cache
        }
        setPhoneVerified(false);
        setVerifiedPhone('');
        setVerificationToken('');
        setVerificationExpiresAt(null);
        setVerificationContext({ mode: currentVerificationMode, merchantKind: currentVerificationMerchantKind, applicationId: currentVerificationApplicationId });
        sessionStorage.removeItem(VERIFICATION_STORAGE_KEY);
    }, [currentVerificationApplicationId, currentVerificationMerchantKind, currentVerificationMode, draftStorageKey, form, isCompletionMode, phoneFromUrl, resubmitId]);

    const handleStepValidationError = useCallback((error: unknown, fallbackMessage = '请完善当前步骤必填信息') => {
        const errorFields = (
            typeof error === 'object'
            && error !== null
            && 'errorFields' in error
            && Array.isArray((error as { errorFields?: unknown[] }).errorFields)
        )
            ? (error as { errorFields: Array<{ name?: (string | number)[]; errors?: string[] }> }).errorFields
            : [];

        const firstField = errorFields[0];
        if (firstField?.name && firstField.name.length > 0) {
            form.scrollToField(firstField.name);
        }
        message.error(firstField?.errors?.[0] || fallbackMessage);
    }, [form]);

    const persistDraftSnapshot = useCallback((draft: {
        timestamp?: number;
        currentStep: number;
        formValues: Record<string, unknown>;
        portfolioCases: PortfolioCase[];
    }) => {
        sessionStorage.setItem(draftStorageKey, JSON.stringify({
            timestamp: draft.timestamp ?? Date.now(),
            currentStep: draft.currentStep,
            formValues: draft.formValues,
            portfolioCases: draft.portfolioCases,
        }));
    }, [draftStorageKey]);

    const saveDraft = (step = currentStep) => {
        const values = form.getFieldsValue(true);
        persistDraftSnapshot({
            currentStep: step,
            formValues: values,
            portfolioCases,
        });
    };

    const clearDraft = () => {
        sessionStorage.removeItem(draftStorageKey);
    };

    const clearPhoneVerification = useCallback(() => {
        setPhoneVerified(false);
        setVerifiedPhone('');
        setVerificationToken('');
        setVerificationExpiresAt(null);
        setVerificationContext({ mode: currentVerificationMode, merchantKind: currentVerificationMerchantKind, applicationId: currentVerificationApplicationId });
        sessionStorage.removeItem(VERIFICATION_STORAGE_KEY);
    }, [currentVerificationApplicationId, currentVerificationMerchantKind, currentVerificationMode]);

    const persistPhoneVerification = useCallback((state: PhoneVerificationState) => {
        setPhoneVerified(state.phoneVerified);
        setVerifiedPhone(state.verifiedPhone);
        setVerificationToken(state.verificationToken);
        setVerificationExpiresAt(state.verificationExpiresAt);
        setVerificationContext({ mode: state.mode, merchantKind: state.merchantKind, applicationId: state.applicationId });
        sessionStorage.setItem(VERIFICATION_STORAGE_KEY, JSON.stringify(state));
    }, []);

    const hasValidVerification = useCallback((phone: string) => {
        const normalizedPhone = String(phone || '').trim();
        return phoneVerified
            && verificationToken !== ''
            && verifiedPhone === normalizedPhone
            && verificationExpiresAt !== null
            && verificationExpiresAt > Date.now()
            && verificationContext.mode === currentVerificationMode
            && verificationContext.merchantKind === currentVerificationMerchantKind
            && (verificationContext.applicationId ?? 0) === (currentVerificationApplicationId ?? 0);
    }, [currentVerificationApplicationId, currentVerificationMerchantKind, currentVerificationMode, phoneVerified, verificationContext, verificationExpiresAt, verificationToken, verifiedPhone]);

    const hydrateResubmitDetail = useCallback((detail: MerchantApplyDetailData) => {
        form.setFieldsValue({
            phone: detail.phone || phoneFromUrl || undefined,
            role: detail.role || role,
            entityType: detail.entityType || entityType,
            applicantType: detail.applicantType || applicantType,
            realName: detail.realName,
            avatar: detail.avatar,
            idCardNo: detail.idCardNo,
            idCardFront: detail.idCardFront,
            idCardBack: detail.idCardBack,
            companyName: detail.companyName,
            licenseNo: detail.licenseNo,
            licenseImage: detail.licenseImage,
            legalPersonName: detail.legalPersonName,
            legalPersonIdCardNo: detail.legalPersonIdCardNo,
            legalPersonIdCardFront: detail.legalPersonIdCardFront,
            legalPersonIdCardBack: detail.legalPersonIdCardBack,
            teamSize: detail.teamSize,
            officeAddress: detail.officeAddress,
            yearsExperience: detail.yearsExperience,
            highlightTags: detail.highlightTags,
            graduateSchool: detail.graduateSchool,
            designPhilosophy: detail.designPhilosophy,
            serviceArea: detail.serviceAreaCodes || detail.serviceArea,
            styles: detail.styles,
            introduction: detail.introduction,
            companyAlbum: detail.companyAlbum,
            legalAccepted: false,
        });

        if (detail.pricing) {
            form.setFieldsValue({
                priceFlat: detail.pricing.flat,
                priceDuplex: detail.pricing.duplex,
                priceOther: detail.pricing.other,
                pricePerSqm: detail.pricing.perSqm,
                priceFullPackage: detail.pricing.fullPackage,
                priceHalfPackage: detail.pricing.halfPackage,
            });
        }

        if (Array.isArray(detail.portfolioCases) && detail.portfolioCases.length > 0) {
            setPortfolioCases(normalizePortfolioCasesForForm(detail.portfolioCases, isForeman));
        } else if (isForeman) {
            setPortfolioCases(createForemanPortfolioCases());
        }
    }, [applicantType, entityType, form, isForeman, phoneFromUrl, role]);

    const confirmReapplyWarning = useCallback((phone: string) => new Promise<boolean>((resolve) => {
        Modal.confirm({
            title: '检测到当前手机号已有其他商家身份',
            content: `继续申请新商家类型后，待新申请审核通过，旧商家身份将被冻结停用，本操作不可逆。请确认手机号 ${phone} 的申请操作。`,
            okText: '继续申请',
            cancelText: '取消',
            centered: true,
            onOk: () => resolve(true),
            onCancel: () => resolve(false),
        });
    }), []);

    const verifyPhoneAndMaybePrefill = useCallback(async (phone: string, code: string, allowReapply = false) => {
        setResubmitLoading(true);
        setResubmitPrefillFailed(false);
        try {
            const response = await onboardingValidationApi.verifyPhone<MerchantApplyDetailData>({
                phone,
                code,
                merchantKind: 'provider',
                mode: resubmitId ? 'resubmit' : 'apply',
                applicationId: resubmitId ? Number(resubmitId) : undefined,
                allowReapply: allowReapply || undefined,
            });
            const expiresAtMs = response.expiresAt ? getServerTimeMs(response.expiresAt) : Date.now() + VERIFICATION_EXPIRE_MS;
            persistPhoneVerification({
                phoneVerified: true,
                verifiedPhone: response.verifiedPhone || phone,
                verificationToken: response.verificationToken,
                verificationExpiresAt: expiresAtMs,
                mode: currentVerificationMode,
                merchantKind: currentVerificationMerchantKind,
                applicationId: currentVerificationApplicationId,
            });
            if (resubmitId && response.form) {
                hydrateResubmitDetail(response.form);
                const restoredCases = normalizePortfolioCasesForForm(response.form.portfolioCases, isForeman);
                persistDraftSnapshot({
                    currentStep: 1,
                    formValues: {
                        phone: response.form.phone || phone,
                        role: response.form.role || role,
                        entityType: response.form.entityType || entityType,
                        applicantType: response.form.applicantType || applicantType,
                        realName: response.form.realName,
                        avatar: response.form.avatar,
                        idCardNo: response.form.idCardNo,
                        idCardFront: response.form.idCardFront,
                        idCardBack: response.form.idCardBack,
                        companyName: response.form.companyName,
                        licenseNo: response.form.licenseNo,
                        licenseImage: response.form.licenseImage,
                        legalPersonName: response.form.legalPersonName,
                        legalPersonIdCardNo: response.form.legalPersonIdCardNo,
                        legalPersonIdCardFront: response.form.legalPersonIdCardFront,
                        legalPersonIdCardBack: response.form.legalPersonIdCardBack,
                        teamSize: response.form.teamSize,
                        officeAddress: response.form.officeAddress,
                        yearsExperience: response.form.yearsExperience,
                        highlightTags: response.form.highlightTags,
                        graduateSchool: response.form.graduateSchool,
                        designPhilosophy: response.form.designPhilosophy,
                        serviceArea: response.form.serviceAreaCodes || response.form.serviceArea,
                        styles: response.form.styles,
                        introduction: response.form.introduction,
                        companyAlbum: response.form.companyAlbum,
                        priceFlat: response.form.pricing?.flat,
                        priceDuplex: response.form.pricing?.duplex,
                        priceOther: response.form.pricing?.other,
                        pricePerSqm: response.form.pricing?.perSqm,
                        priceFullPackage: response.form.pricing?.fullPackage,
                        priceHalfPackage: response.form.pricing?.halfPackage,
                        legalAccepted: false,
                    },
                    portfolioCases: restoredCases.length > 0 ? restoredCases : portfolioCases,
                });
            }
            message.success(resubmitId ? '手机号校验成功，已回填原申请资料' : '手机号校验成功，可继续填写入驻资料');
            return true;
        } catch (error) {
            if (!resubmitId && !allowReapply && error instanceof MerchantApiError) {
                const guideData = (typeof error.data === 'object' && error.data !== null ? error.data : {}) as { nextAction?: string };
                if (error.code === 409 && guideData.nextAction === 'REAPPLY') {
                    const confirmed = await confirmReapplyWarning(phone);
                    if (confirmed) {
                        return verifyPhoneAndMaybePrefill(phone, code, true);
                    }
                    return false;
                }
            }
            clearPhoneVerification();
            setResubmitPrefillFailed(Boolean(resubmitId));
            message.error(getErrorMessage(error, resubmitId ? '原申请资料回填失败，请检查手机号与验证码' : '手机号校验失败，请检查后重试'));
            return false;
        } finally {
            setResubmitLoading(false);
        }
    }, [applicantType, clearPhoneVerification, confirmReapplyWarning, currentStep, currentVerificationApplicationId, currentVerificationMerchantKind, currentVerificationMode, entityType, hydrateResubmitDetail, persistDraftSnapshot, persistPhoneVerification, portfolioCases, resubmitId, role]);

    const validateImageBeforeUpload = (file: File, spec: typeof IMAGE_UPLOAD_SPECS.avatar) =>
        validateImageUploadBeforeSend(file, spec);

    const createSingleUploadHandler = (
        fieldName: 'avatar' | 'idCardFront' | 'idCardBack' | 'licenseImage',
    ): UploadProps['customRequest'] => async (options) => {
        try {
            const uploaded = await merchantUploadApi.uploadOnboardingImageData(options.file as File);
            form.setFieldsValue({ [fieldName]: uploaded.url });
            options.onSuccess?.(uploaded);
        } catch (error) {
            const errorMessage = getErrorMessage(error, '上传失败');
            message.error(errorMessage);
            options.onError?.(new Error(errorMessage));
        }
    };

    const toSingleUploadFileList = (value?: string): UploadFile[] => {
        if (!value) {
            return [];
        }
        return [{
            uid: value,
            name: value.split('/').pop() || 'uploaded-image',
            status: 'done',
            url: value,
        }];
    };

    const toCaseUploadFileList = (urls: string[]): UploadFile[] => (
        urls.map((url, index) => ({
            uid: `${url}-${index}`,
            name: url.split('/').pop() || `case-image-${index + 1}`,
            status: 'done',
            url,
        }))
    );

    const adjustCaseUploadingCount = (caseIndex: number, delta: number) => {
        setUploadingCaseCountMap((prev) => {
            const current = prev[caseIndex] || 0;
            const nextCount = Math.max(0, current + delta);
            if (nextCount === 0) {
                const { [caseIndex]: _, ...rest } = prev;
                return rest;
            }
            return {
                ...prev,
                [caseIndex]: nextCount,
            };
        });
    };

    const getCaseImageCountError = (imageCount: number, category?: ForemanCaseCategory) => {
        if (role === 'designer') {
            if (imageCount < caseMinImages) return `至少上传 ${caseMinImages} 张，当前 ${imageCount} 张`;
            if (imageCount > caseMaxImages) return `最多上传 ${caseMaxImages} 张，当前 ${imageCount} 张`;
            return '';
        }
        if (role === 'foreman') {
            const { min, max } = getForemanCaseImageBounds(category);
            if (imageCount < min) return `至少上传 ${min} 张，当前 ${imageCount} 张`;
            if (imageCount > max) return `最多上传 ${max} 张，当前 ${imageCount} 张`;
            return '';
        }
        if (imageCount < 3) {
            return `至少上传 3 张，当前 ${imageCount} 张`;
        }
        return '';
    };

    const handleCasePreview = (file: UploadFile) => {
        const previewUrl = typeof file.url === 'string'
            ? file.url
            : (file.response as { url?: string } | undefined)?.url;
        if (!previewUrl) {
            message.error('该图片暂不可预览，请等待上传完成后重试');
            return;
        }
        setPreviewImage(previewUrl);
        setPreviewVisible(true);
    };

    const handleSinglePreview = (file: UploadFile, fieldName: 'avatar' | 'idCardFront' | 'idCardBack' | 'licenseImage') => {
        const previewUrl = typeof file.url === 'string'
            ? file.url
            : (file.response as { url?: string } | undefined)?.url
                || form.getFieldValue(fieldName);
        if (!previewUrl) {
            message.error('该图片暂不可预览，请等待上传完成后重试');
            return;
        }
        setPreviewImage(previewUrl);
        setPreviewVisible(true);
    };

    const createCaseBeforeUpload = (caseIndex: number): UploadProps['beforeUpload'] => async (file, fileList) => {
        const basicValidation = await validateImageBeforeUpload(file as File, IMAGE_UPLOAD_SPECS.showcase);
        if (basicValidation !== true) {
            return basicValidation;
        }

        const existingCount = portfolioCases[caseIndex]?.images.length || 0;
        const maxImageCount = role === 'foreman'
            ? getForemanCaseImageBounds(portfolioCases[caseIndex]?.category).max
            : caseMaxImages;
        const remaining = maxImageCount - existingCount;
        if (remaining <= 0) {
            message.warning(`单套案例最多上传 ${maxImageCount} 张，已达到上限`);
            return Upload.LIST_IGNORE;
        }

        const currentIndexInBatch = fileList.findIndex((item) => item.uid === file.uid);
        if (currentIndexInBatch >= remaining) {
            message.warning(`单套案例最多上传 ${maxImageCount} 张，超出图片将被忽略`);
            return Upload.LIST_IGNORE;
        }

        return true;
    };

    const createCaseUploadHandler = (caseIndex: number): UploadProps['customRequest'] => async (options) => {
        const maxImageCount = role === 'foreman'
            ? getForemanCaseImageBounds(portfolioCases[caseIndex]?.category).max
            : caseMaxImages;
        const currentImages = portfolioCases[caseIndex]?.images || [];
        if (currentImages.length >= maxImageCount) {
            message.warning(`单套案例最多上传 ${maxImageCount} 张`);
            options.onError?.(new Error('已超过图片数量上限'));
            return;
        }

        adjustCaseUploadingCount(caseIndex, 1);
        try {
            const uploaded = await merchantUploadApi.uploadOnboardingImageData(options.file as File);
            options.onSuccess?.(uploaded);
            let reachedLimit = false;
            setPortfolioCases((prev) => {
                const next = [...prev];
                const current = next[caseIndex];
                if (!current) {
                    return prev;
                }
                if (current.images.includes(uploaded.url)) {
                    return prev;
                }
                const nextImages = [...current.images, uploaded.url].slice(0, maxImageCount);
                reachedLimit = nextImages.length === maxImageCount && current.images.length < maxImageCount;
                next[caseIndex] = {
                    ...current,
                    images: nextImages,
                };
                return next;
            });
            if (reachedLimit) {
                message.info(`已达到单套案例图片上限（${maxImageCount} 张）`);
            }
        } catch (error) {
            const errorMessage = getErrorMessage(error, '上传失败');
            message.error(errorMessage);
            options.onError?.(new Error(errorMessage));
        } finally {
            adjustCaseUploadingCount(caseIndex, -1);
        }
    };

    const handleCompanyAlbumUpload: UploadProps['customRequest'] = async (options) => {
        const currentImages = (form.getFieldValue('companyAlbum') || []) as string[];
        if (currentImages.length >= 8) {
            message.warning('公司相册最多上传 8 张');
            options.onError?.(new Error('已超过图片数量上限'));
            return;
        }
        try {
            const uploaded = await merchantUploadApi.uploadOnboardingImageData(options.file as File);
            options.onSuccess?.(uploaded);
            const latestImages = ((form.getFieldValue('companyAlbum') || []) as string[]).filter(Boolean);
            if (!latestImages.includes(uploaded.url)) {
                form.setFieldValue('companyAlbum', [...latestImages, uploaded.url].slice(0, 8));
            }
        } catch (error) {
            const errorMessage = getErrorMessage(error, '上传失败');
            message.error(errorMessage);
            options.onError?.(new Error(errorMessage));
        }
    };

    const validatePortfolioCases = () => {
        if (role === 'foreman') {
            for (const section of FOREMAN_CASE_SECTIONS) {
                const caseItem = portfolioCases.find((item) => item.category === section.category);
                const hasAnyContent = Boolean(caseItem?.description.trim() || (caseItem?.images.length || 0) > 0);
                if (section.required && !caseItem) {
                    message.error(`${section.title}不能为空`);
                    return false;
                }
                if (!caseItem) {
                    continue;
                }
                if (!section.required && !hasAnyContent) {
                    continue;
                }
                if (!caseItem.description.trim()) {
                    message.error(`${section.title}请填写工艺说明`);
                    return false;
                }
                if (caseItem.description.length > 5000) {
                    message.error(`${section.title}说明不能超过5000字`);
                    return false;
                }
                const { min, max } = getForemanCaseImageBounds(caseItem.category);
                if (caseItem.images.length < min || caseItem.images.length > max) {
                    message.error(`${section.title}图片数量需为 ${min}-${max} 张`);
                    return false;
                }
            }
            return true;
        }

        const validCases = portfolioCases.filter((caseItem) =>
            caseItem.title.trim() && caseItem.description.trim() && caseItem.images.length > 0
        );
        if (validCases.length < caseMinCount) {
            message.error(`请至少添加 ${caseMinCount} 套案例`);
            return false;
        }

        for (let index = 0; index < validCases.length; index += 1) {
            const caseItem = validCases[index];
            if (!caseItem.description.trim()) {
                message.error(`第 ${index + 1} 套案例请填写说明`);
                return false;
            }
            if (caseItem.description.length > 5000) {
                message.error(`第 ${index + 1} 套案例说明不能超过5000字`);
                return false;
            }
            if (role === 'designer' && (caseItem.images.length < caseMinImages || caseItem.images.length > caseMaxImages)) {
                message.error(`第 ${index + 1} 套案例图片数量需为 ${caseMinImages}-${caseMaxImages} 张`);
                return false;
            }
            if (role === 'company' && caseItem.images.length < 3) {
                message.error(`第 ${index + 1} 套案例至少上传 3 张图`);
                return false;
            }
        }

        return true;
    };

    const validatePricing = (values: Record<string, number | undefined>) => {
        const inRange = (value: number | undefined) =>
            typeof value === 'number' && Number.isFinite(value) && value >= PRICING_MIN && value <= PRICING_MAX;

        if (role === 'designer') {
            if (!inRange(values.priceFlat)) {
                message.error(`请填写平层报价（${PRICING_MIN}-${PRICING_MAX}）`);
                return false;
            }
            if (values.priceDuplex !== undefined && values.priceDuplex !== null && !inRange(values.priceDuplex)) {
                message.error(`复式报价需在 ${PRICING_MIN}-${PRICING_MAX} 之间`);
                return false;
            }
            if (values.priceOther !== undefined && values.priceOther !== null && !inRange(values.priceOther)) {
                message.error(`其他报价需在 ${PRICING_MIN}-${PRICING_MAX} 之间`);
                return false;
            }
        } else if (role === 'foreman') {
            if (!inRange(values.pricePerSqm)) {
                message.error(`请填写施工报价（${PRICING_MIN}-${PRICING_MAX}）`);
                return false;
            }
        } else if (!inRange(values.priceFullPackage) || !inRange(values.priceHalfPackage)) {
            message.error(`请填写全包 / 半包报价（${PRICING_MIN}-${PRICING_MAX}）`);
            return false;
        }

        return true;
    };

    const handleSendCode = async () => {
        try {
            await form.validateFields(['phone']);
        } catch {
            return;
        }

        setSendingCode(true);
        try {
            const phone = form.getFieldValue('phone');
            const response = await merchantAuthApi.sendCode(phone, 'identity_apply');
            if (import.meta.env.DEV && response?.debugCode) {
                console.debug(`[DEV] 验证码: ${response.debugCode}`);
            }
            message.success('验证码已发送');
            setCountdown(60);
            countdownTimerRef.current = window.setInterval(() => {
                setCountdown((prev) => {
                    if (prev <= 1) {
                        if (countdownTimerRef.current !== null) {
                            clearInterval(countdownTimerRef.current);
                            countdownTimerRef.current = null;
                        }
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } catch (error) {
            message.error(getErrorMessage(error, '发送失败'));
        } finally {
            setSendingCode(false);
        }
    };

    const handleNext = async () => {
        try {
            if (flowStep === 0) {
                const authValues = await form.validateFields(['phone', 'code']);
                const phone = String(authValues.phone || '').trim();
                const code = String(authValues.code || '').trim();
                if (!hasValidVerification(phone)) {
                    const ok = await verifyPhoneAndMaybePrefill(phone, code);
                    if (!ok) {
                        return;
                    }
                }
                if (showRedirectAlert) {
                    setShowRedirectAlert(false);
                }
            } else if (flowStep === 1) {
                const fields = ['realName', 'avatar', 'officeAddress'];
                if (entityType === 'company' || role === 'company') {
                    fields.push('companyName');
                }
                if (role === 'company') {
                    fields.push('companyAlbum');
                }
                await form.validateFields(fields);
            } else if (flowStep === 2) {
                const fields = ['idCardNo', 'idCardFront', 'idCardBack'];
                if (requiresCompanyLicense) {
                    fields.push('licenseNo', 'licenseImage');
                }
                if (isForeman) {
                    fields.push('yearsExperience');
                }
                if (role === 'designer') {
                    fields.push('yearsExperience');
                }
                await form.validateFields(fields);
            } else if (flowStep === 3) {
                if (hasPendingCaseUploads) {
                    message.warning('案例图片仍在上传中，请等待上传完成后再进入下一步');
                    return;
                }
                if (!validatePortfolioCases()) {
                    return;
                }
            }
            const nextStep = currentStep + 1;
            setCurrentStep(nextStep);
            saveDraft(nextStep);
        } catch (error) {
            handleStepValidationError(error);
        }
    };

    const handlePrev = () => {
        setCurrentStep((prev) => prev - 1);
    };

    const buildPricingPayload = (values: Record<string, number | undefined>): Record<string, number> => {
        const hasNumber = (value: number | undefined): value is number =>
            typeof value === 'number' && Number.isFinite(value);

        if (role === 'designer') {
            const pricing: Record<string, number> = {
                flat: Number(values.priceFlat),
            };
            if (hasNumber(values.priceDuplex)) {
                pricing.duplex = Number(values.priceDuplex);
            }
            if (hasNumber(values.priceOther)) {
                pricing.other = Number(values.priceOther);
            }
            return pricing;
        }
        if (role === 'foreman') {
            return {
                perSqm: Number(values.pricePerSqm),
            };
        }
        return {
            fullPackage: Number(values.priceFullPackage),
            halfPackage: Number(values.priceHalfPackage),
        };
    };

    const handleSubmit = async () => {
        const fields = ['realName', 'avatar', 'idCardNo', 'idCardFront', 'idCardBack', 'serviceArea', 'legalAccepted'];
        if (!isCompletionMode) {
            fields.unshift('phone');
        }
        if (requiresCompanyLicense) {
            fields.push('companyName', 'licenseNo', 'licenseImage');
        }
        if (role === 'designer') {
            fields.push('yearsExperience', 'styles', 'priceFlat', 'officeAddress');
        }
        if (role === 'foreman') {
            fields.push('yearsExperience', 'highlightTags', 'pricePerSqm', 'officeAddress');
        }
        if (role === 'company') {
            fields.push('priceFullPackage', 'priceHalfPackage', 'officeAddress', 'companyAlbum');
        }

        let validatedValues: Record<string, unknown>;
        try {
            validatedValues = await form.validateFields(fields);
        } catch {
            return;
        }

        const values = {
            ...form.getFieldsValue(true),
            ...validatedValues,
        };

        if (!isCompletionMode && !hasValidVerification(String(values.phone || '').trim())) {
            setCurrentStep(0);
            message.error('请先完成手机号验证码校验');
            return;
        }

        if (hasPendingCaseUploads) {
            message.warning('案例图片仍在上传中，请等待上传完成后再提交');
            return;
        }

        if (!validatePortfolioCases()) {
            return;
        }
        if (!validatePricing(values)) {
            return;
        }

        if (role === 'designer') {
            const styles = values.styles || [];
            if (styles.length < 1 || styles.length > 3) {
                message.error('设计师擅长风格需选择 1-3 个');
                return;
            }
        }

        if (role === 'foreman') {
            const highlightTags = values.highlightTags || [];
            if (highlightTags.length < 1 || highlightTags.length > 3) {
                message.error('工长施工亮点需选择 1-3 个');
                return;
            }
        }

        Modal.confirm({
            title: '确认提交',
            content: isCompletionMode ? '确认提交正式入驻资料补全？' : (resubmitId ? '确认重新提交申请？' : '确认提交入驻申请？'),
            okText: '确认',
            cancelText: '取消',
            onOk: async () => {
                setLoading(true);
                try {
                    const payloadBase = {
                        role,
                        entityType,
                        applicantType,
                        realName: String(values.realName || '').trim(),
                        avatar: String(values.avatar || '').trim(),
                        idCardNo: String(values.idCardNo || '').trim(),
                        idCardFront: String(values.idCardFront || '').trim(),
                        idCardBack: String(values.idCardBack || '').trim(),
                        companyName: values.companyName ? String(values.companyName).trim() : undefined,
                        licenseNo: values.licenseNo ? normalizeLicenseNo(String(values.licenseNo)) : undefined,
                        licenseImage: values.licenseImage ? String(values.licenseImage).trim() : undefined,
                        legalPersonName: isCompanyEntity ? String(values.realName || '').trim() : undefined,
                        legalPersonIdCardNo: isCompanyEntity ? String(values.idCardNo || '').trim().toUpperCase() : undefined,
                        legalPersonIdCardFront: isCompanyEntity ? String(values.idCardFront || '').trim() : undefined,
                        legalPersonIdCardBack: isCompanyEntity ? String(values.idCardBack || '').trim() : undefined,
                        teamSize: values.teamSize,
                        officeAddress: String(values.officeAddress || '').trim(),
                        yearsExperience: values.yearsExperience,
                        serviceArea: values.serviceArea || [],
                        styles: role === 'designer' ? values.styles || [] : [],
                        highlightTags: role === 'foreman' ? values.highlightTags || [] : [],
                        pricing: buildPricingPayload(values),
                        introduction: values.introduction,
                        graduateSchool: values.graduateSchool,
                        designPhilosophy: values.designPhilosophy,
                        companyAlbum: role === 'company' ? (values.companyAlbum || []) : undefined,
                        portfolioCases: portfolioCases
                            .filter((caseItem) => caseItem.description.trim() && caseItem.images.length > 0)
                            .map((caseItem) => ({
                                title: isForeman ? (FOREMAN_CASE_SECTIONS.find((section) => section.category === caseItem.category)?.title || caseItem.title.trim()) : caseItem.title.trim(),
                                category: caseItem.category,
                                description: caseItem.description.trim(),
                                images: caseItem.images,
                                style: isForeman ? undefined : caseItem.style,
                                area: isForeman ? undefined : caseItem.area,
                            })),
                        legalAcceptance: {
                            accepted: true,
                            onboardingAgreementVersion: ONBOARDING_AGREEMENT_VERSION,
                            platformRulesVersion: PLATFORM_RULES_VERSION,
                            privacyDataProcessingVersion: PRIVACY_DATA_PROCESSING_VERSION,
                        },
                    };

                    const result = isCompletionMode
                        ? await merchantCompletionApi.submit(payloadBase as MerchantCompletionSubmitPayload)
                        : resubmitId
                            ? await merchantApplyApi.resubmit(Number(resubmitId), {
                                ...(payloadBase as MerchantApplyPayload),
                                phone: String(values.phone || '').trim(),
                                code: String(values.code || '').trim(),
                                verificationToken,
                                resubmitToken: resubmitId ? (verificationToken || undefined) : undefined,
                            })
                            : await merchantApplyApi.apply({
                                ...(payloadBase as MerchantApplyPayload),
                                phone: String(values.phone || '').trim(),
                                code: String(values.code || '').trim(),
                                verificationToken,
                                resubmitToken: undefined,
                            });

                    if (!result.applicationId) {
                        message.error('提交失败：申请编号缺失');
                        return;
                    }

                    clearDraft();
                    if (isCompletionMode) {
                        message.success('补全资料已提交，请等待审核');
                        await onCompletionSubmitted?.();
                        return;
                    }

                    message.success(resubmitId ? '已重新提交，请等待审核' : '申请已提交，请等待审核');
                    navigate(`/apply-status?phone=${encodeURIComponent(String(values.phone || ''))}`);
                } catch (error) {
                    message.error(getErrorMessage(error, '提交失败'));
                } finally {
                    setLoading(false);
                }
            },
        });
    };

    const updatePortfolioCase = (index: number, field: keyof PortfolioCase, value: PortfolioCase[keyof PortfolioCase]) => {
        setPortfolioCases((prev) => {
            const next = [...prev];
            next[index] = {
                ...next[index],
                [field]: value,
            };
            return next;
        });
    };

    const addPortfolioCase = () => {
        if (isForeman) {
            return;
        }
        setPortfolioCases((prev) => [...prev, createEmptyPortfolioCase()]);
    };

    const removePortfolioCase = (index: number) => {
        if (isForeman) {
            return;
        }
        setPortfolioCases((prev) => {
            if (prev.length <= caseMinCount) {
                message.warning(`至少保留 ${caseMinCount} 套案例`);
                return prev;
            }
            return prev.filter((_, currentIndex) => currentIndex !== index);
        });
    };

    const renderStepContent = () => {
        switch (flowStep) {
            case 0:
                return (
                    <div className="animate-fade-in glassmorphism-form">
                        <Title level={4} style={{ marginBottom: 8, color: '#1e293b' }}>手机号验证</Title>
                        <Text style={{ display: 'block', marginBottom: 24, color: '#64748b', lineHeight: 1.75 }}>请先完成手机号验证码校验，验证通过后再继续填写入驻资料。</Text>
                        <Form.Item
                            name="phone"
                            label={phoneLabel}
                            rules={[
                                { required: true, message: '请输入手机号' },
                                { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号' },
                            ]}
                        >
                            <Input className="premium-input"
                                prefix={<PhoneOutlined aria-hidden="true" />}
                                placeholder={isCompanyEntity ? '请输入联系手机号' : '请输入11位手机号'}
                                maxLength={11}
                                aria-label="手机号"
                                aria-required="true"
                                readOnly={Boolean(resubmitId && phoneFromUrl)}
                                disabled={Boolean(resubmitId && phoneFromUrl)}
                                data-testid="merchant-register-phone-input"
                                onChange={(event) => {
                                    const nextPhone = event.target.value.replace(/\D/g, '').slice(0, 11);
                                    form.setFieldsValue({ phone: nextPhone });
                                    if (phoneVerified && nextPhone !== verifiedPhone) {
                                        clearPhoneVerification();
                                    }
                                }}
                            />
                        </Form.Item>
                        <Form.Item
                            name="code"
                            label="验证码"
                            rules={[
                                { required: true, message: '请输入验证码' },
                                { pattern: /^\d{6}$/, message: '请输入6位验证码' },
                            ]}
                        >
                            <Input className="premium-input"
                                prefix={<SafetyOutlined aria-hidden="true" />}
                                placeholder="请输入6位验证码"
                                maxLength={6}
                                aria-label="验证码"
                                aria-required="true"
                                onChange={(event) => {
                                    const nextCode = event.target.value.replace(/\D/g, '').slice(0, 6);
                                    form.setFieldsValue({ code: nextCode });
                                    if (phoneVerified) {
                                        clearPhoneVerification();
                                    }
                                }}
                                suffix={(
                                    <Button
                                        type="link"
                                        size="small"
                                        disabled={countdown > 0 || sendingCode}
                                        onClick={handleSendCode}
                                        loading={sendingCode}
                                        aria-label={countdown > 0 ? `${countdown}秒后可重新获取验证码` : '获取验证码'}
                                    >
                                        {countdown > 0 ? `${countdown}s` : '获取验证码'}
                                    </Button>
                                )}
                            />
                        </Form.Item>
                    </div>
                );

            case 1:
                return (
                    <div className="animate-fade-in glassmorphism-form">
                        <Title level={4} style={{ marginBottom: 24, color: '#1e293b' }}>基础信息</Title>
                        <Form.Item
                            name="realName"
                            label={realNameLabel}
                            validateTrigger="onBlur"
                            rules={[
                                { required: true, message: `请输入${realNameLabel}` },
                                {
                                    validator: (_, value) => {
                                        const normalized = String(value || '').trim();
                                        if (!normalized) {
                                            return Promise.resolve();
                                        }
                                        if (normalized.length < 2 || normalized.length > 20) {
                                            return Promise.reject(new Error('姓名长度应在2-20个字符之间'));
                                        }
                                        const currentIdNo = String(form.getFieldValue('idCardNo') || '').trim();
                                        if (!currentIdNo || !isValidChineseIDCard(currentIdNo)) {
                                            return Promise.resolve();
                                        }
                                        return validateIdCardRemote(currentIdNo, normalized);
                                    },
                                },
                            ]}
                        >
                            <Input className="premium-input"
                                prefix={<UserOutlined aria-hidden="true" />}
                                placeholder={`请输入${realNameLabel}`}
                                maxLength={20}
                                aria-label={realNameLabel}
                                aria-required="true"
                            />
                        </Form.Item>
                        <Form.Item
                            label="头像"
                            required
                            validateStatus={form.getFieldError('avatar').length > 0 ? 'error' : undefined}
                            help={form.getFieldError('avatar')[0]}
                        >
                            <Form.Item name="avatar" hidden rules={[{ required: true, message: '请上传头像' }]}>
                                <Input />
                            </Form.Item>
                            <ImgCrop rotationSlider cropShape="round" aspect={1} showReset showGrid>
                                <Upload
                                    listType="picture-card"
                                    fileList={toSingleUploadFileList(typeof watchedAvatar === 'string' ? watchedAvatar : undefined)}
                                    maxCount={1}
                                    accept=".jpg,.jpeg,.png"
                                    beforeUpload={(file) => validateImageBeforeUpload(file as File, IMAGE_UPLOAD_SPECS.avatar)}
                                    customRequest={createSingleUploadHandler('avatar')}
                                    onPreview={(file) => handleSinglePreview(file, 'avatar')}
                                    onRemove={() => {
                                        form.setFieldsValue({ avatar: undefined });
                                        void form.validateFields(['avatar']).catch(() => undefined);
                                        return true;
                                    }}
                                    aria-label="上传头像"
                                >
                                    <div>
                                        <PictureOutlined style={{ fontSize: 24 }} aria-hidden="true" />
                                        <div style={{ marginTop: 8 }}>上传头像</div>
                                    </div>
                                </Upload>
                            </ImgCrop>
                        </Form.Item>

                        {(entityType === 'company' || role === 'company') && (
                            <>
                                <Form.Item
                                    name="companyName"
                                    label={companyNameLabel}
                                    validateTrigger="onBlur"
                                    rules={[
                                        { required: true, message: '请输入公司名称' },
                                        { max: 100, message: '名称最多100个字符' },
                                        {
                                            validator: (_, value) => {
                                                const companyName = String(value || '').trim();
                                                if (!companyName) {
                                                    return Promise.resolve();
                                                }
                                                const currentLicenseNo = String(form.getFieldValue('licenseNo') || '').trim();
                                                if (!currentLicenseNo || !isValidBusinessLicenseNo(currentLicenseNo)) {
                                                    return Promise.resolve();
                                                }
                                                return validateLicenseRemote(currentLicenseNo, companyName);
                                            },
                                        },
                                    ]}
                                >
                                    <Input className="premium-input"
                                        placeholder="请输入公司名称 / 个体名称"
                                        maxLength={100}
                                        aria-label={companyNameLabel}
                                        aria-required="true"
                                    />
                                </Form.Item>

                                <Form.Item name="teamSize" label="团队规模">
                                    <Select className="premium-input"
                                        placeholder="选择团队规模"
                                        aria-label="团队规模"
                                    >
                                        <Select.Option value={1}>1人</Select.Option>
                                        <Select.Option value={5}>2-5人</Select.Option>
                                        <Select.Option value={10}>6-10人</Select.Option>
                                        <Select.Option value={20}>11-20人</Select.Option>
                                        <Select.Option value={50}>20人以上</Select.Option>
                                    </Select>
                                </Form.Item>

                                {role === 'company' && (
                                    <Form.Item
                                        name="companyAlbum"
                                        label="公司相册"
                                        rules={[{ validator: (_, value) => Array.isArray(value) && value.length >= 3 && value.length <= 8 ? Promise.resolve() : Promise.reject(new Error('请上传 3-8 张公司相册')) }]}
                                    >
                                        <Upload
                                            listType="picture-card"
                                            multiple
                                            maxCount={8}
                                            fileList={toCaseUploadFileList(form.getFieldValue('companyAlbum') || [])}
                                            accept=".jpg,.jpeg,.png"
                                            beforeUpload={async (file, fileList) => {
                                                const basicValidation = await validateImageBeforeUpload(file as File, IMAGE_UPLOAD_SPECS.showcase);
                                                if (basicValidation !== true) {
                                                    return basicValidation;
                                                }
                                                const current = (form.getFieldValue('companyAlbum') || []) as string[];
                                                const remaining = 8 - current.length;
                                                const currentIndexInBatch = fileList.findIndex((item) => item.uid === file.uid);
                                                return currentIndexInBatch >= remaining ? Upload.LIST_IGNORE : true;
                                            }}
                                            customRequest={handleCompanyAlbumUpload}
                                            onPreview={handleCasePreview}
                                            onRemove={(file) => {
                                                const url = file.url || (file.response as { url?: string } | undefined)?.url;
                                                if (!url) return false;
                                                const current = (form.getFieldValue('companyAlbum') || []) as string[];
                                                form.setFieldValue('companyAlbum', current.filter((image) => image !== url));
                                                return true;
                                            }}
                                        >
                                            {((form.getFieldValue('companyAlbum') || []) as string[]).length < 8 ? (
                                                <div>
                                                    <PictureOutlined aria-hidden="true" />
                                                    <div style={{ marginTop: 8 }}>上传图片</div>
                                                </div>
                                            ) : null}
                                        </Upload>
                                        <div style={{ marginTop: 8, color: '#8c8c8c' }}>请上传 3-8 张公司展示图片</div>
                                    </Form.Item>
                                )}
                            </>
                        )}

                        <Form.Item
                            name="officeAddress"
                            label="常驻地址"
                            rules={[{ required: true, message: '请输入常驻地址' }]}
                        >
                            <Input className="premium-input"
                                prefix={<EnvironmentOutlined aria-hidden="true" />}
                                placeholder="请输入常驻地址"
                                maxLength={200}
                                aria-label="常驻地址"
                                aria-required="true"
                            />
                        </Form.Item>
                    </div>
                );

            case 2:
                return (
                    <div className="animate-fade-in glassmorphism-form">
                        <Title level={4} style={{ marginBottom: 24, color: '#1e293b' }}>资质上传</Title>
                        <Form.Item
                            name="idCardNo"
                            label={idCardLabel}
                            validateTrigger="onBlur"
                            rules={[
                                { required: true, message: `请输入${idCardLabel}` },
                                { pattern: /^\d{17}[\dXx]$/, message: '请输入正确的18位身份证号' },
                                {
                                    validator: (_, value) => {
                                        const id = String(value || '').trim().toUpperCase();
                                        if (!id) {
                                            return Promise.resolve();
                                        }
                                        if (!isValidChineseIDCard(id)) {
                                            return Promise.reject(new Error('身份证号校验失败，请检查号码是否有效'));
                                        }
                                        const currentName = String(form.getFieldValue('realName') || '').trim();
                                        if (!currentName) {
                                            return Promise.resolve();
                                        }
                                        return validateIdCardRemote(id, currentName);
                                    },
                                },
                            ]}
                        >
                            <Input className="premium-input"
                                placeholder={`请输入${idCardLabel}`}
                                maxLength={18}
                                aria-label={idCardLabel}
                                aria-required="true"
                            />
                        </Form.Item>

                        <Row gutter={16}>
                            <Col xs={24} sm={12}>
                                <Form.Item
                                    name="idCardFront"
                                    label={isCompanyEntity ? '法人/经营者身份证正面' : '身份证正面'}
                                    valuePropName="fileList"
                                    getValueProps={(value: unknown) => ({
                                        fileList: typeof value === 'string' ? toSingleUploadFileList(value) : [],
                                    })}
                                    getValueFromEvent={() => form.getFieldValue('idCardFront')}
                                    rules={[{ required: true, message: '请上传身份证正面' }]}
                                >
                                    <Upload
                                        listType="picture-card"
                                        maxCount={1}
                                        accept=".jpg,.jpeg,.png"
                                        beforeUpload={(file) => validateImageBeforeUpload(file as File, IMAGE_UPLOAD_SPECS.onboardingDoc)}
                                        customRequest={createSingleUploadHandler('idCardFront')}
                                        onPreview={(file) => handleSinglePreview(file, 'idCardFront')}
                                        onRemove={() => {
                                            form.setFieldsValue({ idCardFront: undefined });
                                            return true;
                                        }}
                                        aria-label="上传身份证正面照片"
                                    >
                                        <div>
                                            <IdcardOutlined style={{ fontSize: 24 }} aria-hidden="true" />
                                            <div style={{ marginTop: 8 }}>上传正面</div>
                                        </div>
                                    </Upload>
                                </Form.Item>
                            </Col>
                            <Col xs={24} sm={12}>
                                <Form.Item
                                    name="idCardBack"
                                    label={isCompanyEntity ? '法人/经营者身份证反面' : '身份证反面'}
                                    valuePropName="fileList"
                                    getValueProps={(value: unknown) => ({
                                        fileList: typeof value === 'string' ? toSingleUploadFileList(value) : [],
                                    })}
                                    getValueFromEvent={() => form.getFieldValue('idCardBack')}
                                    rules={[{ required: true, message: '请上传身份证反面' }]}
                                >
                                    <Upload
                                        listType="picture-card"
                                        maxCount={1}
                                        accept=".jpg,.jpeg,.png"
                                        beforeUpload={(file) => validateImageBeforeUpload(file as File, IMAGE_UPLOAD_SPECS.onboardingDoc)}
                                        customRequest={createSingleUploadHandler('idCardBack')}
                                        onPreview={(file) => handleSinglePreview(file, 'idCardBack')}
                                        onRemove={() => {
                                            form.setFieldsValue({ idCardBack: undefined });
                                            return true;
                                        }}
                                        aria-label="上传身份证反面照片"
                                    >
                                        <div>
                                            <IdcardOutlined style={{ fontSize: 24 }} aria-hidden="true" />
                                            <div style={{ marginTop: 8 }}>上传反面</div>
                                        </div>
                                    </Upload>
                                </Form.Item>
                            </Col>
                        </Row>

                        {requiresCompanyLicense && (
                            <>
                                <Divider aria-hidden="true">企业资质</Divider>
                                <Form.Item
                                    name="licenseNo"
                                    label="统一社会信用代码 / 营业执照号"
                                    validateTrigger="onBlur"
                                    rules={[
                                        { required: true, message: '请输入统一社会信用代码 / 营业执照号' },
                                        {
                                            validator: (_, value) => {
                                                const licenseNo = normalizeLicenseNo(String(value || ''));
                                                if (!licenseNo) {
                                                    return Promise.resolve();
                                                }
                                                if (!isValidBusinessLicenseNo(licenseNo)) {
                                                    return Promise.reject(new Error('请输入正确的统一社会信用代码/营业执照号'));
                                                }
                                                const companyName = String(form.getFieldValue('companyName') || '').trim();
                                                if (!companyName) {
                                                    return Promise.resolve();
                                                }
                                                return validateLicenseRemote(licenseNo, companyName);
                                            },
                                        },
                                    ]}
                                >
                                    <Input className="premium-input"
                                        placeholder="请输入18位统一社会信用代码或15位旧营业执照号"
                                        maxLength={18}
                                        aria-label="统一社会信用代码或营业执照号"
                                        onBlur={(event) => {
                                            const normalized = normalizeLicenseNo(event.target.value);
                                            if (normalized !== event.target.value) {
                                                form.setFieldsValue({ licenseNo: normalized });
                                            }
                                        }}
                                        aria-required="true"
                                    />
                                </Form.Item>
                                <Form.Item
                                    name="licenseImage"
                                    label="营业执照图片"
                                    valuePropName="fileList"
                                    getValueProps={(value: unknown) => ({
                                        fileList: typeof value === 'string' ? toSingleUploadFileList(value) : [],
                                    })}
                                    getValueFromEvent={() => form.getFieldValue('licenseImage')}
                                    rules={[{ required: true, message: '请上传营业执照' }]}
                                >
                                    <Upload
                                        listType="picture-card"
                                        maxCount={1}
                                        accept=".jpg,.jpeg,.png"
                                        beforeUpload={(file) => validateImageBeforeUpload(file as File, IMAGE_UPLOAD_SPECS.onboardingDoc)}
                                        customRequest={createSingleUploadHandler('licenseImage')}
                                        onPreview={(file) => handleSinglePreview(file, 'licenseImage')}
                                        onRemove={() => {
                                            form.setFieldsValue({ licenseImage: undefined });
                                            return true;
                                        }}
                                        aria-label="上传营业执照照片"
                                    >
                                        <div>
                                            <PictureOutlined style={{ fontSize: 24 }} aria-hidden="true" />
                                            <div style={{ marginTop: 8 }}>上传执照</div>
                                        </div>
                                    </Upload>
                                </Form.Item>
                            </>
                        )}

                        {isForeman && (
                            <>
                                <Divider aria-hidden="true">施工信息</Divider>
                                <Form.Item
                                    name="yearsExperience"
                                    label="施工经验（年）"
                                    rules={[{ required: true, message: '请选择施工经验' }]}
                                >
                                    <Select className="premium-input"
                                        placeholder="选择施工经验"
                                        aria-label="施工经验年限"
                                        aria-required="true"
                                    >
                                        {[1, 2, 3, 5, 8, 10, 15, 20, 30].map((year) => (
                                            <Select.Option key={year} value={year}>{year}年以上</Select.Option>
                                        ))}
                                    </Select>
                                </Form.Item>
                            </>
                        )}
                        {role === 'designer' && (
                            <>
                                <Divider aria-hidden="true">从业信息</Divider>
                                <Form.Item
                                    name="yearsExperience"
                                    label="从业经验（年）"
                                    rules={[{ required: true, message: '请选择从业经验' }]}
                                >
                                    <Select className="premium-input" placeholder="选择从业经验" aria-label="从业经验年限" aria-required="true">
                                        {[1, 2, 3, 5, 8, 10, 15, 20, 30, 40, 50].map((year) => (
                                            <Select.Option key={year} value={year}>{year}年以上</Select.Option>
                                        ))}
                                    </Select>
                                </Form.Item>
                            </>
                        )}
                    </div>
                );

            case 3:
                return (
                    <div className="animate-fade-in glassmorphism-form">
                        <Title level={4} style={{ marginBottom: 24, color: '#1e293b' }}>
                            案例上传 <Text type="secondary" style={{ fontSize: 14, fontWeight: 'normal' }}>（至少 {caseMinCount} 套，{caseImageRuleText(role, entityType)}）</Text>
                        </Title>
                        {portfolioCases.map((caseItem, index) => {
                            const section = isForeman ? FOREMAN_CASE_SECTIONS.find((item) => item.category === caseItem.category) : undefined;
                            return (
                                <Card
                                    key={caseItem.id}
                                    size="small"
                                    className="premium-case-card"
                                    title={isForeman ? section?.title : `案例 ${index + 1}`}
                                    extra={(!isForeman && (
                                        <Button
                                            type="link"
                                            danger
                                            icon={<DeleteOutlined />}
                                            onClick={() => removePortfolioCase(index)}
                                            disabled={portfolioCases.length <= caseMinCount}
                                            aria-label={`删除案例 ${index + 1}`}
                                        >
                                            删除案例
                                        </Button>
                                    )) || undefined}
                                    style={{ marginBottom: 16 }}
                                    role="region"
                                    aria-label={isForeman ? (section?.title || `案例 ${index + 1}`) : `案例 ${index + 1}`}
                                >
                                    {!isForeman && (
                                        <Form.Item label="案例标题" required>
                                            <Input
                                                className="premium-input"
                                                placeholder="例如：现代简约三居室"
                                                value={caseItem.title}
                                                maxLength={50}
                                                onChange={(event) => updatePortfolioCase(index, 'title', event.target.value)}
                                                aria-label={`案例 ${index + 1} 标题`}
                                                aria-required="true"
                                            />
                                        </Form.Item>
                                    )}
                                    <Form.Item label={isForeman ? '工艺说明' : '案例说明'} required={Boolean(isForeman ? section?.required || caseItem.description || caseItem.images.length : true)}>
                                        <TextArea
                                            className="premium-input"
                                            rows={3}
                                            placeholder={isForeman ? '建议填写主要辅材品牌名、施工工序、节点做法与验收标准。' : '请输入案例说明'}
                                            value={caseItem.description}
                                            maxLength={5000}
                                            showCount
                                            onChange={(event) => updatePortfolioCase(index, 'description', event.target.value)}
                                            aria-label={`${isForeman ? (section?.title || '案例') : `案例 ${index + 1}`} 说明`}
                                        />
                                    </Form.Item>
                                    {!isForeman && (
                                        <Row gutter={16}>
                                            <Col xs={24} sm={12}>
                                                <Form.Item label="风格">
                                                    <Select className="premium-input" placeholder="选择风格" value={caseItem.style || undefined} onChange={(value) => updatePortfolioCase(index, 'style', value)} aria-label={`案例 ${index + 1} 风格`}>
                                                        {styleOptions.map((style) => (
                                                            <Select.Option key={style} value={style}>{style}</Select.Option>
                                                        ))}
                                                    </Select>
                                                </Form.Item>
                                            </Col>
                                            <Col xs={24} sm={12}>
                                                <Form.Item label="面积">
                                                    <Select className="premium-input" placeholder="选择面积区间" value={caseItem.area || undefined} onChange={(value) => updatePortfolioCase(index, 'area', value)} aria-label={`案例 ${index + 1} 面积`}>
                                                        {CASE_AREA_OPTIONS.map((area) => (
                                                            <Select.Option key={area} value={area}>{area}</Select.Option>
                                                        ))}
                                                    </Select>
                                                </Form.Item>
                                            </Col>
                                        </Row>
                                    )}
                                    <Form.Item label={isForeman ? '施工图片' : '案例图片'} required>
                                        <Upload
                                            listType="picture-card"
                                            multiple
                                            maxCount={role === 'foreman' ? getForemanCaseImageBounds(caseItem.category).max : caseMaxImages}
                                            fileList={toCaseUploadFileList(caseItem.images)}
                                            accept=".jpg,.jpeg,.png"
                                            beforeUpload={createCaseBeforeUpload(index)}
                                            customRequest={createCaseUploadHandler(index)}
                                            onPreview={handleCasePreview}
                                            onRemove={(file) => {
                                                const url = file.url || (file.response as { url?: string } | undefined)?.url;
                                                if (!url) {
                                                    return false;
                                                }
                                                setPortfolioCases((prev) => {
                                                    const next = [...prev];
                                                    const current = next[index];
                                                    if (!current) {
                                                        return prev;
                                                    }
                                                    next[index] = {
                                                        ...current,
                                                        images: current.images.filter((image) => image !== url),
                                                    };
                                                    return next;
                                                });
                                                return true;
                                            }}
                                            aria-label={`${isForeman ? (section?.title || '案例') : `案例 ${index + 1}`} 图片`}
                                        >
                                            {caseItem.images.length < (role === 'foreman' ? getForemanCaseImageBounds(caseItem.category).max : caseMaxImages) ? (
                                                <div>
                                                    <PictureOutlined aria-hidden="true" />
                                                    <div style={{ marginTop: 8 }}>上传图片</div>
                                                </div>
                                            ) : null}
                                        </Upload>
                                        <div style={{ marginTop: 8, color: getCaseImageCountError(caseItem.images.length, caseItem.category) ? '#ff4d4f' : '#8c8c8c' }}>
                                            {getCaseImageCountError(caseItem.images.length, caseItem.category) || `已上传 ${caseItem.images.length} 张，可一次选择多张`}
                                        </div>
                                    </Form.Item>
                                </Card>
                            );
                        })}
                        {!isForeman && (
                            <Button type="dashed" block onClick={addPortfolioCase} aria-label="添加更多案例">+ 添加更多案例</Button>
                        )}
                    </div>
                );

            case 4:
                return (
                    <div className="animate-fade-in glassmorphism-form">
                        <Title level={4} style={{ marginBottom: 24, color: '#1e293b' }}>服务与报价</Title>
                        <Form.Item
                            name="serviceArea"
                            label={serviceAreaLabel}
                            rules={[{ required: true, message: `请选择${serviceAreaLabel}` }]}
                        >
                            <Select className="premium-input"
                                mode="multiple"
                                placeholder={`选择${serviceAreaLabel}`}
                                aria-label={serviceAreaLabel}
                                aria-required="true"
                                options={areaOptions}
                                optionFilterProp="label"
                            />
                        </Form.Item>

                        {role === 'designer' && (
                            <Form.Item
                                name="styles"
                                label="擅长风格（1-3个）"
                                rules={[{ required: true, message: '请选择擅长风格' }]}
                            >
                                <Select className="premium-input"
                                    mode="multiple"
                                    placeholder="选择擅长风格"
                                    maxCount={3}
                                    maxTagCount={3}
                                    aria-label="擅长风格"
                                    aria-required="true"
                                >
                                    {styleOptions.map((style) => (
                                        <Select.Option key={style} value={style}>{style}</Select.Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        )}

                        {role === 'foreman' && (
                            <Form.Item
                                name="highlightTags"
                                label="施工亮点（1-3个）"
                                rules={[{ required: true, message: '请选择施工亮点' }]}
                            >
                                <Select className="premium-input"
                                    mode="multiple"
                                    placeholder="选择施工亮点"
                                    maxCount={3}
                                    maxTagCount={3}
                                    aria-label="施工亮点"
                                    aria-required="true"
                                >
                                    {FOREMAN_HIGHLIGHT_OPTIONS.map((tag) => (
                                        <Select.Option key={tag} value={tag}>{tag}</Select.Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        )}

                        <Divider aria-hidden="true">报价（元/㎡）</Divider>
                        {role === 'designer' && (
                            <Row gutter={16}>
                                <Col xs={24} sm={8}>
                                    <Form.Item name="priceFlat" label="平层报价" rules={[{ required: true, message: '必填' }]}>
                                        <InputNumber className="premium-input"
                                            controls={false}
                                            min={PRICING_MIN}
                                            max={PRICING_MAX}
                                            precision={0}
                                            placeholder={`请输入 ${PRICING_MIN}-${PRICING_MAX}`}
                                            style={{ width: '100%' }}
                                            aria-label="平层报价"
                                            aria-required="true"
                                        />
                                    </Form.Item>
                                </Col>
                                <Col xs={24} sm={8}>
                                    <Form.Item name="priceDuplex" label="复式报价">
                                        <InputNumber className="premium-input"
                                            controls={false}
                                            min={PRICING_MIN}
                                            max={PRICING_MAX}
                                            precision={0}
                                            placeholder={`可选，${PRICING_MIN}-${PRICING_MAX}`}
                                            style={{ width: '100%' }}
                                            aria-label="复式报价"
                                        />
                                    </Form.Item>
                                </Col>
                                <Col xs={24} sm={8}>
                                    <Form.Item name="priceOther" label="其他报价">
                                        <InputNumber className="premium-input"
                                            controls={false}
                                            min={PRICING_MIN}
                                            max={PRICING_MAX}
                                            precision={0}
                                            placeholder={`可选，${PRICING_MIN}-${PRICING_MAX}`}
                                            style={{ width: '100%' }}
                                            aria-label="其他报价"
                                        />
                                    </Form.Item>
                                </Col>
                            </Row>
                        )}
                        {role === 'foreman' && (
                            <Form.Item name="pricePerSqm" label="施工报价" rules={[{ required: true, message: '请填写施工报价' }]}>
                                <InputNumber className="premium-input"
                                    controls={false}
                                    min={PRICING_MIN}
                                    max={PRICING_MAX}
                                    precision={0}
                                    placeholder={`请输入 ${PRICING_MIN}-${PRICING_MAX}`}
                                    style={{ width: '100%' }}
                                    aria-label="施工报价（元每平方米）"
                                    aria-required="true"
                                />
                            </Form.Item>
                        )}
                        {role === 'company' && (
                            <Row gutter={16}>
                                <Col xs={24} sm={12}>
                                    <Form.Item name="priceFullPackage" label="全包报价" rules={[{ required: true, message: '请填写全包报价' }]}>
                                        <InputNumber className="premium-input"
                                            controls={false}
                                            min={PRICING_MIN}
                                            max={PRICING_MAX}
                                            precision={0}
                                            placeholder={`请输入 ${PRICING_MIN}-${PRICING_MAX}`}
                                            style={{ width: '100%' }}
                                            aria-label="全包报价"
                                            aria-required="true"
                                        />
                                    </Form.Item>
                                </Col>
                                <Col xs={24} sm={12}>
                                    <Form.Item name="priceHalfPackage" label="半包报价" rules={[{ required: true, message: '请填写半包报价' }]}>
                                        <InputNumber className="premium-input"
                                            controls={false}
                                            min={PRICING_MIN}
                                            max={PRICING_MAX}
                                            precision={0}
                                            placeholder={`请输入 ${PRICING_MIN}-${PRICING_MAX}`}
                                            style={{ width: '100%' }}
                                            aria-label="半包报价"
                                            aria-required="true"
                                        />
                                    </Form.Item>
                                </Col>
                            </Row>
                        )}

                        <Form.Item name="introduction" label={isForeman ? '施工简介' : '个人/公司简介'}>
                            <TextArea className="premium-input"
                                rows={4}
                                placeholder="可填写服务亮点、经验、团队说明等"
                                maxLength={5000}
                                showCount
                                aria-label={isForeman ? '施工简介' : '个人或公司简介'}
                            />
                        </Form.Item>

                        {role === 'designer' && (
                            <Row gutter={16}>
                                <Col xs={24} sm={12}>
                                    <Form.Item name="graduateSchool" label="毕业院校（选填）">
                                        <Input className="premium-input"
                                            placeholder="如：西安建筑科技大学"
                                            maxLength={100}
                                            aria-label="毕业院校"
                                        />
                                    </Form.Item>
                                </Col>
                                <Col xs={24} sm={12}>
                                    <Form.Item name="designPhilosophy" label="设计理念（选填）">
                                        <Input className="premium-input"
                                            placeholder="一句话描述您的理念"
                                            maxLength={200}
                                            aria-label="设计理念"
                                        />
                                    </Form.Item>
                                </Col>
                            </Row>
                        )}
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <MerchantOnboardingShell
            pageTitle={pageTitle}
            pageSubtitle={isCompletionMode ? '账号已绑定，请按正式入驻标准补全资料并提交审核。' : '请按步骤完善资质、案例和服务信息，提交后将进入人工审核。'}
            heroTitle={pageTitle.replace('（公司主体）', '').replace('（个人主体）', '')}
            heroSubtitle={isCompletionMode ? '补全完成并审核通过后，接单、报价、项目推进、资金等经营能力才会重新开放。' : '入驻即注册。完善品牌资料、上传案例作品，并用统一的服务信息向平台展示你的专业能力。'}
            currentStep={currentStep}
            steps={steps}
            onBack={() => navigate('/')}
            alertNode={isCompletionMode ? (
                completionData?.onboardingStatus === 'rejected' ? (
                    <Alert
                        type="error"
                        showIcon
                        message="补全资料已被驳回，请按驳回原因修正后重新提交。"
                        description={completionData?.rejectReason || '请对照资料要求补齐后重新提交。'}
                        style={{ marginBottom: 24, borderRadius: 8 }}
                        role="alert"
                    />
                ) : (
                    <Alert
                        type="warning"
                        showIcon
                        message="账号已绑定，当前仍处于资料待补全状态。"
                        description="在审核通过前，你可以登录和查看消息，但接单、报价、项目推进、提现等经营操作会继续受限。"
                        style={{ marginBottom: 24, borderRadius: 8 }}
                        role="alert"
                    />
                )
            ) : showRedirectAlert ? (
                <Alert
                    type="warning"
                    showIcon
                    closable
                    onClose={() => setShowRedirectAlert(false)}
                    message={fromLogin === 'login_resubmit' ? '系统已识别到原申请记录，正在按原商家类型为你发起重新提交。手机号和商家子类型已锁定，提交前需重新确认协议。' : '该手机号尚未入驻，请先完成入驻申请后再登录'}
                    style={{ marginBottom: 24, borderRadius: 8 }}
                    role="alert"
                />
            ) : undefined}
        >
            <Form
                form={form}
                layout="vertical"
                preserve
                aria-label="商家入驻申请表单"
                size="large"
                className="premium-form"
                data-testid="merchant-register-form"
            >
                {!isCompletionMode && resubmitLoading && (
                    <Alert
                        type="info"
                        showIcon
                        style={{ marginBottom: 16, borderRadius: 8 }}
                        message="正在校验手机号并回填原申请资料，请稍候。"
                        data-testid="merchant-register-resubmit-loading"
                    />
                )}
                {!isCompletionMode && resubmitId && resubmitPrefillFailed && (
                    <Alert
                        type="warning"
                        showIcon
                        style={{ marginBottom: 16, borderRadius: 8 }}
                        message="原申请资料回填失败，请确认手机号与验证码正确后重试；手机号与商家子类型仍保持原申请约束。"
                        data-testid="merchant-register-resubmit-failed"
                    />
                )}
                {!isCompletionMode && phoneVerified && hasValidVerification(String(form.getFieldValue('phone') || phoneFromUrl || '').trim()) && (
                    <Alert
                        type="success"
                        showIcon
                        style={{ marginBottom: 16, borderRadius: 8 }}
                        message="手机号已验证，可继续填写入驻资料。"
                        data-testid="merchant-register-phone-verified"
                    />
                )}
                <div data-testid={`merchant-register-step-${currentStep}`}>
                    {renderStepContent()}
                </div>

                {currentStep === steps.length - 1 && (
                    <Form.Item
                        name="legalAccepted"
                        valuePropName="checked"
                        style={{ marginTop: 16, marginBottom: 0 }}
                        rules={[
                            {
                                validator: (_, value) =>
                                    value
                                        ? Promise.resolve()
                                        : Promise.reject(new Error('请先阅读并同意平台入驻相关条款')),
                            },
                        ]}
                    >
                        <Checkbox aria-label="同意平台入驻相关条款" data-testid="merchant-register-legal-checkbox">
                            我已阅读并同意
                            {' '}
                            <a href={MERCHANT_LEGAL_ROUTES.onboardingAgreement} target="_blank" rel="noreferrer">
                                《平台入驻协议（线上勾选版）》
                            </a>
                            {' '}
                            <a href={MERCHANT_LEGAL_ROUTES.platformRules} target="_blank" rel="noreferrer">
                                《平台规则》
                            </a>
                            {' '}
                            <a href={MERCHANT_LEGAL_ROUTES.privacyDataProcessing} target="_blank" rel="noreferrer">
                                《隐私与数据处理条款》
                            </a>
                        </Checkbox>
                    </Form.Item>
                )}
            </Form>

            <Divider aria-hidden="true" style={{ margin: '40px 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div>
                    {currentStep > 0 && (
                        <Button
                            size="large"
                            icon={<ArrowLeftOutlined aria-hidden="true" />}
                            onClick={handlePrev}
                            style={{ borderRadius: 8 }}
                            aria-label="返回上一步"
                        >
                            上一步
                        </Button>
                    )}
                </div>
                <div>
                    {currentStep < steps.length - 1 ? (
                        <Button
                            type="primary"
                            size="large"
                            onClick={handleNext}
                            style={{ borderRadius: 8, padding: '0 32px' }}
                            aria-label="进入下一步"
                            data-testid={`merchant-register-next-${currentStep}`}
                        >
                            下一步 <ArrowRightOutlined aria-hidden="true" />
                        </Button>
                    ) : (
                        <Button
                            type="primary"
                            size="large"
                            loading={loading}
                            onClick={handleSubmit}
                            icon={<CheckOutlined aria-hidden="true" />}
                            style={{ borderRadius: 8, padding: '0 32px' }}
                            aria-label={isCompletionMode ? '提交正式入驻资料补全' : '提交商家入驻申请'}
                            data-testid="merchant-register-submit"
                        >
                            {isCompletionMode ? '提交补全资料' : '提交申请'}
                        </Button>
                    )}
                </div>
            </div>

            <Modal
                open={previewVisible}
                footer={null}
                onCancel={() => {
                    setPreviewVisible(false);
                    setPreviewImage('');
                }}
                title="图片预览"
                width={720}
                destroyOnClose
            >
                <img src={previewImage} alt="案例图片预览" style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain' }} />
            </Modal>
        </MerchantOnboardingShell>
    );
};

export default MerchantRegister;
