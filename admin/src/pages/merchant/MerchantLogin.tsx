import React, { useState } from 'react';
import { Card, Form, Input, Button, message, Layout, Typography, Divider } from 'antd';
import { PhoneOutlined, SafetyOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { merchantAuthApi } from '../../services/merchantApi';

const { Content } = Layout;
const { Title, Text } = Typography;

const MerchantLogin: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [sendingCode, setSendingCode] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const navigate = useNavigate();
    const [form] = Form.useForm();

    // 手机号校验规则
    const phoneRules = [
        { required: true, message: '请输入手机号' },
        { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的11位手机号' },
    ];

    // 验证码校验规则
    const codeRules = [
        { required: true, message: '请输入验证码' },
        { pattern: /^\d{6}$/, message: '请输入6位数字验证码' },
    ];

    // 只允许输入数字
    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.replace(/\D/g, '').slice(0, 11);
        form.setFieldsValue({ phone: value });
    };

    const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.replace(/\D/g, '').slice(0, 6);
        form.setFieldsValue({ code: value });
    };

    const handleSendCode = async () => {
        // 先触发手机号校验
        try {
            await form.validateFields(['phone']);
        } catch {
            return;
        }

        const phone = form.getFieldValue('phone');
        setSendingCode(true);
        try {
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
        } catch (error: unknown) {
            const maybeAxiosError = error as { response?: { data?: { message?: string } }; message?: string };
            message.error(maybeAxiosError.response?.data?.message || maybeAxiosError.message || '发送失败');
        } finally {
            setSendingCode(false);
        }
    };

    const onFinish = async (values: { phone: string; code: string }) => {
        setLoading(true);
        try {
            const data = await merchantAuthApi.login(values);
            const { token, provider, tinodeToken } = data;
            localStorage.setItem('merchant_token', token);
            localStorage.setItem('merchant_provider', JSON.stringify(provider));
            if (tinodeToken) {
                localStorage.setItem('merchant_tinode_token', tinodeToken);
            } else {
                localStorage.removeItem('merchant_tinode_token');
            }
            message.success('登录成功');
            navigate('/dashboard');
        } catch (error: unknown) {
            const maybeAxiosError = error as { response?: { data?: { message?: string } }; message?: string };
            message.error(maybeAxiosError.response?.data?.message || maybeAxiosError.message || '登录失败');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)' }}>
            <Content style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <Card style={{ width: 420, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', borderRadius: 12 }}>
                    <div style={{ textAlign: 'center', marginBottom: 32 }}>
                        <Title level={3} style={{ marginBottom: 8 }}>商家服务中心</Title>
                        <Text type="secondary">独立设计师/设计工作室/工长/装修公司登录</Text>
                    </div>
                    <Form
                        form={form}
                        name="merchant_login"
                        onFinish={onFinish}
                        size="large"
                        validateTrigger={['onBlur', 'onChange']}
                    >
                        <Form.Item
                            name="phone"
                            rules={phoneRules}
                            validateTrigger={['onBlur', 'onChange']}
                        >
                            <Input
                                prefix={<PhoneOutlined />}
                                placeholder="请输入11位手机号"
                                maxLength={11}
                                onChange={handlePhoneChange}
                                inputMode="numeric"
                            />
                        </Form.Item>

                        <Form.Item
                            name="code"
                            rules={codeRules}
                            validateTrigger={['onBlur', 'onChange']}
                        >
                            <Input
                                prefix={<SafetyOutlined />}
                                placeholder="请输入6位验证码"
                                maxLength={6}
                                onChange={handleCodeChange}
                                inputMode="numeric"
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

                        <Form.Item>
                            <Button type="primary" htmlType="submit" block loading={loading}>
                                登 录
                            </Button>
                        </Form.Item>

                        <div style={{ textAlign: 'center', marginTop: 16 }}>
                            <Button type="link" onClick={() => navigate('/register?type=personal')}>
                                独立设计师入驻
                            </Button>
                            <Divider type="vertical" />
                            <Button type="link" onClick={() => navigate('/register?type=studio')}>
                                设计工作室入驻
                            </Button>
                            <Divider type="vertical" />
                            <Button type="link" onClick={() => navigate('/register?type=company')}>
                                装修公司入驻
                            </Button>
                            <Divider type="vertical" />
                            <Button type="link" onClick={() => navigate('/register?type=foreman')}>
                                工长入驻
                            </Button>
                        </div>
                    </Form>
                </Card>
            </Content>
        </Layout>
    );
};

export default MerchantLogin;
