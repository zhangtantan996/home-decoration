import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Avatar,
    Button,
    Card,
    Col,
    Divider,
    Form,
    Input,
    InputNumber,
    Progress,
    Row,
    Select,
    Switch,
    Tag,
    Upload,
    message,
} from 'antd';
import {
    ArrowLeftOutlined,
    BookOutlined,
    CameraOutlined,
    LoadingOutlined,
    SaveOutlined,
    TeamOutlined,
    UserOutlined,
    WalletOutlined,
} from '@ant-design/icons';
import ImgCrop from 'antd-img-crop';
import type { UploadFile, UploadProps } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
    merchantAuthApi,
    merchantUploadApi,
    type MerchantUploadResult,
    type MerchantProviderInfo,
    type MerchantServiceSetting,
} from '../../services/merchantApi';
import { useMerchantAuthStore } from '../../stores/merchantAuthStore';
import { dictionaryApi } from '../../services/dictionaryApi';
import { regionApi, type ServiceCityRegion } from '../../services/regionApi';
import { resolveDisplayStatusMeta } from '../../utils/displayStatus';
import { IMAGE_UPLOAD_SPECS, validateImageUploadBeforeSend } from '../../utils/imageUpload';
import {
    buildStoredAssetFile,
    getStoredPathFromUploadFile,
    getUploadedAssetPreviewUrl,
    getUploadedAssetStoredPath,
    normalizeStoredAssetValues,
} from '../../utils/uploadAsset';

const FOREMAN_HIGHLIGHT_OPTIONS = [
    '工期可控',
    '工地整洁',
    '节点验收',
    '材料透明',
    '自有工班',
    '售后保障',
];

const DEFAULT_SERVICE_SETTINGS: MerchantServiceSetting = {
    acceptBooking: true,
    autoConfirmHours: 24,
    responseTimeDesc: '',
    priceRangeMin: 0,
    priceRangeMax: 0,
    serviceStyles: [],
    servicePackages: [],
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

const toAlbumFileList = (urls: string[] = []) =>
    urls
        .map((value, index) => buildStoredAssetFile(value, `${index}-${value}`))
        .filter(Boolean) as Array<UploadFile<MerchantUploadResult>>;

const pickPositiveNumber = (value: unknown) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined;
};

const parsePackagesFromRaw = (raw: string): Array<Record<string, unknown>> => {
    const trimmed = raw.trim();
    if (!trimmed) {
        return [];
    }

    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) {
        throw new Error('服务套餐必须是 JSON 数组');
    }

    return parsed.map((item) => {
        if (typeof item !== 'object' || item === null || Array.isArray(item)) {
            throw new Error('服务套餐数组元素必须是对象');
        }
        return item as Record<string, unknown>;
    });
};

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

interface MerchantInfoFormValues {
    name: string;
    companyName?: string;
    yearsExperience?: number;
    specialty?: string[];
    highlightTags?: string[];
    priceFlat?: number;
    priceDuplex?: number;
    priceOther?: number;
    pricePerSqm?: number;
    priceFullPackage?: number;
    priceHalfPackage?: number;
    graduateSchool?: string;
    designPhilosophy?: string;
    serviceArea?: string[];
    introduction?: string;
    teamSize?: number;
    officeAddress?: string;
    companyAlbum?: string[];
    surveyDepositPrice?: number;
}

interface MerchantServiceSettingsFormValues {
    acceptBooking: boolean;
    autoConfirmHours: number;
    responseTimeDesc: string;
    priceRangeMin: number;
    priceRangeMax: number;
    serviceStyles: string[];
    servicePackagesRaw: string;
    surveyDepositPrice?: number;
}

interface SaveOptions {
    silent?: boolean;
    rethrow?: boolean;
    latestInfoValues?: MerchantInfoFormValues;
}

type SectionKey = 'basic' | 'settings';

