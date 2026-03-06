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
import type { UploadFile, UploadProps } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    MERCHANT_LEGAL_ROUTES,
    ONBOARDING_AGREEMENT_VERSION,
    PLATFORM_RULES_VERSION,
    PRIVACY_DATA_PROCESSING_VERSION,
} from '../../constants/merchantLegal';
import { dictionaryApi } from '../../services/dictionaryApi';
import {
    merchantApplyApi,
    merchantAuthApi,
    merchantUploadApi,
    onboardingValidationApi,
    type MerchantApplicantType,
    type MerchantApplyPayload,
} from '../../services/merchantApi';
import { regionApi } from '../../services/regionApi';
import { isValidBusinessLicenseNo, isValidChineseIDCard, normalizeLicenseNo } from '../../utils/onboardingValidation';
import MerchantOnboardingShell from './components/MerchantOnboardingShell';

const { Title, Text } = Typography;
const { TextArea } = Input;

type MerchantApplyRole = 'designer' | 'foreman' | 'company';
type MerchantEntityType = 'personal' | 'company';

const WORK_TYPE_OPTIONS = [
    { value: 'mason', label: '瓦工' },
    { value: 'electrician', label: '电工' },
    { value: 'carpenter', label: '木工' },
    { value: 'painter', label: '油漆工' },
    { value: 'plumber', label: '水暖工' },
];

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

const DEFAULT_CITY_CODE = '610100';
const DRAFT_STORAGE_KEY = 'merchant_register_draft';
const DRAFT_EXPIRY_MS = 2 * 60 * 60 * 1000;

interface PortfolioCase {
    id: string;
    title: string;
    description: string;
    images: string[];
    style: string;
    area: string;
}

interface ResolvedApplyMeta {
    role: MerchantApplyRole;
    entityType: MerchantEntityType;
    applicantType: MerchantApplicantType;
}

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

const caseImageRuleText = (role: MerchantApplyRole) => {
    if (role === 'designer') return '每套 3-6 张图';
    if (role === 'foreman') return '每套 8-12 张图';
    return '每套至少 3 张图';
};

