import React, { useEffect, useMemo, useState } from 'react';
import {
    Avatar,
    Button,
    Card,
    Col,
    Divider,
    Form,
    Input,
    InputNumber,
    Row,
    Select,
    Switch,
    Upload,
    message,
} from 'antd';
import { ArrowLeftOutlined, CameraOutlined, LoadingOutlined, SaveOutlined, UserOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
    merchantAuthApi,
    merchantUploadApi,
    type MerchantProviderInfo,
    type MerchantServiceSetting,
} from '../../services/merchantApi';
import { dictionaryApi } from '../../services/dictionaryApi';
import { regionApi } from '../../services/regionApi';
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

const toAlbumFileList = (urls: string[] = []) => urls.map((url, index) => ({
    uid: `${index}-${url}`,
    name: `company-album-${index + 1}`,
    status: 'done' as const,
    url,
    response: { url },
}));

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

const parsePricingFromRaw = (raw: string): Record<string, number> => {
    const trimmed = raw.trim();
    if (!trimmed) {
        return {};
    }

    const parsed = JSON.parse(trimmed);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('报价信息必须是 JSON 对象');
    }

    const pricing: Record<string, number> = {};
    Object.entries(parsed as Record<string, unknown>).forEach(([key, value]) => {
        const numericValue = Number(value);
        if (Number.isFinite(numericValue) && numericValue > 0) {
            pricing[key] = numericValue;
        }
    });
    return pricing;
};

