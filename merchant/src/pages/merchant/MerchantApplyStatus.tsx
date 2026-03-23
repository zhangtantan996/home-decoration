import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Alert, Form, Input, Button, message, Layout, Typography, Result, Spin, Steps, Tag, Grid } from 'antd';
import { PhoneOutlined, ArrowLeftOutlined, ClockCircleOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    materialShopApplyApi,
    merchantApplyApi,
    type MaterialShopApplyStatusData,
    type MerchantApplyStatusData,
} from '../../services/merchantApi';
import { formatServerDateTime } from '../../utils/serverTime';

const { Content } = Layout;
const { Title, Text, Paragraph } = Typography;
const { useBreakpoint } = Grid;

const MerchantApplyStatus: React.FC = () => {
    const [searchParams] = useSearchParams();
    const phoneFromUrl = searchParams.get('phone') || '';
    const source = searchParams.get('from') || '';
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
                return <ClockCircleOutlined style={{ color: '#faad14', fontSize: 64 }} />;
            case 1:
                return <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 64 }} />;
            case 2:
                return <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 64 }} />;
            default:
                return null;
        }
    };

    const getStatusTag = (status: number) => {
        switch (status) {
            case 0:
                return <Tag color="processing" icon={<ClockCircleOutlined />} style={{ padding: '4px 12px', fontSize: 14, borderRadius: 16 }}>审核中</Tag>;
            case 1:
                return <Tag color="success" icon={<CheckCircleOutlined />} style={{ padding: '4px 12px', fontSize: 14, borderRadius: 16 }}>审核通过</Tag>;
            case 2:
                return <Tag color="error" icon={<CloseCircleOutlined />} style={{ padding: '4px 12px', fontSize: 14, borderRadius: 16 }}>审核拒绝</Tag>;
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
            <div style={{
                marginTop: 32,
                padding: '32px 24px',
                background: '#f8fafc',
                borderRadius: 16,
                border: '1px solid #f1f5f9'
            }}>
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <div style={{ marginBottom: 16 }}>
                        {getStatusIcon(status)}
                    </div>
                    <Title level={3} style={{ marginTop: 0, marginBottom: 16, color: '#1a1a1a' }}>
                        {statusText}
                    </Title>
                    {getStatusTag(status)}
                </div>

                <Steps
                    current={status === 0 ? 1 : 2}
                    status={status === 2 ? 'error' : undefined}
                    items={[
                        { title: '提交申请', description: createdAt ? formatServerDateTime(createdAt, '') : '' },
                        { title: '平台审核', description: status === 0 ? '审核中...' : '' },
                        {
                            title: status === 2 ? '审核拒绝' : '审核通过',
                            description: auditedAt ? formatServerDateTime(auditedAt, '') : '',
                        },
                    ]}
                    style={{ marginBottom: 40 }}
                    direction={screens.xs ? 'vertical' : 'horizontal'}
                    size={screens.xs ? 'small' : 'default'}
                    aria-label="审核流程步骤"
                />

                {status === 0 && (
                    <Result
                        status="info"
                        title="申请正在加急审核中"
                        subTitle="预计1-3个工作日内完成审核，请耐心等待。审核结果也将通过短信通知您。"
                        style={{ padding: 0 }}
                    />
                )}

                {status === 1 && (
                    <Result
                        status="success"
                        title={<span style={{ fontWeight: 600 }}>恭喜！审核已通过</span>}
                        subTitle="您现在可以使用手机号直接登录商家中心，开始您的业务之旅"
                        style={{ padding: 0 }}
                        extra={(
                            <Button
                                type="primary"
                                size="large"
                                onClick={() => navigate('/login')}
                                aria-label="前往登录商家中心"
                                style={{
                                    background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
                                    padding: '0 40px',
                                    height: 48,
                                    borderRadius: 8,
                                    boxShadow: '0 4px 14px rgba(24, 144, 255, 0.3)'
                                }}
                            >
                                立即登录商家中心
                            </Button>
                        )}
                    />
                )}

                {status === 2 && (
                    <Result
                        status="error"
                        title={<span style={{ fontWeight: 600 }}>本次申请未通过，可按原商家子类型重新提交</span>}
                        subTitle={(
                            <div style={{ marginTop: 16, background: '#fff1f0', padding: 16, borderRadius: 8, border: '1px solid #ffa39e' }}>
                                <Text style={{ color: '#cf1322', fontWeight: 500 }}>拒绝原因：</Text>
                                <Paragraph style={{ color: '#cf1322', margin: 0, marginTop: 8 }}>{rejectReason || '未说明原因'}</Paragraph>
                            </div>
                        )}
                        style={{ padding: 0 }}
                        extra={(
                            <>
                                <Alert
                                    type="warning"
                                    showIcon
                                    style={{ marginBottom: 16, textAlign: 'left', borderRadius: 8 }}
                                    message="驳回后支持按原申请类型重提，当前不支持直接切换为其他商家子类型。若需其他类型，请返回首页重新申请新商家类型。"
                                />
                                <Button
                                type="primary"
                                size="large"
                                data-testid="merchant-apply-status-resubmit-button"
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
                                aria-label="修改申请信息后重新提交"
                                style={{
                                    background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
                                    padding: '0 40px',
                                    height: 48,
                                    borderRadius: 8,
                                }}
                            >
                                按原类型修改信息后重新提交
                            </Button>
                            </>
                        )}
                    />
                )}

                <div style={{ textAlign: 'center', marginTop: 32, paddingTop: 24, borderTop: '1px dashed #e2e8f0' }}>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                        申请类型记录：{isMaterialShop ? '主材商' : `${role === 'company' ? '装修公司' : role === 'foreman' ? '工长' : '设计师'}${entityType ? ` · ${entityType === 'company' ? '公司主体' : '个人主体'}` : ''}`}
                    </Text>
                </div>
            </div>
        );
    };

    return (
        <Layout style={{ minHeight: '100vh', background: '#7361a6' }}>
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '40vh',
                background: 'linear-gradient(135deg, rgba(24, 144, 255, 0.4) 0%, rgba(9, 109, 217, 0.4) 100%)',
                clipPath: 'polygon(0 0, 100% 0, 100% 60%, 0% 100%)',
                zIndex: 0
            }} />
            <Content style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'flex-start',
                padding: screens.xs ? '24px 16px' : '64px 24px',
                position: 'relative',
                zIndex: 1
            }}>
                <div
                    style={{
                        width: '100%',
                        maxWidth: 680,
                        background: '#ffffff',
                        borderRadius: 24,
                        boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
                        padding: screens.xs ? '32px 20px' : '48px 56px'
                    }}
                >
                    <div style={{ marginBottom: 32, position: 'relative' }}>
                        <Button
                            type="text"
                            icon={<ArrowLeftOutlined aria-hidden="true" />}
                            onClick={() => navigate('/')}
                            style={{ position: 'absolute', left: -16, top: 0, color: '#64748b' }}
                            aria-label="返回商家入驻首页"
                        >
                            返回
                        </Button>
                        <div style={{ textAlign: 'center' }}>
                            <Title level={2} style={{ marginTop: 0, marginBottom: 8, color: '#1a1a1a', fontWeight: 600 }}>
                                统一商家入驻进度
                            </Title>
                            <Text style={{ color: '#64748b', fontSize: 15 }}>输入申请时使用的注册手机号，查询统一商家体系下的审核状态</Text>
                        </div>
                    </div>

                    {source.startsWith('login_') && (
                        <Alert
                            type="info"
                            showIcon
                            style={{ marginBottom: 20, borderRadius: 8 }}
                            message={source === 'login_pending' ? '当前手机号存在审核中的申请，已为你展示最新审核进度。' : '当前手机号存在待处理申请，已为你展示对应申请状态。'}
                        />
                    )}

                    <Form
                        form={form}
                        onFinish={handleQuery}
                        layout="vertical"
                        aria-label="审核进度查询表单"
                        requiredMark={false}
                    >
                        <Form.Item
                            name="phone"
                            rules={[
                                { required: true, message: '请输入手机号' },
                                { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号' },
                            ]}
                        >
                            <Input
                                prefix={<PhoneOutlined style={{ color: '#94a3b8', marginRight: 8 }} aria-hidden="true" />}
                                placeholder="请输入11位手机号"
                                maxLength={11}
                                size="large"
                                aria-label="手机号"
                                aria-required="true"
                                style={{
                                    height: 56,
                                    borderRadius: 12,
                                    fontSize: 16
                                }}
                            />
                        </Form.Item>
                        <Form.Item style={{ marginBottom: 0 }}>
                            <Button
                                type="primary"
                                htmlType="submit"
                                block
                                size="large"
                                loading={loading}
                                aria-label="查询审核状态"
                                style={{
                                    height: 56,
                                    borderRadius: 12,
                                    fontSize: 16,
                                    fontWeight: 500,
                                    background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
                                    border: 'none',
                                    boxShadow: '0 4px 14px rgba(24, 144, 255, 0.3)'
                                }}
                            >
                                查询状态
                            </Button>
                        </Form.Item>
                    </Form>

                    {loading && (
                        <div style={{ textAlign: 'center', padding: '64px 0' }} role="status" aria-live="polite">
                            <Spin size="large" />
                            <div style={{ marginTop: 16, color: '#64748b' }}>正在查询最新状态...</div>
                        </div>
                    )}

                    {queried && !loading && renderStatusResult()}

                    {queried && !loading && !applicationStatus && (
                        <div style={{ marginTop: 32 }}>
                            <Result
                                status="404"
                                title="未找到您的申请记录"
                                subTitle="系统未能找到与该手机号匹配的入驻记录。请确认手机号码是否正确，或者您可能尚未完成提交。"
                                extra={(
                                    <Button
                                        type="primary"
                                        size="large"
                                        onClick={() => navigate('/')}
                                        aria-label="前往商家入驻申请页面"
                                        style={{ height: 44, borderRadius: 8, padding: '0 32px' }}
                                    >
                                        重新申请入驻
                                    </Button>
                                )}
                            />
                        </div>
                    )}
                </div>
            </Content>
        </Layout>
    );
};

export default MerchantApplyStatus;