const MerchantRegister: React.FC = () => {
    const [searchParams] = useSearchParams();
    const phoneFromUrl = searchParams.get('phone') || '';
    const fromLogin = searchParams.get('from') || '';
    const resubmitId = searchParams.get('resubmit');
    const navigate = useNavigate();

    const applyMeta = useMemo(() => resolveApplyMeta(searchParams), [searchParams]);
    const { role, entityType, applicantType } = applyMeta;

    const [currentStep, setCurrentStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [sendingCode, setSendingCode] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [showRedirectAlert, setShowRedirectAlert] = useState(fromLogin.startsWith('login_'));
    const [form] = Form.useForm();
    const [portfolioCases, setPortfolioCases] = useState<PortfolioCase[]>([
        { id: crypto.randomUUID(), title: '', description: '', images: [], style: '', area: '' },
        { id: crypto.randomUUID(), title: '', description: '', images: [], style: '', area: '' },
        { id: crypto.randomUUID(), title: '', description: '', images: [], style: '', area: '' },
    ]);
    const [styleOptions, setStyleOptions] = useState<string[]>([]);
    const [areaOptions, setAreaOptions] = useState<string[]>([]);
    const [uploadingCaseCountMap, setUploadingCaseCountMap] = useState<Record<number, number>>({});
    const [previewVisible, setPreviewVisible] = useState(false);
    const [previewImage, setPreviewImage] = useState('');
    const countdownTimerRef = useRef<number | null>(null);

    const isForeman = role === 'foreman';
    const isCompanyRole = role === 'company';
    const isCompanyEntity = entityType === 'company' || role === 'company';
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
                overflow-x: hidden;
                overflow-y: visible;
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
    const caseMinCount = 3;
    const caseMaxImages = role === 'designer' ? 6 : 12;

    const pageTitle = useMemo(() => {
        if (role === 'company') return '装修公司入驻申请';
        if (role === 'foreman') return entityType === 'company' ? '工长入驻申请（公司主体）' : '工长入驻申请（个人主体）';
        return entityType === 'company' ? '设计师入驻申请（公司主体）' : '设计师入驻申请（个人主体）';
    }, [entityType, role]);

    const steps = [
        { title: '基础信息' },
        { title: '资质上传' },
        { title: isForeman ? '施工案例' : '案例作品' },
        { title: '服务与报价' },
    ];

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
            const districts = await regionApi.getChildren(DEFAULT_CITY_CODE);
            setAreaOptions(districts.map((district) => district.name));
        } catch {
            setAreaOptions(['雁塔区', '碑林区', '新城区', '莲湖区', '未央区', '灞桥区', '长安区', '高新区', '曲江新区', '经开区']);
        }
    }, []);

    const restoreDraft = useCallback(() => {
        const stored = sessionStorage.getItem(DRAFT_STORAGE_KEY);
        if (!stored) return;

        try {
            const draft = JSON.parse(stored) as {
                timestamp: number;
                currentStep: number;
                formValues: Record<string, unknown>;
                portfolioCases: PortfolioCase[];
            };

            if (Date.now() - draft.timestamp > DRAFT_EXPIRY_MS) {
                sessionStorage.removeItem(DRAFT_STORAGE_KEY);
                return;
            }

            Modal.confirm({
                title: '检测到未完成的申请',
                content: '是否恢复之前填写的内容？',
                okText: '恢复',
                cancelText: '清除',
                onOk: () => {
                    form.setFieldsValue(draft.formValues);
                    setCurrentStep(draft.currentStep);
                    const restoredCases = Array.isArray(draft.portfolioCases)
                        ? draft.portfolioCases.map((caseItem) => ({
                            id: caseItem?.id || crypto.randomUUID(),
                            title: String(caseItem?.title || ''),
                            description: String(caseItem?.description || ''),
                            images: Array.isArray(caseItem?.images)
                                ? caseItem.images.map((image) => String(image)).filter(Boolean)
                                : [],
                            style: String(caseItem?.style || ''),
                            area: String(caseItem?.area || ''),
                        }))
                        : [];
                    if (restoredCases.length > 0) {
                        setPortfolioCases(restoredCases);
                    }
                },
                onCancel: () => {
                    sessionStorage.removeItem(DRAFT_STORAGE_KEY);
                },
            });
        } catch {
            sessionStorage.removeItem(DRAFT_STORAGE_KEY);
        }
    }, [form]);

    useEffect(() => {
        form.setFieldsValue({
            role,
            entityType,
            applicantType,
            phone: phoneFromUrl || undefined,
        });
        void loadStyleOptions();
        void loadAreaOptions();
        void restoreDraft();
    }, [applicantType, entityType, form, phoneFromUrl, role, loadStyleOptions, loadAreaOptions, restoreDraft]);

    useEffect(() => {
        return () => {
            if (countdownTimerRef.current !== null) {
                clearInterval(countdownTimerRef.current);
            }
        };
    }, []);

    const saveDraft = () => {
        const values = form.getFieldsValue(true);
        const draft = {
            timestamp: Date.now(),
            currentStep,
            formValues: values,
            portfolioCases,
        };
        sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    };

    const clearDraft = () => {
        sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    };

    const validateImageBeforeUpload = (file: File, maxSizeMB: number) => {
        const isImage = file.type === 'image/jpeg' || file.type === 'image/png';
        if (!isImage) {
            message.error('只支持上传 JPG/PNG 格式的图片');
            return Upload.LIST_IGNORE;
        }

        if (file.size / 1024 / 1024 >= maxSizeMB) {
            message.error(`图片大小不能超过 ${maxSizeMB}MB`);
            return Upload.LIST_IGNORE;
        }

        return true;
    };

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

    const getCaseImageCountError = (imageCount: number) => {
        if (role === 'designer') {
            if (imageCount < 3) return `至少上传 3 张，当前 ${imageCount} 张`;
            if (imageCount > 6) return `最多上传 6 张，当前 ${imageCount} 张`;
            return '';
        }
        if (role === 'foreman') {
            if (imageCount < 8) return `至少上传 8 张，当前 ${imageCount} 张`;
            if (imageCount > 12) return `最多上传 12 张，当前 ${imageCount} 张`;
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

    const createCaseBeforeUpload = (caseIndex: number): UploadProps['beforeUpload'] => (file, fileList) => {
        const basicValidation = validateImageBeforeUpload(file as File, 5);
        if (basicValidation !== true) {
            return basicValidation;
        }

        const existingCount = portfolioCases[caseIndex]?.images.length || 0;
        const remaining = caseMaxImages - existingCount;
        if (remaining <= 0) {
            message.warning(`单套案例最多上传 ${caseMaxImages} 张，已达到上限`);
            return Upload.LIST_IGNORE;
        }

        const currentIndexInBatch = fileList.findIndex((item) => item.uid === file.uid);
        if (currentIndexInBatch >= remaining) {
            message.warning(`单套案例最多上传 ${caseMaxImages} 张，超出图片将被忽略`);
            return Upload.LIST_IGNORE;
        }

        return true;
    };

    const createCaseUploadHandler = (caseIndex: number): UploadProps['customRequest'] => async (options) => {
        const currentImages = portfolioCases[caseIndex]?.images || [];
        if (currentImages.length >= caseMaxImages) {
            message.warning(`单套案例最多上传 ${caseMaxImages} 张`);
            options.onError?.(new Error('已超过图片数量上限'));
            return;
        }

        adjustCaseUploadingCount(caseIndex, 1);
        try {
            const uploaded = await merchantUploadApi.uploadOnboardingImageData(options.file as File);
            options.onSuccess?.(uploaded);

            const latestImages = portfolioCases[caseIndex]?.images || [];
            if (!latestImages.includes(uploaded.url)) {
                const nextImages = [...latestImages, uploaded.url].slice(0, caseMaxImages);
                updatePortfolioCase(caseIndex, 'images', nextImages);
                if (nextImages.length === caseMaxImages) {
                    message.info(`已达到单套案例图片上限（${caseMaxImages} 张）`);
                }
            }
        } catch (error) {
            const errorMessage = getErrorMessage(error, '上传失败');
            message.error(errorMessage);
            options.onError?.(new Error(errorMessage));
        } finally {
            adjustCaseUploadingCount(caseIndex, -1);
        }
    };

    const validatePortfolioCases = () => {
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
            if (role === 'designer' && (caseItem.images.length < 3 || caseItem.images.length > 6)) {
                message.error(`第 ${index + 1} 套案例图片数量需为 3-6 张`);
                return false;
            }
            if (role === 'foreman' && (caseItem.images.length < 8 || caseItem.images.length > 12)) {
                message.error(`第 ${index + 1} 套施工案例图片数量需为 8-12 张`);
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
            if (currentStep === 0) {
                const fields = ['phone', 'code', 'realName', 'avatar'];
                if (entityType === 'company' || role === 'company') {
                    fields.push('companyName');
                }
                await form.validateFields(fields);
                if (showRedirectAlert) {
                    setShowRedirectAlert(false);
                }
            } else if (currentStep === 1) {
                const fields = ['idCardNo', 'idCardFront', 'idCardBack'];
                if (requiresCompanyLicense) {
                    fields.push('licenseNo', 'licenseImage');
                }
                if (isForeman) {
                    fields.push('yearsExperience', 'workTypes');
                }
                if (role === 'designer') {
                    fields.push('yearsExperience');
                }
                await form.validateFields(fields);
            } else if (currentStep === 2) {
                if (hasPendingCaseUploads) {
                    message.warning('案例图片仍在上传中，请等待上传完成后再进入下一步');
                    return;
                }
                if (!validatePortfolioCases()) {
                    return;
                }
            }
            setCurrentStep((prev) => prev + 1);
            saveDraft();
        } catch {
            // no-op
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
        const fields = ['phone', 'code', 'realName', 'avatar', 'idCardNo', 'idCardFront', 'idCardBack', 'serviceArea', 'legalAccepted'];
        if (requiresCompanyLicense) {
            fields.push('companyName', 'licenseNo', 'licenseImage');
        }
        if (role === 'designer') {
            fields.push('yearsExperience', 'styles', 'priceFlat');
        }
        if (role === 'foreman') {
            fields.push('yearsExperience', 'workTypes', 'highlightTags', 'pricePerSqm');
        }
        if (role === 'company') {
            fields.push('priceFullPackage', 'priceHalfPackage');
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
            content: resubmitId ? '确认重新提交申请？' : '确认提交入驻申请？',
            okText: '确认',
            cancelText: '取消',
            onOk: async () => {
                setLoading(true);
                try {
                    const payload: MerchantApplyPayload = {
                        phone: String(values.phone || '').trim(),
                        code: String(values.code || '').trim(),
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
                        officeAddress: values.officeAddress ? String(values.officeAddress).trim() : undefined,
                        yearsExperience: values.yearsExperience,
                        workTypes: isForeman ? values.workTypes || [] : [],
                        serviceArea: values.serviceArea || [],
                        styles: role === 'designer' ? values.styles || [] : [],
                        highlightTags: role === 'foreman' ? values.highlightTags || [] : [],
                        pricing: buildPricingPayload(values),
                        introduction: values.introduction,
                        graduateSchool: values.graduateSchool,
                        designPhilosophy: values.designPhilosophy,
                        portfolioCases: portfolioCases.filter((caseItem) =>
                            caseItem.title.trim() && caseItem.description.trim() && caseItem.images.length > 0
                        ).map((caseItem) => ({
                            title: caseItem.title.trim(),
                            description: caseItem.description.trim(),
                            images: caseItem.images,
                            style: caseItem.style,
                            area: caseItem.area,
                        })),
                        legalAcceptance: {
                            accepted: true,
                            onboardingAgreementVersion: ONBOARDING_AGREEMENT_VERSION,
                            platformRulesVersion: PLATFORM_RULES_VERSION,
                            privacyDataProcessingVersion: PRIVACY_DATA_PROCESSING_VERSION,
                        },
                    };

                    const result = resubmitId
                        ? await merchantApplyApi.resubmit(Number(resubmitId), payload)
                        : await merchantApplyApi.apply(payload);

                    if (!result.applicationId) {
                        message.error('提交失败：申请编号缺失');
                        return;
                    }

                    clearDraft();
                    message.success(resubmitId ? '已重新提交，请等待审核' : '申请已提交，请等待审核');
                    navigate(`/apply-status?phone=${encodeURIComponent(values.phone)}`);
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
        setPortfolioCases((prev) => [...prev, { id: crypto.randomUUID(), title: '', description: '', images: [], style: '', area: '' }]);
    };

    const removePortfolioCase = (index: number) => {
        setPortfolioCases((prev) => {
            if (prev.length <= caseMinCount) {
                message.warning(`至少保留 ${caseMinCount} 套案例`);
                return prev;
            }
            return prev.filter((_, currentIndex) => currentIndex !== index);
        });
    };

    const renderStepContent = () => {
        switch (currentStep) {
            case 0:
                return (
                    <div className="animate-fade-in glassmorphism-form">
                        <Title level={4} style={{ marginBottom: 24, color: '#1e293b' }}>基础信息</Title>
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
                            name="avatar"
                            label="头像"
                            valuePropName="fileList"
                            getValueProps={(value: unknown) => ({
                                fileList: typeof value === 'string' ? toSingleUploadFileList(value) : [],
                            })}
                            getValueFromEvent={() => form.getFieldValue('avatar')}
                            rules={[{ required: true, message: '请上传头像' }]}
                        >
                            <Upload
                                listType="picture-card"
                                maxCount={1}
                                accept=".jpg,.jpeg,.png"
                                beforeUpload={(file) => validateImageBeforeUpload(file as File, 2)}
                                customRequest={createSingleUploadHandler('avatar')}
                                onPreview={(file) => handleSinglePreview(file, 'avatar')}
                                onRemove={() => {
                                    form.setFieldsValue({ avatar: undefined });
                                    return true;
                                }}
                                aria-label="上传头像"
                            >
                                <div>
                                    <PictureOutlined style={{ fontSize: 24 }} aria-hidden="true" />
                                    <div style={{ marginTop: 8 }}>上传头像</div>
                                </div>
                            </Upload>
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

                                <Form.Item name="officeAddress" label="办公地址">
                                    <Input className="premium-input"
                                        prefix={<EnvironmentOutlined aria-hidden="true" />}
                                        placeholder="请输入办公地址"
                                        maxLength={200}
                                        aria-label="办公地址"
                                    />
                                </Form.Item>
                            </>
                        )}
                    </div>
                );

            case 1:
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
                                        beforeUpload={(file) => validateImageBeforeUpload(file as File, 2)}
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
                                        beforeUpload={(file) => validateImageBeforeUpload(file as File, 2)}
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
                                        beforeUpload={(file) => validateImageBeforeUpload(file as File, 5)}
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
                                <Form.Item
                                    name="workTypes"
                                    label="工种类型"
                                    rules={[{ required: true, message: '请至少选择1个工种' }]}
                                >
                                    <Select className="premium-input"
                                        mode="multiple"
                                        placeholder="选择可承接工种"
                                        options={WORK_TYPE_OPTIONS}
                                        aria-label="工种类型"
                                        aria-required="true"
                                    />
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

            case 2:
                return (
                    <div className="animate-fade-in glassmorphism-form">
                        <Title level={4} style={{ marginBottom: 24, color: '#1e293b' }}>
                            案例上传 <Text type="secondary" style={{ fontSize: 14, fontWeight: 'normal' }}>（至少 {caseMinCount} 套，{caseImageRuleText(role)}）</Text>
                        </Title>
                        {portfolioCases.map((caseItem, index) => (
                            <Card key={caseItem.id} size="small" className="premium-case-card"
                                title={`案例 ${index + 1}`}
                                extra={(
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
                                )}
                                style={{ marginBottom: 16 }}
                                role="region"
                                aria-label={`案例 ${index + 1}`}
                            >
                                <Form.Item label="案例标题" required>
                                    <Input className="premium-input"
                                        placeholder="例如：现代简约三居室"
                                        value={caseItem.title}
                                        maxLength={50}
                                        onChange={(event) => updatePortfolioCase(index, 'title', event.target.value)}
                                        aria-label={`案例 ${index + 1} 标题`}
                                        aria-required="true"
                                    />
                                </Form.Item>
                                <Form.Item label="案例说明" required>
                                    <TextArea className="premium-input"
                                        rows={3}
                                        placeholder="请输入案例说明"
                                        value={caseItem.description}
                                        maxLength={5000}
                                        showCount
                                        onChange={(event) => updatePortfolioCase(index, 'description', event.target.value)}
                                        aria-label={`案例 ${index + 1} 说明`}
                                        aria-required="true"
                                    />
                                </Form.Item>
                                <Row gutter={16}>
                                    <Col xs={24} sm={12}>
                                        <Form.Item label="风格">
                                            <Select className="premium-input"
                                                placeholder="选择风格"
                                                value={caseItem.style || undefined}
                                                onChange={(value) => updatePortfolioCase(index, 'style', value)}
                                                aria-label={`案例 ${index + 1} 风格`}
                                            >
                                                {styleOptions.map((style) => (
                                                    <Select.Option key={style} value={style}>{style}</Select.Option>
                                                ))}
                                            </Select>
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} sm={12}>
                                        <Form.Item label="面积">
                                            <Select className="premium-input"
                                                placeholder="选择面积区间"
                                                value={caseItem.area || undefined}
                                                onChange={(value) => updatePortfolioCase(index, 'area', value)}
                                                aria-label={`案例 ${index + 1} 面积`}
                                            >
                                                {CASE_AREA_OPTIONS.map((area) => (
                                                    <Select.Option key={area} value={area}>{area}</Select.Option>
                                                ))}
                                            </Select>
                                        </Form.Item>
                                    </Col>
                                </Row>
                                <Form.Item label="案例图片" required>
                                    <Upload
                                        listType="picture-card"
                                        multiple
                                        maxCount={caseMaxImages}
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
                                            updatePortfolioCase(index, 'images', caseItem.images.filter((image) => image !== url));
                                            return true;
                                        }}
                                        aria-label={`上传案例 ${index + 1} 图片`}
                                    >
                                        {caseItem.images.length < caseMaxImages ? (
                                            <div>
                                                <PictureOutlined aria-hidden="true" />
                                                <div style={{ marginTop: 8 }}>上传图片</div>
                                            </div>
                                        ) : null}
                                    </Upload>
                                    <div style={{ marginTop: 8, color: getCaseImageCountError(caseItem.images.length) ? '#ff4d4f' : '#8c8c8c' }}>
                                        {getCaseImageCountError(caseItem.images.length) || `已上传 ${caseItem.images.length} 张，可一次选择多张`}
                                    </div>
                                </Form.Item>
                            </Card>
                        ))}
                        <Button
                            type="dashed"
                            block
                            onClick={addPortfolioCase}
                            aria-label="添加更多案例"
                        >
                            + 添加更多案例
                        </Button>
                    </div>
                );

            case 3:
                return (
                    <div className="animate-fade-in glassmorphism-form">
                        <Title level={4} style={{ marginBottom: 24, color: '#1e293b' }}>服务与报价</Title>
                        <Form.Item
                            name="serviceArea"
                            label="服务区域"
                            rules={[{ required: true, message: '请选择服务区域' }]}
                        >
                            <Select className="premium-input"
                                mode="multiple"
                                placeholder="选择可服务区域"
                                aria-label="服务区域"
                                aria-required="true"
                            >
                                {areaOptions.map((area) => (
                                    <Select.Option key={area} value={area}>{area}</Select.Option>
                                ))}
                            </Select>
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
            pageSubtitle="请按步骤完善资质、案例和服务信息，提交后将进入人工审核。"
            heroTitle={pageTitle.replace('（公司主体）', '').replace('（个人主体）', '')}
            heroSubtitle="入驻即注册。完善品牌资料、上传案例作品，并用统一的服务信息向平台展示你的专业能力。"
            currentStep={currentStep}
            steps={steps}
            onBack={() => navigate('/')}
            alertNode={showRedirectAlert ? (
                <Alert
                    type="warning"
                    showIcon
                    closable
                    onClose={() => setShowRedirectAlert(false)}
                    message="该手机号尚未入驻，请先完成入驻申请后再登录"
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
            >
                {renderStepContent()}

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
                        <Checkbox aria-label="同意平台入驻相关条款">
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
                            aria-label="提交商家入驻申请"
                        >
                            提交申请
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
