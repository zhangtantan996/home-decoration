import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, message, Layout, Typography, Result, Spin, Steps, Tag } from 'antd';
import { PhoneOutlined, ArrowLeftOutlined, ClockCircleOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';

const { Content } = Layout;
const { Title, Text, Paragraph } = Typography;

interface ApplicationStatus {
    applicationId: number;
    status: number;
    statusText: string;
    rejectReason?: string;
    createdAt: string;
    auditedAt?: string;
}

const MerchantApplyStatus: React.FC = () => {
    const [searchParams] = useSearchParams();
    const phoneFromUrl = searchParams.get('phone') || '';
    const navigate = useNavigate();

    const [loading, setLoading] = useState(false);
    const [queried, setQueried] = useState(false);
    const [applicationStatus, setApplicationStatus] = useState<ApplicationStatus | null>(null);
    const [form] = Form.useForm();

    useEffect(() => {
        if (phoneFromUrl) {
            form.setFieldsValue({ phone: phoneFromUrl });
            handleQuery({ phone: phoneFromUrl });
        }
    }, [phoneFromUrl]);

    const handleQuery = async (values: { phone: string }) => {
        setLoading(true);
        try {
            const response = await fetch(`/api/v1/merchant/apply/${values.phone}/status`);
            const result = await response.json();

            if (result.code === 0) {
                setApplicationStatus(result.data);
                setQueried(true);
            } else {
                message.error(result.message || '查询失败');
                setApplicationStatus(null);
            }
        } catch (error) {
            message.error('查询失败，请稍后重试');
        } finally {
            setLoading(false);
        }
    };

    const getStatusIcon = (status: number) => {
        switch (status) {
            case 0:
                return <ClockCircleOutlined style={{ color: '#faad14', fontSize: 48 }} />;
            case 1:
                return <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 48 }} />;
            case 2:
                return <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 48 }} />;
            default:
                return null;
        }
    };

    const getStatusTag = (status: number) => {
        switch (status) {
            case 0:
                return <Tag color="processing" icon={<ClockCircleOutlined />}>审核中</Tag>;
            case 1:
                return <Tag color="success" icon={<CheckCircleOutlined />}>审核通过</Tag>;
            case 2:
                return <Tag color="error" icon={<CloseCircleOutlined />}>审核拒绝</Tag>;
            default:
                return null;
        }
    };

    const renderStatusResult = () => {
        if (!applicationStatus) return null;

        const { status, statusText, rejectReason, createdAt, auditedAt } = applicationStatus;

        return (
            <Card style={{ marginTop: 24 }}>
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    {getStatusIcon(status)}
                    <Title level={4} style={{ marginTop: 16, marginBottom: 8 }}>
                        {statusText}
                    </Title>
                    {getStatusTag(status)}
                </div>

                <Steps
                    current={status === 0 ? 1 : 2}
                    status={status === 2 ? 'error' : undefined}
                    items={[
                        { title: '提交申请', description: createdAt ? new Date(createdAt).toLocaleString() : '' },
                        { title: '平台审核', description: status === 0 ? '审核中...' : '' },
                        {
                            title: status === 2 ? '审核拒绝' : '审核通过',
                            description: auditedAt ? new Date(auditedAt).toLocaleString() : ''
                        },
                    ]}
                    style={{ marginBottom: 24 }}
                />

                {status === 0 && (
                    <Result
                        status="info"
                        title="申请审核中"
                        subTitle="预计1-3个工作日内完成审核，请耐心等待"
                    />
                )}

                {status === 1 && (
                    <Result
                        status="success"
                        title="恭喜！审核已通过"
                        subTitle="您可以使用手机号登录商家中心"
                        extra={
                            <Button type="primary" onClick={() => navigate('/login')}>
                                立即登录
                            </Button>
                        }
                    />
                )}

                {status === 2 && (
                    <Result
                        status="error"
                        title="审核未通过"
                        subTitle={
                            <div>
                                <Text>拒绝原因：</Text>
                                <Paragraph type="danger">{rejectReason || '未说明原因'}</Paragraph>
                            </div>
                        }
                        extra={
                            <Button
                                type="primary"
                                onClick={() => navigate(`/register?type=personal&resubmit=${applicationStatus.applicationId}`)}
                            >
                                修改后重新提交
                            </Button>
                        }
                    />
                )}
            </Card>
        );
    };

    return (
        <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
            <Content style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'flex-start',
                padding: 24,
                paddingTop: 48,
            }}>
                <Card style={{ width: '100%', maxWidth: 600 }}>
                    <div style={{ marginBottom: 24 }}>
                        <Button
                            type="link"
                            icon={<ArrowLeftOutlined />}
                            onClick={() => navigate('/')}
                            style={{ padding: 0 }}
                        >
                            返回
                        </Button>
                        <Title level={4} style={{ marginTop: 8, marginBottom: 0 }}>
                            查询审核进度
                        </Title>
                        <Text type="secondary">输入申请时使用的手机号查询</Text>
                    </div>

                    <Form form={form} onFinish={handleQuery} layout="vertical">
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
                                placeholder="请输入申请时使用的手机号"
                                maxLength={11}
                                size="large"
                            />
                        </Form.Item>
                        <Form.Item>
                            <Button
                                type="primary"
                                htmlType="submit"
                                block
                                size="large"
                                loading={loading}
                            >
                                查询审核状态
                            </Button>
                        </Form.Item>
                    </Form>

                    {loading && (
                        <div style={{ textAlign: 'center', padding: 48 }}>
                            <Spin size="large" />
                        </div>
                    )}

                    {queried && !loading && renderStatusResult()}

                    {queried && !loading && !applicationStatus && (
                        <Result
                            status="404"
                            title="未找到申请记录"
                            subTitle="请确认手机号是否正确，或者您尚未提交入驻申请"
                            extra={
                                <Button type="primary" onClick={() => navigate('/')}>
                                    立即申请入驻
                                </Button>
                            }
                        />
                    )}
                </Card>
            </Content>
        </Layout>
    );
};

export default MerchantApplyStatus;
