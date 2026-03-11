import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRightOutlined, CheckOutlined, DeleteOutlined, PlusOutlined, SafetyOutlined } from '@ant-design/icons';
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
import {
    materialShopApplyApi,
    merchantAuthApi,
    merchantUploadApi,
    onboardingValidationApi,
    type BusinessHoursRange,
    type MaterialShopApplyDetailData,
    type MaterialShopApplyPayload,
} from '../../services/merchantApi';
import { isValidBusinessLicenseNo, isValidChineseIDCard, normalizeLicenseNo } from '../../utils/onboardingValidation';
import MerchantOnboardingShell from './components/MerchantOnboardingShell';
import BusinessHoursEditor, { summarizeBusinessHoursRanges } from './components/BusinessHoursEditor';

const { Title, Text } = Typography;

const DRAFT_KEY = 'material_shop_register_draft';
const VERIFICATION_STORAGE_KEY = 'material_shop_register_phone_verification';
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

interface MaterialProductForm {
    id: string;
    name: string;
    unit: string;
    price?: number;
    images: string[];
}

const createEmptyProduct = (): MaterialProductForm => ({
    id: `product_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    name: '',
    unit: '',
    price: undefined,
    images: [],
});

const normalizeBusinessHoursRangesForForm = (value: unknown): BusinessHoursRange[] => {
    if (!Array.isArray(value)) {
        return [];
    }
    return value
        .map((item) => ({
            day: Number((item as BusinessHoursRange)?.day) === 7 ? 0 : Number((item as BusinessHoursRange)?.day),
            start: String((item as BusinessHoursRange)?.start || ''),
            end: String((item as BusinessHoursRange)?.end || ''),
        }))
        .filter((item) => Number.isInteger(item.day) && item.day >= 0 && item.day <= 6);
};

const normalizeBusinessHoursRangesForApi = (value: unknown): BusinessHoursRange[] =>
    normalizeBusinessHoursRangesForForm(value).map((item) => ({
        ...item,
        day: item.day === 0 ? 7 : item.day,
    }));

const parseLegacyBusinessHoursText = (value?: string): BusinessHoursRange[] => {
    const text = String(value || '').trim();
    if (!text) {
        return [];
    }

    const ranges: BusinessHoursRange[] = [];
    const matchAll = text.matchAll(/周([一二三四五六日])\s*(\d{2}:\d{2})-(\d{2}:\d{2})/g);
    const dayMap: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 0 };
    for (const match of matchAll) {
        ranges.push({ day: dayMap[match[1]], start: match[2], end: match[3] });
    }
    if (ranges.length > 0) {
        return ranges;
    }

    const plain = text.match(/(\d{2}:\d{2})-(\d{2}:\d{2})/);
    if (!plain) {
        return [];
    }
    return [{ day: 1, start: plain[1], end: plain[2] }];
};

const resolveBusinessHoursRanges = (ranges?: BusinessHoursRange[], legacyText?: string) => {
    const normalized = normalizeBusinessHoursRangesForForm(ranges);
    return normalized.length > 0 ? normalized : parseLegacyBusinessHoursText(legacyText);
};

const resolveProductUnit = (product: Record<string, unknown>) => {
    const explicitUnit = String(product.unit || '').trim();
    if (explicitUnit) {
        return explicitUnit;
    }
    const params = product.params as Record<string, unknown> | undefined;
    const legacyUnit = params?.unit ?? params?.单位;
    return legacyUnit === undefined || legacyUnit === null ? '' : String(legacyUnit).trim();
};

const getErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    const maybeAxiosError = error as { response?: { data?: { message?: string } }; message?: string };
    return maybeAxiosError.response?.data?.message || maybeAxiosError.message || fallback;
};

const MaterialShopRegister: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [form] = Form.useForm();
    const [currentStep, setCurrentStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [sendingCode, setSendingCode] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [showRedirectAlert, setShowRedirectAlert] = useState((searchParams.get('from') || '').startsWith('login_'));
    const [products, setProducts] = useState<MaterialProductForm[]>([createEmptyProduct()]);
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
        merchantKind: 'material_shop',
        applicationId: undefined,
    });
    const timerRef = useRef<number | null>(null);

    const phoneFromUrl = searchParams.get('phone') || '';
    const resubmitId = searchParams.get('resubmit');

    const entityType = useMemo(() => {
        const raw = (searchParams.get('entityType') || 'company').toLowerCase();
        return raw === 'individual_business' ? 'individual_business' : 'company';
    }, [searchParams]);

    const steps = useMemo(() => ([
        { title: '手机号验证' },
        { title: '基础信息' },
        { title: '商品信息' },
    ]), []);

    const draftStorageKey = useMemo(() => (
        resubmitId ? `${DRAFT_KEY}:resubmit:${resubmitId}` : DRAFT_KEY
    ), [resubmitId]);

    const currentVerificationMode = resubmitId ? 'resubmit' as const : 'apply' as const;
    const currentVerificationApplicationId = resubmitId ? Number(resubmitId) : undefined;
    const currentVerificationMerchantKind = 'material_shop' as const;

    const validateLicenseRemote = async (licenseNo: string, companyName?: string) => {
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
    };

    const validateIdCardRemote = async (idNo: string, realName: string) => {
        const normalizedId = String(idNo || '').trim().toUpperCase();
        const normalizedName = String(realName || '').trim();
        if (!normalizedId) return;
        if (!isValidChineseIDCard(normalizedId)) {
            throw new Error('身份证号校验失败，请检查号码是否有效');
        }
        if (!normalizedName) return;
        const result = await onboardingValidationApi.validateIdCard({ idNo: normalizedId, realName: normalizedName });
        if (!result.ok) {
            throw new Error(result.message || '身份证号校验失败');
        }
    };

    useEffect(() => {
        form.setFieldsValue({
            phone: phoneFromUrl || undefined,
            entityType,
        });
    }, [entityType, form, phoneFromUrl]);


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
            .premium-product-card {
                border-radius: 16px;
                box-shadow: 0 8px 24px rgba(0,0,0,0.04);
                border: 1px solid #f0f0f0;
                transition: transform 0.3s;
                background: #ffffff;
            }
            .premium-product-card:hover {
                transform: translateY(-4px);
                box-shadow: 0 12px 32px rgba(0,0,0,0.08);
            }
            .premium-product-card .ant-card-head {
                background: #f8fafc;
                border-bottom: 1px solid #f1f5f9;
                border-radius: 16px 16px 0 0;
            }
        `;
        document.head.appendChild(style);
        return () => { document.head.removeChild(style); };
    }, []);


    useEffect(() => {
        const savedDraft = sessionStorage.getItem(draftStorageKey);
        if (savedDraft) {
            try {
                const parsed = JSON.parse(savedDraft);
                if (parsed.formValues) {
                    form.setFieldsValue(parsed.formValues);
                }
                if (typeof parsed.currentStep === 'number' && parsed.currentStep >= 0 && parsed.currentStep < steps.length) {
                    setCurrentStep(parsed.currentStep);
                }
                if (Array.isArray(parsed.products) && parsed.products.length > 0) {
                    setProducts(parsed.products);
                }
            } catch {
                // Ignore invalid draft
            }
        }
    }, [draftStorageKey, form, steps.length]);

    useEffect(() => {
        return () => {
            if (timerRef.current !== null) {
                window.clearInterval(timerRef.current);
            }
        };
    }, []);

    useEffect(() => {
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
    }, [currentVerificationApplicationId, currentVerificationMerchantKind, currentVerificationMode, draftStorageKey, form, phoneFromUrl, resubmitId]);

    const hydrateResubmitDetail = (detail: MaterialShopApplyDetailData) => {
        form.setFieldsValue({
            phone: detail.phone || phoneFromUrl || undefined,
            entityType: detail.entityType || entityType,
            shopName: detail.shopName,
            shopDescription: detail.shopDescription,
            companyName: detail.companyName,
            businessLicenseNo: detail.businessLicenseNo,
            businessLicense: detail.businessLicense,
            legalPersonName: detail.legalPersonName,
            legalPersonIdCardNo: detail.legalPersonIdCardNo,
            legalPersonIdCardFront: detail.legalPersonIdCardFront,
            legalPersonIdCardBack: detail.legalPersonIdCardBack,
            businessHours: detail.businessHours,
            businessHoursRanges: resolveBusinessHoursRanges(detail.businessHoursRanges, detail.businessHours),
            contactPhone: detail.contactPhone,
            contactName: detail.contactName,
            address: detail.address,
            legalAccepted: false,
        });

        if (Array.isArray(detail.products) && detail.products.length > 0) {
            setProducts(detail.products.map((product, index) => ({
                id: `resubmit_product_${index}_${Date.now()}`,
                name: String(product?.name || ''),
                unit: resolveProductUnit(product as unknown as Record<string, unknown>),
                price: typeof product?.price === 'number' ? product.price : undefined,
                images: Array.isArray(product?.images) ? product.images.map((image) => String(image)).filter(Boolean) : [],
            })));
        }
    };

    const validateImageBeforeUpload = (file: File, maxSizeMB: number) => {
        const isImage = file.type === 'image/jpeg' || file.type === 'image/png';
        if (!isImage) {
            message.error('只支持 JPG/PNG 图片');
            return Upload.LIST_IGNORE;
        }
        if (file.size / 1024 / 1024 >= maxSizeMB) {
            message.error(`图片大小不能超过 ${maxSizeMB}MB`);
            return Upload.LIST_IGNORE;
        }
        return true;
    };

    const createSingleUploadHandler = (fieldName: 'businessLicense' | 'legalPersonIdCardFront' | 'legalPersonIdCardBack'): UploadProps['customRequest'] => async (options) => {
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

    const toProductUploadFileList = (product: MaterialProductForm): UploadFile[] =>
        product.images.map((url, imageIndex) => ({
            uid: `${product.id}_${imageIndex}`,
            name: url.split('/').pop() || `product-image-${imageIndex + 1}`,
            status: 'done',
            url,
        }));

    const handleUploadPreview = async (file: UploadFile) => {
        const previewUrl = typeof file.url === 'string'
            ? file.url
            : (file.response as { url?: string } | undefined)?.url;
        if (!previewUrl) {
            return;
        }
        setPreviewImage(previewUrl);
        setPreviewVisible(true);
    };

    const createProductUploadHandler = (productIndex: number): UploadProps['customRequest'] => async (options) => {
        try {
            const uploaded = await merchantUploadApi.uploadOnboardingImageData(options.file as File);
            options.onSuccess?.(uploaded);
            setProducts((prev) => {
                const next = [...prev];
                const current = next[productIndex]?.images || [];
                if (!current.includes(uploaded.url)) {
                    next[productIndex] = { ...next[productIndex], images: [...current, uploaded.url].slice(0, 6) };
                }
                return next;
            });
        } catch (error) {
            const errorMessage = getErrorMessage(error, '上传失败');
            message.error(errorMessage);
            options.onError?.(new Error(errorMessage));
        }
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
                console.debug('验证码（仅开发环境）:', response.debugCode);
            }
            message.success('验证码已发送');
            setCountdown(60);
            if (timerRef.current !== null) {
                window.clearInterval(timerRef.current);
            }
            timerRef.current = window.setInterval(() => {
                setCountdown((prev) => {
                    if (prev <= 1) {
                        if (timerRef.current !== null) {
                            window.clearInterval(timerRef.current);
                            timerRef.current = null;
                        }
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } catch (error) {
            message.error(getErrorMessage(error, '发送验证码失败'));
        } finally {
            setSendingCode(false);
        }
    };

    const handleNext = async () => {
        try {
            if (currentStep === 0) {
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
            } else if (currentStep === 1) {
                await form.validateFields([
                    'shopName',
                    'companyName',
                    'businessLicenseNo',
                    'businessLicense',
                    'legalPersonName',
                    'legalPersonIdCardNo',
                    'legalPersonIdCardFront',
                    'legalPersonIdCardBack',
                    'businessHoursRanges',
                    'contactPhone',
                    'address',
                ]);
            }
            setCurrentStep((prev) => prev + 1);
        } catch {
            // no-op
        }
    };

    const handlePrev = () => {
        setCurrentStep((prev) => prev - 1);
    };

    const updateProduct = (index: number, patch: Partial<MaterialProductForm>) => {
        setProducts((prev) => {
            const next = [...prev];
            next[index] = { ...next[index], ...patch };
            return next;
        });
    };

    const addProduct = () => {
        setProducts((prev) => {
            if (prev.length >= 20) {
                message.warning('最多添加20个商品');
                return prev;
            }
            return [...prev, createEmptyProduct()];
        });
    };

    const removeProduct = (index: number) => {
        setProducts((prev) => {
            if (prev.length <= 1) {
                message.warning('至少保留1个商品');
                return prev;
            }
            return prev.filter((_, i) => i !== index);
        });
    };

    const persistDraftSnapshot = useCallback((draft: {
        currentStep: number;
        formValues: Record<string, unknown>;
        products: MaterialProductForm[];
    }) => {
        sessionStorage.setItem(draftStorageKey, JSON.stringify(draft));
    }, [draftStorageKey]);

    const saveDraft = (step = currentStep) => {
        persistDraftSnapshot({
            currentStep: step,
            formValues: form.getFieldsValue(),
            products,
        });
        message.success('草稿已保存');
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

    const verifyPhoneAndMaybePrefill = useCallback(async (phone: string, code: string) => {
        setResubmitLoading(true);
        setResubmitPrefillFailed(false);
        try {
            const response = await onboardingValidationApi.verifyPhone<MaterialShopApplyDetailData>({
                phone,
                code,
                merchantKind: 'material_shop',
                mode: resubmitId ? 'resubmit' : 'apply',
                applicationId: resubmitId ? Number(resubmitId) : undefined,
            });
            const expiresAtMs = response.expiresAt ? new Date(response.expiresAt).getTime() : Date.now() + VERIFICATION_EXPIRE_MS;
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
                const restoredProducts = Array.isArray(response.form.products)
                    ? response.form.products.map((product, index) => ({
                        id: `resubmit_product_${index}_${Date.now()}`,
                        name: String(product?.name || ''),
                        unit: resolveProductUnit(product as unknown as Record<string, unknown>),
                        price: typeof product?.price === 'number' ? product.price : undefined,
                        images: Array.isArray(product?.images) ? product.images.map((image) => String(image)).filter(Boolean) : [],
                    }))
                    : [];
                persistDraftSnapshot({
                    currentStep: 1,
                    formValues: {
                        phone: response.form.phone || phone,
                        entityType: response.form.entityType || entityType,
                        shopName: response.form.shopName,
                        shopDescription: response.form.shopDescription,
                        companyName: response.form.companyName,
                        businessLicenseNo: response.form.businessLicenseNo,
                        businessLicense: response.form.businessLicense,
                        legalPersonName: response.form.legalPersonName,
                        legalPersonIdCardNo: response.form.legalPersonIdCardNo,
                        legalPersonIdCardFront: response.form.legalPersonIdCardFront,
                        legalPersonIdCardBack: response.form.legalPersonIdCardBack,
                        businessHours: response.form.businessHours,
                        businessHoursRanges: resolveBusinessHoursRanges(response.form.businessHoursRanges, response.form.businessHours),
                        contactPhone: response.form.contactPhone,
                        contactName: response.form.contactName,
                        address: response.form.address,
                        legalAccepted: false,
                    },
                    products: restoredProducts.length > 0 ? restoredProducts : products,
                });
            }
            message.success(resubmitId ? '手机号校验成功，已回填原申请资料' : '手机号校验成功，可继续填写入驻资料');
            return true;
        } catch (error) {
            clearPhoneVerification();
            setResubmitPrefillFailed(Boolean(resubmitId));
            message.error(resubmitId ? '原申请资料回填失败，请检查手机号与验证码' : '验证码校验失败，请检查后重试');
            return false;
        } finally {
            setResubmitLoading(false);
        }
    }, [clearPhoneVerification, currentVerificationApplicationId, currentVerificationMerchantKind, currentVerificationMode, entityType, hydrateResubmitDetail, persistDraftSnapshot, persistPhoneVerification, products, resubmitId]);

    const clearDraft = () => {
        Modal.confirm({
            title: '确认清除草稿',
            content: '清除后将无法恢复，确定要清除草稿吗？',
            okText: '确定',
            cancelText: '取消',
            okButtonProps: { danger: true },
            onOk: () => {
                sessionStorage.removeItem(draftStorageKey);
                form.resetFields();
                setProducts([createEmptyProduct()]);
                setCurrentStep(0);
                message.success('草稿已清除');
            },
        });
    };

    const validateProducts = () => {
        const validProducts = products.filter((product) => product.name.trim() && product.unit.trim() && product.price && product.images.length > 0);
        if (validProducts.length < 5) {
            message.error('请至少填写 5 个商品');
            return false;
        }
        if (validProducts.length > 20) {
            message.error('最多支持 20 个商品');
            return false;
        }

        for (let index = 0; index < validProducts.length; index += 1) {
            const product = validProducts[index];
            if (!product.unit.trim()) {
                message.error(`第 ${index + 1} 个商品请输入单位`);
                return false;
            }
            if (product.images.length < 1 || product.images.length > 6) {
                message.error(`第 ${index + 1} 个商品图片数量需为 1-6 张`);
                return false;
            }
        }
        return true;
    };

    const handleSubmit = async () => {
        try {
            await form.validateFields([
                'phone',
                'shopName',
                'companyName',
                'businessLicenseNo',
                'businessLicense',
                'legalPersonName',
                'legalPersonIdCardNo',
                'legalPersonIdCardFront',
                'legalPersonIdCardBack',
                'businessHoursRanges',
                'contactPhone',
                'address',
                'legalAccepted',
            ]);
        } catch {
            return;
        }

        if (!hasValidVerification(String(form.getFieldValue('phone') || '').trim())) {
            setCurrentStep(0);
            message.error('请先完成手机号验证码校验');
            return;
        }

        if (!validateProducts()) {
            return;
        }

        Modal.confirm({
            title: '确认提交申请',
            content: '请确认所有信息填写正确，提交后将进入审核流程。',
            okText: '确定提交',
            cancelText: '再检查一下',
            onOk: async () => {
                setLoading(true);
                try {
                    const values = form.getFieldsValue(true) as Record<string, unknown>;
                    const businessHoursRanges = normalizeBusinessHoursRangesForApi(values.businessHoursRanges);
                    const validProducts = products
                        .filter((product) => product.name.trim() && product.unit.trim() && product.price && product.images.length > 0)
                        .map((product) => ({
                            name: product.name.trim(),
                            unit: product.unit.trim(),
                            price: Number(product.price),
                            images: product.images,
                        }));

                    const payload: MaterialShopApplyPayload = {
                        phone: String(values.phone || '').trim(),
                        code: String(values.code || '').trim(),
                        verificationToken,
                        resubmitToken: resubmitId ? (verificationToken || undefined) : undefined,
                        entityType,
                        shopName: String(values.shopName || '').trim(),
                        shopDescription: values.shopDescription ? String(values.shopDescription).trim() : undefined,
                        companyName: String(values.companyName || '').trim(),
                        businessLicenseNo: normalizeLicenseNo(String(values.businessLicenseNo || '')),
                        businessLicense: String(values.businessLicense || '').trim(),
                        legalPersonName: String(values.legalPersonName || '').trim(),
                        legalPersonIdCardNo: String(values.legalPersonIdCardNo || '').trim().toUpperCase(),
                        legalPersonIdCardFront: String(values.legalPersonIdCardFront || '').trim(),
                        legalPersonIdCardBack: String(values.legalPersonIdCardBack || '').trim(),
                        businessHours: summarizeBusinessHoursRanges(normalizeBusinessHoursRangesForForm(values.businessHoursRanges)),
                        businessHoursRanges,
                        contactPhone: String(values.contactPhone || '').trim(),
                        contactName: String(values.legalPersonName || '').trim(),
                        address: String(values.address || '').trim(),
                        products: validProducts,
                        legalAcceptance: {
                            accepted: true,
                            onboardingAgreementVersion: ONBOARDING_AGREEMENT_VERSION,
                            platformRulesVersion: PLATFORM_RULES_VERSION,
                            privacyDataProcessingVersion: PRIVACY_DATA_PROCESSING_VERSION,
                        },
                    };

                    const result = resubmitId
                        ? await materialShopApplyApi.resubmit(Number(resubmitId), payload)
                        : await materialShopApplyApi.apply(payload);

                    if (!result.applicationId) {
                        message.error('提交失败：申请编号缺失');
                        return;
                    }

                    sessionStorage.removeItem(draftStorageKey);
                    message.success(resubmitId ? '已重新提交，请等待审核' : '申请已提交，请等待审核');
                    navigate(`/apply-status?phone=${encodeURIComponent(values.phone as string)}`);
                } catch (error) {
                    message.error(getErrorMessage(error, '提交失败'));
                } finally {
                    setLoading(false);
                }
            },
        });
    };

    return (
        <MerchantOnboardingShell
            pageTitle="主材商入驻申请"
            pageSubtitle="主材商独立通道：资料中心 + 商品管理。"
            heroTitle="主材商入驻"
            heroSubtitle="完善店铺、资质与商品资料，让门店信息与商品能力在同一条入驻链路中完成展示与审核。"
            currentStep={currentStep}
            steps={steps}
            onBack={() => navigate('/')}
            maxWidth={820}
            alertNode={showRedirectAlert ? (
                <Alert
                    type="warning"
                    showIcon
                    closable
                    onClose={() => setShowRedirectAlert(false)}
                    message={(searchParams.get('from') || '') === 'login_resubmit' ? '系统已识别到原主材商申请记录，正在按原类型重新提交。手机号与商家类型已锁定，提交前需重新确认协议。' : '该手机号尚未入驻，请先完成入驻申请后再登录'}
                    style={{ marginBottom: 24, borderRadius: 8 }}
                />
            ) : undefined}
        >
            <Form form={form} layout="vertical" className="glassmorphism-form premium-form" data-testid="material-register-form">
                {resubmitLoading && (
                    <Alert
                        type="info"
                        showIcon
                        style={{ marginBottom: 16, borderRadius: 8 }}
                        message="正在校验手机号并回填原申请资料，请稍候。"
                        data-testid="material-register-resubmit-loading"
                    />
                )}
                {resubmitId && resubmitPrefillFailed && (
                    <Alert
                        type="warning"
                        showIcon
                        style={{ marginBottom: 16, borderRadius: 8 }}
                        message="原申请资料回填失败，请确认手机号与验证码正确后重试；手机号与主材商类型仍保持原申请约束。"
                        data-testid="material-register-resubmit-failed"
                    />
                )}
                {phoneVerified && hasValidVerification(String(form.getFieldValue('phone') || phoneFromUrl || '').trim()) && (
                    <Alert
                        type="success"
                        showIcon
                        style={{ marginBottom: 16, borderRadius: 8 }}
                        message="手机号已验证，可继续填写入驻资料。"
                        data-testid="material-register-phone-verified"
                    />
                )}
                        {currentStep === 0 && (
                            <div data-testid="material-register-step-0">
                                <div style={{ marginBottom: 28 }}>
                                    <Title level={4} style={{ marginBottom: 8, color: '#1e293b' }}>手机号验证</Title>
                                    <Text style={{ color: '#64748b', lineHeight: 1.75 }}>请先完成手机号验证码校验，验证通过后再继续填写主材商入驻资料。</Text>
                                </div>
                                <Form.Item
                                    name="phone"
                                    label="手机号"
                                    rules={[
                                        { required: true, message: '请输入手机号' },
                                        { pattern: /^1[3-9]\d{9}$/, message: '请输入正确手机号' },
                                    ]}
                                >
                                    <Input className="premium-input" placeholder="请输入11位手机号" maxLength={11} readOnly={Boolean(resubmitId && phoneFromUrl)} disabled={Boolean(resubmitId && phoneFromUrl)} data-testid="material-register-phone-input"
                                        onChange={(event) => {
                                            const nextPhone = event.target.value.replace(/\D/g, '').slice(0, 11);
                                            form.setFieldsValue({ phone: nextPhone });
                                            if (phoneVerified && nextPhone !== verifiedPhone) {
                                                clearPhoneVerification();
                                            }
                                        }} />
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
                                        prefix={<SafetyOutlined />}
                                        placeholder="请输入6位验证码"
                                        maxLength={6}
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
                                            >
                                                {countdown > 0 ? `${countdown}s` : '获取验证码'}
                                            </Button>
                                        )}
                                    />
                                </Form.Item>
                            </div>
                        )}

                        {currentStep === 1 && (
                            <div data-testid="material-register-step-1">
                                <div style={{ marginBottom: 28 }}>
                                    <Title level={4} style={{ marginBottom: 8, color: '#1e293b' }}>基础信息</Title>
                                    <Text style={{ color: '#64748b', lineHeight: 1.75 }}>填写店铺、资质与联系人信息，确保审核通过后能完整展示在平台内。</Text>
                                </div>
                                <div style={{ marginBottom: 24 }}>
                                    <div style={{ marginBottom: 8, color: 'rgba(0, 0, 0, 0.85)', fontSize: 14 }}>主体类型</div>
                                    <div style={{ padding: '4px 11px', background: '#fafafa', border: '1px solid #d9d9d9', borderRadius: 6, color: 'rgba(0, 0, 0, 0.88)' }}>
                                        {entityType === 'individual_business' ? '个体工商户' : '企业'}
                                    </div>
                                </div>

                                <Form.Item name="shopName" label="店铺名称" rules={[{ required: true, message: '请输入店铺名称' }]}>
                                    <Input className="premium-input" maxLength={100} placeholder="请输入店铺名称" />
                                </Form.Item>

                                <Form.Item name="shopDescription" label="店铺描述">
                                    <Input.TextArea className="premium-input" rows={3} maxLength={5000} showCount placeholder="填写店铺经营范围、服务特色等" />
                                </Form.Item>

                                <Form.Item
                                    name="companyName"
                                    label="公司/个体名称"
                                    validateTrigger="onBlur"
                                    rules={[
                                        { required: true, message: '请输入公司/个体名称' },
                                        { max: 100, message: '名称最多100个字符' },
                                        {
                                            validator: (_, value) => {
                                                const companyName = String(value || '').trim();
                                                if (!companyName) {
                                                    return Promise.resolve();
                                                }
                                                const currentLicenseNo = String(form.getFieldValue('businessLicenseNo') || '').trim();
                                                if (!currentLicenseNo || !isValidBusinessLicenseNo(currentLicenseNo)) {
                                                    return Promise.resolve();
                                                }
                                                return validateLicenseRemote(currentLicenseNo, companyName);
                                            },
                                        },
                                    ]}
                                >
                                    <Input className="premium-input" maxLength={100} placeholder="请输入公司/个体名称" />
                                </Form.Item>

                                <Row gutter={16}>
                                    <Col xs={24} sm={12}>
                                        <Form.Item
                                            name="businessLicenseNo"
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
                                            <Input
                                                className="premium-input"
                                                maxLength={18}
                                                placeholder="请输入18位统一社会信用代码或15位旧营业执照号"
                                                onBlur={(event) => {
                                                    const normalized = normalizeLicenseNo(event.target.value);
                                                    if (normalized !== event.target.value) {
                                                        form.setFieldsValue({ businessLicenseNo: normalized });
                                                    }
                                                }}
                                            />
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} sm={12}>
                                        <Form.Item
                                            name="businessHoursRanges"
                                            label="营业时间"
                                            rules={[{
                                                validator: (_, value) => normalizeBusinessHoursRangesForApi(value).length > 0
                                                    ? Promise.resolve()
                                                    : Promise.reject(new Error('请至少填写 1 条营业时间')),
                                            }]}
                                        >
                                            <BusinessHoursEditor />
                                        </Form.Item>
                                        {!!form.getFieldValue('businessHours') && normalizeBusinessHoursRangesForForm(form.getFieldValue('businessHoursRanges')).length === 0 && (
                                            <Text style={{ color: '#64748b', fontSize: 12 }}>
                                                已识别历史营业时间：{String(form.getFieldValue('businessHours') || '')}，请补充为结构化时段。
                                            </Text>
                                        )}
                                    </Col>
                                </Row>

                                <Form.Item
                                    name="businessLicense"
                                    label="营业执照图片"
                                    valuePropName="fileList"
                                    getValueProps={(value: unknown) => ({
                                        fileList: typeof value === 'string' ? toSingleUploadFileList(value) : [],
                                    })}
                                    getValueFromEvent={() => form.getFieldValue('businessLicense')}
                                    rules={[{ required: true, message: '请上传营业执照图片' }]}
                                >
                                    <Upload
                                        listType="picture-card"
                                        maxCount={1}
                                        accept=".jpg,.jpeg,.png"
                                        beforeUpload={(file) => validateImageBeforeUpload(file as File, 5)}
                                        customRequest={createSingleUploadHandler('businessLicense')}
                                        onPreview={handleUploadPreview}
                                        onRemove={() => {
                                            form.setFieldsValue({ businessLicense: undefined });
                                            return true;
                                        }}
                                    >
                                        <div>上传执照</div>
                                    </Upload>
                                </Form.Item>

                                <Row gutter={16}>
                                    <Col xs={24} sm={12}>
                                        <Form.Item
                                            name="legalPersonName"
                                            label="法人/经营者姓名"
                                            validateTrigger="onBlur"
                                            rules={[
                                                { required: true, message: '请输入法人/经营者姓名' },
                                                { max: 20, message: '姓名最多20个字符' },
                                                {
                                                    validator: (_, value) => {
                                                        const realName = String(value || '').trim();
                                                        if (!realName) {
                                                            return Promise.resolve();
                                                        }
                                                        const currentIdNo = String(form.getFieldValue('legalPersonIdCardNo') || '').trim();
                                                        if (!currentIdNo || !isValidChineseIDCard(currentIdNo)) {
                                                            return Promise.resolve();
                                                        }
                                                        return validateIdCardRemote(currentIdNo, realName);
                                                    },
                                                },
                                            ]}
                                        >
                                            <Input className="premium-input" maxLength={20} placeholder="请输入法人/经营者姓名" />
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} sm={12}>
                                        <Form.Item
                                            name="contactPhone"
                                            label="联系手机号"
                                            rules={[
                                                { required: true, message: '请输入联系手机号' },
                                                { pattern: /^1[3-9]\d{9}$/, message: '请输入正确手机号' },
                                            ]}
                                        >
                                            <Input className="premium-input" maxLength={11} placeholder="请输入联系手机号" />
                                        </Form.Item>
                                    </Col>
                                </Row>

                                <Form.Item
                                    name="legalPersonIdCardNo"
                                    label="法人/经营者身份证号"
                                    validateTrigger="onBlur"
                                    rules={[
                                        { required: true, message: '请输入法人/经营者身份证号' },
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
                                                const realName = String(form.getFieldValue('legalPersonName') || '').trim();
                                                if (!realName) {
                                                    return Promise.resolve();
                                                }
                                                return validateIdCardRemote(id, realName);
                                            },
                                        },
                                    ]}
                                >
                                    <Input className="premium-input" maxLength={18} placeholder="请输入法人/经营者身份证号" />
                                </Form.Item>

                                <Row gutter={16}>
                                    <Col xs={24} sm={12}>
                                        <Form.Item
                                            name="legalPersonIdCardFront"
                                            label="法人/经营者身份证正面"
                                            valuePropName="fileList"
                                            getValueProps={(value: unknown) => ({
                                                fileList: typeof value === 'string' ? toSingleUploadFileList(value) : [],
                                            })}
                                            getValueFromEvent={() => form.getFieldValue('legalPersonIdCardFront')}
                                            rules={[{ required: true, message: '请上传法人/经营者身份证正面' }]}
                                        >
                                            <Upload
                                                listType="picture-card"
                                                maxCount={1}
                                                accept=".jpg,.jpeg,.png"
                                                beforeUpload={(file) => validateImageBeforeUpload(file as File, 2)}
                                                customRequest={createSingleUploadHandler('legalPersonIdCardFront')}
                                                onPreview={handleUploadPreview}
                                                onRemove={() => {
                                                    form.setFieldsValue({ legalPersonIdCardFront: undefined });
                                                    return true;
                                                }}
                                            >
                                                <div>上传正面</div>
                                            </Upload>
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} sm={12}>
                                        <Form.Item
                                            name="legalPersonIdCardBack"
                                            label="法人/经营者身份证反面"
                                            valuePropName="fileList"
                                            getValueProps={(value: unknown) => ({
                                                fileList: typeof value === 'string' ? toSingleUploadFileList(value) : [],
                                            })}
                                            getValueFromEvent={() => form.getFieldValue('legalPersonIdCardBack')}
                                            rules={[{ required: true, message: '请上传法人/经营者身份证反面' }]}
                                        >
                                            <Upload
                                                listType="picture-card"
                                                maxCount={1}
                                                accept=".jpg,.jpeg,.png"
                                                beforeUpload={(file) => validateImageBeforeUpload(file as File, 2)}
                                                customRequest={createSingleUploadHandler('legalPersonIdCardBack')}
                                                onPreview={handleUploadPreview}
                                                onRemove={() => {
                                                    form.setFieldsValue({ legalPersonIdCardBack: undefined });
                                                    return true;
                                                }}
                                            >
                                                <div>上传反面</div>
                                            </Upload>
                                        </Form.Item>
                                    </Col>
                                </Row>

                                <Form.Item name="address" label="门店地址" rules={[{ required: true, message: '请输入门店地址' }]}>
                                    <Input className="premium-input" placeholder="请输入门店地址" maxLength={300} />
                                </Form.Item>
                            </div>
                        )}

                        {currentStep === 2 && (
                            <div data-testid="material-register-step-2">
                                <div style={{ marginBottom: 24 }}>
                                    <Title level={4} style={{ marginBottom: 8, color: '#1e293b' }}>商品信息</Title>
                                    <Text style={{ color: '#64748b', lineHeight: 1.75 }}>按统一卡片方式维护商品名称、单位、价格与图片；至少准备 5 个商品，便于平台审核与展示。</Text>
                                </div>
                                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'stretch', justifyContent: 'space-between', marginBottom: 16 }}>
                                    <Alert
                                        type="info"
                                        showIcon
                                        message="商品要求：至少 5 个，最多 20 个；每个商品需填写名称、单位、价格，上传 1-6 张图片"
                                        style={{ flex: 1, minWidth: 280, borderRadius: 12 }}
                                    />
                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                        <Button size="middle" onClick={() => saveDraft()} style={{ borderRadius: 8 }}>保存草稿</Button>
                                        <Button size="middle" danger onClick={clearDraft} style={{ borderRadius: 8 }}>清除草稿</Button>
                                    </div>
                                </div>
                                {products.map((product, index) => (
                                    <Card key={product.id} size="small" className="premium-product-card"
                                        title={
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <span style={{ fontWeight: 600 }}>商品 {index + 1}</span>
                                                <span style={{ fontSize: 12, color: '#64748b' }}>{product.images.length}/6 张图片</span>
                                            </div>
                                        }
                                        extra={
                                            products.length > 1 && (
                                                <Button
                                                    type="text"
                                                    danger
                                                    size="small"
                                                    icon={<DeleteOutlined />}
                                                    onClick={() => removeProduct(index)}
                                                >
                                                    删除
                                                </Button>
                                            )
                                        }
                                        style={{ marginBottom: 12 }}
                                    >
                                        <Row gutter={[12, 12]}>
                                            <Col xs={24} sm={12}>
                                                <Input className="premium-input"
                                                    placeholder="商品名称"
                                                    value={product.name}
                                                    maxLength={120}
                                                    onChange={(event) => updateProduct(index, { name: event.target.value })}
                                                />
                                            </Col>
                                            <Col xs={24} sm={12}>
                                                <Input className="premium-input"
                                                    placeholder="单位（例如：个 / 套 / m / 平方米）"
                                                    value={product.unit}
                                                    maxLength={20}
                                                    onChange={(event) => updateProduct(index, { unit: event.target.value })}
                                                />
                                            </Col>
                                            <Col xs={24} sm={12}>
                                                <InputNumber className="premium-input"
                                                    style={{ width: '100%' }}
                                                    min={1}
                                                    controls={false}
                                                    placeholder="价格（元）"
                                                    value={product.price}
                                                    onChange={(value) => updateProduct(index, { price: value || undefined })}
                                                />
                                            </Col>
                                        </Row>
                                        <div style={{ marginTop: 16 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 12, flexWrap: 'wrap' }}>
                                                <Text strong style={{ color: '#1e293b' }}>商品图片</Text>
                                                <Text style={{ color: '#64748b', fontSize: 12 }}>至少 1 张，最多 6 张，支持批量上传</Text>
                                            </div>
                                            <Upload
                                                listType="picture-card"
                                                multiple
                                                maxCount={6}
                                                accept=".jpg,.jpeg,.png"
                                                fileList={toProductUploadFileList(product)}
                                                beforeUpload={(file) => validateImageBeforeUpload(file as File, 5)}
                                                customRequest={createProductUploadHandler(index)}
                                                onPreview={handleUploadPreview}
                                                onChange={(uploadInfo) => {
                                                    const urls = uploadInfo.fileList
                                                        .map((uploadFile: UploadFile) => {
                                                            const response = uploadFile.response as { url?: string } | undefined;
                                                            return response?.url || uploadFile.url || '';
                                                        })
                                                        .filter((url): url is string => Boolean(url));
                                                    updateProduct(index, { images: urls });
                                                }}
                                            >
                                                {product.images.length < 6 ? (
                                                    <div>
                                                        <PlusOutlined />
                                                        <div style={{ marginTop: 8 }}>上传图片</div>
                                                    </div>
                                                ) : null}
                                            </Upload>
                                        </div>
                                    </Card>
                                ))}
                                <Button type="dashed" block icon={<PlusOutlined />} onClick={addProduct} disabled={products.length >= 20} style={{ height: 48, borderRadius: 12, marginTop: 8 }}>
                                    添加商品
                                </Button>
                            </div>
                        )}

                        {currentStep === 2 && (
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
                                <Checkbox aria-label="同意平台入驻相关条款" data-testid="material-register-legal-checkbox">
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

                    <Divider style={{ margin: '40px 0' }} />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                        <div>
                            {currentStep > 0 && (
                                <Button size="large" onClick={handlePrev} style={{ borderRadius: 8 }}>上一步</Button>
                            )}
                        </div>
                        <div>
                            {currentStep < steps.length - 1 ? (
                                <Button type="primary" size="large" onClick={handleNext} style={{ borderRadius: 8, padding: '0 32px' }} data-testid={`material-register-next-${currentStep}`}>
                                    下一步 <ArrowRightOutlined />
                                </Button>
                            ) : (
                                <Button type="primary" size="large" loading={loading} icon={<CheckOutlined />} onClick={handleSubmit} style={{ borderRadius: 8, padding: '0 32px' }} data-testid="material-register-submit">
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
                        <img src={previewImage} alt="主材图片预览" style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain' }} />
                    </Modal>
        </MerchantOnboardingShell>
    );
};

export default MaterialShopRegister;
