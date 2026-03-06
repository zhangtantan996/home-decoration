import React, { useState, useRef, useEffect } from 'react';
import { Form, Input, Button, message, Layout, Typography, Divider, Grid } from 'antd';
import { PhoneOutlined, SafetyOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { MerchantApiError, merchantAuthApi, type MerchantLoginGuideData, type MerchantLoginNextAction } from '../../services/merchantApi';
import { useMerchantAuthStore } from '../../stores/merchantAuthStore';
import merchantAppIcon from '../../assets/branding/company-logo.png';
import { MERCHANT_THEME } from '../../constants/merchantTheme';

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

const MerchantLogin: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [sendingCode, setSendingCode] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const timerRef = useRef<number | null>(null);
    const navigate = useNavigate();
    const screens = useBreakpoint();
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

    useEffect(() => {
        // Init inject style for animated elements and custom ant overrides
        const style = document.createElement('style');
        style.innerHTML = `
            .premium-login-btn {
                background: ${MERCHANT_THEME.primaryGradient};
                border: none;
                height: ${MERCHANT_THEME.controlHeight}px;
                font-size: 16px;
                font-weight: 500;
                box-shadow: 0 4px 14px rgba(24, 144, 255, 0.3);
                transition: all 0.3s ease;
                border-radius: ${MERCHANT_THEME.controlRadius}px;
            }
            .premium-login-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(24, 144, 255, 0.4);
            }
            .premium-input .ant-input-affix-wrapper {
                padding: 12px 16px;
                border-radius: ${MERCHANT_THEME.controlRadius}px;
                border-color: ${MERCHANT_THEME.borderColor};
                transition: all 0.3s ease;
            }
            .premium-input .ant-input-affix-wrapper:hover,
            .premium-input .ant-input-affix-wrapper-focused {
                border-color: ${MERCHANT_THEME.primaryColor};
                box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.1);
            }
            .welcome-fade-in {
                animation: fadeInUp 0.8s ease-out;
            }
            @keyframes fadeInUp {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }
        `;
        document.head.appendChild(style);
        return () => {
            if (timerRef.current !== null) {
                clearInterval(timerRef.current);
            }
            document.head.removeChild(style);
        };
    }, []);

    const handleSendCode = async () => {
        try {
            await form.validateFields(['phone']);
        } catch {
            return;
        }

        const phone = form.getFieldValue('phone');
        setSendingCode(true);
        try {
            const res = await merchantAuthApi.sendCode(phone, 'login');
            if (import.meta.env.DEV && res?.debugCode) {
                console.debug(`[DEV] 验证码: ${res.debugCode}`);
            }
            message.success('验证码已发送');
            setCountdown(60);
            if (timerRef.current !== null) {
                clearInterval(timerRef.current);
            }
            timerRef.current = window.setInterval(() => {
                setCountdown((prev) => {
                    if (prev <= 1) {
                        if (timerRef.current !== null) {
                            clearInterval(timerRef.current);
                            timerRef.current = null;
                        }
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } catch (error: unknown) {
            if (error instanceof MerchantApiError) {
                message.error(error.message || '发送失败');
                return;
            }
            if (axios.isAxiosError(error)) {
                message.error(error.response?.data?.message || error.message || '发送失败');
                return;
            }
            message.error('发送失败');
        } finally {
            setSendingCode(false);
        }
    };

    const handleLoginGuide = (phone: string, nextAction: MerchantLoginNextAction, guide?: MerchantLoginGuideData['applyStatus']) => {
        if (nextAction === 'PENDING') {
            message.warning('入驻申请审核中，正在跳转审核进度页', 1.2);
            navigate(`/apply-status?phone=${encodeURIComponent(phone)}&from=login_pending`);
            return;
        }

        if (nextAction === 'RESUBMIT') {
            message.warning('入驻申请被驳回，正在跳转重提页面', 1.2);
            const applicationId = guide?.applicationId;
            if (guide?.kind === 'material_shop') {
                navigate(`/material-shop/register?from=login_resubmit&phone=${encodeURIComponent(phone)}${applicationId ? `&resubmit=${applicationId}` : ''}`);
                return;
            }
            const role = guide?.role || 'designer';
            const entityType = guide?.entityType || (
                guide?.applicantType === 'studio' || guide?.applicantType === 'company'
                    ? 'company'
                    : 'personal'
            );
            navigate(`/register?from=login_resubmit&phone=${encodeURIComponent(phone)}&role=${role}&entityType=${entityType}${applicationId ? `&resubmit=${applicationId}` : ''}`);
            return;
        }

        if (nextAction === 'CHANGE_ROLE') {
            message.warning('当前账号已入驻其他商家身份，请提交角色变更申请', 1.6);
            return;
        }

        message.warning('该手机号尚未入驻，正在为你跳转入驻页', 1.2);
        navigate(`/register?from=login_unregistered&phone=${encodeURIComponent(phone)}`);
    };

    const onFinish = async (values: { phone: string; code: string }) => {
        setLoading(true);
        try {
            const data = await merchantAuthApi.login(values);
            const { token, provider, tinodeToken, merchantKind } = data;
            useMerchantAuthStore.getState().login({ token, provider, tinodeToken });
            message.success('登录成功');
            if (merchantKind === 'material_shop' || provider?.merchantKind === 'material_shop') {
                navigate('/material-shop/settings');
            } else {
                navigate('/dashboard');
            }
        } catch (error: unknown) {
            if (error instanceof MerchantApiError) {
                const guideData = error.data as MerchantLoginGuideData | undefined;
                if (error.code === 409 && guideData?.nextAction) {
                    handleLoginGuide(values.phone, guideData.nextAction, guideData.applyStatus);
                    return;
                }
                message.error(error.message || '登录失败');
                return;
            }

            if (axios.isAxiosError(error)) {
                message.error(error.response?.data?.message || error.message || '登录失败');
                return;
            }
            message.error('登录失败');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout style={{ minHeight: '100vh', flexDirection: 'row', background: '#f8fafc' }}>
            {/* Left Panel - Image & Branding (hidden on mobile) */}
            {screens.md && (
                <div style={{
                    flex: 1,
                    background: 'url("https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?q=80&w=2000&auto=format&fit=crop") center/cover no-repeat',
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '60px',
                    overflow: 'hidden'
                }}>
                    <div style={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                        background: 'linear-gradient(135deg, rgba(24,144,255,0.7) 0%, rgba(9,109,217,0.4) 100%)',
                        mixBlendMode: 'multiply'
                    }} />
                    <div style={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                        background: 'linear-gradient(to right, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.1) 100%)'
                    }} />

                    <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
                        <img
                            src={merchantAppIcon}
                            alt="禾泽云"
                            style={{
                                width: 44,
                                height: 44,
                                borderRadius: 12,
                                boxShadow: '0 10px 24px rgba(0,0,0,0.18)'
                            }}
                        />
                        <Title level={4} style={{ margin: 0, color: '#fff', letterSpacing: '1px' }}>禾泽云商家中心</Title>
                    </div>

                    <div className="welcome-fade-in" style={{ position: 'relative', zIndex: 1, color: '#fff', maxWidth: 540 }}>
                        <Title style={{ color: '#fff', fontSize: '3.5rem', fontWeight: 700, marginBottom: '24px', letterSpacing: '-1px', lineHeight: 1.2 }}>
                            共筑家的<br /><span style={{ color: '#69b1ff' }}>无限可能</span>
                        </Title>
                        <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: '1.25rem', lineHeight: 1.6, display: 'block' }}>
                            禾泽云商家服务中心，连接优质设计师与可靠施工团队。在这里，发现更多客户，提升品牌价值。
                        </Text>
                    </div>

                    <div style={{ position: 'relative', zIndex: 1 }}>
                        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem' }}>
                            © {new Date().getFullYear()} 禾泽云 Hezeyun. 保留所有权利.
                        </Text>
                    </div>
                </div>
            )}

            {/* Right Panel - Login Form */}
            <div style={{
                width: screens.md ? '520px' : '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                background: '#ffffff',
                padding: screens.xs ? '32px 24px' : '64px',
                boxShadow: screens.md ? '-20px 0 40px rgba(0,0,0,0.08)' : 'none',
                zIndex: 2,
                position: 'relative'
            }}>
                <div className="welcome-fade-in" style={{ maxWidth: '380px', width: '100%', margin: '0 auto' }}>
                    <div style={{ marginBottom: '40px' }}>
                        {!screens.md && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
                                <img
                                    src={merchantAppIcon}
                                    alt="禾泽云"
                                    style={{ width: 32, height: 32, borderRadius: 9, boxShadow: '0 8px 18px rgba(24,144,255,0.18)' }}
                                />
                                <Text strong style={{ fontSize: 18, color: '#1a1a1a' }}>禾泽云商家中心</Text>
                            </div>
                        )}
                        <Title level={2} style={{ fontWeight: 600, marginBottom: '8px', color: '#1a1a1a' }}>欢迎回来</Title>
                        <Text style={{ color: '#64748b', fontSize: '1rem' }}>登录商家服务中心，追踪您的业务动态</Text>
                    </div>

                    <Form
                        form={form}
                        name="merchant_login"
                        onFinish={onFinish}
                        size="large"
                        validateTrigger="onBlur"
                        className="premium-input"
                    >
                        <Form.Item
                            name="phone"
                            rules={phoneRules}
                            style={{ marginBottom: 24 }}
                        >
                            <Input
                                prefix={<PhoneOutlined style={{ color: '#94a3b8', marginRight: 8 }} />}
                                placeholder="输入您的11位手机号"
                                maxLength={11}
                                onChange={handlePhoneChange}
                                inputMode="numeric"
                            />
                        </Form.Item>

                        <Form.Item
                            name="code"
                            rules={codeRules}
                            style={{ marginBottom: 32 }}
                        >
                            <Input
                                prefix={<SafetyOutlined style={{ color: '#94a3b8', marginRight: 8 }} />}
                                placeholder="输入6位验证码"
                                maxLength={6}
                                onChange={handleCodeChange}
                                inputMode="numeric"
                                suffix={(
                                    <Button
                                        type="text"
                                        size="small"
                                        disabled={countdown > 0 || sendingCode}
                                        onClick={handleSendCode}
                                        loading={sendingCode}
                                        style={{ color: countdown > 0 ? '#94a3b8' : '#1890ff', fontWeight: 500 }}
                                    >
                                        {countdown > 0 ? `${countdown}s 后重新获取` : '获取验证码'}
                                    </Button>
                                )}
                            />
                        </Form.Item>

                        <Form.Item>
                            <Button
                                type="primary"
                                htmlType="submit"
                                block
                                loading={loading}
                                className="premium-login-btn"
                                icon={<ArrowRightOutlined />}
                                iconPosition="end"
                            >
                                立即登录
                            </Button>
                        </Form.Item>

                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginTop: 32,
                            padding: '16px',
                            background: '#f8fafc',
                            borderRadius: '8px'
                        }}>
                            <Text style={{ color: '#64748b', marginRight: 8 }}>还没有账号极速入驻？</Text>
                            <Button
                                type="link"
                                onClick={() => navigate('/')}
                                style={{ padding: 0, fontWeight: 500 }}
                            >
                                免费入驻
                            </Button>
                            <Divider type="vertical" style={{ margin: '0 12px' }} />
                            <Button
                                type="link"
                                onClick={() => navigate('/apply-status')}
                                style={{ padding: 0, color: '#64748b' }}
                            >
                                审核进度查询
                            </Button>
                        </div>
                    </Form>
                </div>
            </div>
        </Layout>
    );
};

export default MerchantLogin;
