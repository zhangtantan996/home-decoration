import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ArrowLeftOutlined,
    ArrowRightOutlined,
    CheckOutlined,
    EnvironmentOutlined,
    IdcardOutlined,
    PhoneOutlined,
    PictureOutlined,
    SafetyOutlined,
    ToolOutlined,
    UserOutlined,
} from '@ant-design/icons';
import {
    Alert,
    Button,
    Card,
    Col,
    Divider,
    Form,
    Input,
    InputNumber,
    Layout,
    Modal,
    Row,
    Select,
    Steps,
    Typography,
    Upload,
    message,
    Grid,
} from 'antd';
import type { UploadFile, UploadProps } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { dictionaryApi } from '../../services/dictionaryApi';
import {
    merchantApplyApi,
    merchantAuthApi,
    merchantUploadApi,
    type MerchantApplicantType,
    type MerchantApplyPayload,
} from '../../services/merchantApi';
import { regionApi } from '../../services/regionApi';

const { Content } = Layout;
const { Title, Text } = Typography;
const { TextArea } = Input;
const { useBreakpoint } = Grid;

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

const DEFAULT_CITY_CODE = '610100';
const DRAFT_STORAGE_KEY = 'merchant_register_draft';
const DRAFT_EXPIRY_MS = 2 * 60 * 60 * 1000;

interface PortfolioCase {
    id: string;
    title: string;
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
    const screens = useBreakpoint();

    const applyMeta = useMemo(() => resolveApplyMeta(searchParams), [searchParams]);
    const { role, entityType, applicantType } = applyMeta;

    const [currentStep, setCurrentStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [sendingCode, setSendingCode] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [showRedirectAlert, setShowRedirectAlert] = useState(fromLogin.startsWith('login_'));
    const [form] = Form.useForm();
    const [portfolioCases, setPortfolioCases] = useState<PortfolioCase[]>([
        { id: crypto.randomUUID(), title: '', images: [], style: '', area: '' },
        { id: crypto.randomUUID(), title: '', images: [], style: '', area: '' },
        { id: crypto.randomUUID(), title: '', images: [], style: '', area: '' },
    ]);
    const [styleOptions, setStyleOptions] = useState<string[]>([]);
    const [areaOptions, setAreaOptions] = useState<string[]>([]);
    const countdownTimerRef = useRef<number | null>(null);

    const isForeman = role === 'foreman';
    const isCompanyRole = role === 'company';
    const requiresCompanyLicense = entityType === 'company' || isCompanyRole;
    const caseMinCount = 3;
    const caseMaxImages = role === 'designer' ? 6 : 12;

    const pageTitle = useMemo(() => {
        if (role === 'company') return '装修公司入驻申请';
        if (role === 'foreman') return entityType === 'company' ? '工长入驻申请（公司主体）' : '工长入驻申请（个人主体）';
        return entityType === 'company' ? '设计师入驻申请（公司主体）' : '设计师入驻申请（个人主体）';
    }, [entityType, role]);

    const steps = [
        { title: '基础信息', icon: <UserOutlined /> },
        { title: '资质上传', icon: <IdcardOutlined /> },
        { title: isForeman ? '施工案例' : '案例作品', icon: isForeman ? <ToolOutlined /> : <PictureOutlined /> },
        { title: '服务与报价', icon: <CheckOutlined /> },
    ];

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
                    setPortfolioCases(draft.portfolioCases);
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
        const values = form.getFieldsValue();
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
        fieldName: 'idCardFront' | 'idCardBack' | 'licenseImage',
    ): UploadProps['customRequest'] => async (options) => {
        try {
            const uploaded = await merchantUploadApi.uploadImageData(options.file as File);
            form.setFieldsValue({ [fieldName]: uploaded.url });
            options.onSuccess?.(uploaded);
        } catch (error) {
            const errorMessage = getErrorMessage(error, '上传失败');
            message.error(errorMessage);
            options.onError?.(new Error(errorMessage));
        }
    };

    const createCaseUploadHandler = (caseIndex: number): UploadProps['customRequest'] => async (options) => {
        try {
            const uploaded = await merchantUploadApi.uploadImageData(options.file as File);
            options.onSuccess?.(uploaded);

            const currentImages = portfolioCases[caseIndex]?.images || [];
            if (!currentImages.includes(uploaded.url)) {
                updatePortfolioCase(caseIndex, 'images', [...currentImages, uploaded.url]);
            }
        } catch (error) {
            const errorMessage = getErrorMessage(error, '上传失败');
            message.error(errorMessage);
            options.onError?.(new Error(errorMessage));
        }
    };

