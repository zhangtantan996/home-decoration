import React, { useState, useEffect } from 'react';
import { Button, Layout, Typography, Row, Col, Modal, Radio, Grid, Alert } from 'antd';
import { ArrowRightOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MERCHANT_THEME } from '../../constants/merchantTheme';

const { Content } = Layout;
const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

type MerchantApplyRole = 'designer' | 'foreman' | 'company' | 'material_shop';
type MerchantEntityType = 'personal' | 'company';

const withQueryString = (path: string, params: URLSearchParams) => {
    const query = params.toString();
    return query ? `${path}?${query}` : path;
};

interface MerchantTypeCardProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    onClick: () => void;
    delayClassName: string;
}

const MerchantTypeCard: React.FC<MerchantTypeCardProps> = ({ icon, title, description, onClick, delayClassName }) => {
    return (
        <div
            className={`merchant-entry-role-card merchant-entry-fade-in ${delayClassName}`}
            onClick={onClick}
            tabIndex={0}
            role="button"
        >
            <div className="merchant-entry-role-icon">
                {icon}
            </div>
            <Title level={4} className="merchant-entry-role-title">{title}</Title>
            <Text className="merchant-entry-role-desc">{description}</Text>
            <div className="merchant-entry-role-arrow">
                <ArrowRightOutlined />
            </div>
        </div>
    );
};

const DesignerIcon = () => (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9"></path>
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
    </svg>
);

const ForemanIcon = () => (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
    </svg>
);

const CompanyIcon = () => (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect>
        <path d="M9 22v-4h6v4"></path>
        <path d="M8 6h.01"></path>
        <path d="M16 6h.01"></path>
        <path d="M12 6h.01"></path>
        <path d="M12 10h.01"></path>
        <path d="M12 14h.01"></path>
        <path d="M16 10h.01"></path>
        <path d="M16 14h.01"></path>
        <path d="M8 10h.01"></path>
        <path d="M8 14h.01"></path>
    </svg>
);

const MaterialIcon = () => (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
        <polyline points="9 22 9 12 15 12 15 22"></polyline>
    </svg>
);