const MerchantSettings: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [savingInfo, setSavingInfo] = useState(false);
    const [savingSettings, setSavingSettings] = useState(false);
    const [savingAll, setSavingAll] = useState(false);
    const [avatarUploading, setAvatarUploading] = useState(false);
    const [coverUploading, setCoverUploading] = useState(false);
    const [displayUpdating, setDisplayUpdating] = useState(false);
    const [providerInfo, setProviderInfo] = useState<MerchantProviderInfo | null>(null);
    const [styleOptions, setStyleOptions] = useState<string[]>([]);
    const [areaOptions, setAreaOptions] = useState<ServiceCityGroupOption[]>([]);
    const updateSessionProvider = useMerchantAuthStore((state) => state.updateProvider);
    const sectionRefs = useRef<Record<SectionKey, HTMLDivElement | null>>({
        basic: null,
        settings: null,
    });
    const [infoForm] = Form.useForm();
    const [settingForm] = Form.useForm();

    const isForeman = useMemo(() => {
        const subtype = String(providerInfo?.providerSubType || '').toLowerCase();
        if (subtype === 'foreman') {
            return true;
        }
        return providerInfo?.providerType === 3;
    }, [providerInfo]);

    const isCompanyOrStudio = useMemo(() => {
        const applicantType = String(providerInfo?.applicantType || '').toLowerCase();
        return applicantType === 'company' || applicantType === 'studio' || providerInfo?.providerType === 2;
    }, [providerInfo]);

    const isCompanyRole = useMemo(() => {
        const role = String(providerInfo?.role || '').toLowerCase();
        return role === 'company' || providerInfo?.providerType === 2;
    }, [providerInfo]);
    const displayStatusMeta = useMemo(
        () => resolveDisplayStatusMeta(providerInfo, { activeLabel: '接单中' }),
        [providerInfo],
    );
    const isDesignerRole = !isForeman && !isCompanyRole;

    const basicInfoTitle = isDesignerRole
        ? '品牌与能力设定'
        : isForeman
        ? '基础资料与施工能力'
        : isCompanyRole
            ? '企业资料与服务能力'
            : '个人品牌与服务能力';
    const nameLabel = isForeman ? '工长显示名称' : isCompanyRole ? '企业展示名称' : '设计师显示名称';
    const namePlaceholder = isForeman ? '请输入工长/项目经理名称' : isCompanyRole ? '请输入企业展示名称' : '请输入设计师名称';
    const companyNameLabel = isCompanyRole ? '企业名称' : '公司/工作室名称';
    const yearsLabel = isForeman ? '施工年限' : '从业年限';
    const yearsPlaceholder = isForeman ? '选择施工年限' : '选择从业年限';
    const serviceAreaLabel = isForeman ? '常驻城市' : '服务城市';
    const introLabel = isForeman ? '施工服务简介' : isCompanyRole ? '企业品牌介绍' : '个人/公司简介';
    const introPlaceholder = isForeman
        ? '介绍施工经验、班组优势、服务特色等'
        : isCompanyRole
            ? '介绍企业资质、主营服务、交付能力与服务承诺'
            : '介绍设计理念、服务特色等';
    const philosophyLabel = isForeman ? '施工理念' : isCompanyRole ? '服务承诺' : '设计理念';
    const philosophyPlaceholder = isForeman
        ? '请填写施工理念（选填）'
        : isCompanyRole
            ? '请填写企业服务承诺（选填）'
            : '请填写设计理念（选填）';
    const serviceSettingTitle = isForeman ? '施工接单设置' : isCompanyRole ? '企业服务设置' : '设计服务设置';
    const teamSectionTitle = isDesignerRole
        ? '团队与办公地点'
        : isCompanyRole
            ? '团队与办公地点'
            : isForeman
                ? '班组与常驻信息'
                : '团队与办公信息';
    const philosophySectionTitle = isDesignerRole
        ? '设计理念与教育背景'
        : isCompanyRole
            ? '品牌介绍与服务承诺'
            : '施工理念与服务说明';
    const sectionLabels: Record<SectionKey, { title: string; description: string }> = {
        basic: {
            title: basicInfoTitle,
            description: isForeman
                ? '维护工长形象、施工能力与可承接区域。'
                : isCompanyRole
                    ? '维护企业对外展示资料、团队能力与服务范围。'
                    : '维护个人品牌、设计能力与对外展示信息。',
        },
        settings: {
            title: serviceSettingTitle,
            description: isDesignerRole
                ? '统一维护量房费等设计服务参数。'
                : '统一维护接单策略、服务范围与对外报价摘要。',
        },
    };
    const isSaving = savingInfo || savingSettings || savingAll;
    const profileCompletion = useMemo(() => {
        if (!providerInfo) return 0;
        const checks = [
            Boolean(providerInfo.avatar),
            Boolean(providerInfo.name),
            Boolean(providerInfo.serviceArea?.length),
            Boolean(providerInfo.introduction),
            Boolean(providerInfo.designPhilosophy),
            Boolean(providerInfo.yearsExperience),
            Boolean(providerInfo.specialty?.length || providerInfo.highlightTags?.length),
            Boolean(providerInfo.pricing && Object.keys(providerInfo.pricing).length > 0),
        ];
        const filled = checks.filter(Boolean).length;
        return Math.max(10, Math.round((filled / checks.length) * 100));
    }, [providerInfo]);

    useEffect(() => {
        void Promise.all([
            fetchProviderInfo(),
            fetchServiceSettings(),
            loadStyleOptions(),
            loadAreaOptions(),
        ]);
    }, []);

    const loadStyleOptions = async () => {
        try {
            const options = await dictionaryApi.getOptions('style');
            setStyleOptions(options.map((item) => item.label));
        } catch (error) {
            console.error('加载装修风格失败:', error);
            setStyleOptions(['现代简约', '北欧风格', '新中式', '轻奢风格', '美式风格', '欧式风格', '日式风格', '工业风格']);
        }
    };

    const loadAreaOptions = async () => {
        try {
            const cities = await regionApi.getServiceCities();
            setAreaOptions(buildServiceCityGroups(cities));
        } catch (error) {
            console.error('加载服务城市失败:', error);
            setAreaOptions([
                {
                    label: '陕西省',
                    options: [{ label: '西安市', value: '610100' }],
                },
            ]);
        }
    };

    const fetchProviderInfo = async () => {
        setLoading(true);
        try {
            const info = await merchantAuthApi.getInfo();
            setProviderInfo(info);
            updateSessionProvider({
                name: info.name,
                avatar: info.avatar,
                role: info.role,
                entityType: info.entityType,
                applicantType: info.applicantType,
                providerSubType: info.providerSubType,
                merchantKind: info.merchantKind,
            });
            infoForm.setFieldsValue({
                name: info.name,
                companyName: info.companyName,
                yearsExperience: info.yearsExperience,
                surveyDepositPrice: info.surveyDepositPrice || 0,
                specialty: info.specialty,
                highlightTags: info.highlightTags || [],
                priceFlat: info.pricing?.flat,
                priceDuplex: info.pricing?.duplex,
                priceOther: info.pricing?.other,
                pricePerSqm: info.pricing?.perSqm,
                priceFullPackage: info.pricing?.fullPackage,
                priceHalfPackage: info.pricing?.halfPackage,
                graduateSchool: info.graduateSchool || '',
                designPhilosophy: info.designPhilosophy || '',
                serviceArea: info.serviceAreaCodes || info.serviceArea,
                introduction: info.introduction,
                teamSize: info.teamSize,
                officeAddress: info.officeAddress,
                companyAlbum: normalizeStoredAssetValues(info.companyAlbum || []),
            });
            settingForm.setFieldValue('surveyDepositPrice', info.surveyDepositPrice || 0);
        } catch (error) {
            message.error(getErrorMessage(error, '获取账户信息失败'));
        } finally {
            setLoading(false);
        }
    };

    const fetchServiceSettings = async () => {
        try {
            const settings = await merchantAuthApi.getServiceSettings();
            settingForm.setFieldsValue({
                ...DEFAULT_SERVICE_SETTINGS,
                ...settings,
                servicePackagesRaw: JSON.stringify(settings.servicePackages || [], null, 2),
            });
        } catch (error) {
            console.error('加载服务设置失败:', error);
            settingForm.setFieldsValue({
                ...DEFAULT_SERVICE_SETTINGS,
                servicePackagesRaw: '[]',
            });
        }
    };

    const scrollToSection = (section: SectionKey) => {
        sectionRefs.current[section]?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
        });
    };

    const buildInfoPayload = (values: MerchantInfoFormValues, surveyDepositPrice?: number) => {
        const pricing: Record<string, number> = {};
        if (isDesignerRole) {
            const flat = pickPositiveNumber(values.priceFlat);
            const duplex = pickPositiveNumber(values.priceDuplex);
            const other = pickPositiveNumber(values.priceOther);
            if (flat) pricing.flat = flat;
            if (duplex) pricing.duplex = duplex;
            if (other) pricing.other = other;
        } else if (isForeman) {
            const perSqm = pickPositiveNumber(values.pricePerSqm);
            if (perSqm) pricing.perSqm = perSqm;
        } else {
            const fullPackage = pickPositiveNumber(values.priceFullPackage);
            const halfPackage = pickPositiveNumber(values.priceHalfPackage);
            if (fullPackage) pricing.fullPackage = fullPackage;
            if (halfPackage) pricing.halfPackage = halfPackage;
        }

        const officeAddress = (values.officeAddress || '').trim();
        if (!officeAddress) {
            throw new Error(isForeman ? '请输入常驻地址' : '请输入办公地址');
        }

        const resolvedSurveyDepositPrice = surveyDepositPrice ?? (
            values.surveyDepositPrice != null ? Number(values.surveyDepositPrice || 0) : undefined
        );

        const payload: Record<string, unknown> = {
            name: values.name,
            companyName: values.companyName || '',
            yearsExperience: values.yearsExperience || 0,
            highlightTags: values.highlightTags || [],
            pricing,
            graduateSchool: values.graduateSchool || '',
            designPhilosophy: values.designPhilosophy || '',
            serviceArea: values.serviceArea || [],
            introduction: values.introduction || '',
            teamSize: values.teamSize || 1,
            officeAddress,
        };

        if (resolvedSurveyDepositPrice != null) {
            payload.surveyDepositPrice = resolvedSurveyDepositPrice;
        }

        if (isForeman) {
            payload.specialty = [];
        } else {
            payload.specialty = values.specialty || [];
        }

        if (isCompanyRole) {
            payload.companyAlbum = normalizeStoredAssetValues(values.companyAlbum || []);
        }

        const providerPatch: Partial<MerchantProviderInfo> = {
            name: values.name,
            companyName: values.companyName || '',
            yearsExperience: values.yearsExperience || 0,
            specialty: isForeman ? [] : (values.specialty || []),
            highlightTags: values.highlightTags || [],
            pricing,
            graduateSchool: values.graduateSchool || '',
            designPhilosophy: values.designPhilosophy || '',
            serviceArea: values.serviceArea || [],
            introduction: values.introduction || '',
            teamSize: values.teamSize || 1,
            officeAddress,
        };

        if (resolvedSurveyDepositPrice != null) {
            providerPatch.surveyDepositPrice = resolvedSurveyDepositPrice;
        }

        if (isCompanyRole) {
            providerPatch.companyAlbum = normalizeStoredAssetValues(values.companyAlbum || []);
        }

        return {
            payload,
            providerPatch,
        };
    };

    const persistInfo = async (values: MerchantInfoFormValues, options: SaveOptions = {}) => {
        setSavingInfo(true);
        try {
            const { payload, providerPatch } = buildInfoPayload(values);
            await merchantAuthApi.updateInfo(payload);
            setProviderInfo((prev) => {
                if (!prev) return prev;
                return {
                    ...prev,
                    ...providerPatch,
                };
            });
            updateSessionProvider({
                name: providerPatch.name,
            });

            if (!options.silent) {
                message.success('基础资料保存成功');
            }
        } catch (error) {
            if (!options.silent) {
                message.error(getErrorMessage(error, '保存失败'));
            }
            if (options.rethrow) {
                throw error;
            }
        } finally {
            setSavingInfo(false);
        }
    };

    const persistServiceSettings = async (values: MerchantServiceSettingsFormValues, options: SaveOptions = {}) => {
        setSavingSettings(true);
        try {
            if (isDesignerRole) {
                const latestInfoValues = options.latestInfoValues || infoForm.getFieldsValue() as MerchantInfoFormValues;
                if (!providerInfo && !latestInfoValues) {
                    message.error('账户信息尚未加载完成');
                    return;
                }
                const baseValues: MerchantInfoFormValues = {
                    name: latestInfoValues?.name || providerInfo?.name || '',
                    companyName: latestInfoValues?.companyName || providerInfo?.companyName || '',
                    yearsExperience: latestInfoValues?.yearsExperience || providerInfo?.yearsExperience || 0,
                    specialty: latestInfoValues?.specialty || providerInfo?.specialty || [],
                    highlightTags: latestInfoValues?.highlightTags || providerInfo?.highlightTags || [],
                    priceFlat: latestInfoValues?.priceFlat ?? providerInfo?.pricing?.flat,
                    priceDuplex: latestInfoValues?.priceDuplex ?? providerInfo?.pricing?.duplex,
                    priceOther: latestInfoValues?.priceOther ?? providerInfo?.pricing?.other,
                    pricePerSqm: latestInfoValues?.pricePerSqm ?? providerInfo?.pricing?.perSqm,
                    priceFullPackage: latestInfoValues?.priceFullPackage ?? providerInfo?.pricing?.fullPackage,
                    priceHalfPackage: latestInfoValues?.priceHalfPackage ?? providerInfo?.pricing?.halfPackage,
                    graduateSchool: latestInfoValues?.graduateSchool || providerInfo?.graduateSchool || '',
                    designPhilosophy: latestInfoValues?.designPhilosophy || providerInfo?.designPhilosophy || '',
                    serviceArea: latestInfoValues?.serviceArea || providerInfo?.serviceArea || [],
                    introduction: latestInfoValues?.introduction || providerInfo?.introduction || '',
                    teamSize: latestInfoValues?.teamSize || providerInfo?.teamSize || 1,
                    officeAddress: latestInfoValues?.officeAddress || providerInfo?.officeAddress || '',
                    companyAlbum: latestInfoValues?.companyAlbum || providerInfo?.companyAlbum || [],
                    surveyDepositPrice: latestInfoValues?.surveyDepositPrice ?? providerInfo?.surveyDepositPrice,
                };
                const surveyDepositPrice = Number(values.surveyDepositPrice || 0);
                const { payload, providerPatch } = buildInfoPayload(baseValues, surveyDepositPrice);
                await merchantAuthApi.updateInfo(payload);
                setProviderInfo((prev) => prev ? ({
                    ...prev,
                    ...providerPatch,
                }) : prev);
                infoForm.setFieldValue('surveyDepositPrice', surveyDepositPrice);
                if (!options.silent) {
                    message.success('设计服务设置保存成功');
                }
                return;
            }

            const servicePackages = parsePackagesFromRaw(values.servicePackagesRaw || '[]');
            const payload: MerchantServiceSetting = {
                acceptBooking: Boolean(values.acceptBooking),
                autoConfirmHours: Number(values.autoConfirmHours || 24),
                responseTimeDesc: (values.responseTimeDesc || '').trim(),
                priceRangeMin: Number(values.priceRangeMin || 0),
                priceRangeMax: Number(values.priceRangeMax || 0),
                serviceStyles: values.serviceStyles || [],
                servicePackages,
            };

            await merchantAuthApi.updateServiceSettings(payload);
            if (!options.silent) {
                message.success('服务设置保存成功');
            }
        } catch (error) {
            if (!options.silent) {
                message.error(getErrorMessage(error, '服务设置保存失败'));
            }
            if (options.rethrow) {
                throw error;
            }
        } finally {
            setSavingSettings(false);
        }
    };

    const handleSaveAll = async () => {
        setSavingAll(true);
        try {
            const infoValues = await infoForm.validateFields().catch((error) => {
                scrollToSection('basic');
                throw error;
            }) as MerchantInfoFormValues;

            await persistInfo(infoValues, { silent: true, rethrow: true });
            if (!isDesignerRole) {
                const settingsValues = await settingForm.validateFields().catch((error) => {
                    scrollToSection('settings');
                    throw error;
                }) as MerchantServiceSettingsFormValues;
                await persistServiceSettings(settingsValues, {
                    silent: true,
                    rethrow: true,
                    latestInfoValues: infoValues,
                });
            }
            message.success('账户设置已保存');
        } catch (error) {
            if ((error as { errorFields?: unknown[] } | undefined)?.errorFields) {
                return;
            }
            message.error(getErrorMessage(error, '账户设置保存失败'));
        } finally {
            setSavingAll(false);
        }
    };

    const handleAvatarUpload: UploadProps['customRequest'] = async (options) => {
        const { file, onSuccess, onError } = options;
        setAvatarUploading(true);
        try {
            const uploaded = await merchantUploadApi.uploadAvatarData(file as File);
            const uploadedUrl = getUploadedAssetPreviewUrl(uploaded);

            setProviderInfo((prev) => (prev ? { ...prev, avatar: uploadedUrl } : prev));
            updateSessionProvider({ avatar: uploadedUrl });

            message.success('头像上传成功');
            onSuccess?.(uploaded);
        } catch (error) {
            const errorMessage = getErrorMessage(error, '头像上传失败');
            message.error(errorMessage);
            onError?.(new Error(errorMessage));
        } finally {
            setAvatarUploading(false);
        }
    };

    const handleCoverUpload: UploadProps['customRequest'] = async (options) => {
        const { file, onSuccess, onError } = options;
        setCoverUploading(true);
        try {
            const uploaded = await merchantUploadApi.uploadImageData(file as File);
            const storedPath = getUploadedAssetStoredPath(uploaded);
            if (!storedPath) {
                throw new Error('背景图上传结果缺少资源路径');
            }

            const previewUrl = getUploadedAssetPreviewUrl(uploaded) || storedPath;
            await merchantAuthApi.updateInfo({ coverImage: storedPath });
            setProviderInfo((prev) => (prev ? { ...prev, coverImage: previewUrl } : prev));
            message.success('背景图已更新');
            onSuccess?.(uploaded);
        } catch (error) {
            const errorMessage = getErrorMessage(error, '背景图上传失败');
            message.error(errorMessage);
            onError?.(new Error(errorMessage));
        } finally {
            setCoverUploading(false);
        }
    };

    const handleCoverClear = async () => {
        if (!providerInfo?.coverImage) {
            return;
        }

        setCoverUploading(true);
        try {
            await merchantAuthApi.updateInfo({ coverImage: '' });
            setProviderInfo((prev) => (prev ? { ...prev, coverImage: '' } : prev));
            message.success('背景图已清空');
        } catch (error) {
            message.error(getErrorMessage(error, '清空背景图失败'));
        } finally {
            setCoverUploading(false);
        }
    };

    const handleCompanyAlbumUpload: UploadProps['customRequest'] = async (options) => {
        const { file, onSuccess, onError } = options;
        try {
            const uploaded = await merchantUploadApi.uploadImageData(file as File);
            const storedPath = getUploadedAssetStoredPath(uploaded);
            const current = normalizeStoredAssetValues((infoForm.getFieldValue('companyAlbum') || []) as string[]);
            if (storedPath && !current.includes(storedPath)) {
                infoForm.setFieldValue('companyAlbum', [...current, storedPath].slice(0, 8));
            }
            onSuccess?.(uploaded);
        } catch (error) {
            const errorMessage = getErrorMessage(error, '公司相册上传失败');
            message.error(errorMessage);
            onError?.(new Error(errorMessage));
        }
    };

    const handleDisplayToggle = async (checked: boolean) => {
        setDisplayUpdating(true);
        try {
            await merchantAuthApi.updateInfo({ merchantDisplayEnabled: checked });
            setProviderInfo((prev) => prev ? {
                ...prev,
                merchantDisplayEnabled: checked,
            } : prev);
            message.success(checked ? '展示设置已保存' : '已下线');
            await fetchProviderInfo();
        } catch (error) {
            message.error(getErrorMessage(error, '更新接单状态失败'));
        } finally {
            setDisplayUpdating(false);
        }
    };

    const getProviderTypeLabel = () => {
        if (!providerInfo) return '商家';
        const providerSubType = String(providerInfo.providerSubType || '').toLowerCase();
        switch (providerSubType) {
            case 'company':
                return '装修公司';
            case 'foreman':
                return '工长/项目经理';
            default:
                return '设计师';
        }
    };

    const sectionCardStyle: React.CSSProperties = {
        borderRadius: 24,
        boxShadow: '0 12px 30px rgba(15, 23, 42, 0.06)',
    };

    const sectionBodyStyle: React.CSSProperties = {
        padding: 24,
    };

    const softPanelStyle: React.CSSProperties = {
        borderRadius: 20,
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        padding: 18,
        height: '100%',
    };

    return (
        <div style={{ padding: 24, background: '#f6f8fb', minHeight: '100vh' }}>
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 16,
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    marginBottom: 24,
                }}
            >
                <div>
                    <Button
                        type="link"
                        icon={<ArrowLeftOutlined />}
                        onClick={() => navigate('/dashboard')}
                        style={{ padding: 0, marginBottom: 8 }}
                    >
                        返回工作台
                    </Button>
                    <h2 style={{ margin: 0, fontSize: 28, color: '#0f172a' }}>账户设置</h2>
                    <div style={{ marginTop: 8, color: '#64748b' }}>
                        借鉴参考页的信息组织方式，但不照搬视觉，保留当前业务所需字段与保存逻辑。
                    </div>
                </div>
                <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    size="large"
                    loading={isSaving}
                    onClick={() => void handleSaveAll()}
                    style={{
                        minWidth: 144,
                        borderRadius: 12,
                        boxShadow: '0 10px 20px rgba(22, 119, 255, 0.18)',
                    }}
                >
                    保存更新
                </Button>
            </div>

            <Row gutter={24} align="top">
                <Col xs={24} xl={6}>
                    <div style={{ position: 'sticky', top: 24 }}>
                        <Card
                            loading={loading}
                            bordered={false}
                            style={{
                                ...sectionCardStyle,
                                overflow: 'hidden',
                            }}
                            bodyStyle={sectionBodyStyle}
                        >
                            <div
                                style={{
                                    margin: '-24px -24px 24px',
                                    padding: '28px 24px 22px',
                                    background: 'linear-gradient(135deg, #e0f2fe 0%, #eff6ff 100%)',
                                    textAlign: 'center',
                                }}
                            >
                                <div style={{ textAlign: 'center', marginBottom: 8 }}>
                                    <ImgCrop rotationSlider cropShape="round" aspect={1} showReset showGrid>
                                        <Upload
                                            name="avatar"
                                            showUploadList={false}
                                            customRequest={handleAvatarUpload}
                                            beforeUpload={(file) => validateImageUploadBeforeSend(file as File, IMAGE_UPLOAD_SPECS.avatar)}
                                            accept=".jpg,.jpeg,.png"
                                        >
                                            <div style={{ position: 'relative', display: 'inline-block', cursor: 'pointer' }}>
                                                <Avatar
                                                    size={88}
                                                    src={providerInfo?.avatar}
                                                    icon={avatarUploading ? <LoadingOutlined /> : <UserOutlined />}
                                                    style={{
                                                        marginBottom: 8,
                                                        border: '4px solid rgba(255,255,255,0.9)',
                                                        boxShadow: '0 12px 24px rgba(14, 116, 144, 0.16)',
                                                    }}
                                                />
                                                <div
                                                    style={{
                                                        position: 'absolute',
                                                        bottom: 8,
                                                        right: 0,
                                                        background: '#1677ff',
                                                        borderRadius: '50%',
                                                        width: 26,
                                                        height: 26,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        border: '2px solid #fff',
                                                    }}
                                                >
                                                    <CameraOutlined style={{ color: '#fff', fontSize: 12 }} />
                                                </div>
                                            </div>
                                            <div style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>点击更换头像</div>
                                        </Upload>
                                    </ImgCrop>
                                    <h3 style={{ margin: '12px 0 6px', color: '#0f172a' }}>{providerInfo?.name || '商家'}</h3>
                                    <div style={{ color: '#64748b' }}>
                                        {getProviderTypeLabel()}
                                        {providerInfo?.verified && <span style={{ color: '#16a34a', marginLeft: 8 }}>已认证</span>}
                                    </div>
                                </div>
                            </div>

                            <div style={{ ...softPanelStyle, marginBottom: 20 }}>
                                <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 8 }}>详情页背景图</div>
                                <div
                                    style={{
                                        position: 'relative',
                                        height: 128,
                                        borderRadius: 18,
                                        overflow: 'hidden',
                                        border: '1px solid #e2e8f0',
                                        background: 'linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%)',
                                    }}
                                >
                                    {providerInfo?.coverImage ? (
                                        <img
                                            src={providerInfo.coverImage}
                                            alt="服务商背景图"
                                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                        />
                                    ) : (
                                        <div
                                            style={{
                                                width: '100%',
                                                height: '100%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: '#475569',
                                                fontSize: 13,
                                                textAlign: 'center',
                                                padding: '0 16px',
                                                lineHeight: 1.7,
                                            }}
                                        >
                                            未上传背景图时，前台会按公司相册 / 案例图 / 默认背景兜底
                                        </div>
                                    )}
                                </div>
                                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                                    <Upload
                                        showUploadList={false}
                                        customRequest={handleCoverUpload}
                                        beforeUpload={(file) => validateImageUploadBeforeSend(file as File, IMAGE_UPLOAD_SPECS.showcase)}
                                        accept=".jpg,.jpeg,.png,.webp"
                                    >
                                        <Button icon={coverUploading ? <LoadingOutlined /> : <CameraOutlined />} loading={coverUploading}>
                                            上传背景图
                                        </Button>
                                    </Upload>
                                    <Button onClick={() => void handleCoverClear()} disabled={!providerInfo?.coverImage || coverUploading}>
                                        清空背景图
                                    </Button>
                                </div>
                                <div style={{ color: '#64748b', fontSize: 12, lineHeight: 1.7, marginTop: 10 }}>
                                    背景图只用于服务商详情页顶部头图，不再和头像共用。
                                </div>
                            </div>

                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                                    gap: 12,
                                    marginBottom: 20,
                                }}
                            >
                                {[
                                    { label: '评分', value: providerInfo?.rating || 0 },
                                    { label: '订单', value: `${providerInfo?.completedCnt || 0} 单` },
                                    { label: '年限', value: `${providerInfo?.yearsExperience || 0} 年` },
                                ].map((item) => (
                                    <div
                                        key={item.label}
                                        style={{
                                            padding: '14px 12px',
                                            borderRadius: 16,
                                            background: '#f8fafc',
                                            border: '1px solid #e2e8f0',
                                            textAlign: 'center',
                                        }}
                                    >
                                        <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>{item.label}</div>
                                        <div style={{ color: '#0f172a', fontWeight: 600 }}>{item.value}</div>
                                    </div>
                                ))}
                            </div>

                            <div style={softPanelStyle}>
                                <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 6 }}>资料维护建议</div>
                                <div style={{ color: '#475569', lineHeight: 1.7 }}>
                                    优先完善头像、名称、服务城市、理念介绍和报价信息，外部展示会更完整。
                                </div>
                            </div>

                            <div style={{ ...softPanelStyle, marginTop: 16 }}>
                                <div
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        gap: 16,
                                        flexWrap: 'wrap',
                                    }}
                                >
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                        <div style={{ color: '#0f172a', fontWeight: 600 }}>接单状态</div>
                                        <div style={{ marginTop: 8 }}>
                                            <Tag
                                                color={displayStatusMeta.color}
                                                style={{ margin: 0, borderRadius: 999, paddingInline: 10, lineHeight: '22px' }}
                                            >
                                                {displayStatusMeta.label}
                                            </Tag>
                                        </div>
                                        {displayStatusMeta.helperText && (
                                            <div style={{ marginTop: 8, color: '#64748b', fontSize: 12, lineHeight: 1.6 }}>
                                                {displayStatusMeta.helperText}
                                            </div>
                                        )}
                                    </div>
                                    <Switch
                                        checked={providerInfo?.merchantDisplayEnabled ?? true}
                                        loading={displayUpdating}
                                        disabled={displayStatusMeta.switchDisabled}
                                        onChange={handleDisplayToggle}
                                        checkedChildren="接单中"
                                        unCheckedChildren="下线"
                                    />
                                </div>
                            </div>

                            <Divider style={{ margin: '20px 0' }} />

                            <div style={softPanelStyle}>
                                <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 8 }}>资料完善度</div>
                                <div style={{ color: '#0f172a', fontWeight: 700, fontSize: 24, marginBottom: 8 }}>
                                    {profileCompletion}%
                                </div>
                                <Progress percent={profileCompletion} showInfo={false} strokeColor="#2563eb" trailColor="#dbeafe" />
                                <div style={{ color: '#64748b', marginTop: 10, lineHeight: 1.7 }}>
                                    完善头像、理念介绍和报价信息，可提升资料完整度与展示质量。
                                </div>
                            </div>
                        </Card>
                    </div>
                </Col>

                <Col xs={24} xl={18}>
                    <Form form={infoForm} layout="vertical">
                        <div
                            ref={(node) => {
                                sectionRefs.current.basic = node;
                            }}
                        >
                            <Row gutter={[16, 16]}>
                                <Col xs={24} lg={14}>
                                    <Card
                                        title={(
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                                <UserOutlined style={{ color: '#2563eb' }} />
                                                <span>{basicInfoTitle}</span>
                                            </span>
                                        )}
                                        loading={loading}
                                        bordered={false}
                                        style={sectionCardStyle}
                                        bodyStyle={sectionBodyStyle}
                                        extra={<span style={{ color: '#94a3b8', fontSize: 12 }}>{sectionLabels.basic.description}</span>}
                                    >
                                        <Row gutter={16}>
                                            <Col xs={24} md={12}>
                                                <Form.Item
                                                    name="name"
                                                    label={nameLabel}
                                                    rules={[{ required: true, message: '请输入名称' }, { max: 50, message: '名称最多50个字符' }]}
                                                >
                                                    <Input placeholder={namePlaceholder} maxLength={50} />
                                                </Form.Item>
                                            </Col>
                                            <Col xs={24} md={12}>
                                                {isCompanyOrStudio ? (
                                                    <Form.Item name="companyName" label={companyNameLabel}>
                                                        <Input placeholder="公司全称" maxLength={100} />
                                                    </Form.Item>
                                                ) : (
                                                    <Form.Item name="yearsExperience" label={yearsLabel}>
                                                        <Select placeholder={yearsPlaceholder}>
                                                            {[1, 2, 3, 5, 8, 10, 15, 20].map((year) => (
                                                                <Select.Option key={year} value={year}>
                                                                    {year}年以上
                                                                </Select.Option>
                                                            ))}
                                                        </Select>
                                                    </Form.Item>
                                                )}
                                            </Col>
                                        </Row>

                                        <Row gutter={16}>
                                            <Col xs={24} md={12}>
                                                {!isForeman && (
                                                    <Form.Item
                                                        name="specialty"
                                                        label={isCompanyRole ? '主营风格 / 项目偏好' : '专注设计风格'}
                                                        rules={[{ type: 'array', max: 5, message: '最多选择5个擅长风格' }]}
                                                    >
                                                        <Select mode="multiple" placeholder={isCompanyRole ? '选择主营风格/项目偏好' : '选择擅长风格'} maxTagCount={4}>
                                                            {styleOptions.map((style) => (
                                                                <Select.Option key={style} value={style}>
                                                                    {style}
                                                                </Select.Option>
                                                            ))}
                                                        </Select>
                                                    </Form.Item>
                                                )}
                                            </Col>
                                            <Col xs={24} md={12}>
                                                {isForeman && (
                                                    <Form.Item
                                                        name="highlightTags"
                                                        label="业务擅长领域"
                                                        rules={[{ type: 'array', min: 1, max: 3, message: '请选择1-3个施工亮点' }]}
                                                    >
                                                        <Select
                                                            mode="multiple"
                                                            placeholder="选择工种/班组亮点"
                                                            options={FOREMAN_HIGHLIGHT_OPTIONS.map((item) => ({ value: item, label: item }))}
                                                        />
                                                    </Form.Item>
                                                )}
                                            </Col>
                                        </Row>

                                        <Form.Item name="serviceArea" label={serviceAreaLabel}>
                                            <Select
                                                mode="multiple"
                                                placeholder={`选择${serviceAreaLabel}`}
                                                options={areaOptions}
                                                optionFilterProp="label"
                                            />
                                        </Form.Item>
                                    </Card>
                                </Col>

                                <Col xs={24} lg={10}>
                                    <Card bordered={false} style={sectionCardStyle} bodyStyle={sectionBodyStyle}>
                                        <div style={{ color: '#0f172a', fontWeight: 700, fontSize: 18, marginBottom: 16 }}>
                                            资料摘要
                                        </div>
                                        <div style={{ display: 'grid', gap: 12 }}>
                                            <div style={softPanelStyle}>
                                                <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 6 }}>当前角色</div>
                                                <div style={{ color: '#0f172a', fontWeight: 600 }}>{getProviderTypeLabel()}</div>
                                            </div>
                                            <div style={softPanelStyle}>
                                                <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 6 }}>必要资料</div>
                                                <div style={{ color: '#475569', lineHeight: 1.7 }}>
                                                    必要功能仍全部保留，只是把字段重新分组，减少“长表单一路往下滚”的割裂感。
                                                </div>
                                            </div>
                                            <div style={softPanelStyle}>
                                                <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 6 }}>保存策略</div>
                                                <div style={{ color: '#475569', lineHeight: 1.7 }}>
                                                    顶部单按钮统一提交，避免基础资料与服务设置各自保存造成状态不同步。
                                                </div>
                                            </div>
                                        </div>
                                    </Card>
                                </Col>

                                <Col xs={24}>
                                    <Card
                                        title={(
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                                <TeamOutlined style={{ color: '#2563eb' }} />
                                                <span>{teamSectionTitle}</span>
                                            </span>
                                        )}
                                        bordered={false}
                                        style={sectionCardStyle}
                                        bodyStyle={sectionBodyStyle}
                                    >
                                        <Row gutter={16}>
                                            <Col xs={24} lg={10}>
                                                <div style={{ display: 'grid', gap: 16 }}>
                                                    <div style={softPanelStyle}>
                                                        <Form.Item name="yearsExperience" label={yearsLabel} style={{ marginBottom: 16 }}>
                                                            <Select placeholder={yearsPlaceholder}>
                                                                {[1, 2, 3, 5, 8, 10, 15, 20].map((year) => (
                                                                    <Select.Option key={year} value={year}>
                                                                        {year}年以上
                                                                    </Select.Option>
                                                                ))}
                                                            </Select>
                                                        </Form.Item>
                                                        <Form.Item name="teamSize" label={isForeman ? '班组规模' : '团队规模'} style={{ marginBottom: 0 }}>
                                                            <InputNumber min={1} max={500} style={{ width: '100%' }} placeholder="团队人数" />
                                                        </Form.Item>
                                                    </div>
                                                    <div style={softPanelStyle}>
                                                        <Form.Item
                                                            name="officeAddress"
                                                            label={isForeman ? '常驻地址 / 办公地址' : '办公地址'}
                                                            rules={[{ required: true, message: isForeman ? '请输入常驻地址' : '请输入办公地址' }]}
                                                            style={{ marginBottom: 0 }}
                                                        >
                                                            <Input.TextArea
                                                                rows={4}
                                                                placeholder={isForeman ? '请输入常驻地址或办公地址' : '请输入办公地址'}
                                                                maxLength={200}
                                                            />
                                                        </Form.Item>
                                                    </div>
                                                </div>
                                            </Col>
                                            <Col xs={24} lg={14}>
                                                {isCompanyRole ? (
                                                    <div style={softPanelStyle}>
                                                        <Form.Item
                                                            name="companyAlbum"
                                                            label="企业形象相册"
                                                            rules={[
                                                                {
                                                                    validator: (_, value) => {
                                                                        const images = Array.isArray(value) ? value : [];
                                                                        if (images.length < 3 || images.length > 8) {
                                                                            return Promise.reject(new Error('公司相册需上传 3-8 张图片'));
                                                                        }
                                                                        return Promise.resolve();
                                                                    },
                                                                },
                                                            ]}
                                                            extra="建议上传办公环境、团队空间等真实照片。"
                                                            style={{ marginBottom: 0 }}
                                                        >
                                                            <Upload
                                                                listType="picture-card"
                                                                multiple
                                                                fileList={toAlbumFileList(infoForm.getFieldValue('companyAlbum') || [])}
                                                                beforeUpload={(file) => validateImageUploadBeforeSend(file as File, IMAGE_UPLOAD_SPECS.showcase)}
                                                                customRequest={handleCompanyAlbumUpload}
                                                                onChange={({ fileList }) => {
                                                                    const next = normalizeStoredAssetValues(
                                                                        fileList.map((file) => getStoredPathFromUploadFile(file as UploadFile<MerchantUploadResult>)),
                                                                    );
                                                                    infoForm.setFieldValue('companyAlbum', next);
                                                                }}
                                                                onRemove={(file) => {
                                                                    const current = (infoForm.getFieldValue('companyAlbum') || []) as string[];
                                                                    const target = getStoredPathFromUploadFile(file as UploadFile<MerchantUploadResult>);
                                                                    infoForm.setFieldValue('companyAlbum', current.filter((item) => item !== target));
                                                                    return true;
                                                                }}
                                                            >
                                                                {((infoForm.getFieldValue('companyAlbum') || []) as string[]).length < 8 ? <div>上传图片</div> : null}
                                                            </Upload>
                                                        </Form.Item>
                                                    </div>
                                                ) : (
                                                    <div style={softPanelStyle}>
                                                        <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 6 }}>展示说明</div>
                                                        <div style={{ color: '#475569', lineHeight: 1.8 }}>
                                                            这里保留团队规模与地址等基础信息，品牌介绍、理念与对外说明放在下方统一维护。
                                                        </div>
                                                    </div>
                                                )}
                                            </Col>
                                        </Row>
                                    </Card>
                                </Col>

                                <Col xs={24}>
                                    <Card
                                        title={(
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                                <WalletOutlined style={{ color: '#2563eb' }} />
                                                <span>服务报价与资费标准</span>
                                            </span>
                                        )}
                                        bordered={false}
                                        style={sectionCardStyle}
                                        bodyStyle={sectionBodyStyle}
                                    >
                                        <Row gutter={[16, 16]}>
                                            {isDesignerRole && (
                                                <>
                                                    <Col xs={24} md={12} xl={6}>
                                                        <div style={softPanelStyle}>
                                                            <Form.Item name="priceFlat" label="大平层 / 普通住宅参考报价（元/㎡）" style={{ marginBottom: 0 }}>
                                                                <InputNumber min={0} precision={0} style={{ width: '100%' }} placeholder="如：120" />
                                                            </Form.Item>
                                                        </div>
                                                    </Col>
                                                    <Col xs={24} md={12} xl={6}>
                                                        <div style={softPanelStyle}>
                                                            <Form.Item name="priceDuplex" label="复式 / 别墅参考报价（元/㎡）" style={{ marginBottom: 0 }}>
                                                                <InputNumber min={0} precision={0} style={{ width: '100%' }} placeholder="如：160" />
                                                            </Form.Item>
                                                        </div>
                                                    </Col>
                                                    <Col xs={24} md={12} xl={6}>
                                                        <div style={softPanelStyle}>
                                                            <Form.Item name="priceOther" label="其他户型参考报价（元/㎡）" style={{ marginBottom: 0 }}>
                                                                <InputNumber min={0} precision={0} style={{ width: '100%' }} placeholder="如：100" />
                                                            </Form.Item>
                                                        </div>
                                                    </Col>
                                                    <Col xs={24} md={12} xl={6}>
                                                        <div style={softPanelStyle}>
                                                            <Form.Item name="surveyDepositPrice" label="量房费（元）" style={{ marginBottom: 0 }}>
                                                                <InputNumber min={0} precision={2} style={{ width: '100%' }} placeholder="如：500" />
                                                            </Form.Item>
                                                        </div>
                                                    </Col>
                                                </>
                                            )}

                                            {isForeman && (
                                                <Col xs={24} md={12}>
                                                    <div style={softPanelStyle}>
                                                        <Form.Item name="pricePerSqm" label="施工参考报价（元/㎡）" style={{ marginBottom: 0 }}>
                                                            <InputNumber min={0} precision={0} style={{ width: '100%' }} placeholder="如：900" />
                                                        </Form.Item>
                                                    </div>
                                                </Col>
                                            )}

                                            {isCompanyRole && (
                                                <>
                                                    <Col xs={24} md={8}>
                                                        <div style={softPanelStyle}>
                                                            <Form.Item name="priceFullPackage" label="整装参考报价（元/㎡）" style={{ marginBottom: 0 }}>
                                                                <InputNumber min={0} precision={0} style={{ width: '100%' }} placeholder="如：1299" />
                                                            </Form.Item>
                                                        </div>
                                                    </Col>
                                                    <Col xs={24} md={8}>
                                                        <div style={softPanelStyle}>
                                                            <Form.Item name="priceHalfPackage" label="半包参考报价（元/㎡）" style={{ marginBottom: 0 }}>
                                                                <InputNumber min={0} precision={0} style={{ width: '100%' }} placeholder="如：899" />
                                                            </Form.Item>
                                                        </div>
                                                    </Col>
                                                    <Col xs={24} md={8}>
                                                        <div style={softPanelStyle}>
                                                            <Form.Item name="surveyDepositPrice" label="量房费（元）" style={{ marginBottom: 0 }}>
                                                                <InputNumber min={0} precision={2} style={{ width: '100%' }} placeholder="未填写则使用平台默认价" />
                                                            </Form.Item>
                                                        </div>
                                                    </Col>
                                                </>
                                            )}
                                        </Row>
                                    </Card>
                                </Col>

                                <Col xs={24}>
                                    <Card
                                        title={(
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                                <BookOutlined style={{ color: '#2563eb' }} />
                                                <span>{philosophySectionTitle}</span>
                                            </span>
                                        )}
                                        bordered={false}
                                        style={sectionCardStyle}
                                        bodyStyle={sectionBodyStyle}
                                    >
                                        <Row gutter={16}>
                                            {!isForeman && (
                                                <Col xs={24} lg={10}>
                                                    <div style={softPanelStyle}>
                                                        <Form.Item name="graduateSchool" label="毕业院校 / 教育背景" style={{ marginBottom: 0 }}>
                                                            <Input placeholder="请输入毕业院校（选填）" maxLength={100} />
                                                        </Form.Item>
                                                    </div>
                                                </Col>
                                            )}
                                            <Col xs={24} lg={isForeman ? 24 : 14}>
                                                <div style={softPanelStyle}>
                                                    <Form.Item name="designPhilosophy" label={philosophyLabel} style={{ marginBottom: 0 }}>
                                                        <Input.TextArea
                                                            rows={6}
                                                            placeholder={philosophyPlaceholder}
                                                            maxLength={5000}
                                                            showCount
                                                        />
                                                    </Form.Item>
                                                </div>
                                            </Col>
                                            <Col xs={24}>
                                                <div style={softPanelStyle}>
                                                    <Form.Item name="introduction" label={introLabel} style={{ marginBottom: 0 }}>
                                                        <Input.TextArea
                                                            rows={5}
                                                            placeholder={introPlaceholder}
                                                            maxLength={5000}
                                                            showCount
                                                        />
                                                    </Form.Item>
                                                </div>
                                            </Col>
                                        </Row>
                                    </Card>
                                </Col>
                            </Row>
                        </div>
                    </Form>

                    {!isDesignerRole && (
                        <div
                            ref={(node) => {
                                sectionRefs.current.settings = node;
                            }}
                        >
                            <Form form={settingForm} layout="vertical">
                                <Card
                                    title={(
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                            <SaveOutlined style={{ color: '#2563eb' }} />
                                            <span>{serviceSettingTitle}</span>
                                        </span>
                                    )}
                                    bordered={false}
                                    style={sectionCardStyle}
                                    bodyStyle={sectionBodyStyle}
                                    extra={<span style={{ color: '#94a3b8', fontSize: 12 }}>{sectionLabels.settings.description}</span>}
                                >
                                    <Row gutter={[16, 16]}>
                                        <Col xs={24} lg={8}>
                                            <div style={softPanelStyle}>
                                                <Form.Item name="acceptBooking" label="预约接收" valuePropName="checked" style={{ marginBottom: 0 }}>
                                                    <Switch checkedChildren="开启" unCheckedChildren="暂停" />
                                                </Form.Item>
                                            </div>
                                        </Col>
                                        <Col xs={24} lg={8}>
                                            <div style={softPanelStyle}>
                                                <Form.Item
                                                    name="autoConfirmHours"
                                                    label="自动确认时间（小时）"
                                                    rules={[{ required: true, message: '请填写自动确认时间' }]}
                                                    style={{ marginBottom: 0 }}
                                                >
                                                    <InputNumber min={1} max={168} style={{ width: '100%' }} />
                                                </Form.Item>
                                            </div>
                                        </Col>
                                        <Col xs={24} lg={8}>
                                            <div style={softPanelStyle}>
                                                <Form.Item
                                                    name="responseTimeDesc"
                                                    label="响应时间描述"
                                                    rules={[{ max: 50, message: '最多50个字符' }]}
                                                    style={{ marginBottom: 0 }}
                                                >
                                                    <Input placeholder="例如：2小时内回复" maxLength={50} />
                                                </Form.Item>
                                            </div>
                                        </Col>

                                        <Col xs={24} lg={12}>
                                            <div style={softPanelStyle}>
                                                <Form.Item name="priceRangeMin" label="价格区间下限（元）" style={{ marginBottom: 0 }}>
                                                    <InputNumber min={0} style={{ width: '100%' }} />
                                                </Form.Item>
                                            </div>
                                        </Col>
                                        <Col xs={24} lg={12}>
                                            <div style={softPanelStyle}>
                                                <Form.Item name="priceRangeMax" label="价格区间上限（元）" style={{ marginBottom: 0 }}>
                                                    <InputNumber min={0} style={{ width: '100%' }} />
                                                </Form.Item>
                                            </div>
                                        </Col>

                                        <Col xs={24}>
                                            <div style={softPanelStyle}>
                                                <Form.Item name="serviceStyles" label={isForeman ? '可承接项目风格' : '主营服务风格'} style={{ marginBottom: 0 }}>
                                                    <Select mode="multiple" placeholder={isForeman ? '选择可承接项目风格' : '选择企业主营服务风格'}>
                                                        {styleOptions.map((style) => (
                                                            <Select.Option key={style} value={style}>
                                                                {style}
                                                            </Select.Option>
                                                        ))}
                                                    </Select>
                                                </Form.Item>
                                            </div>
                                        </Col>

                                        <Col xs={24}>
                                            <div style={softPanelStyle}>
                                                <Form.Item
                                                    name="servicePackagesRaw"
                                                    label="服务套餐配置"
                                                    extra="先保留现有结构化保存能力，避免影响已存在数据；后续再收敛成表单化编辑。"
                                                    style={{ marginBottom: 0 }}
                                                >
                                                    <Input.TextArea rows={5} placeholder="[]" />
                                                </Form.Item>
                                            </div>
                                        </Col>
                                    </Row>
                                </Card>
                            </Form>
                        </div>
                    )}
                </Col>
            </Row>
        </div>
    );
};

export default MerchantSettings;