    const validatePortfolioCases = () => {
        const validCases = portfolioCases.filter((caseItem) => caseItem.title.trim() && caseItem.images.length > 0);
        if (validCases.length < caseMinCount) {
            message.error(`请至少添加 ${caseMinCount} 套案例`);
            return false;
        }

        for (let index = 0; index < validCases.length; index += 1) {
            const caseItem = validCases[index];
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
        if (role === 'designer') {
            if (!values.priceFlat || !values.priceDuplex || !values.priceOther) {
                message.error('请填写平层 / 复式 / 其他三个报价');
                return false;
            }
        } else if (role === 'foreman') {
            if (!values.pricePerSqm) {
                message.error('请填写施工报价（元/㎡）');
                return false;
            }
        } else if (!values.priceFullPackage || !values.priceHalfPackage) {
            message.error('请填写全包 / 半包报价（元/㎡）');
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
                const fields = ['phone', 'code', 'realName'];
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
                await form.validateFields(fields);
            } else if (currentStep === 2 && !validatePortfolioCases()) {
                return;
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
        if (role === 'designer') {
            return {
                flat: Number(values.priceFlat),
                duplex: Number(values.priceDuplex),
                other: Number(values.priceOther),
            };
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
        const fields = ['serviceArea'];
        if (role === 'designer') {
            fields.push('styles');
        }
        if (role === 'foreman') {
            fields.push('highlightTags');
        }

        try {
            await form.validateFields(fields);
        } catch {
            return;
        }

        const values = form.getFieldsValue();

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
                        phone: values.phone,
                        code: values.code,
                        role,
                        entityType,
                        applicantType,
                        realName: values.realName,
                        idCardNo: values.idCardNo,
                        idCardFront: values.idCardFront,
                        idCardBack: values.idCardBack,
                        companyName: values.companyName,
                        licenseNo: values.licenseNo,
                        licenseImage: values.licenseImage,
                        teamSize: values.teamSize,
                        officeAddress: values.officeAddress,
                        yearsExperience: values.yearsExperience,
                        workTypes: isForeman ? values.workTypes || [] : [],
                        serviceArea: values.serviceArea || [],
                        styles: role === 'designer' ? values.styles || [] : [],
                        highlightTags: role === 'foreman' ? values.highlightTags || [] : [],
                        pricing: buildPricingPayload(values),
                        introduction: values.introduction,
                        graduateSchool: values.graduateSchool,
                        designPhilosophy: values.designPhilosophy,
                        portfolioCases: portfolioCases.filter((caseItem) => caseItem.title.trim() && caseItem.images.length > 0),
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
        setPortfolioCases((prev) => [...prev, { id: crypto.randomUUID(), title: '', images: [], style: '', area: '' }]);
    };

    const renderStepContent = () => {
        switch (currentStep) {
            case 0:
                return (
                    <div>
                        <Title level={5}>基础信息</Title>
                        <Form.Item
                            name="phone"
                            label="手机号"
                            rules={[
                                { required: true, message: '请输入手机号' },
                                { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号' },
                            ]}
                        >
                            <Input prefix={<PhoneOutlined />} placeholder="请输入11位手机号" maxLength={11} />
                        </Form.Item>
                        <Form.Item
                            name="code"
                            label="验证码"
                            rules={[
                                { required: true, message: '请输入验证码' },
                                { pattern: /^\d{6}$/, message: '请输入6位验证码' },
                            ]}
                        >
                            <Input
                                prefix={<SafetyOutlined />}
                                placeholder="请输入6位验证码"
                                maxLength={6}
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
                        <Form.Item
                            name="realName"
                            label={isForeman ? '工长姓名' : '负责人姓名'}
                            rules={[
                                { required: true, message: '请输入姓名' },
                                { max: 20, message: '姓名最多20个字符' },
                            ]}
                        >
                            <Input prefix={<UserOutlined />} placeholder="请输入姓名" maxLength={20} />
                        </Form.Item>

                        {(entityType === 'company' || role === 'company') && (
                            <>
                                <Form.Item
                                    name="companyName"
                                    label={role === 'designer' ? '工作室/公司名称' : '公司名称'}
                                    rules={[
                                        { required: true, message: '请输入公司名称' },
                                        { max: 100, message: '名称最多100个字符' },
                                    ]}
                                >
                                    <Input placeholder="请输入公司名称" maxLength={100} />
                                </Form.Item>

                                <Form.Item name="teamSize" label="团队规模">
                                    <Select placeholder="选择团队规模">
                                        <Select.Option value={1}>1人</Select.Option>
                                        <Select.Option value={5}>2-5人</Select.Option>
                                        <Select.Option value={10}>6-10人</Select.Option>
                                        <Select.Option value={20}>11-20人</Select.Option>
                                        <Select.Option value={50}>20人以上</Select.Option>
                                    </Select>
                                </Form.Item>

                                <Form.Item name="officeAddress" label="办公地址">
                                    <Input prefix={<EnvironmentOutlined />} placeholder="请输入办公地址" maxLength={200} />
                                </Form.Item>
                            </>
                        )}
                    </div>
                );

            case 1:
                return (
                    <div>
                        <Title level={5}>资质上传</Title>
                        <Form.Item
                            name="idCardNo"
                            label="身份证号"
                            rules={[
                                { required: true, message: '请输入身份证号' },
                                { pattern: /^\d{17}[\dXx]$/, message: '请输入正确的18位身份证号' },
                            ]}
                        >
                            <Input placeholder="请输入身份证号" maxLength={18} />
                        </Form.Item>

                        <Row gutter={16}>
                            <Col xs={24} sm={12}>
                                <Form.Item
                                    name="idCardFront"
                                    label="身份证正面"
                                    rules={[{ required: true, message: '请上传身份证正面' }]}
                                >
                                    <Upload
                                        listType="picture-card"
                                        maxCount={1}
                                        accept=".jpg,.jpeg,.png"
                                        beforeUpload={(file) => validateImageBeforeUpload(file as File, 2)}
                                        customRequest={createSingleUploadHandler('idCardFront')}
                                        onRemove={() => {
                                            form.setFieldsValue({ idCardFront: undefined });
                                            return true;
                                        }}
                                    >
                                        <div>
                                            <IdcardOutlined style={{ fontSize: 24 }} />
                                            <div style={{ marginTop: 8 }}>上传正面</div>
                                        </div>
                                    </Upload>
                                </Form.Item>
                            </Col>
                            <Col xs={24} sm={12}>
                                <Form.Item
                                    name="idCardBack"
                                    label="身份证反面"
                                    rules={[{ required: true, message: '请上传身份证反面' }]}
                                >
                                    <Upload
                                        listType="picture-card"
                                        maxCount={1}
                                        accept=".jpg,.jpeg,.png"
                                        beforeUpload={(file) => validateImageBeforeUpload(file as File, 2)}
                                        customRequest={createSingleUploadHandler('idCardBack')}
                                        onRemove={() => {
                                            form.setFieldsValue({ idCardBack: undefined });
                                            return true;
                                        }}
                                    >
                                        <div>
                                            <IdcardOutlined style={{ fontSize: 24 }} />
                                            <div style={{ marginTop: 8 }}>上传反面</div>
                                        </div>
                                    </Upload>
                                </Form.Item>
                            </Col>
                        </Row>

                        {requiresCompanyLicense && (
                            <>
                                <Divider>企业资质</Divider>
                                <Form.Item
                                    name="licenseNo"
                                    label="营业执照号"
                                    rules={[{ required: true, message: '请输入营业执照号' }]}
                                >
                                    <Input placeholder="请输入统一社会信用代码" maxLength={18} />
                                </Form.Item>
                                <Form.Item
                                    name="licenseImage"
                                    label="营业执照照片"
                                    rules={[{ required: true, message: '请上传营业执照' }]}
                                >
                                    <Upload
                                        listType="picture-card"
                                        maxCount={1}
                                        accept=".jpg,.jpeg,.png"
                                        beforeUpload={(file) => validateImageBeforeUpload(file as File, 5)}
                                        customRequest={createSingleUploadHandler('licenseImage')}
                                        onRemove={() => {
                                            form.setFieldsValue({ licenseImage: undefined });
                                            return true;
                                        }}
                                    >
                                        <div>
                                            <PictureOutlined style={{ fontSize: 24 }} />
                                            <div style={{ marginTop: 8 }}>上传执照</div>
                                        </div>
                                    </Upload>
                                </Form.Item>
                            </>
                        )}

                        {isForeman && (
                            <>
                                <Divider>施工信息</Divider>
                                <Form.Item
                                    name="yearsExperience"
                                    label="施工经验（年）"
                                    rules={[{ required: true, message: '请选择施工经验' }]}
                                >
                                    <Select placeholder="选择施工经验">
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
                                    <Select mode="multiple" placeholder="选择可承接工种" options={WORK_TYPE_OPTIONS} />
                                </Form.Item>
                            </>
                        )}
                    </div>
                );

            case 2:
                return (
                    <div>
                        <Title level={5}>
                            案例上传（至少 {caseMinCount} 套，{caseImageRuleText(role)}）
                        </Title>
                        {portfolioCases.map((caseItem) => (
                            <Card key={caseItem.id} size="small" title={`案例 ${portfolioCases.indexOf(caseItem) + 1}`} style={{ marginBottom: 16 }}>
                                <Form.Item label="案例标题" required>
                                    <Input
                                        placeholder="例如：现代简约三居室"
                                        value={caseItem.title}
                                        maxLength={50}
                                        onChange={(event) => updatePortfolioCase(portfolioCases.indexOf(caseItem), 'title', event.target.value)}
                                    />
                                </Form.Item>
                                <Row gutter={16}>
                                    <Col xs={24} sm={12}>
                                        <Form.Item label="风格">
                                            <Select
                                                placeholder="选择风格"
                                                value={caseItem.style || undefined}
                                                onChange={(value) => updatePortfolioCase(portfolioCases.indexOf(caseItem), 'style', value)}
                                            >
                                                {styleOptions.map((style) => (
                                                    <Select.Option key={style} value={style}>{style}</Select.Option>
                                                ))}
                                            </Select>
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} sm={12}>
                                        <Form.Item label="面积">
                                            <Select
                                                placeholder="选择区域"
                                                value={caseItem.area || undefined}
                                                onChange={(value) => updatePortfolioCase(portfolioCases.indexOf(caseItem), 'area', value)}
                                            >
                                                {areaOptions.map((area) => (
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
                                        accept=".jpg,.jpeg,.png"
                                        beforeUpload={(file) => validateImageBeforeUpload(file as File, 5)}
                                        customRequest={createCaseUploadHandler(portfolioCases.indexOf(caseItem))}
                                        onChange={(uploadInfo) => {
                                            const urls = uploadInfo.fileList
                                                .map((uploadFile: UploadFile) => {
                                                    const response = uploadFile.response as { url?: string } | undefined;
                                                    return response?.url || uploadFile.url || '';
                                                })
                                                .filter((url): url is string => Boolean(url));
                                            updatePortfolioCase(portfolioCases.indexOf(caseItem), 'images', urls);
                                        }}
                                    >
                                        <div>
                                            <PictureOutlined />
                                            <div style={{ marginTop: 8 }}>上传图片</div>
                                        </div>
                                    </Upload>
                                </Form.Item>
                            </Card>
                        ))}
                        <Button type="dashed" block onClick={addPortfolioCase}>
                            + 添加更多案例
                        </Button>
                    </div>
                );

            case 3:
                return (
                    <div>
                        <Title level={5}>服务与报价</Title>
                        <Form.Item
                            name="serviceArea"
                            label="服务区域"
                            rules={[{ required: true, message: '请选择服务区域' }]}
                        >
                            <Select mode="multiple" placeholder="选择可服务区域">
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
                                <Select mode="multiple" placeholder="选择擅长风格" maxTagCount={3}>
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
                                <Select mode="multiple" placeholder="选择施工亮点" maxTagCount={3}>
                                    {FOREMAN_HIGHLIGHT_OPTIONS.map((tag) => (
                                        <Select.Option key={tag} value={tag}>{tag}</Select.Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        )}

                        <Divider>报价（元/㎡）</Divider>
                        {role === 'designer' && (
                            <Row gutter={16}>
                                <Col xs={24} sm={8}>
                                    <Form.Item name="priceFlat" label="平层报价" rules={[{ required: true, message: '必填' }]}>
                                        <InputNumber min={1} style={{ width: '100%' }} />
                                    </Form.Item>
                                </Col>
                                <Col xs={24} sm={8}>
                                    <Form.Item name="priceDuplex" label="复式报价" rules={[{ required: true, message: '必填' }]}>
                                        <InputNumber min={1} style={{ width: '100%' }} />
                                    </Form.Item>
                                </Col>
                                <Col xs={24} sm={8}>
                                    <Form.Item name="priceOther" label="其他报价" rules={[{ required: true, message: '必填' }]}>
                                        <InputNumber min={1} style={{ width: '100%' }} />
                                    </Form.Item>
                                </Col>
                            </Row>
                        )}
                        {role === 'foreman' && (
                            <Form.Item name="pricePerSqm" label="施工报价" rules={[{ required: true, message: '请填写施工报价' }]}>
                                <InputNumber min={1} style={{ width: '100%' }} />
                            </Form.Item>
                        )}
                        {role === 'company' && (
                            <Row gutter={16}>
                                <Col xs={24} sm={12}>
                                    <Form.Item name="priceFullPackage" label="全包报价" rules={[{ required: true, message: '请填写全包报价' }]}>
                                        <InputNumber min={1} style={{ width: '100%' }} />
                                    </Form.Item>
                                </Col>
                                <Col xs={24} sm={12}>
                                    <Form.Item name="priceHalfPackage" label="半包报价" rules={[{ required: true, message: '请填写半包报价' }]}>
                                        <InputNumber min={1} style={{ width: '100%' }} />
                                    </Form.Item>
                                </Col>
                            </Row>
                        )}

                        <Form.Item name="introduction" label={isForeman ? '施工简介' : '个人/公司简介'}>
                            <TextArea rows={4} placeholder="可填写服务亮点、经验、团队说明等" maxLength={5000} showCount />
                        </Form.Item>

                        {role === 'designer' && (
                            <Row gutter={16}>
                                <Col xs={24} sm={12}>
                                    <Form.Item name="graduateSchool" label="毕业院校（选填）">
                                        <Input placeholder="如：西安建筑科技大学" maxLength={100} />
                                    </Form.Item>
                                </Col>
                                <Col xs={24} sm={12}>
                                    <Form.Item name="designPhilosophy" label="设计理念（选填）">
                                        <Input placeholder="一句话描述您的理念" maxLength={200} />
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
        <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
            <Content style={{ padding: screens.xs ? 16 : 24, maxWidth: 900, margin: '0 auto', width: '100%' }}>
                <Card styles={{ body: { padding: screens.xs ? 16 : 24 } }}>
                    <div style={{ marginBottom: 24 }}>
                        <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate('/')} style={{ padding: 0 }}>
                            返回
                        </Button>
                        <Title level={4} style={{ marginTop: 8 }}>
                            {pageTitle}
                        </Title>
                        <Text type="secondary">入驻即注册。审核通过后可登录商家中心。</Text>
                    </div>

                    {showRedirectAlert && (
                        <Alert
                            type="warning"
                            showIcon
                            closable
                            onClose={() => setShowRedirectAlert(false)}
                            message="该手机号尚未入驻，请先完成入驻申请后再登录"
                            style={{ marginBottom: 16 }}
                        />
                    )}

                    <Steps 
                        current={currentStep} 
                        items={steps} 
                        style={{ marginBottom: 32 }} 
                        direction={screens.xs ? 'vertical' : 'horizontal'}
                        size={screens.xs ? 'small' : 'default'}
                    />

                    <Form form={form} layout="vertical">
                        {renderStepContent()}
                    </Form>

                    <Divider />

                    <Row justify="space-between">
                        <Col>
                            {currentStep > 0 && (
                                <Button icon={<ArrowLeftOutlined />} onClick={handlePrev}>
                                    上一步
                                </Button>
                            )}
                        </Col>
                        <Col>
                            {currentStep < steps.length - 1 ? (
                                <Button type="primary" onClick={handleNext}>
                                    下一步 <ArrowRightOutlined />
                                </Button>
                            ) : (
                                <Button type="primary" loading={loading} onClick={handleSubmit} icon={<CheckOutlined />}>
                                    提交申请
                                </Button>
                            )}
                        </Col>
                    </Row>
                </Card>
            </Content>
        </Layout>
    );
};

export default MerchantRegister;