const MerchantEntry: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const screens = useBreakpoint();
    const [applyModalOpen, setApplyModalOpen] = useState(false);
    const [selectedRole, setSelectedRole] = useState<MerchantApplyRole | ''>('');
    const [entityType, setEntityType] = useState<MerchantEntityType>('personal');
    const phoneFromLogin = String(searchParams.get('phone') || '').trim();
    const fromLoginUnregistered = searchParams.get('from') === 'login_unregistered';
    const delayClassNames = ['merchant-entry-delay-200', 'merchant-entry-delay-300', 'merchant-entry-delay-400', 'merchant-entry-delay-500'];

    useEffect(() => {
        const style = document.createElement('style');
        style.innerHTML = `
            .merchant-entry-page {
                position: relative;
                min-height: 100vh;
                overflow: hidden;
                background: ${MERCHANT_THEME.pageBgGradient};
            }
            .merchant-entry-page::before {
                content: '';
                position: absolute;
                top: -10%;
                left: -10%;
                z-index: 0;
                width: 60%;
                height: 60%;
                border-radius: 50%;
                background: radial-gradient(circle, ${MERCHANT_THEME.accentGlowStart} 0%, rgba(24, 144, 255, 0) 70%);
            }
            .merchant-entry-page::after {
                content: '';
                position: absolute;
                right: -5%;
                bottom: -10%;
                z-index: 0;
                width: 50%;
                height: 70%;
                border-radius: 50%;
                background: radial-gradient(circle, ${MERCHANT_THEME.accentGlowEnd} 0%, rgba(114, 46, 209, 0) 70%);
            }
            .merchant-entry-content {
                display: flex;
                min-height: 100vh;
                align-items: center;
                justify-content: center;
                padding: 64px 24px;
            }
            .merchant-entry-card {
                position: relative;
                z-index: 1;
                width: 100%;
                max-width: 960px;
                border: ${MERCHANT_THEME.surfaceBorder};
                border-radius: ${MERCHANT_THEME.cardRadius}px;
                background: ${MERCHANT_THEME.surfaceBg};
                backdrop-filter: blur(20px);
                box-shadow: ${MERCHANT_THEME.surfaceShadow};
                padding: 64px 56px;
            }
            .merchant-entry-fade-in {
                animation: merchantEntryFadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                opacity: 0;
                transform: translateY(20px);
            }
            .merchant-entry-delay-0 { animation-delay: 0ms; }
            .merchant-entry-delay-100 { animation-delay: 100ms; }
            .merchant-entry-delay-200 { animation-delay: 200ms; }
            .merchant-entry-delay-300 { animation-delay: 300ms; }
            .merchant-entry-delay-400 { animation-delay: 400ms; }
            .merchant-entry-delay-500 { animation-delay: 500ms; }
            .merchant-entry-hero {
                margin-bottom: 48px;
                text-align: center;
            }
            .merchant-entry-badge {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                margin-bottom: 16px;
                border-radius: 100px;
                background: #e6f4ff;
                padding: 8px 16px;
            }
            .merchant-entry-badge-text {
                color: ${MERCHANT_THEME.primaryColor} !important;
                font-size: 13px;
                font-weight: 600;
                letter-spacing: 1px;
            }
            .merchant-entry-title {
                margin-bottom: 16px !important;
                color: #0f172a !important;
                font-size: 42px !important;
                font-weight: 700 !important;
                letter-spacing: -1px;
            }
            .merchant-entry-login-alert {
                margin-bottom: 24px;
                border-radius: 12px;
            }
            .merchant-entry-action-bar {
                position: relative;
                overflow: hidden;
                margin-bottom: 24px;
                border: 1px solid rgba(255, 255, 255, 0.6);
                border-radius: 16px;
                background: rgba(255, 255, 255, 0.65);
                backdrop-filter: blur(24px);
                box-shadow: 0 16px 48px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.8);
                padding: 24px 32px;
                transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            }
            .merchant-entry-action-bar::before {
                content: '';
                position: absolute;
                top: -30%;
                right: -10%;
                z-index: 0;
                width: 50%;
                height: 150%;
                border-radius: 50%;
                background: radial-gradient(circle, rgba(24, 144, 255, 0.06) 0%, rgba(255, 255, 255, 0) 70%);
                pointer-events: none;
            }
            .merchant-entry-action-bar:hover {
                transform: translateY(-2px);
                box-shadow: 0 20px 56px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.8);
            }
            .merchant-entry-action-title {
                display: block;
                margin-bottom: 6px;
                color: ${MERCHANT_THEME.textPrimary} !important;
                font-size: 20px;
                font-weight: 600;
            }
            .merchant-entry-action-desc {
                color: ${MERCHANT_THEME.textSecondary} !important;
                font-size: 15px;
            }
            .merchant-entry-action-buttons {
                display: flex;
                gap: 16px;
                justify-content: flex-end;
            }
            .merchant-entry-primary-button {
                height: 48px;
                border-radius: ${MERCHANT_THEME.controlRadius}px;
                box-shadow: ${MERCHANT_THEME.softShadow};
                padding: 0 32px;
                font-weight: 500;
            }
            .merchant-entry-secondary-button {
                height: 48px;
                border-radius: ${MERCHANT_THEME.controlRadius}px;
                background: transparent;
                border-color: ${MERCHANT_THEME.borderColorStrong};
                color: #475569;
                padding: 0 32px;
            }
            .merchant-entry-role-card {
                position: relative;
                display: flex;
                height: 100%;
                cursor: pointer;
                flex-direction: column;
                align-items: center;
                overflow: hidden;
                border: 1px solid #f0f0f0;
                border-radius: 20px;
                background: #ffffff;
                padding: 32px 24px;
                text-align: center;
                transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            }
            .merchant-entry-role-card::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: linear-gradient(135deg, rgba(24, 144, 255, 0) 0%, rgba(24, 144, 255, 0.03) 100%);
                opacity: 0;
                transition: opacity 0.3s ease;
            }
            .merchant-entry-role-card:hover {
                transform: translateY(-8px);
                border-color: ${MERCHANT_THEME.primaryColor};
                box-shadow: 0 16px 32px rgba(24, 144, 255, 0.12);
            }
            .merchant-entry-role-card:hover::before {
                opacity: 1;
            }
            .merchant-entry-role-icon {
                display: flex;
                width: 64px;
                height: 64px;
                margin-bottom: 24px;
                align-items: center;
                justify-content: center;
                border-radius: 16px;
                background: var(--ant-color-primary-bg);
                color: ${MERCHANT_THEME.primaryColor};
                font-size: 32px;
                transition: all 0.3s ease;
            }
            .merchant-entry-role-card:hover .merchant-entry-role-icon {
                transform: scale(1.1);
                background: ${MERCHANT_THEME.primaryColor};
                color: #ffffff;
            }
            .merchant-entry-role-title {
                margin-bottom: 12px !important;
                color: #1a1a1a !important;
                font-weight: 600 !important;
                transition: color 0.3s ease;
            }
            .merchant-entry-role-card:hover .merchant-entry-role-title {
                color: ${MERCHANT_THEME.primaryColor} !important;
            }
            .merchant-entry-role-desc {
                position: relative;
                z-index: 1;
                color: ${MERCHANT_THEME.textSecondary} !important;
                font-size: 14px;
                line-height: 1.6;
            }
            .merchant-entry-role-arrow {
                position: absolute;
                bottom: 24px;
                color: ${MERCHANT_THEME.primaryColor};
                font-size: 20px;
                opacity: 0;
                transform: translateY(10px);
                transition: all 0.3s ease;
            }
            .merchant-entry-role-card:hover .merchant-entry-role-arrow {
                opacity: 1;
                transform: translateY(0);
            }
            .merchant-entry-role-card:hover .merchant-entry-role-desc {
                opacity: 0;
            }
            .merchant-entry-modal-title {
                margin: 8px 0;
                text-align: center;
                font-size: 20px;
                font-weight: 600;
            }
            .merchant-entry-modal-body {
                padding: 24px 0 8px;
            }
            .merchant-entry-section-label {
                display: block;
                margin-bottom: 16px;
                color: #1a1a1a !important;
                font-size: 16px;
            }
            .merchant-entry-role-select {
                display: flex;
                cursor: pointer;
                align-items: center;
                gap: 12px;
                border: 2px solid #f0f0f0;
                border-radius: 12px;
                background: #fff;
                padding: 16px;
                transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            }
            .merchant-entry-role-select-selected {
                border-color: ${MERCHANT_THEME.primaryColor};
                background: var(--ant-color-primary-bg);
            }
            .merchant-entry-role-select-icon {
                display: flex;
                width: 40px;
                height: 40px;
                align-items: center;
                justify-content: center;
                border-radius: 10px;
                background: #f8fafc;
                color: ${MERCHANT_THEME.textSecondary};
                font-size: 20px;
                transition: all 0.2s;
            }
            .merchant-entry-role-select-icon-selected {
                background: ${MERCHANT_THEME.primaryColor};
                color: #fff;
            }
            .merchant-entry-role-select-text {
                color: ${MERCHANT_THEME.textPrimary} !important;
                font-size: 15px;
            }
            .merchant-entry-role-select-text-selected {
                color: ${MERCHANT_THEME.primaryColor} !important;
            }
            .merchant-entry-entity-block {
                margin-top: 32px;
            }
            .merchant-entry-entity-group {
                display: flex;
                width: 100%;
                gap: 12px;
            }
            .merchant-entry-entity-group .ant-radio-button-wrapper {
                flex: 1;
                height: 48px;
                border-radius: 8px;
                border: 2px solid #f0f0f0;
                color: ${MERCHANT_THEME.textPrimary};
                font-size: 15px;
                line-height: 46px;
                text-align: center;
            }
            .merchant-entry-entity-group .ant-radio-button-wrapper:not(:first-child) {
                border-inline-start-width: 2px;
            }
            .merchant-entry-entity-group .ant-radio-button-wrapper-checked:not(.ant-radio-button-wrapper-disabled) {
                border-color: ${MERCHANT_THEME.primaryColor};
                background: var(--ant-color-primary-bg);
                color: ${MERCHANT_THEME.primaryColor};
                box-shadow: none;
            }
            .merchant-entry-entity-note {
                display: flex;
                align-items: flex-start;
                gap: 8px;
                margin-top: 12px;
                border-radius: 8px;
                background: #f8fafc;
                padding: 12px 16px;
            }
            .merchant-entry-entity-note-icon {
                margin-top: 2px;
                color: ${MERCHANT_THEME.primaryColor};
            }
            .merchant-entry-entity-note-text {
                color: ${MERCHANT_THEME.textSecondary} !important;
                font-size: 13px;
                line-height: 1.5;
            }
            .merchant-entry-modal-ok {
                height: 44px;
                border: none;
                border-radius: ${MERCHANT_THEME.controlRadius}px;
                background: ${MERCHANT_THEME.primaryGradient};
                padding: 0 32px;
                font-weight: 500;
            }
            .merchant-entry-modal-cancel {
                height: 44px;
                border-radius: ${MERCHANT_THEME.controlRadius}px;
                padding: 0 32px;
            }
            @keyframes merchantEntryFadeInUp {
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            @media (max-width: 767px) {
                .merchant-entry-content {
                    padding: 32px 16px;
                }
                .merchant-entry-card {
                    padding: 40px 24px;
                }
                .merchant-entry-title {
                    font-size: 32px !important;
                }
                .merchant-entry-action-buttons {
                    justify-content: flex-start;
                }
                .merchant-entry-mobile-full {
                    width: 100%;
                }
            }
        `;
        document.head.appendChild(style);
        return () => {
            document.head.removeChild(style);
        };
    }, []);

    const merchantRoles: Array<{
        icon: React.ReactNode;
        title: string;
        description: string;
        role: MerchantApplyRole;
    }> = [
        {
            icon: <DesignerIcon />,
            title: '设计师入驻',
            description: '独立设计师或设计工作室，提供专业设计服务',
            role: 'designer',
        },
        {
            icon: <ForemanIcon />,
            title: '工长入驻',
            description: '个人工长或施工团队，承接装修施工细节，口碑制胜',
            role: 'foreman',
        },
        {
            icon: <CompanyIcon />,
            title: '装修公司',
            description: '具备企业资质的装修公司，提供一站式无忧入住服务',
            role: 'company',
        },
        {
            icon: <MaterialIcon />,
            title: '主材商入驻',
            description: '严选主材门店或顶级供应商，提供优质建材产品',
            role: 'material_shop',
        },
    ];

    const openApplyFlow = (role?: MerchantApplyRole) => {
        if (role) {
            setSelectedRole(role);
            if (role === 'company' || role === 'material_shop') {
                setEntityType('company');
            } else {
                setEntityType('personal');
            }
        } else {
            setSelectedRole('');
            setEntityType('personal');
        }
        setApplyModalOpen(true);
    };

    const handleRoleSelect = (role: MerchantApplyRole) => {
        setSelectedRole(role);
        if (role === 'company' || role === 'material_shop') {
            setEntityType('company');
        } else {
            setEntityType('personal');
        }
    };

    const handleStartApply = () => {
        if (!selectedRole) {
            return;
        }

        const params = new URLSearchParams();
        if (fromLoginUnregistered) {
            params.set('from', 'login_unregistered');
        }
        if (phoneFromLogin) {
            params.set('phone', phoneFromLogin);
        }

        if (selectedRole === 'material_shop') {
            params.set('entityType', 'company');
            navigate(withQueryString('/material-shop/register', params));
            return;
        }

        if (selectedRole === 'company') {
            params.set('role', 'company');
            params.set('entityType', 'company');
            navigate(withQueryString('/register', params));
            return;
        }

        params.set('role', selectedRole);
        params.set('entityType', entityType);
        navigate(withQueryString('/register', params));
    };

    return (
        <Layout className="merchant-entry-page">
            <Content className="merchant-entry-content">
                <div className="merchant-entry-card">
                    <div className="merchant-entry-hero merchant-entry-fade-in merchant-entry-delay-0">
                        <div className="merchant-entry-badge">
                            <Text className="merchant-entry-badge-text">合作伙伴招募</Text>
                        </div>
                        <Title level={1} className="merchant-entry-title">
                            加入禾泽云商家生态
                        </Title>
                    </div>

                    {fromLoginUnregistered && (
                        <Alert
                            type="info"
                            showIcon
                            message="您还没有完成商家入驻"
                            description="请先选择入驻类型并提交申请，审核通过后再登录商家中心。"
                            className="merchant-entry-login-alert"
                        />
                    )}

                    <div className="merchant-entry-action-bar merchant-entry-fade-in merchant-entry-delay-100">
                        <Row align="middle" justify="space-between" gutter={[24, 24]}>
                            <Col xs={24} md={12}>
                                <Text className="merchant-entry-action-title">
                                    已有账号？
                                </Text>
                                <Text className="merchant-entry-action-desc">
                                    极速登录商家中心，管理您的专属业务
                                </Text>
                            </Col>
                            <Col xs={24} md={12} className="merchant-entry-action-buttons">
                                <Button
                                    type="primary"
                                    size="large"
                                    onClick={() => navigate('/login')}
                                    className={`merchant-entry-primary-button ${screens.xs ? 'merchant-entry-mobile-full' : ''}`}
                                >
                                    立即登录
                                </Button>
                                <Button
                                    size="large"
                                    onClick={() => navigate('/apply-status')}
                                    className={`merchant-entry-secondary-button ${screens.xs ? 'merchant-entry-mobile-full' : ''}`}
                                >
                                    查询进度
                                </Button>
                            </Col>
                        </Row>
                    </div>

                    <Row gutter={[24, 24]}>
                        {merchantRoles.map((item, index) => (
                            <Col xs={24} sm={12} md={6} key={item.role}>
                                <MerchantTypeCard
                                    icon={item.icon}
                                    title={item.title}
                                    description={item.description}
                                    onClick={() => openApplyFlow(item.role)}
                                    delayClassName={delayClassNames[index]}
                                />
                            </Col>
                        ))}
                    </Row>
                </div>
            </Content>

            <Modal
                title={
                    <div className="merchant-entry-modal-title">
                        确认入驻资质
                    </div>
                }
                open={applyModalOpen}
                onCancel={() => { setApplyModalOpen(false); }}
                onOk={handleStartApply}
                okText="开始入驻申请"
                cancelText="返回"
                centered
                width={560}
                okButtonProps={{
                    disabled: !selectedRole,
                    className: 'merchant-entry-modal-ok',
                    size: 'large'
                }}
                cancelButtonProps={{
                    className: 'merchant-entry-modal-cancel',
                    size: 'large'
                }}
            >
                <div className="merchant-entry-modal-body">
                    <Text strong className="merchant-entry-section-label">1. 选择商家角色</Text>
                    <Row gutter={[12, 12]}>
                        {merchantRoles.map((item) => (
                            <Col span={12} key={item.role}>
                                <div
                                    onClick={() => handleRoleSelect(item.role)}
                                    className={`merchant-entry-role-select ${selectedRole === item.role ? 'merchant-entry-role-select-selected' : ''}`}
                                >
                                    <div className={`merchant-entry-role-select-icon ${selectedRole === item.role ? 'merchant-entry-role-select-icon-selected' : ''}`}>
                                        {item.icon}
                                    </div>
                                    <Text strong className={`merchant-entry-role-select-text ${selectedRole === item.role ? 'merchant-entry-role-select-text-selected' : ''}`}>
                                        {item.title}
                                    </Text>
                                </div>
                            </Col>
                        ))}
                    </Row>

                    {(selectedRole === 'designer' || selectedRole === 'foreman') && (
                        <div className="merchant-entry-entity-block">
                            <Text strong className="merchant-entry-section-label">2. 选择主体类型</Text>
                            <Radio.Group
                                value={entityType}
                                onChange={(event) => setEntityType(event.target.value)}
                                className="merchant-entry-entity-group"
                            >
                                <Radio.Button value="personal">
                                    个人资质
                                </Radio.Button>
                                <Radio.Button value="company">
                                    企业资质
                                </Radio.Button>
                            </Radio.Group>
                            <div className="merchant-entry-entity-note">
                                <InfoCircleOutlined className="merchant-entry-entity-note-icon" />
                                <Text className="merchant-entry-entity-note-text">
                                    {entityType === 'personal' ? '个人资质仅需提供身份证，适合独立设计师或个体工长。' : '企业资质需提供营业执照，适合设计工作室或装修施工公司，可获得更多平台权益。'}
                                </Text>
                            </div>
                        </div>
                    )}
                </div>
            </Modal>
        </Layout>
    );
};

export default MerchantEntry;
