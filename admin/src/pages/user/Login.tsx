import React, { useState } from 'react';
import { Card, Form, Input, Button, message, Layout, Typography } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { adminAuthApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import type { AdminUser, MenuItem } from '../../stores/authStore';

const { Content } = Layout;
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
                navigate('/dashboard');
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
        <Layout style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
            <Content style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <Card style={{ width: 400, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', borderRadius: 12 }}>
                    <div style={{ textAlign: 'center', marginBottom: 32 }}>
                        <Title level={3} style={{ marginBottom: 8 }}>装修平台管理后台</Title>
                        <Text type="secondary">RBAC 权限管理系统</Text>
                    </div>
                    <Form
                        name="admin_login"
                        initialValues={{ username: '', password: '' }}
                        onFinish={onFinish}
                        size="large"
                    >
                        <Form.Item
                            name="username"
                            rules={[{ required: true, message: '请输入用户名' }]}
                        >
                            <Input
                                prefix={<UserOutlined />}
                                placeholder="用户名"
                                autoComplete="username"
                            />
                        </Form.Item>

                        <Form.Item
                            name="password"
                            rules={[{ required: true, message: '请输入密码' }]}
                        >
                            <Input.Password
                                prefix={<LockOutlined />}
                                placeholder="密码"
                                autoComplete="current-password"
                            />
                        </Form.Item>

                        <Form.Item>
                            <Button type="primary" htmlType="submit" block loading={loading}>
                                登 录
                            </Button>
                        </Form.Item>
                    </Form>
                </Card>
            </Content>
        </Layout>
    );
};

export default Login;
