import React, { useState, useEffect } from 'react';
import {
    Card, Form, Input, Button, message, Layout, Typography,
    Steps, Row, Col, Upload, Select, Divider
} from 'antd';
import {
    UserOutlined, PhoneOutlined, SafetyOutlined,
    IdcardOutlined, PictureOutlined, EnvironmentOutlined,
    ArrowLeftOutlined, ArrowRightOutlined, CheckOutlined
} from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { dictionaryApi } from '../../services/dictionaryApi';
import { regionApi } from '../../services/regionApi';

const { Content } = Layout;
const { Title, Text } = Typography;
const { TextArea } = Input;

interface PortfolioCase {
    title: string;
    images: string[];
    style: string;
    area: string;
}

const MerchantRegister: React.FC = () => {
    const [searchParams] = useSearchParams();
    const applicantType = searchParams.get('type') || 'personal';
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

    // Dictionary Options
    const [styleOptions, setStyleOptions] = useState<string[]>([]);
    const [areaOptions, setAreaOptions] = useState<string[]>([]);

    const typeLabels: Record<string, string> = {
        personal: '独立设计师',
        studio: '设计工作室',
        company: '装修公司',
    };

    // 步骤配置
    const steps = [
        { title: '基础信息', icon: <UserOutlined /> },
        { title: '资质上传', icon: <IdcardOutlined /> },
        { title: '作品集', icon: <PictureOutlined /> },
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
            // 降级到默认选项
            setStyleOptions([
                '现代简约', '北欧风格', '新中式', '轻奢风格',
                '美式风格', '欧式风格', '日式风格', '工业风格'
            ]);
        }
    };

    const loadAreaOptions = async () => {
        try {
            // 加载陕西省西安市的区县数据
            const districts = await regionApi.getChildren('610100'); // 西安市代码
            setAreaOptions(districts.map(d => d.name));
        } catch (error) {
            console.error('加载服务区域失败:', error);
            // 降级到默认选项
            setAreaOptions([
                '雁塔区', '碑林区', '新城区', '莲湖区', '未央区',
                '灞桥区', '长安区', '高新区', '曲江新区', '经开区'
            ]);
        }
    };

    // 发送验证码
    const handleSendCode = async () => {
        try {
            await form.validateFields(['phone']);
        } catch {
            return;
        }

        setSendingCode(true);
        try {
            // TODO: 调用发送验证码API
            message.success('验证码已发送 (测试: 123456)');
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
        } catch (error: any) {
            message.error('发送失败');
        } finally {
            setSendingCode(false);
        }
    };

    // 下一步
    const handleNext = async () => {
        try {
            // 根据当前步骤校验对应字段
            if (currentStep === 0) {
                const fieldsToValidate = ['phone', 'code', 'realName'];
                if (applicantType !== 'personal') {
                    fieldsToValidate.push('companyName');
                }
                await form.validateFields(fieldsToValidate);
            } else if (currentStep === 1) {
                await form.validateFields(['idCardNo', 'idCardFront', 'idCardBack']);
                if (applicantType === 'company') {
                    await form.validateFields(['licenseNo', 'licenseImage']);
                }
            } else if (currentStep === 2) {
                // 校验作品集
                const validCases = portfolioCases.filter(c => c.title && c.images.length > 0);
                if (validCases.length < 3) {
                    message.error('请至少添加3个作品');
                    return;
                }
            }
            setCurrentStep(currentStep + 1);
        } catch (error) {
            // 校验失败，不进行下一步
        }
    };

    // 上一步
    const handlePrev = () => {
        setCurrentStep(currentStep - 1);
    };

    // 提交申请
    const handleSubmit = async () => {
        try {
            await form.validateFields(['serviceArea', 'styles']);
        } catch {
            return;
        }

        setLoading(true);
        try {
            const values = form.getFieldsValue();
            const payload = {
                ...values,
                applicantType,
                portfolioCases: portfolioCases.filter(c => c.title && c.images.length > 0),
            };

            // 调用API
            const response = await fetch('/api/v1/merchant/apply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const result = await response.json();

            if (result.code === 0) {
                message.success('申请已提交，请等待审核');
                navigate('/apply-status?phone=' + values.phone);
            } else {
                message.error(result.message || '提交失败');
            }
        } catch (error: any) {
            message.error('提交失败');
        } finally {
            setLoading(false);
        }
    };

    // 更新作品集
    const updatePortfolioCase = (index: number, field: keyof PortfolioCase, value: any) => {
        const newCases = [...portfolioCases];
        (newCases[index] as any)[field] = value;
        setPortfolioCases(newCases);
    };

    // 添加更多作品
    const addPortfolioCase = () => {
        setPortfolioCases([...portfolioCases, { title: '', images: [], style: '', area: '' }]);
    };

    // 渲染步骤内容
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
                                { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号' }
                            ]}
                        >
                            <Input
                                prefix={<PhoneOutlined />}
                                placeholder="请输入11位手机号"
                                maxLength={11}
                            />
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
                            label={applicantType === 'personal' ? '真实姓名' : '负责人姓名'}
                            rules={[
                                { required: true, message: '请输入姓名' },
                                { max: 20, message: '姓名最多20个字符' }
                            ]}
                        >
                            <Input prefix={<UserOutlined />} placeholder="请输入姓名" maxLength={20} />
                        </Form.Item>
                        {applicantType !== 'personal' && (
                            <>
                                <Form.Item
                                    name="companyName"
                                    label={applicantType === 'studio' ? '工作室名称' : '公司名称'}
                                    rules={[
                                        { required: true, message: '请输入名称' },
                                        { max: 100, message: '名称最多100个字符' }
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
                                { pattern: /^\d{17}[\dXx]$/, message: '请输入正确的18位身份证号' }
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
                                        beforeUpload={(file) => {
                                            const isJpgOrPng = file.type === 'image/jpeg' || file.type === 'image/png';
                                            if (!isJpgOrPng) {
                                                message.error('只支持上传 JPG/PNG 格式的图片!');
                                                return Upload.LIST_IGNORE;
                                            }
                                            const isLt2M = file.size / 1024 / 1024 < 2;
                                            if (!isLt2M) {
                                                message.error('图片大小不能超过 2MB!');
                                                return Upload.LIST_IGNORE;
                                            }
                                            return false;
                                        }}
                                        onChange={() => {
                                            // 模拟上传，实际需要调用OSS上传
                                            form.setFieldsValue({
                                                idCardFront: 'https://placeholder.com/id_front.jpg'
                                            });
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
                                        beforeUpload={(file) => {
                                            const isJpgOrPng = file.type === 'image/jpeg' || file.type === 'image/png';
                                            if (!isJpgOrPng) {
                                                message.error('只支持上传 JPG/PNG 格式的图片!');
                                                return Upload.LIST_IGNORE;
                                            }
                                            const isLt2M = file.size / 1024 / 1024 < 2;
                                            if (!isLt2M) {
                                                message.error('图片大小不能超过 2MB!');
                                                return Upload.LIST_IGNORE;
                                            }
                                            return false;
                                        }}
                                        onChange={() => {
                                            form.setFieldsValue({
                                                idCardBack: 'https://placeholder.com/id_back.jpg'
                                            });
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
                        {applicantType === 'company' && (
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
                                        beforeUpload={(file) => {
                                            const isJpgOrPng = file.type === 'image/jpeg' || file.type === 'image/png';
                                            if (!isJpgOrPng) {
                                                message.error('只支持上传 JPG/PNG 格式的图片!');
                                                return Upload.LIST_IGNORE;
                                            }
                                            const isLt5M = file.size / 1024 / 1024 < 5;
                                            if (!isLt5M) {
                                                message.error('营业执照图片大小不能超过 5MB!');
                                                return Upload.LIST_IGNORE;
                                            }
                                            return false;
                                        }}
                                        onChange={() => {
                                            form.setFieldsValue({
                                                licenseImage: 'https://placeholder.com/license.jpg'
                                            });
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
                    </div>
                );

            case 2:
                return (
                    <div>
                        <Title level={5}>作品集 (至少3个)</Title>
                        {portfolioCases.map((caseItem, index) => (
                            <Card
                                key={index}
                                size="small"
                                title={`作品 ${index + 1}`}
                                style={{ marginBottom: 16 }}
                            >
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
                                        beforeUpload={(file) => {
                                            const isJpgOrPng = file.type === 'image/jpeg' || file.type === 'image/png';
                                            if (!isJpgOrPng) {
                                                message.error('只支持上传 JPG/PNG 格式的图片!');
                                                return Upload.LIST_IGNORE;
                                            }
                                            const isLt5M = file.size / 1024 / 1024 < 5;
                                            if (!isLt5M) {
                                                message.error('单张图片大小不能超过 5MB!');
                                                return Upload.LIST_IGNORE;
                                            }
                                            return false;
                                        }}
                                        onChange={(uploadInfo) => {
                                            // 模拟上传
                                            const urls = uploadInfo.fileList.map((_file, i) =>
                                                `https://placeholder.com/case_${index}_${i}.jpg`
                                            );
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
                            <Select
                                mode="multiple"
                                placeholder="选择可服务的区域"
                                style={{ width: '100%' }}
                            >
                                {areaOptions.map(area => (
                                    <Select.Option key={area} value={area}>{area}</Select.Option>
                                ))}
                            </Select>
                        </Form.Item>
                        <Form.Item
                            name="styles"
                            label="擅长风格"
                            rules={[{ required: true, message: '请选择擅长风格' }]}
                        >
                            <Select
                                mode="multiple"
                                placeholder="选择擅长的设计风格"
                                style={{ width: '100%' }}
                            >
                                {styleOptions.map(style => (
                                    <Select.Option key={style} value={style}>{style}</Select.Option>
                                ))}
                            </Select>
                        </Form.Item>
                        <Form.Item name="introduction" label="个人/公司简介">
                            <TextArea
                                rows={4}
                                placeholder="介绍您的设计理念、服务特色等（选填）"
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
                        <Button
                            type="link"
                            icon={<ArrowLeftOutlined />}
                            onClick={() => navigate('/')}
                            style={{ padding: 0 }}
                        >
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
                                <Button
                                    type="primary"
                                    loading={loading}
                                    onClick={handleSubmit}
                                    icon={<CheckOutlined />}
                                >
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
