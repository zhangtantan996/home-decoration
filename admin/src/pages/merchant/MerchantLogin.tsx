import React, { useState, useRef, useEffect } from 'react';
import { Card, Form, Input, Button, message, Layout, Typography, Divider, Grid } from 'antd';
import { PhoneOutlined, SafetyOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { MerchantApiError, merchantAuthApi, type MerchantLoginGuideData, type MerchantLoginNextAction } from '../../services/merchantApi';
import { useMerchantAuthStore } from '../../stores/merchantAuthStore';
import { MERCHANT_THEME } from '../../constants/merchantTheme';

const { Content } = Layout;
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
        return () => {
            if (timerRef.current !== null) {
                clearInterval(timerRef.current);
            }
        };
    }, []);

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
        <Layout style={{ minHeight: '100vh', background: MERCHANT_THEME.pageBgGradient }}>
            <Content style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: screens.xs ? 16 : 24 }}>
                <Card 
                    style={{ width: MERCHANT_THEME.cardWidth, maxWidth: MERCHANT_THEME.cardMaxWidth, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', borderRadius: 12 }}
                    styles={{ body: { padding: screens.xs ? 24 : 32 } }}
                >
                    <div style={{ textAlign: 'center', marginBottom: screens.xs ? 24 : 32 }}>
                        <Title level={3} style={{ marginBottom: 8 }}>商家服务中心</Title>
                        <Text type="secondary">设计师/工长/装修公司/主材商统一登录</Text>
                    </div>
                    <Form
                        form={form}
                        name="merchant_login"
                        onFinish={onFinish}
                        size="large"
                        validateTrigger="onBlur"
                    >
                        <Form.Item
                            name="phone"
                            rules={phoneRules}
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
                            <Button type="link" onClick={() => navigate('/')}>
                                我要入驻
                            </Button>
                            <Divider type="vertical" />
                            <Button type="link" onClick={() => navigate('/apply-status')}>
                                查询审核进度
                            </Button>
                        </div>
                    </Form>
                </Card>
            </Content>
        </Layout>
    );
};

export default MerchantLogin;
