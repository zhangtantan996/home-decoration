import React, { useEffect, useMemo, useState } from 'react';
import {
    Avatar,
    Button,
    Card,
    Col,
    ConfigProvider,
    Form,
    Input,
    InputNumber,
    Modal,
    Row,
    Select,
    Switch,
    Tag,
    Upload,
    message,
} from 'antd';
import {
    ArrowLeftOutlined,
    CameraOutlined,
    LoadingOutlined,
    SaveOutlined,
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
import styles from './MerchantSettings.module.css';

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

const MerchantSettings: React.FC = () => {
    const navigate = useNavigate();
    const [, setLoading] = useState(false);
    const [savingInfo, setSavingInfo] = useState(false);
    const [savingSettings, setSavingSettings] = useState(false);
    const [avatarUploading, setAvatarUploading] = useState(false);
    const [displayUpdating, setDisplayUpdating] = useState(false);
    const [providerInfo, setProviderInfo] = useState<MerchantProviderInfo | null>(null);
    const [serviceSettingsData, setServiceSettingsData] = useState<MerchantServiceSetting>(DEFAULT_SERVICE_SETTINGS);
    const [activeEditor, setActiveEditor] = useState<'info' | 'pricing' | 'settings' | null>(null);
    const [styleOptions, setStyleOptions] = useState<string[]>([]);
    const [areaOptions, setAreaOptions] = useState<ServiceCityGroupOption[]>([]);
    const updateSessionProvider = useMerchantAuthStore((state) => state.updateProvider);
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
        () => resolveDisplayStatusMeta(providerInfo, {
            activeLabel: '接单中',
            settingsPath: '/settings',
            workflowPath: '/bookings',
            reviewPath: '/apply-status',
        }),
        [providerInfo],
    );
    const isDesignerRole = !isForeman && !isCompanyRole;
    const serviceAreaLabelMap = useMemo(() => {
        const entries = areaOptions.flatMap((group) => group.options || []);
        return new Map(entries.map((item) => [String(item.value), item.label]));
    }, [areaOptions]);

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
    const serviceSettingTitle = isForeman ? '施工接单设置' : isCompanyRole ? '企业接单设置' : '设计服务设置';
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
            const nextSettings = {
                ...DEFAULT_SERVICE_SETTINGS,
                ...settings,
            };
            setServiceSettingsData(nextSettings);
            settingForm.setFieldsValue({
                ...nextSettings,
                servicePackagesRaw: JSON.stringify(nextSettings.servicePackages || [], null, 2),
            });
        } catch (error) {
            console.error('加载服务设置失败:', error);
            setServiceSettingsData(DEFAULT_SERVICE_SETTINGS);
            settingForm.setFieldsValue({
                ...DEFAULT_SERVICE_SETTINGS,
                servicePackagesRaw: '[]',
            });
        }
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
            setServiceSettingsData(payload);
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

    const saveInfoEditor = async () => {
        try {
            const values = await infoForm.validateFields();
            await persistInfo(values as MerchantInfoFormValues, { silent: false, rethrow: true });
            setActiveEditor(null);
        } catch (error) {
            if ((error as { errorFields?: unknown[] } | undefined)?.errorFields) {
                return;
            }
            message.error(getErrorMessage(error, '资料保存失败'));
        }
    };

    const savePricingEditor = async () => {
        try {
            const fields = isDesignerRole
                ? ['priceFlat', 'priceDuplex', 'priceOther', 'surveyDepositPrice']
                : isForeman
                    ? ['pricePerSqm', 'surveyDepositPrice']
                    : ['priceFullPackage', 'priceHalfPackage', 'surveyDepositPrice'];
            await infoForm.validateFields(fields);
            await persistInfo(infoForm.getFieldsValue() as MerchantInfoFormValues, { silent: false, rethrow: true });
            setActiveEditor(null);
        } catch (error) {
            if ((error as { errorFields?: unknown[] } | undefined)?.errorFields) {
                return;
            }
            message.error(getErrorMessage(error, '报价保存失败'));
        }
    };

    const saveSettingsEditor = async () => {
        try {
            const values = await settingForm.validateFields();
            await persistServiceSettings(values as MerchantServiceSettingsFormValues, {
                silent: false,
                rethrow: true,
                latestInfoValues: infoForm.getFieldsValue() as MerchantInfoFormValues,
            });
            setActiveEditor(null);
        } catch (error) {
            if ((error as { errorFields?: unknown[] } | undefined)?.errorFields) {
                return;
            }
            message.error(getErrorMessage(error, '接单设置保存失败'));
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
                return '工长';
            default:
                return '设计师';
        }
    };

    const displayText = (value: unknown) => {
        const text = String(value ?? '').trim();
        return text || '未填写';
    };

    const hasDisplayText = (value: unknown) => String(value ?? '').trim() !== '';
    const hasPositiveNumber = (value: unknown) => {
        const numeric = Number(value);
        return Number.isFinite(numeric) && numeric > 0;
    };
    const hasDisplayList = (values?: string[]) => (values || []).map((item) => String(item || '').trim()).filter(Boolean).length > 0;

    const displayList = (values?: string[]) => {
        const list = (values || []).map((item) => String(item || '').trim()).filter(Boolean);
        return list.length > 0 ? list.join('、') : '未填写';
    };

    const displayServiceAreas = (values?: string[]) => {
        const resolved = (values || [])
            .map((item) => {
                const normalized = String(item || '').trim();
                if (!normalized) {
                    return '';
                }
                return serviceAreaLabelMap.get(normalized) || normalized;
            })
            .filter(Boolean);
        return resolved.length > 0 ? Array.from(new Set(resolved)).join('、') : '未填写';
    };

    const pricingDisplayItems = (isDesignerRole
        ? [
            { label: '普通住宅', value: providerInfo?.pricing?.flat ? `${providerInfo.pricing.flat} 元/㎡` : '', note: '基础住宅设计报价' },
            { label: '复式 / 别墅', value: providerInfo?.pricing?.duplex ? `${providerInfo.pricing.duplex} 元/㎡` : '', note: '高复杂度空间' },
            { label: '其他户型', value: providerInfo?.pricing?.other ? `${providerInfo.pricing.other} 元/㎡` : '', note: '特殊户型报价' },
            { label: '量房费', value: providerInfo?.surveyDepositPrice ? `${providerInfo.surveyDepositPrice} 元` : '', note: '预约确认前展示' },
        ]
        : isForeman
            ? [
                { label: '施工参考价', value: providerInfo?.pricing?.perSqm ? `${providerInfo.pricing.perSqm} 元/㎡` : '', note: '施工报价基准' },
                { label: '量房费', value: providerInfo?.surveyDepositPrice ? `${providerInfo.surveyDepositPrice} 元` : '', note: '前期上门沟通' },
            ]
            : [
                { label: '整装', value: providerInfo?.pricing?.fullPackage ? `${providerInfo.pricing.fullPackage} 元/㎡` : '', note: '整装报价基准' },
                { label: '半包', value: providerInfo?.pricing?.halfPackage ? `${providerInfo.pricing.halfPackage} 元/㎡` : '', note: '半包报价基准' },
                { label: '量房费', value: providerInfo?.surveyDepositPrice ? `${providerInfo.surveyDepositPrice} 元` : '', note: '前期上门沟通' },
            ])
        .filter((item) => hasDisplayText(item.value));

    const providerTypeLabel = getProviderTypeLabel();
    const statusNote = (() => {
        if (providerInfo?.platformDisplayEnabled === false) {
            return '平台已下线';
        }
        if (providerInfo?.merchantDisplayEnabled === false) {
            return '当前已下线';
        }
        switch (displayStatusMeta.status) {
            case 'pending_review':
                return '审核完成后可上线';
            case 'profile_incomplete':
                return '先补齐资料';
            case 'observing':
                return '等待首单转化';
            case 'restricted':
                return '当前存在限制';
            case 'active':
                return '当前可正常接单';
            case 'offline':
            default:
                return displayStatusMeta.label;
        }
    })();
    const showExplicitStatus = displayStatusMeta.status !== 'active';
    const showStatusHint = showExplicitStatus && statusNote !== displayStatusMeta.label;

    const summaryStats = [
        { label: '资料完整度', value: `${profileCompletion}%` },
        { label: '服务城市', value: `${providerInfo?.serviceArea?.length || 0} 个` },
        { label: '已完成订单', value: `${providerInfo?.completedCnt || 0} 单` },
        {
            label: isCompanyRole ? '团队规模' : yearsLabel,
            value: isCompanyRole ? `${providerInfo?.teamSize || 0} 人` : `${providerInfo?.yearsExperience || 0} 年`,
        },
    ];

    const baseInfoItems = [
        { label: nameLabel, value: displayText(providerInfo?.name), show: hasDisplayText(providerInfo?.name), singleLine: false },
        { label: companyNameLabel, value: displayText(providerInfo?.companyName), show: isCompanyOrStudio && hasDisplayText(providerInfo?.companyName), singleLine: false },
        { label: yearsLabel, value: `${providerInfo?.yearsExperience} 年`, show: hasPositiveNumber(providerInfo?.yearsExperience), singleLine: false },
        { label: serviceAreaLabel, value: displayServiceAreas(providerInfo?.serviceArea || []), show: hasDisplayList(providerInfo?.serviceArea || []), singleLine: false },
        { label: isForeman ? '常驻地址 / 办公地址' : '办公地址', value: displayText(providerInfo?.officeAddress), show: hasDisplayText(providerInfo?.officeAddress), singleLine: true },
        { label: '团队规模', value: `${providerInfo?.teamSize} 人`, show: isCompanyRole && hasPositiveNumber(providerInfo?.teamSize), singleLine: false },
    ].filter((item) => item.show);

    const serviceFeatureItems = [
        {
            label: isForeman ? '业务擅长领域' : '设计风格 / 项目偏好',
            value: isForeman ? displayList(providerInfo?.highlightTags || []) : displayList(providerInfo?.specialty || []),
            show: isForeman ? hasDisplayList(providerInfo?.highlightTags || []) : hasDisplayList(providerInfo?.specialty || []),
        },
        { label: '毕业院校 / 教育背景', value: displayText(providerInfo?.graduateSchool), show: !isForeman && hasDisplayText(providerInfo?.graduateSchool) },
        { label: philosophyLabel, value: displayText(providerInfo?.designPhilosophy), show: hasDisplayText(providerInfo?.designPhilosophy) },
    ].filter((item) => item.show);

    const introductionValue = hasDisplayText(providerInfo?.introduction) ? displayText(providerInfo?.introduction) : '';
    const companyAlbum = providerInfo?.companyAlbum || [];
    const serviceSettingItems = !isDesignerRole
        ? [
            { label: '预约接收', value: serviceSettingsData.acceptBooking ? '开启' : '暂停', show: true },
            { label: '自动确认时间', value: `${serviceSettingsData.autoConfirmHours || 24} 小时`, show: true },
            { label: '响应时间描述', value: displayText(serviceSettingsData.responseTimeDesc), show: hasDisplayText(serviceSettingsData.responseTimeDesc) },
            {
                label: '价格区间',
                value: `${serviceSettingsData.priceRangeMin || 0} - ${serviceSettingsData.priceRangeMax || 0} 元`,
                show: Boolean(serviceSettingsData.priceRangeMin || serviceSettingsData.priceRangeMax),
            },
            {
                label: isForeman ? '可承接项目风格' : '主营服务风格',
                value: displayList(serviceSettingsData.serviceStyles),
                show: hasDisplayList(serviceSettingsData.serviceStyles),
            },
        ].filter((item) => item.show)
        : [];

    return (
        <ConfigProvider
            theme={{
                components: {
                    Input: { borderRadiusLG: 14, controlHeightLG: 48 },
                    Select: { borderRadiusLG: 14, controlHeightLG: 48 },
                    InputNumber: { borderRadiusLG: 14, controlHeightLG: 48 },
                },
            }}
        >
        <div className={`${styles.shell} ${styles.page}`}>
            <div className={styles.pageHeader}>
                <Button
                    type="link"
                    icon={<ArrowLeftOutlined />}
                    onClick={() => navigate('/dashboard')}
                    className={styles.backButton}
                >
                    返回工作台
                </Button>
                <h2 className={styles.pageTitle}>资料设置</h2>
            </div>

            <Card bordered={false} className={styles.overviewCard}>
                <div className={styles.overviewBody}>
                    <div className={styles.identityBlock}>
                        <Avatar
                            size={80}
                            src={providerInfo?.avatar}
                            icon={avatarUploading ? <LoadingOutlined /> : <UserOutlined />}
                            className={styles.avatar}
                        />

                        <div className={styles.identityMeta}>
                            <h3 className={styles.identityName}>{providerInfo?.name || '商家'}</h3>
                            <div className={styles.tagRow}>
                                <Tag color="blue" style={{ margin: 0 }}>{providerTypeLabel}</Tag>
                                {providerInfo?.verified ? <Tag color="success" style={{ margin: 0 }}>已认证</Tag> : null}
                            </div>
                            <div className={styles.summaryRow}>
                                {summaryStats.map((item) => (
                                    <div key={item.label} className={styles.summaryChip}>
                                        <div className={styles.summaryChipLabel}>{item.label}</div>
                                        <div className={styles.summaryChipValue}>{item.value}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className={styles.statusBlock}>
                        <div className={styles.statusLabel}>接单状态</div>
                        <div className={styles.statusRow}>
                            {showExplicitStatus ? (
                                <Tag color={displayStatusMeta.color} style={{ margin: 0 }}>
                                    {displayStatusMeta.label}
                                </Tag>
                            ) : null}
                            <Switch
                                checked={providerInfo?.merchantDisplayEnabled ?? true}
                                loading={displayUpdating}
                                disabled={displayStatusMeta.switchDisabled}
                                onChange={handleDisplayToggle}
                            />
                        </div>
                        {showStatusHint ? <div className={styles.statusHint}>{statusNote}</div> : null}
                    </div>
                </div>
            </Card>

            <div className={styles.contentGrid}>
                <div className={styles.mainColumn}>
                    <Card
                        title={(
                            <span className={styles.sectionTitle}>
                                <UserOutlined className={styles.sectionTitleIcon} />
                                <span>资料信息</span>
                            </span>
                        )}
                        extra={<Button className={styles.sectionButton} onClick={() => setActiveEditor('info')}>编辑资料</Button>}
                        bordered={false}
                        className={styles.sectionCard}
                    >
                        <div className={styles.infoBody}>
                            {baseInfoItems.length > 0 ? (
                                <div className={styles.infoGrid}>
                                    {baseInfoItems.map((item) => (
                                        <div key={item.label} className={styles.infoItem}>
                                            <div className={styles.infoLabel}>{item.label}</div>
                                            <div
                                                className={`${styles.infoValue} ${item.singleLine ? styles.singleLineValue : ''}`}
                                                title={item.singleLine ? item.value : undefined}
                                            >
                                                {item.value}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : null}

                            {serviceFeatureItems.length > 0 ? (
                                <>
                                    <div className={styles.infoDivider} />
                                    <div className={styles.infoGrid}>
                                        {serviceFeatureItems.map((item) => (
                                            <div key={item.label} className={styles.infoItem}>
                                                <div className={styles.infoLabel}>{item.label}</div>
                                                <div className={styles.infoValue}>{item.value}</div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : null}

                            {introductionValue ? (
                                <>
                                    <div className={styles.infoDivider} />
                                    <div className={styles.infoItem}>
                                        <div className={styles.infoLabel}>{introLabel}</div>
                                        <div className={styles.infoValue}>{introductionValue}</div>
                                    </div>
                                </>
                            ) : null}

                            {isCompanyRole && companyAlbum.length > 0 ? (
                                <>
                                    <div className={styles.infoDivider} />
                                    <div className={styles.albumBlock}>
                                        <div className={styles.infoLabel}>企业相册</div>
                                        <div className={styles.albumGrid}>
                                            {companyAlbum.map((image, index) => (
                                                <div key={`${image}-${index}`} className={styles.albumItem}>
                                                    <img src={image} alt={`企业相册 ${index + 1}`} />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            ) : null}
                        </div>
                    </Card>
                </div>

                <div className={styles.sideColumn}>
                    <Card
                        title={(
                            <span className={styles.sectionTitle}>
                                <WalletOutlined className={styles.sectionTitleIcon} />
                                <span>服务报价</span>
                            </span>
                        )}
                        extra={<Button className={styles.sectionButton} onClick={() => setActiveEditor('pricing')}>编辑报价</Button>}
                        bordered={false}
                        className={styles.sectionCard}
                    >
                        {pricingDisplayItems.length > 0 ? (
                            <div className={styles.priceList}>
                                {pricingDisplayItems.map((item) => (
                                    <div key={item.label} className={styles.priceItem}>
                                        <div className={styles.priceLabel}>{item.label}</div>
                                        <div className={styles.priceValue}>{item.value}</div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className={styles.emptyState}>
                                <div className={styles.emptyTitle}>暂未填写报价</div>
                                <div className={styles.emptyText}>点击编辑报价补充。</div>
                            </div>
                        )}
                    </Card>

                    {!isDesignerRole ? (
                        <Card
                            title={(
                                <span className={styles.sectionTitle}>
                                    <SaveOutlined className={styles.sectionTitleIcon} />
                                    <span>{serviceSettingTitle}</span>
                                </span>
                            )}
                            extra={<Button className={styles.sectionButton} onClick={() => setActiveEditor('settings')}>编辑设置</Button>}
                            bordered={false}
                            className={styles.sectionCard}
                        >
                            <div className={styles.settingList}>
                                {serviceSettingItems.map((item) => (
                                    <div key={item.label} className={styles.settingItem}>
                                        <div className={styles.settingLabel}>{item.label}</div>
                                        <div className={styles.settingValue}>{item.value}</div>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    ) : null}
                </div>
            </div>

            <Modal
                open={activeEditor === 'info'}
                title="编辑资料信息"
                onCancel={() => setActiveEditor(null)}
                onOk={() => void saveInfoEditor()}
                confirmLoading={savingInfo}
                width={980}
                destroyOnClose={false}
            >
                <div className={styles.editorScroll}>
                    <Form form={infoForm} layout="vertical">
                        <div className={styles.editorStack}>
                            <div className={styles.editorGroup}>
                                <div className={styles.editorGroupTitle}>头像与基本信息</div>
                                <div className={styles.avatarEditorRow}>
                                    <Avatar
                                        size={72}
                                        src={providerInfo?.avatar}
                                        icon={avatarUploading ? <LoadingOutlined /> : <UserOutlined />}
                                        className={styles.avatar}
                                    />
                                    <div className={styles.avatarEditorMeta}>
                                        <ImgCrop rotationSlider cropShape="round" aspect={1} showReset showGrid>
                                            <Upload
                                                name="avatar"
                                                showUploadList={false}
                                                customRequest={handleAvatarUpload}
                                                beforeUpload={(file) => validateImageUploadBeforeSend(file as File, IMAGE_UPLOAD_SPECS.avatar)}
                                                accept=".jpg,.jpeg,.png"
                                            >
                                                <Button icon={<CameraOutlined />} loading={avatarUploading}>
                                                    更换头像
                                                </Button>
                                            </Upload>
                                        </ImgCrop>
                                        <div className={styles.avatarEditorHint}>支持 JPG、PNG，建议上传清晰正方形头像。</div>
                                    </div>
                                </div>
                                <Row gutter={[16, 0]}>
                                    <Col xs={24} md={8}>
                                        <Form.Item
                                            name="name"
                                            label={nameLabel}
                                            rules={[{ required: true, message: '请输入名称' }, { max: 50, message: '名称最多50个字符' }]}
                                        >
                                            <Input placeholder={namePlaceholder} maxLength={50} />
                                        </Form.Item>
                                    </Col>
                                    {isCompanyOrStudio ? (
                                        <Col xs={24} md={8}>
                                            <Form.Item name="companyName" label={companyNameLabel}>
                                                <Input placeholder="公司全称" maxLength={100} />
                                            </Form.Item>
                                        </Col>
                                    ) : null}
                                    <Col xs={24} md={8}>
                                        <Form.Item name="yearsExperience" label={yearsLabel}>
                                            <Select placeholder={yearsPlaceholder}>
                                                {[1, 2, 3, 5, 8, 10, 15, 20].map((year) => (
                                                    <Select.Option key={year} value={year}>
                                                        {year}年以上
                                                    </Select.Option>
                                                ))}
                                            </Select>
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24}>
                                        {!isForeman ? (
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
                                        ) : (
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
                            </div>

                            <div className={styles.editorGroup}>
                                <div className={styles.editorGroupTitle}>服务范围</div>
                                <Form.Item name="serviceArea" label={serviceAreaLabel} style={{ marginBottom: 0 }}>
                                    <Select
                                        mode="multiple"
                                        placeholder={`选择${serviceAreaLabel}`}
                                        options={areaOptions}
                                        optionFilterProp="label"
                                    />
                                </Form.Item>
                            </div>

                            <div className={styles.editorGroup}>
                                <div className={styles.editorGroupTitle}>专业信息</div>
                                <Row gutter={[16, 0]}>
                                    {!isForeman ? (
                                        <Col xs={24} md={8}>
                                            <Form.Item name="graduateSchool" label="毕业院校 / 教育背景">
                                                <Input placeholder="请输入毕业院校（选填）" maxLength={100} />
                                            </Form.Item>
                                        </Col>
                                    ) : null}
                                    <Col xs={24} md={isForeman ? 24 : 16}>
                                        <Form.Item name="designPhilosophy" label={philosophyLabel}>
                                            <Input.TextArea rows={4} placeholder={philosophyPlaceholder} maxLength={5000} showCount />
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24}>
                                        <Form.Item name="introduction" label={introLabel} style={{ marginBottom: 0 }}>
                                            <Input.TextArea rows={4} placeholder={introPlaceholder} maxLength={5000} showCount />
                                        </Form.Item>
                                    </Col>
                                </Row>
                            </div>

                            <div className={styles.editorGroup}>
                                <div className={styles.editorGroupTitle}>办公与企业补充</div>
                                <Row gutter={[16, 0]}>
                                    {isCompanyRole ? (
                                        <Col xs={24} md={8}>
                                            <Form.Item name="teamSize" label="团队规模">
                                                <InputNumber min={1} max={500} style={{ width: '100%' }} placeholder="团队人数" />
                                            </Form.Item>
                                        </Col>
                                    ) : null}
                                    <Col xs={24} md={isCompanyRole ? 16 : 24}>
                                        <Form.Item
                                            name="officeAddress"
                                            label={isForeman ? '常驻地址 / 办公地址' : '办公地址'}
                                            rules={[{ required: true, message: isForeman ? '请输入常驻地址' : '请输入办公地址' }]}
                                            style={{ marginBottom: 0 }}
                                        >
                                            <Input placeholder={isForeman ? '请输入常驻地址或办公地址' : '请输入办公地址'} maxLength={200} />
                                        </Form.Item>
                                    </Col>
                                </Row>
                            </div>

                            {isCompanyRole ? (
                                <div className={styles.editorGroup}>
                                    <div className={styles.editorGroupTitle}>企业展示相册</div>
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
                            ) : null}
                        </div>
                    </Form>
                </div>
            </Modal>

            <Modal
                open={activeEditor === 'pricing'}
                title="编辑服务报价"
                onCancel={() => setActiveEditor(null)}
                onOk={() => void savePricingEditor()}
                confirmLoading={savingInfo}
                width={900}
                destroyOnClose={false}
            >
                <div className={styles.editorScroll}>
                    <Form form={infoForm} layout="vertical">
                        <div className={styles.editorStack}>
                            <div className={styles.editorGroup}>
                                <div className={styles.editorGroupTitle}>服务报价</div>
                                <Row gutter={[16, 16]}>
                                    {isDesignerRole ? (
                                        <>
                                            <Col xs={24} md={12}>
                                                <Form.Item name="priceFlat" label="普通住宅">
                                                    <InputNumber min={0} precision={0} style={{ width: '100%' }} addonAfter="元/㎡" placeholder="120" />
                                                </Form.Item>
                                            </Col>
                                            <Col xs={24} md={12}>
                                                <Form.Item name="priceDuplex" label="复式 / 别墅">
                                                    <InputNumber min={0} precision={0} style={{ width: '100%' }} addonAfter="元/㎡" placeholder="160" />
                                                </Form.Item>
                                            </Col>
                                            <Col xs={24} md={12}>
                                                <Form.Item name="priceOther" label="其他户型">
                                                    <InputNumber min={0} precision={0} style={{ width: '100%' }} addonAfter="元/㎡" placeholder="100" />
                                                </Form.Item>
                                            </Col>
                                            <Col xs={24} md={12}>
                                                <Form.Item name="surveyDepositPrice" label="量房费">
                                                    <InputNumber min={0} precision={2} style={{ width: '100%' }} addonAfter="元" placeholder="500" />
                                                </Form.Item>
                                            </Col>
                                        </>
                                    ) : null}
                                    {isForeman ? (
                                        <>
                                            <Col xs={24} md={12}>
                                                <Form.Item name="pricePerSqm" label="施工参考价">
                                                    <InputNumber min={0} precision={0} style={{ width: '100%' }} addonAfter="元/㎡" placeholder="900" />
                                                </Form.Item>
                                            </Col>
                                            <Col xs={24} md={12}>
                                                <Form.Item name="surveyDepositPrice" label="量房费">
                                                    <InputNumber min={0} precision={2} style={{ width: '100%' }} addonAfter="元" placeholder="500" />
                                                </Form.Item>
                                            </Col>
                                        </>
                                    ) : null}
                                    {isCompanyRole ? (
                                        <>
                                            <Col xs={24} md={8}>
                                                <Form.Item name="priceFullPackage" label="整装">
                                                    <InputNumber min={0} precision={0} style={{ width: '100%' }} addonAfter="元/㎡" placeholder="1299" />
                                                </Form.Item>
                                            </Col>
                                            <Col xs={24} md={8}>
                                                <Form.Item name="priceHalfPackage" label="半包">
                                                    <InputNumber min={0} precision={0} style={{ width: '100%' }} addonAfter="元/㎡" placeholder="899" />
                                                </Form.Item>
                                            </Col>
                                            <Col xs={24} md={8}>
                                                <Form.Item name="surveyDepositPrice" label="量房费">
                                                    <InputNumber min={0} precision={2} style={{ width: '100%' }} addonAfter="元" placeholder="500" />
                                                </Form.Item>
                                            </Col>
                                        </>
                                    ) : null}
                                </Row>
                            </div>
                        </div>
                    </Form>
                </div>
            </Modal>

            {!isDesignerRole ? (
                <Modal
                    open={activeEditor === 'settings'}
                    title={serviceSettingTitle}
                    onCancel={() => setActiveEditor(null)}
                    onOk={() => void saveSettingsEditor()}
                    confirmLoading={savingSettings}
                    width={900}
                    destroyOnClose={false}
                >
                    <div className={styles.editorScroll}>
                        <Form form={settingForm} layout="vertical">
                            <div className={styles.editorStack}>
                                <div className={styles.editorGroup}>
                                    <div className={styles.editorGroupTitle}>接单设置</div>
                                    <Row gutter={[16, 16]}>
                                        <Col xs={24} md={8}>
                                            <Form.Item name="acceptBooking" label="预约接收" valuePropName="checked">
                                                <Switch checkedChildren="开启" unCheckedChildren="暂停" />
                                            </Form.Item>
                                        </Col>
                                        <Col xs={24} md={8}>
                                            <Form.Item
                                                name="autoConfirmHours"
                                                label="自动确认时间（小时）"
                                                rules={[{ required: true, message: '请填写自动确认时间' }]}
                                            >
                                                <InputNumber min={1} max={168} style={{ width: '100%' }} />
                                            </Form.Item>
                                        </Col>
                                        <Col xs={24} md={8}>
                                            <Form.Item
                                                name="responseTimeDesc"
                                                label="响应时间描述"
                                                rules={[{ max: 50, message: '最多50个字符' }]}
                                            >
                                                <Input placeholder="例如：2小时内回复" maxLength={50} />
                                            </Form.Item>
                                        </Col>
                                        <Col xs={24} md={12}>
                                            <Form.Item name="priceRangeMin" label="价格区间下限（元）">
                                                <InputNumber min={0} style={{ width: '100%' }} />
                                            </Form.Item>
                                        </Col>
                                        <Col xs={24} md={12}>
                                            <Form.Item name="priceRangeMax" label="价格区间上限（元）">
                                                <InputNumber min={0} style={{ width: '100%' }} />
                                            </Form.Item>
                                        </Col>
                                        <Col xs={24}>
                                            <Form.Item name="serviceStyles" label={isForeman ? '可承接项目风格' : '主营服务风格'}>
                                                <Select mode="multiple" placeholder={isForeman ? '选择可承接项目风格' : '选择企业主营服务风格'}>
                                                    {styleOptions.map((style) => (
                                                        <Select.Option key={style} value={style}>
                                                            {style}
                                                        </Select.Option>
                                                    ))}
                                                </Select>
                                            </Form.Item>
                                        </Col>
                                        <Col xs={24}>
                                            <Form.Item name="servicePackagesRaw" label="服务套餐配置" style={{ marginBottom: 0 }}>
                                                <Input.TextArea rows={5} placeholder="[]" />
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                </div>
                            </div>
                        </Form>
                    </div>
                </Modal>
            ) : null}
        </div>
        </ConfigProvider>
    );
};

export default MerchantSettings;
