import React, { useState } from 'react';
import { Card, Form, Input, Button, message, Layout, Typography } from 'antd';
import { LockOutlined, MobileOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../../services/api';

const { Content } = Layout;
const { Title } = Typography;

const Login: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const onFinish = async (values: any) => {
        setLoading(true);
        try {
            const res = await authApi.login({
                phone: values.phone,
                code: values.code
            }) as any;

            if (res.code === 0) {
                message.success('登录成功');
                localStorage.setItem('token', res.data.token);
                localStorage.setItem('user', JSON.stringify(res.data.user));
                navigate('/dashboard');
            } else {
                message.error(res.message || '登录失败');
            }
        } catch (error: any) {
            console.error(error);
            message.error(error.response?.data?.message || '登录异常');
        } finally {
            setLoading(false);
        }
    };

    const handleSendCode = async () => {
        message.success('验证码已发送: 123456');
    };

    return (
        <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
            <Content style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <Card style={{ width: 400, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                    <div style={{ textAlign: 'center', marginBottom: 24 }}>
                        <Title level={3}>装修平台管理后台</Title>
                    </div>
                    <Form
                        name="login_form"
                        initialValues={{ remember: true }}
                        onFinish={onFinish}
                        size="large"
                    >
                        <Form.Item
                            name="phone"
                            rules={[{ required: true, message: '请输入手机号' }]}
                        >
                            <Input prefix={<MobileOutlined />} placeholder="手机号 (任意)" />
                        </Form.Item>

                        <Form.Item
                            name="code"
                            rules={[{ required: true, message: '请输入验证码' }]}
                        >
                            <div style={{ display: 'flex', gap: 8 }}>
                                <Input prefix={<LockOutlined />} placeholder="验证码: 123456" />
                                <Button onClick={handleSendCode}>获取</Button>
                            </div>
                        </Form.Item>

                        <Form.Item>
                            <Button type="primary" htmlType="submit" block loading={loading}>
                                登录
                            </Button>
                        </Form.Item>
                    </Form>
                </Card>
            </Content>
        </Layout>
    );
};

export default Login;
