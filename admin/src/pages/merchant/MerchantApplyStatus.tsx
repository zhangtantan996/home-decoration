import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, Form, Input, Button, message, Layout, Typography, Result, Spin, Steps, Tag, Grid } from 'antd';
import { PhoneOutlined, ArrowLeftOutlined, ClockCircleOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    materialShopApplyApi,
    merchantApplyApi,
    type MaterialShopApplyStatusData,
    type MerchantApplyStatusData,
} from '../../services/merchantApi';
import { MERCHANT_THEME } from '../../constants/merchantTheme';

const { Content } = Layout;
const { Title, Text, Paragraph } = Typography;
const { useBreakpoint } = Grid;

const MerchantApplyStatus: React.FC = () => {
    const [searchParams] = useSearchParams();
    const phoneFromUrl = searchParams.get('phone') || '';
    const navigate = useNavigate();
    const screens = useBreakpoint();

    const [loading, setLoading] = useState(false);
    const [queried, setQueried] = useState(false);
    const [applicationStatus, setApplicationStatus] = useState<(MerchantApplyStatusData | MaterialShopApplyStatusData) | null>(null);
    const [form] = Form.useForm();
    const pollingTimerRef = useRef<number | null>(null);

    const handleQuery = useCallback(async (values: { phone: string }) => {
        setLoading(true);
        try {
            const [providerResult, materialResult] = await Promise.allSettled([
                merchantApplyApi.status(values.phone),
                materialShopApplyApi.status(values.phone),
            ]);

            if (providerResult.status === 'fulfilled') {
                setApplicationStatus(providerResult.value);
            } else if (materialResult.status === 'fulfilled') {
                setApplicationStatus(materialResult.value);
            } else {
                throw new Error('查询失败，请稍后重试');
            }
            setQueried(true);
        } catch (error: unknown) {
            const maybeAxiosError = error as { response?: { data?: { message?: string } }; message?: string };
            message.error(maybeAxiosError.response?.data?.message || maybeAxiosError.message || '查询失败，请稍后重试');
            setApplicationStatus(null);
            setQueried(true);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (phoneFromUrl) {
            form.setFieldsValue({ phone: phoneFromUrl });
            void handleQuery({ phone: phoneFromUrl });
        }
    }, [phoneFromUrl, form, handleQuery]);

    useEffect(() => {
        if (applicationStatus?.status === 0) {
            pollingTimerRef.current = window.setInterval(() => {
                const currentPhone = form.getFieldValue('phone') || phoneFromUrl;
                if (currentPhone) {
                    void handleQuery({ phone: currentPhone });
                }
            }, 30000);
        }

        return () => {
            if (pollingTimerRef.current !== null) {
                clearInterval(pollingTimerRef.current);
                pollingTimerRef.current = null;
            }
        };
    }, [applicationStatus?.status, form, phoneFromUrl, handleQuery]);

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
        const role = (applicationStatus as { role?: string }).role;
        const entityType = (applicationStatus as { entityType?: string }).entityType;
        const isMaterialShop = role === 'material_shop' || (applicationStatus as { merchantKind?: string }).merchantKind === 'material_shop';

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
                            description: auditedAt ? new Date(auditedAt).toLocaleString() : '',
                        },
                    ]}
                    style={{ marginBottom: 32 }}
                    direction={screens.xs ? 'vertical' : 'horizontal'}
                    size={screens.xs ? 'small' : 'default'}
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
                        extra={(
                            <Button type="primary" onClick={() => navigate('/login')}>
                                立即登录
                            </Button>
                        )}
                    />
                )}

                {status === 2 && (
                    <Result
                        status="error"
                        title="审核未通过"
                        subTitle={(
                            <div>
                                <Text>拒绝原因：</Text>
                                <Paragraph type="danger">{rejectReason || '未说明原因'}</Paragraph>
                            </div>
                        )}
                        extra={(
                            <Button
                                type="primary"
                                onClick={() => {
                                    const currentPhone = form.getFieldValue('phone') || phoneFromUrl || '';
                                    if (isMaterialShop) {
                                        navigate(`/material-shop/register?resubmit=${applicationStatus.applicationId}&phone=${encodeURIComponent(currentPhone)}`);
                                        return;
                                    }

                                    const providerStatus = applicationStatus as MerchantApplyStatusData;
                                    const targetRole = providerStatus.role || (
                                        providerStatus.applicantType === 'foreman'
                                            ? 'foreman'
                                            : providerStatus.applicantType === 'company'
                                                ? 'company'
                                                : providerStatus.applicantType === 'studio'
                                                    ? 'designer'
                                                    : providerStatus.applicantType === 'personal'
                                                        ? 'designer'
                                                        : 'designer'
                                    );
                                    const targetEntity = providerStatus.entityType || (
                                        providerStatus.applicantType === 'studio' || providerStatus.applicantType === 'company'
                                            ? 'company'
                                            : 'personal'
                                    );
                                    navigate(`/register?role=${targetRole}&entityType=${targetEntity}&resubmit=${providerStatus.applicationId}&phone=${encodeURIComponent(currentPhone)}`);
                                }}
                            >
                                修改后重新提交
                            </Button>
                        )}
                    />
                )}

                <div style={{ textAlign: 'center', marginTop: 8 }}>
                    <Text type="secondary">
                        当前申请类型：{isMaterialShop ? '主材商' : `${role === 'company' ? '装修公司' : role === 'foreman' ? '工长' : '设计师'}${entityType ? ` · ${entityType === 'company' ? '公司主体' : '个人主体'}` : ''}`}
                    </Text>
                </div>
            </Card>
        );
    };

    return (
        <Layout style={{ minHeight: '100vh', background: MERCHANT_THEME.pageBgGradient }}>
            <Content style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'flex-start',
                padding: screens.xs ? 16 : 24,
                paddingTop: screens.xs ? 24 : 48,
            }}>
                <Card 
                    style={{ width: '100%', maxWidth: 600, borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                    styles={{ body: { padding: screens.xs ? 16 : 24 } }}
                >
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
                                { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号' },
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
                            extra={(
                                <Button type="primary" onClick={() => navigate('/')}>
                                    立即申请入驻
                                </Button>
                            )}
                        />
                    )}
                </Card>
            </Content>
        </Layout>
    );
};

export default MerchantApplyStatus;