const MerchantSettings: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [savingInfo, setSavingInfo] = useState(false);
    const [savingSettings, setSavingSettings] = useState(false);
    const [avatarUploading, setAvatarUploading] = useState(false);
    const [providerInfo, setProviderInfo] = useState<MerchantProviderInfo | null>(null);
    const [styleOptions, setStyleOptions] = useState<string[]>([]);
    const [areaOptions, setAreaOptions] = useState<string[]>([]);
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
            const districts = await regionApi.getChildren('610100');
            setAreaOptions(districts.map((item) => item.name));
        } catch (error) {
            console.error('加载服务区域失败:', error);
            setAreaOptions(['雁塔区', '碑林区', '新城区', '莲湖区', '未央区', '灞桥区', '长安区', '高新区', '曲江新区', '经开区']);
        }
    };

    const fetchProviderInfo = async () => {
        setLoading(true);
        try {
            const info = await merchantAuthApi.getInfo();
            setProviderInfo(info);
            infoForm.setFieldsValue({
                name: info.name,
                companyName: info.companyName,
                yearsExperience: info.yearsExperience,
                specialty: info.specialty,
                highlightTags: info.highlightTags || [],
                pricingRaw: JSON.stringify(info.pricing || {}, null, 2),
                graduateSchool: info.graduateSchool || '',
                designPhilosophy: info.designPhilosophy || '',
                serviceArea: info.serviceArea,
                introduction: info.introduction,
                teamSize: info.teamSize,
                officeAddress: info.officeAddress,
                companyAlbum: info.companyAlbum || [],
            });
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

    const handleSaveInfo = async (values: {
        name: string;
        companyName?: string;
        yearsExperience?: number;
        specialty?: string[];
        highlightTags?: string[];
        pricingRaw?: string;
        graduateSchool?: string;
        designPhilosophy?: string;
        serviceArea?: string[];
        introduction?: string;
        teamSize?: number;
        officeAddress?: string;
        companyAlbum?: string[];
    }) => {
        setSavingInfo(true);
        try {
            const pricing = parsePricingFromRaw(values.pricingRaw || '');
            const officeAddress = (values.officeAddress || '').trim();
            if (!officeAddress) {
                message.error('请输入办公地址');
                return;
            }
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

            if (isForeman) {
                payload.specialty = [];
            } else {
                payload.specialty = values.specialty || [];
            }

            if (isCompanyRole) {
                payload.companyAlbum = values.companyAlbum || [];
            }

            await merchantAuthApi.updateInfo(payload);
            setProviderInfo((prev) => {
                if (!prev) return prev;
                return {
                    ...prev,
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
                    companyAlbum: isCompanyRole ? (values.companyAlbum || []) : prev.companyAlbum,
                };
            });

            const storedProvider = JSON.parse(localStorage.getItem('merchant_provider') || '{}');
            storedProvider.name = values.name;
            localStorage.setItem('merchant_provider', JSON.stringify(storedProvider));

            message.success('基本信息保存成功');
        } catch (error) {
            message.error(getErrorMessage(error, '保存失败'));
        } finally {
            setSavingInfo(false);
        }
    };

    const handleSaveServiceSettings = async (values: {
        acceptBooking: boolean;
        autoConfirmHours: number;
        responseTimeDesc: string;
        priceRangeMin: number;
        priceRangeMax: number;
        serviceStyles: string[];
        servicePackagesRaw: string;
    }) => {
        setSavingSettings(true);
        try {
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
            message.success('服务设置保存成功');
        } catch (error) {
            message.error(getErrorMessage(error, '服务设置保存失败'));
        } finally {
            setSavingSettings(false);
        }
    };

    const handleAvatarUpload: UploadProps['customRequest'] = async (options) => {
        const { file, onSuccess, onError } = options;
        setAvatarUploading(true);
        try {
            const uploaded = await merchantUploadApi.uploadImageData(file as File);
            const uploadedUrl = uploaded.url;

            setProviderInfo((prev) => (prev ? { ...prev, avatar: uploadedUrl } : prev));

            const storedProvider = JSON.parse(localStorage.getItem('merchant_provider') || '{}');
            storedProvider.avatar = uploadedUrl;
            localStorage.setItem('merchant_provider', JSON.stringify(storedProvider));

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
            const current = (infoForm.getFieldValue('companyAlbum') || []) as string[];
            if (!current.includes(uploaded.url)) {
                infoForm.setFieldValue('companyAlbum', [...current, uploaded.url].slice(0, 8));
            }
            onSuccess?.(uploaded);
        } catch (error) {
            const errorMessage = getErrorMessage(error, '公司相册上传失败');
            message.error(errorMessage);
            onError?.(new Error(errorMessage));
        }
    };

    const getProviderTypeLabel = () => {
        if (!providerInfo) return '商家';
        switch (providerInfo.applicantType) {
            case 'studio':
                return '设计工作室';
            case 'company':
                return '装修公司';
            case 'foreman':
                return '工长/项目经理';
            default:
                if (providerInfo.providerType === 3) return '工长/项目经理';
                if (providerInfo.providerType === 2) return '装修公司';
                return '独立设计师';
        }
    };

    return (
        <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
            <div style={{ marginBottom: 24 }}>
                <Button
                    type="link"
                    icon={<ArrowLeftOutlined />}
                    onClick={() => navigate('/dashboard')}
                    style={{ padding: 0, marginBottom: 8 }}
                >
                    返回工作台
                </Button>
                <h2 style={{ margin: 0 }}>账户设置</h2>
            </div>

            <Row gutter={24}>
                <Col xs={24} lg={8}>
                    <Card loading={loading}>
                        <div style={{ textAlign: 'center', marginBottom: 24 }}>
                            <Upload
                                name="avatar"
                                showUploadList={false}
                                customRequest={handleAvatarUpload}
                                accept="image/*"
                            >
                                <div style={{ position: 'relative', display: 'inline-block', cursor: 'pointer' }}>
                                    <Avatar
                                        size={80}
                                        src={providerInfo?.avatar}
                                        icon={avatarUploading ? <LoadingOutlined /> : <UserOutlined />}
                                        style={{ marginBottom: 8 }}
                                    />
                                    <div
                                        style={{
                                            position: 'absolute',
                                            bottom: 8,
                                            right: 0,
                                            background: '#1890ff',
                                            borderRadius: '50%',
                                            width: 24,
                                            height: 24,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            border: '2px solid #fff',
                                        }}
                                    >
                                        <CameraOutlined style={{ color: '#fff', fontSize: 12 }} />
                                    </div>
                                </div>
                                <div style={{ color: '#999', fontSize: 12, marginTop: 4 }}>点击更换头像</div>
                            </Upload>
                            <h3 style={{ margin: '8px 0 8px 0' }}>{providerInfo?.name || '商家'}</h3>
                            <div style={{ color: '#999' }}>
                                {getProviderTypeLabel()}
                                {providerInfo?.verified && <span style={{ color: '#52c41a', marginLeft: 8 }}>已认证</span>}
                            </div>
                        </div>

                        <Divider />

                        <div style={{ color: '#666' }}>
                            <div style={{ marginBottom: 12 }}>
                                <span>评分：</span>
                                <span style={{ fontWeight: 500 }}>{providerInfo?.rating || 0}</span>
                            </div>
                            <div style={{ marginBottom: 12 }}>
                                <span>完成订单：</span>
                                <span style={{ fontWeight: 500 }}>{providerInfo?.completedCnt || 0} 单</span>
                            </div>
                            <div>
                                <span>从业年限：</span>
                                <span style={{ fontWeight: 500 }}>{providerInfo?.yearsExperience || 0} 年</span>
                            </div>
                        </div>
                    </Card>

                    <Card title="快捷入口" style={{ marginTop: 16 }}>
                        <Button block style={{ marginBottom: 8 }} onClick={() => navigate('/cases')}>
                            {isForeman ? '管理施工案例' : '管理作品集'}
                        </Button>
                        <Button block style={{ marginBottom: 8 }} onClick={() => navigate('/bank-accounts')}>
                            银行账户管理
                        </Button>
                        <Button block onClick={() => navigate('/income')}>
                            收入中心
                        </Button>
                    </Card>
                </Col>

                <Col xs={24} lg={16}>
                    <Card title="基本信息" loading={loading}>
                        <Form form={infoForm} layout="vertical" onFinish={handleSaveInfo}>
                            <Form.Item
                                name="name"
                                label="显示名称"
                                rules={[{ required: true, message: '请输入名称' }, { max: 50, message: '名称最多50个字符' }]}
                            >
                                <Input placeholder="您的名称或公司名称" maxLength={50} />
                            </Form.Item>

                            {isCompanyOrStudio && (
                                <Form.Item name="companyName" label="公司/工作室名称">
                                    <Input placeholder="公司全称" maxLength={100} />
                                </Form.Item>
                            )}

                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item name="yearsExperience" label="从业年限">
                                        <Select placeholder="选择从业年限">
                                            {[1, 2, 3, 5, 8, 10, 15, 20].map((year) => (
                                                <Select.Option key={year} value={year}>
                                                    {year}年以上
                                                </Select.Option>
                                            ))}
                                        </Select>
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    {!isForeman && (
                                        <Form.Item
                                            name="specialty"
                                            label="擅长风格"
                                            rules={[{ type: 'array', max: 5, message: '最多选择5个擅长风格' }]}
                                        >
                                            <Select mode="multiple" placeholder="选择擅长风格" maxTagCount={4}>
                                                {styleOptions.map((style) => (
                                                    <Select.Option key={style} value={style}>
                                                        {style}
                                                    </Select.Option>
                                                ))}
                                            </Select>
                                        </Form.Item>
                                    )}
                                </Col>
                            </Row>

                            {isForeman && (
                                <Form.Item
                                    name="highlightTags"
                                    label="施工亮点"
                                    rules={[{ type: 'array', min: 1, max: 3, message: '请选择1-3个施工亮点' }]}
                                >
                                    <Select
                                        mode="multiple"
                                        placeholder="选择施工亮点"
                                        options={FOREMAN_HIGHLIGHT_OPTIONS.map((item) => ({ value: item, label: item }))}
                                    />
                                </Form.Item>
                            )}

                            <Form.Item name="serviceArea" label="服务区域">
                                <Select mode="multiple" placeholder="选择可服务的区域">
                                    {areaOptions.map((area) => (
                                        <Select.Option key={area} value={area}>
                                            {area}
                                        </Select.Option>
                                    ))}
                                </Select>
                            </Form.Item>

                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item name="teamSize" label="团队规模">
                                        <InputNumber min={1} max={500} style={{ width: '100%' }} placeholder="团队人数" />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item
                                        name="officeAddress"
                                        label="办公地址"
                                        rules={[{ required: true, message: '请输入办公地址' }]}
                                    >
                                        <Input placeholder="请输入办公地址" maxLength={200} />
                                    </Form.Item>
                                </Col>
                            </Row>

                            {isCompanyRole && (
                                <Form.Item
                                    name="companyAlbum"
                                    label="公司相册"
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
                                >
                                    <Upload
                                        listType="picture-card"
                                        multiple
                                        fileList={toAlbumFileList(infoForm.getFieldValue('companyAlbum') || [])}
                                        customRequest={handleCompanyAlbumUpload}
                                        onChange={({ fileList }) => {
                                            const next = fileList
                                                .map((file) => (file.response as { url?: string } | undefined)?.url || file.url || '')
                                                .filter(Boolean);
                                            infoForm.setFieldValue('companyAlbum', next);
                                        }}
                                        onRemove={(file) => {
                                            const current = (infoForm.getFieldValue('companyAlbum') || []) as string[];
                                            const target = (file.response as { url?: string } | undefined)?.url || file.url || '';
                                            infoForm.setFieldValue('companyAlbum', current.filter((item) => item !== target));
                                            return true;
                                        }}
                                    >
                                        {((infoForm.getFieldValue('companyAlbum') || []) as string[]).length < 8 ? <div>上传图片</div> : null}
                                    </Upload>
                                </Form.Item>
                            )}

                            <Form.Item name="introduction" label={isForeman ? '施工服务简介' : '个人/公司简介'}>
                                <Input.TextArea
                                    rows={4}
                                    placeholder={isForeman ? '介绍施工经验、团队优势、服务特色等' : '介绍设计理念、服务特色等'}
                                    maxLength={5000}
                                    showCount
                                />
                            </Form.Item>

                            <Form.Item
                                name="pricingRaw"
                                label="结构化报价（JSON）"
                                extra={'例如：设计师 {"flat":1200,"duplex":1600,"other":1000}；工长 {"perSqm":900}'}
                            >
                                <Input.TextArea rows={4} placeholder="{}" />
                            </Form.Item>

                            {!isForeman && (
                                <Form.Item name="graduateSchool" label="毕业院校">
                                    <Input placeholder="请输入毕业院校（选填）" maxLength={100} />
                                </Form.Item>
                            )}

                            <Form.Item name="designPhilosophy" label={isForeman ? '施工理念' : '设计理念'}>
                                <Input.TextArea
                                    rows={3}
                                    placeholder={isForeman ? '请填写施工理念（选填）' : '请填写设计理念（选填）'}
                                    maxLength={5000}
                                    showCount
                                />
                            </Form.Item>

                            <Form.Item>
                                <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={savingInfo}>
                                    保存基本信息
                                </Button>
                            </Form.Item>
                        </Form>
                    </Card>

                    <Card title="服务设置" style={{ marginTop: 16 }}>
                        <Form form={settingForm} layout="vertical" onFinish={handleSaveServiceSettings}>
                            <Form.Item name="acceptBooking" label="接单状态" valuePropName="checked">
                                <Switch checkedChildren="接单中" unCheckedChildren="暂停接单" />
                            </Form.Item>

                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item
                                        name="autoConfirmHours"
                                        label="自动确认时间（小时）"
                                        rules={[{ required: true, message: '请填写自动确认时间' }]}
                                    >
                                        <InputNumber min={1} max={168} style={{ width: '100%' }} />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item
                                        name="responseTimeDesc"
                                        label="响应时间描述"
                                        rules={[{ max: 50, message: '最多50个字符' }]}
                                    >
                                        <Input placeholder="例如：2小时内回复" maxLength={50} />
                                    </Form.Item>
                                </Col>
                            </Row>

                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item name="priceRangeMin" label="价格区间下限（元）">
                                        <InputNumber min={0} style={{ width: '100%' }} />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item name="priceRangeMax" label="价格区间上限（元）">
                                        <InputNumber min={0} style={{ width: '100%' }} />
                                    </Form.Item>
                                </Col>
                            </Row>

                            <Form.Item name="serviceStyles" label={isForeman ? '可施工风格' : '服务风格'}>
                                <Select mode="multiple" placeholder={isForeman ? '选择可承接施工风格' : '选择服务风格'}>
                                    {styleOptions.map((style) => (
                                        <Select.Option key={style} value={style}>
                                            {style}
                                        </Select.Option>
                                    ))}
                                </Select>
                            </Form.Item>

                            <Form.Item
                                name="servicePackagesRaw"
                                label="服务套餐（JSON数组）"
                                extra="示例：[{'name':'基础包','price':9999}]"
                            >
                                <Input.TextArea rows={5} placeholder="[]" />
                            </Form.Item>

                            <Form.Item>
                                <Button type="primary" htmlType="submit" loading={savingSettings}>
                                    保存服务设置
                                </Button>
                            </Form.Item>
                        </Form>
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default MerchantSettings;
