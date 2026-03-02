import React, { useEffect, useState } from 'react';
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
import { Button, Card, Col, Divider, Form, Input, Layout, Row, Select, Steps, Typography, Upload, message } from 'antd';
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

const WORK_TYPE_OPTIONS = [
    { value: 'mason', label: '瓦工' },
    { value: 'electrician', label: '电工' },
    { value: 'carpenter', label: '木工' },
    { value: 'painter', label: '油漆工' },
    { value: 'plumber', label: '水暖工' },
];

interface PortfolioCase {
    title: string;
    images: string[];
    style: string;
    area: string;
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

const MerchantRegister: React.FC = () => {
    const [searchParams] = useSearchParams();
    const rawType = searchParams.get('type') || 'personal';
    const applicantType = (['personal', 'studio', 'company', 'foreman'].includes(rawType)
        ? rawType
        : 'personal') as MerchantApplicantType;
    const resubmitId = searchParams.get('resubmit');

    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [sendingCode, setSendingCode] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [form] = Form.useForm();
    const [portfolioCases, setPortfolioCases] = useState<PortfolioCase[]>([
        { title: '', images: [], style: '', area: '' },
        { title: '', images: [], style: '', area: '' },
        { title: '', images: [], style: '', area: '' },
    ]);
    const [styleOptions, setStyleOptions] = useState<string[]>([]);
    const [areaOptions, setAreaOptions] = useState<string[]>([]);

    const isForeman = applicantType === 'foreman';
    const isCompany = applicantType === 'company';
    const needCompanyName = applicantType === 'studio' || applicantType === 'company';

    const typeLabels: Record<MerchantApplicantType, string> = {
        personal: '独立设计师',
        studio: '设计工作室',
        company: '装修公司',
        foreman: '工长/项目经理',
    };

    const steps = [
        { title: '基础信息', icon: <UserOutlined /> },
        { title: '资质上传', icon: <IdcardOutlined /> },
        { title: isForeman ? '施工案例' : '作品集', icon: isForeman ? <ToolOutlined /> : <PictureOutlined /> },
        { title: '确认提交', icon: <CheckOutlined /> },
    ];

    useEffect(() => {
        form.setFieldsValue({ applicantType });
        loadStyleOptions();
        loadAreaOptions();
    }, [applicantType, form]);

    const loadStyleOptions = async () => {
        try {
            const options = await dictionaryApi.getOptions('style');
            setStyleOptions(options.map(opt => opt.label));
        } catch (error) {
            console.error('加载装修风格失败:', error);
            setStyleOptions(['现代简约', '北欧风格', '新中式', '轻奢风格', '美式风格', '欧式风格', '日式风格', '工业风格']);
        }
    };

    const loadAreaOptions = async () => {
        try {
            const districts = await regionApi.getChildren('610100');
            setAreaOptions(districts.map(d => d.name));
        } catch (error) {
            console.error('加载服务区域失败:', error);
            setAreaOptions(['雁塔区', '碑林区', '新城区', '莲湖区', '未央区', '灞桥区', '长安区', '高新区', '曲江新区', '经开区']);
        }
    };

    const validateImageBeforeUpload = (file: File, maxSizeMB: number) => {
        const isImage = file.type === 'image/jpeg' || file.type === 'image/png';
        if (!isImage) {
            message.error('只支持上传 JPG/PNG 格式的图片!');
            return Upload.LIST_IGNORE;
        }

        const isLtMaxSize = file.size / 1024 / 1024 < maxSizeMB;
        if (!isLtMaxSize) {
            message.error(`图片大小不能超过 ${maxSizeMB}MB!`);
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

    const handleSendCode = async () => {
        try {
            await form.validateFields(['phone']);
        } catch {
            return;
        }

        setSendingCode(true);
        try {
            const phone = form.getFieldValue('phone');
            const res = await merchantAuthApi.sendCode(phone);
            const debugSuffix = import.meta.env.DEV && res?.debugCode ? ` (测试码: ${res.debugCode})` : '';
            message.success(`验证码已发送${debugSuffix}`);
            setCountdown(60);
            const timer = setInterval(() => {
                setCountdown((prev) => {
                    if (prev <= 1) {
                        clearInterval(timer);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } catch {
            message.error('发送失败');
        } finally {
            setSendingCode(false);
        }
    };

    const handleNext = async () => {
        try {
            if (currentStep === 0) {
                const fieldsToValidate = ['phone', 'code', 'realName'];
                if (needCompanyName) {
                    fieldsToValidate.push('companyName');
                }
                await form.validateFields(fieldsToValidate);
            } else if (currentStep === 1) {
                await form.validateFields(['idCardNo', 'idCardFront', 'idCardBack']);
                if (isCompany) {
                    await form.validateFields(['licenseNo', 'licenseImage']);
                }
                if (isForeman) {
                    await form.validateFields(['yearsExperience', 'workTypes']);
                }
            } else if (currentStep === 2) {
                const validCases = portfolioCases.filter(c => c.title && c.images.length > 0);
                const minRequired = isForeman ? 1 : 3;
                if (validCases.length < minRequired) {
                    message.error(`请至少添加${minRequired}个${isForeman ? '施工案例' : '作品'}`);
                    return;
                }
            }
            setCurrentStep(currentStep + 1);
        } catch {
            // noop
        }
    };

    const handlePrev = () => {
        setCurrentStep(currentStep - 1);
    };

    const handleSubmit = async () => {
        const finalFields = ['serviceArea'];
        if (!isForeman) {
            finalFields.push('styles');
        }
        try {
            await form.validateFields(finalFields);
        } catch {
            return;
        }

        setLoading(true);
        try {
            const values = form.getFieldsValue();
            const payload: MerchantApplyPayload = {
                ...values,
                applicantType,
                portfolioCases: portfolioCases.filter(c => c.title && c.images.length > 0),
            };

            if (isForeman) {
                payload.styles = [];
            }

            const result = resubmitId
                ? await merchantApplyApi.resubmit(Number(resubmitId), payload)
                : await merchantApplyApi.apply(payload);

            if (!result.applicationId) {
                message.error('提交失败：申请编号缺失');
                return;
            }

            message.success(resubmitId ? '已重新提交，请等待审核' : '申请已提交，请等待审核');
            navigate('/apply-status?phone=' + values.phone);
        } catch (error: unknown) {
            message.error(getErrorMessage(error, '提交失败'));
        } finally {
            setLoading(false);
        }
    };

    const updatePortfolioCase = (index: number, field: keyof PortfolioCase, value: PortfolioCase[keyof PortfolioCase]) => {
        const newCases = [...portfolioCases];
        newCases[index] = {
            ...newCases[index],
            [field]: value,
        };
        setPortfolioCases(newCases);
    };

    const addPortfolioCase = () => {
        setPortfolioCases([...portfolioCases, { title: '', images: [], style: '', area: '' }]);
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
                            rules={[{ required: true, message: '请输入验证码' }]}
                        >
                            <Input
                                prefix={<SafetyOutlined />}
                                placeholder="请输入6位验证码"
                                maxLength={6}
                                suffix={
                                    <Button
                                        type="link"
                                        size="small"
                                        disabled={countdown > 0 || sendingCode}
                                        onClick={handleSendCode}
                                        loading={sendingCode}
                                    >
                                        {countdown > 0 ? `${countdown}s` : '获取验证码'}
                                    </Button>
                                }
                            />
                        </Form.Item>
                        <Form.Item
                            name="realName"
                            label={applicantType === 'personal' ? '真实姓名' : isForeman ? '工长姓名' : '负责人姓名'}
                            rules={[
                                { required: true, message: '请输入姓名' },
                                { max: 20, message: '姓名最多20个字符' },
                            ]}
                        >
                            <Input prefix={<UserOutlined />} placeholder="请输入姓名" maxLength={20} />
                        </Form.Item>

                        {needCompanyName && (
                            <>
                                <Form.Item
                                    name="companyName"
                                    label={applicantType === 'studio' ? '工作室名称' : '公司名称'}
                                    rules={[
                                        { required: true, message: '请输入名称' },
                                        { max: 100, message: '名称最多100个字符' },
                                    ]}
                                >
                                    <Input placeholder={`请输入${applicantType === 'studio' ? '工作室' : '公司'}名称`} maxLength={100} />
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
                                    <Input prefix={<EnvironmentOutlined />} placeholder="请输入办公地址" />
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
                            <Col span={12}>
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
                            <Col span={12}>
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

                        {isCompany && (
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
                                <Divider>施工资质</Divider>
                                <Form.Item
                                    name="yearsExperience"
                                    label="施工经验"
                                    rules={[{ required: true, message: '请选择施工经验' }]}
                                >
                                    <Select placeholder="选择施工经验">
                                        {[1, 2, 3, 5, 8, 10, 15, 20, 30].map(y => (
                                            <Select.Option key={y} value={y}>{y}年以上</Select.Option>
                                        ))}
                                    </Select>
                                </Form.Item>
                                <Form.Item
                                    name="workTypes"
                                    label="工种类型"
                                    rules={[{ required: true, message: '请至少选择1个工种' }]}
                                >
                                    <Select mode="multiple" placeholder="选择可承接的工种" options={WORK_TYPE_OPTIONS} />
                                </Form.Item>
                            </>
                        )}
                    </div>
                );

            case 2:
                return (
                    <div>
                        <Title level={5}>{isForeman ? '施工案例 (至少1个)' : '作品集 (至少3个)'}</Title>
                        {portfolioCases.map((caseItem, index) => (
                            <Card key={index} size="small" title={`${isForeman ? '案例' : '作品'} ${index + 1}`} style={{ marginBottom: 16 }}>
                                <Form.Item label="作品标题" required>
                                    <Input
                                        placeholder="例如：现代简约三居室"
                                        value={caseItem.title}
                                        maxLength={50}
                                        onChange={(e) => updatePortfolioCase(index, 'title', e.target.value)}
                                    />
                                </Form.Item>
                                <Row gutter={16}>
                                    <Col span={12}>
                                        <Form.Item label="风格">
                                            <Select
                                                placeholder="选择风格"
                                                value={caseItem.style || undefined}
                                                onChange={(v) => updatePortfolioCase(index, 'style', v)}
                                            >
                                                {styleOptions.map(s => (
                                                    <Select.Option key={s} value={s}>{s}</Select.Option>
                                                ))}
                                            </Select>
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                        <Form.Item label="面积">
                                            <Input
                                                placeholder="例如：120㎡"
                                                value={caseItem.area}
                                                maxLength={20}
                                                onChange={(e) => updatePortfolioCase(index, 'area', e.target.value)}
                                            />
                                        </Form.Item>
                                    </Col>
                                </Row>
                                <Form.Item label="作品图片" required>
                                    <Upload
                                        listType="picture-card"
                                        multiple
                                        maxCount={9}
                                        accept=".jpg,.jpeg,.png"
                                        beforeUpload={(file) => validateImageBeforeUpload(file as File, 5)}
                                        customRequest={createCaseUploadHandler(index)}
                                        onChange={(uploadInfo) => {
                                            const urls = uploadInfo.fileList
                                                .map((uploadFile: UploadFile) => {
                                                    const response = uploadFile.response as { url?: string } | undefined;
                                                    return response?.url || uploadFile.url || '';
                                                })
                                                .filter((url): url is string => Boolean(url));
                                            updatePortfolioCase(index, 'images', urls);
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
                            + 添加更多作品
                        </Button>
                    </div>
                );

            case 3:
                return (
                    <div>
                        <Title level={5}>服务设置与确认</Title>
                        <Form.Item
                            name="serviceArea"
                            label="服务区域"
                            rules={[{ required: true, message: '请选择服务区域' }]}
                        >
                            <Select mode="multiple" placeholder="选择可服务的区域" style={{ width: '100%' }}>
                                {areaOptions.map(area => (
                                    <Select.Option key={area} value={area}>{area}</Select.Option>
                                ))}
                            </Select>
                        </Form.Item>
                        {!isForeman && (
                            <Form.Item
                                name="styles"
                                label="擅长风格"
                                rules={[{ required: true, message: '请选择擅长风格' }]}
                            >
                                <Select mode="multiple" placeholder="选择擅长的设计风格" style={{ width: '100%' }}>
                                    {styleOptions.map(style => (
                                        <Select.Option key={style} value={style}>{style}</Select.Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        )}
                        <Form.Item name="introduction" label={isForeman ? '个人/团队简介' : '个人/公司简介'}>
                            <TextArea
                                rows={4}
                                placeholder={isForeman ? '介绍您的施工经验、团队优势、服务特色等（选填）' : '介绍您的设计理念、服务特色等（选填）'}
                                maxLength={500}
                                showCount
                            />
                        </Form.Item>
                        <Card style={{ background: '#f5f5f5', marginTop: 16 }}>
                            <Text>
                                提交申请后，平台将在1-3个工作日内完成审核。
                                审核通过后，您可以使用手机号登录商家中心。
                            </Text>
                        </Card>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
            <Content style={{ padding: 24, maxWidth: 800, margin: '0 auto', width: '100%' }}>
                <Card>
                    <div style={{ marginBottom: 24 }}>
                        <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate('/')} style={{ padding: 0 }}>
                            返回
                        </Button>
                        <Title level={4} style={{ marginTop: 8 }}>
                            {typeLabels[applicantType] || '商家'}入驻申请
                        </Title>
                    </div>

                    <Steps current={currentStep} items={steps} style={{ marginBottom: 32 }} />

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
