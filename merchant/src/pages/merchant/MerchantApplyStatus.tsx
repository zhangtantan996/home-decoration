import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Alert, Form, Input, Button, message, Layout, Typography, Result, Spin, Steps, Tag, Grid } from 'antd';
import { PhoneOutlined, ArrowLeftOutlined, ClockCircleOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    MerchantApiError,
    materialShopApplyApi,
    merchantApplyApi,
    type MaterialShopApplyStatusData,
    type MerchantApplyStatusData,
} from '../../services/merchantApi';
import { formatServerDateTime } from '../../utils/serverTime';
import { readSafeErrorMessage } from '../../utils/userFacingText';
import { MERCHANT_THEME } from '../../constants/merchantTheme';

const { Content } = Layout;
const { Title, Text, Paragraph } = Typography;
const { useBreakpoint } = Grid;

const isNotFoundError = (error: unknown) => {
    if (error instanceof MerchantApiError) {
        return error.code === 404 || error.status === 404;
    }
    return false;
};

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

    useEffect(() => {
        const style = document.createElement('style');
        style.innerHTML = `
            .merchant-apply-status-layout {
                min-height: 100vh;
                overflow-x: hidden;
                overflow-y: auto;
                background: #7361a6;
            }
            .merchant-apply-status-hero {
                position: fixed;
                top: 0;
                left: 0;
                z-index: 0;
                width: 100%;
                height: 40vh;
                background: linear-gradient(135deg, rgba(24, 144, 255, 0.4) 0%, rgba(9, 109, 217, 0.4) 100%);
                clip-path: polygon(0 0, 100% 0, 100% 60%, 0% 100%);
            }
            .merchant-apply-status-content {
                position: relative;
                z-index: 1;
                display: flex;
                min-height: 100vh;
                align-items: flex-start;
                justify-content: center;
                padding: 40px 24px 48px;
            }
            .merchant-apply-status-panel {
                width: 100%;
                max-width: 680px;
                border-radius: 24px;
                background: #ffffff;
                box-shadow: ${MERCHANT_THEME.hoverShadow};
                padding: 40px 56px;
            }
            .merchant-apply-status-header {
                position: relative;
                margin-bottom: 28px;
            }
            .merchant-apply-status-back {
                position: absolute;
                top: 0;
                left: -16px;
                color: ${MERCHANT_THEME.textSecondary};
            }
            .merchant-apply-status-header-text {
                text-align: center;
            }
            .merchant-apply-status-header-title {
                margin-top: 0 !important;
                margin-bottom: 8px !important;
                color: #1a1a1a !important;
                font-weight: 600 !important;
            }
            .merchant-apply-status-header-subtitle {
                color: ${MERCHANT_THEME.textSecondary} !important;
                font-size: 15px;
            }
            .merchant-apply-status-source-alert {
                margin-bottom: 20px;
                border-radius: 8px;
            }
            .merchant-apply-status-phone-icon {
                margin-right: 8px;
                color: ${MERCHANT_THEME.textMuted};
            }
            .merchant-apply-status-phone-input {
                height: 56px;
                border-radius: 12px;
                font-size: 16px;
            }
            .merchant-apply-status-form-submit {
                margin-bottom: 0;
            }
            .merchant-apply-status-submit {
                height: 56px;
                border: none;
                border-radius: 12px;
                background: ${MERCHANT_THEME.primaryGradient};
                box-shadow: 0 4px 14px rgba(24, 144, 255, 0.3);
                font-size: 16px;
                font-weight: 500;
            }
            .merchant-apply-status-loading {
                padding: 64px 0;
                text-align: center;
            }
            .merchant-apply-status-loading-text {
                margin-top: 16px;
                color: ${MERCHANT_THEME.textSecondary};
            }
            .merchant-apply-status-card {
                margin-top: 28px;
                border: 1px solid #f1f5f9;
                border-radius: 16px;
                background: #f8fafc;
                padding: 28px 24px;
            }
            .merchant-apply-status-card-header {
                margin-bottom: 28px;
                text-align: center;
            }
            .merchant-apply-status-icon-wrap {
                margin-bottom: 12px;
            }
            .merchant-apply-status-icon-pending,
            .merchant-apply-status-icon-approved,
            .merchant-apply-status-icon-rejected {
                font-size: 64px;
            }
            .merchant-apply-status-icon-pending {
                color: var(--ant-color-warning);
            }
            .merchant-apply-status-icon-approved {
                color: var(--ant-color-success);
            }
            .merchant-apply-status-icon-rejected {
                color: var(--ant-color-error);
            }
            .merchant-apply-status-title {
                margin-top: 0 !important;
                margin-bottom: 12px !important;
                color: #1a1a1a !important;
            }
            .merchant-apply-status-tag {
                border-radius: 16px;
                padding: 4px 12px;
                font-size: 14px;
            }
            .merchant-apply-status-steps {
                margin-bottom: 32px;
            }
            .merchant-apply-status-result-info {
                padding-top: 4px;
                padding-right: 0;
                padding-bottom: 0;
                padding-left: 0;
            }
            .merchant-apply-status-result-compact {
                padding: 0;
            }
            .merchant-apply-status-strong {
                font-weight: 600;
            }
            .merchant-apply-status-primary-action,
            .merchant-apply-status-resubmit {
                height: 48px;
                border-radius: 8px;
                background: ${MERCHANT_THEME.primaryGradient};
                padding: 0 40px;
            }
            .merchant-apply-status-primary-action {
                box-shadow: 0 4px 14px rgba(24, 144, 255, 0.3);
            }
            .merchant-apply-status-reject-box {
                margin-top: 16px;
                border: 1px solid var(--ant-color-error-border);
                border-radius: 8px;
                background: var(--ant-color-error-bg);
                padding: 16px;
            }
            .merchant-apply-status-reject-label {
                color: var(--ant-color-error) !important;
                font-weight: 500;
            }
            .merchant-apply-status-reject-text {
                margin: 8px 0 0 !important;
                color: var(--ant-color-error) !important;
            }
            .merchant-apply-status-reject-alert {
                margin-bottom: 16px;
                border-radius: 8px;
                text-align: left;
            }
            .merchant-apply-status-footer {
                margin-top: 32px;
                border-top: 1px dashed ${MERCHANT_THEME.borderColor};
                padding-top: 24px;
                text-align: center;
            }
            .merchant-apply-status-footer-text {
                font-size: 13px;
            }
            .merchant-apply-status-not-found {
                margin-top: 32px;
            }
            .merchant-apply-status-not-found-result {
                padding: 32px 0 8px;
            }
            .merchant-apply-status-secondary-action {
                height: 44px;
                border-radius: 8px;
                padding: 0 32px;
            }
            @media (max-width: 575px) {
                .merchant-apply-status-content {
                    padding: 20px 16px 32px;
                }
                .merchant-apply-status-panel {
                    border-radius: 20px;
                    padding: 28px 20px;
                }
                .merchant-apply-status-header {
                    margin-bottom: 24px;
                }
                .merchant-apply-status-card {
                    margin-top: 24px;
                    padding: 24px 16px;
                }
                .merchant-apply-status-card-header {
                    margin-bottom: 24px;
                }
                .merchant-apply-status-steps {
                    margin-bottom: 28px;
                }
                .merchant-apply-status-result-info {
                    padding: 0;
                }
                .merchant-apply-status-not-found-result {
                    padding: 24px 0;
                }
            }
        `;
        document.head.appendChild(style);

        if (phoneFromUrl) {
            form.setFieldsValue({ phone: phoneFromUrl });
            void handleQuery({ phone: phoneFromUrl });
        }

        return () => {
            document.head.removeChild(style);
        };
    }, [phoneFromUrl, form]);

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
            } else if (isNotFoundError(providerResult.reason) && isNotFoundError(materialResult.reason)) {
                setApplicationStatus(null);
            } else {
                throw new Error('查询失败，请稍后重试');
            }
            setQueried(true);
        } catch (error: unknown) {
            message.error(readSafeErrorMessage(error, '查询失败，请稍后重试'));
            setApplicationStatus(null);
            setQueried(true);
        } finally {
            setLoading(false);
        }
    }, []);

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
                return <ClockCircleOutlined className="merchant-apply-status-icon-pending" />;
            case 1:
                return <CheckCircleOutlined className="merchant-apply-status-icon-approved" />;
            case 2:
                return <CloseCircleOutlined className="merchant-apply-status-icon-rejected" />;
            default:
                return null;
        }
    };

    const getStatusTag = (status: number) => {
        switch (status) {
            case 0:
                return <Tag className="merchant-apply-status-tag" color="processing" icon={<ClockCircleOutlined />}>审核中</Tag>;
            case 1:
                return <Tag className="merchant-apply-status-tag" color="success" icon={<CheckCircleOutlined />}>审核通过</Tag>;
            case 2:
                return <Tag className="merchant-apply-status-tag" color="error" icon={<CloseCircleOutlined />}>审核拒绝</Tag>;
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
            <div className="merchant-apply-status-card">
                <div className="merchant-apply-status-card-header">
                    <div className="merchant-apply-status-icon-wrap">
                        {getStatusIcon(status)}
                    </div>
                    <Title level={3} className="merchant-apply-status-title">
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
                    className="merchant-apply-status-steps"
                    direction={screens.xs ? 'vertical' : 'horizontal'}
                    size={screens.xs ? 'small' : 'default'}
                    aria-label="审核流程步骤"
                />

                {status === 0 && (
                    <Result
                        status="info"
                        title="申请正在加急审核中"
                        subTitle="预计1-3个工作日内完成审核，请耐心等待。审核结果也将通过短信通知您。"
                        className="merchant-apply-status-result-info"
                    />
                )}

                {status === 1 && (
                    <Result
                        status="success"
                        title={<span className="merchant-apply-status-strong">恭喜！审核已通过</span>}
                        subTitle="您现在可以使用手机号直接登录商家中心，开始您的业务之旅"
                        className="merchant-apply-status-result-compact"
                        extra={(
                            <Button
                                type="primary"
                                size="large"
                                onClick={() => navigate('/login')}
                                aria-label="前往登录商家中心"
                                className="merchant-apply-status-primary-action"
                            >
                                立即登录商家中心
                            </Button>
                        )}
                    />
                )}

                {status === 2 && (
                    <Result
                        status="error"
                        title={<span className="merchant-apply-status-strong">本次申请未通过，可按原商家子类型重新提交</span>}
                        subTitle={(
                            <div className="merchant-apply-status-reject-box">
                                <Text className="merchant-apply-status-reject-label">拒绝原因：</Text>
                                <Paragraph className="merchant-apply-status-reject-text">{rejectReason || '未说明原因'}</Paragraph>
                            </div>
                        )}
                        className="merchant-apply-status-result-compact"
                        extra={(
                            <>
                                <Alert
                                    type="warning"
                                    showIcon
                                    className="merchant-apply-status-reject-alert"
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
                                    className="merchant-apply-status-resubmit"
                                >
                                    按原类型修改信息后重新提交
                                </Button>
                            </>
                        )}
                    />
                )}

                <div className="merchant-apply-status-footer">
                    <Text className="merchant-apply-status-footer-text" type="secondary">
                        申请类型记录：{isMaterialShop ? '主材商' : `${role === 'company' ? '装修公司' : role === 'foreman' ? '工长' : '设计师'}${entityType ? ` · ${entityType === 'company' ? '公司主体' : '个人主体'}` : ''}`}
                    </Text>
                </div>
            </div>
        );
    };

    return (
        <Layout className="merchant-apply-status-layout">
            <div className="merchant-apply-status-hero" />
            <Content className="merchant-apply-status-content">
                <div className="merchant-apply-status-panel">
                    <div className="merchant-apply-status-header">
                        <Button
                            type="text"
                            icon={<ArrowLeftOutlined aria-hidden="true" />}
                            onClick={() => navigate('/')}
                            className="merchant-apply-status-back"
                            aria-label="返回商家入驻首页"
                        >
                            返回
                        </Button>
                        <div className="merchant-apply-status-header-text">
                            <Title level={2} className="merchant-apply-status-header-title">
                                统一商家入驻进度
                            </Title>
                            <Text className="merchant-apply-status-header-subtitle">输入申请时使用的注册手机号，查询统一商家体系下的审核状态</Text>
                        </div>
                    </div>

                    {source.startsWith('login_') && (
                        <Alert
                            type="info"
                            showIcon
                            className="merchant-apply-status-source-alert"
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
                                prefix={<PhoneOutlined className="merchant-apply-status-phone-icon" aria-hidden="true" />}
                                placeholder="请输入11位手机号"
                                maxLength={11}
                                size="large"
                                aria-label="手机号"
                                aria-required="true"
                                className="merchant-apply-status-phone-input"
                            />
                        </Form.Item>
                        <Form.Item className="merchant-apply-status-form-submit">
                            <Button
                                type="primary"
                                htmlType="submit"
                                block
                                size="large"
                                loading={loading}
                                aria-label="查询审核状态"
                                className="merchant-apply-status-submit"
                            >
                                查询状态
                            </Button>
                        </Form.Item>
                    </Form>

                    {loading && (
                        <div className="merchant-apply-status-loading" role="status" aria-live="polite">
                            <Spin size="large" />
                            <div className="merchant-apply-status-loading-text">正在查询最新状态...</div>
                        </div>
                    )}

                    {queried && !loading && renderStatusResult()}

                    {queried && !loading && !applicationStatus && (
                        <div className="merchant-apply-status-not-found">
                            <Result
                                status="404"
                                title="未找到您的申请记录"
                                subTitle="系统未能找到与该手机号匹配的入驻记录。请确认手机号码是否正确，或者您可能尚未完成提交。"
                                className="merchant-apply-status-not-found-result"
                                extra={(
                                    <Button
                                        type="primary"
                                        size="large"
                                        onClick={() => navigate('/')}
                                        aria-label="前往商家入驻申请页面"
                                        className="merchant-apply-status-secondary-action"
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
