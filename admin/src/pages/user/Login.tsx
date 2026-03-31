import React, { useState } from 'react';
import { Card, Form, Input, Button, Checkbox, message, Typography } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { adminAuthApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import type { AdminUser, MenuItem } from '../../stores/authStore';
import merchantAppIcon from '../../assets/branding/company-logo.png';
import { designTokens } from '../../styles/theme';

const { Title, Text } = Typography;

interface AdminLoginResponse {
    code: number;
    message?: string;
    data?: {
        token: string;
        admin: AdminUser;
        permissions?: string[];
        menus?: MenuItem[];
    };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

const parseAdminLoginResponse = (payload: unknown): AdminLoginResponse | null => {
    if (!isRecord(payload)) {
        return null;
    }
    const code = payload.code;
    if (typeof code !== 'number') {
        return null;
    }
    return {
        code,
        message: typeof payload.message === 'string' ? payload.message : undefined,
        data: isRecord(payload.data) ? (payload.data as AdminLoginResponse['data']) : undefined,
    };
};

const isDynamicDetailPath = (path?: string) =>
    typeof path === 'string' && /\/:[^/]+/.test(path);

const pickAdminLandingPath = (menus: MenuItem[] = []) => {
    const preferPath = '/supervision/projects';
    const queue = [...menus];

    while (queue.length > 0) {
        const current = queue.shift();
        if (!current) continue;
        if (current.path === preferPath && !isDynamicDetailPath(current.path)) {
            return preferPath;
        }
        if (Array.isArray(current.children) && current.children.length > 0) {
            queue.unshift(...current.children);
        }
    }

    queue.push(...menus);
    while (queue.length > 0) {
        const current = queue.shift();
        if (!current) continue;
        if (current.path && current.type === 2 && !isDynamicDetailPath(current.path)) {
            return current.path;
        }
        if (Array.isArray(current.children) && current.children.length > 0) {
            queue.unshift(...current.children);
        }
    }

    return '/dashboard';
};

const Login: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { login, setPermissions } = useAuthStore();

    const onFinish = async (values: { username: string; password: string }) => {
        setLoading(true);
        try {
            // 1. 登录获取 token
            const rawResponse: unknown = await adminAuthApi.login({
                username: values.username,
                password: values.password
            });
            const loginRes = parseAdminLoginResponse(rawResponse);

            if (!loginRes) {
                message.error('登录响应格式异常');
                return;
            }

            if (loginRes.code === 0 && loginRes.data) {
                const { token, admin, permissions, menus } = loginRes.data;

                // 保存 token 和用户信息
                login(token, admin);

                // 保存权限和菜单 (登录接口已返回)
                if (permissions && menus) {
                    setPermissions(permissions, menus);
                }

                message.success('登录成功');
                navigate(pickAdminLandingPath(menus || []));
            } else {
                message.error(loginRes.message || '登录失败');
            }
        } catch (error: unknown) {
            const statusCode = (error as { response?: { status?: number } })?.response?.status;
            if (statusCode === 401 || statusCode === 403) {
                message.error('用户名或密码错误');
            } else {
                message.error('登录失败，请稍后重试');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="hz-login">
            <section className="hz-login__brand">
                <div className="hz-login__grid" />
                <div className="hz-login__brand-inner">
                    <div className="hz-login__logo">
                        <img src={merchantAppIcon} alt="禾泽云" />
                    </div>
                    <Title level={1} className="hz-login__brand-title" style={{ color: '#fff', margin: 0 }}>
                        禾泽云管理后台
                    </Title>
                    <Text className="hz-login__brand-subtitle">
                        家装设计一体化平台管理系统，统一管理用户、服务商、项目、审核与财务流程。
                    </Text>
                    <div className="hz-login__stats">
                        <div>
                            <div className="hz-login__stat-value">统一鉴权</div>
                            <div className="hz-login__stat-label">管理员登录与权限控制</div>
                        </div>
                        <div>
                            <div className="hz-login__stat-value">统一审核</div>
                            <div className="hz-login__stat-label">入驻、身份与案例审核</div>
                        </div>
                        <div>
                            <div className="hz-login__stat-value">统一运营</div>
                            <div className="hz-login__stat-label">项目、财务与风险处理入口</div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="hz-login__form">
                <Card className="hz-login__form-card" bordered={false}>
                    <div className="hz-login__form-header">
                        <div className="hz-login__swatches" aria-hidden="true">
                            <span className="hz-login__swatch" style={{ background: '#2563eb' }} />
                            <span className="hz-login__swatch" style={{ background: '#8b6b4a' }} />
                            <span className="hz-login__swatch" style={{ background: '#94a3b8' }} />
                        </div>
                        <Title level={2} className="hz-login__form-title" style={{ margin: 0 }}>
                            欢迎回来
                        </Title>
                        <Text className="hz-login__form-subtitle">请使用管理员账号登录</Text>
                    </div>

                    <Form
                        name="admin_login"
                        initialValues={{ username: '', password: '', remember: false }}
                        onFinish={onFinish}
                        size="large"
                        layout="vertical"
                    >
                        <Form.Item
                            name="username"
                            label="用户名"
                            rules={[{ required: true, message: '请输入用户名' }]}
                        >
                            <Input
                                prefix={<UserOutlined />}
                                placeholder="请输入用户名"
                                autoComplete="username"
                            />
                        </Form.Item>

                        <Form.Item
                            name="password"
                            label="密码"
                            rules={[{ required: true, message: '请输入密码' }]}
                        >
                            <Input.Password
                                prefix={<LockOutlined />}
                                placeholder="请输入密码"
                                autoComplete="current-password"
                            />
                        </Form.Item>

                        <Form.Item style={{ marginBottom: 18 }}>
                            <div className="hz-login__meta-row">
                                <Form.Item name="remember" valuePropName="checked" noStyle>
                                    <Checkbox>记住登录状态</Checkbox>
                                </Form.Item>
                                <a className="hz-login__meta-link" href="#" onClick={(event) => event.preventDefault()}>
                                    忘记密码?
                                </a>
                            </div>
                        </Form.Item>

                        <Form.Item style={{ marginBottom: 0 }}>
                            <Button
                                type="primary"
                                htmlType="submit"
                                block
                                loading={loading}
                                style={{
                                    height: 48,
                                    borderRadius: designTokens.radiusSm,
                                    fontWeight: 700,
                                }}
                            >
                                登 录
                            </Button>
                        </Form.Item>
                    </Form>

                    <div className="hz-login__footer">
                        © 2026 禾泽云科技 · 家装设计一体化平台
                    </div>
                </Card>
            </section>
        </div>
    );
};

export default Login;
