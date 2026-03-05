import React, { useState, useEffect } from 'react';
import { Button, Layout, Typography, Row, Col, Modal, Radio, Grid } from 'antd';
import { ArrowRightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Content } = Layout;
const { Title, Text, Paragraph } = Typography;
const { useBreakpoint } = Grid;

type MerchantApplyRole = 'designer' | 'foreman' | 'company' | 'material_shop';
type MerchantEntityType = 'personal' | 'company';

interface MerchantTypeCardProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    onClick: () => void;
    delay: number;
}

const MerchantTypeCard: React.FC<MerchantTypeCardProps> = ({ icon, title, description, onClick, delay }) => {
    return (
        <div
            className={`merchant-role-card animate-fade-in`}
            style={{ animationDelay: `${delay}ms` }}
            onClick={onClick}
            tabIndex={0}
            role="button"
        >
            <div className="role-icon-wrapper">
                {icon}
            </div>
            <Title level={4} className="role-title">{title}</Title>
            <Text className="role-desc">{description}</Text>
            <div className="role-arrow">
                <ArrowRightOutlined />
            </div>
        </div>
    );
};

// Sleek Custom SVG Icons
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
    const screens = useBreakpoint();
    const [applyModalOpen, setApplyModalOpen] = useState(false);
    const [selectedRole, setSelectedRole] = useState<MerchantApplyRole | ''>('');
    const [entityType, setEntityType] = useState<MerchantEntityType>('personal');

    useEffect(() => {
        const style = document.createElement('style');
        style.innerHTML = `
            .entry-page-bg {
                background: linear-gradient(135deg, #f6f8fb 0%, #e9f0f9 100%);
                position: relative;
                overflow: hidden;
            }
            .entry-page-bg::before {
                content: '';
                position: absolute;
                top: -10%;
                left: -10%;
                width: 60%;
                height: 60%;
                border-radius: 50%;
                background: radial-gradient(circle, rgba(24, 144, 255, 0.08) 0%, rgba(24, 144, 255, 0) 70%);
                z-index: 0;
            }
            .entry-page-bg::after {
                content: '';
                position: absolute;
                bottom: -10%;
                right: -5%;
                width: 50%;
                height: 70%;
                border-radius: 50%;
                background: radial-gradient(circle, rgba(114, 46, 209, 0.05) 0%, rgba(114, 46, 209, 0) 70%);
                z-index: 0;
            }
            .glassmorphism-card {
                background: rgba(255, 255, 255, 0.75);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border: 1px solid rgba(255, 255, 255, 0.5);
                box-shadow: 0 24px 48px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.6);
                border-radius: 24px;
                position: relative;
                z-index: 1;
            }
            .merchant-role-card {
                background: #ffffff;
                border: 1px solid #f0f0f0;
                border-radius: 20px;
                padding: 32px 24px;
                text-align: center;
                cursor: pointer;
                transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                height: 100%;
                display: flex;
                flex-direction: column;
                align-items: center;
                position: relative;
                overflow: hidden;
            }
            .merchant-role-card::before {
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
            .merchant-role-card:hover {
                border-color: #1890ff;
                transform: translateY(-8px);
                box-shadow: 0 16px 32px rgba(24, 144, 255, 0.12);
            }
            .merchant-role-card:hover::before {
                opacity: 1;
            }
            .role-icon-wrapper {
                width: 64px;
                height: 64px;
                border-radius: 16px;
                background: #f0f7ff;
                color: #1890ff;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 32px;
                margin-bottom: 24px;
                transition: all 0.3s ease;
            }
            .merchant-role-card:hover .role-icon-wrapper {
                background: #1890ff;
                color: #ffffff;
                transform: scale(1.1);
            }
            .role-title {
                font-weight: 600 !important;
                margin-bottom: 12px !important;
                color: #1a1a1a;
                transition: color 0.3s ease;
            }
            .merchant-role-card:hover .role-title {
                color: #1890ff;
            }
            .role-desc {
                color: #64748b;
                font-size: 14px;
                line-height: 1.6;
                position: relative;
                z-index: 1;
            }
            .role-arrow {
                position: absolute;
                bottom: 24px;
                opacity: 0;
                transform: translateY(10px);
                color: #1890ff;
                font-size: 20px;
                transition: all 0.3s ease;
            }
            .merchant-role-card:hover .role-arrow {
                opacity: 1;
                transform: translateY(0);
            }
            .merchant-role-card:hover .role-desc {
                opacity: 0;
            }
            .premium-action-bar {
                background: rgba(255, 255, 255, 0.65);
                backdrop-filter: blur(24px);
                -webkit-backdrop-filter: blur(24px);
                border: 1px solid rgba(255, 255, 255, 0.6);
                border-radius: 16px;
                padding: 24px 32px;
                box-shadow: 0 16px 48px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.8);
                position: relative;
                overflow: hidden;
                transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            }
            .premium-action-bar:hover {
                transform: translateY(-2px);
                box-shadow: 0 20px 56px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.8);
            }
            .premium-action-bar::before {
                content: '';
                position: absolute;
                top: -30%;
                right: -10%;
                width: 50%;
                height: 150%;
                background: radial-gradient(circle, rgba(24, 144, 255, 0.06) 0%, rgba(255, 255, 255, 0) 70%);
                border-radius: 50%;
                pointer-events: none;
                z-index: 0;
            }
            .premium-action-bar > .ant-row {
                position: relative;
                z-index: 1;
            }
            .animate-fade-in {
                animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                opacity: 0;
                transform: translateY(20px);
            }
            @keyframes fadeInUp {
                to { opacity: 1; transform: translateY(0); }
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

        if (selectedRole === 'material_shop') {
            navigate('/material-shop/register?entityType=company');
            return;
        }

        if (selectedRole === 'company') {
            navigate('/register?role=company&entityType=company');
            return;
        }

        navigate(`/register?role=${selectedRole}&entityType=${entityType}`);
    };

    return (
        <Layout className="entry-page-bg" style={{ minHeight: '100vh' }}>
            <Content
                style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: screens.xs ? '32px 16px' : '64px 24px',
                }}
            >
                <div
                    className="glassmorphism-card"
                    style={{
                        width: '100%',
                        maxWidth: 960,
                        padding: screens.xs ? '40px 24px' : '64px 56px',
                    }}
                >
                    <div style={{ textAlign: 'center', marginBottom: 48, animationDelay: '0ms' }} className="animate-fade-in">
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#e6f4ff', padding: '8px 16px', borderRadius: '100px', marginBottom: 16 }}>
                            <Text style={{ color: '#1890ff', fontWeight: 600, letterSpacing: '1px', fontSize: 13 }}>合作伙伴招募</Text>
                        </div>
                        <Title level={1} style={{ marginBottom: 16, color: '#0f172a', fontWeight: 700, fontSize: screens.xs ? 32 : 42, letterSpacing: '-1px' }}>
                            加入禾泽云商家生态
                        </Title>
                        <Paragraph style={{ color: '#64748b', fontSize: 18, maxWidth: 600, margin: '0 auto' }}>
                            选择您的角色，与数千万业主共享家装红利，开启您的数字化业务新篇章
                        </Paragraph>
                    </div>

                    <div className="premium-action-bar animate-fade-in" style={{ marginBottom: 48, animationDelay: '100ms' }}>
                        <Row align="middle" justify="space-between" gutter={[24, 24]}>
                            <Col xs={24} md={12}>
                                <Text style={{ color: '#1e293b', fontSize: 20, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                                    已有账号？
                                </Text>
                                <Text style={{ color: '#64748b', fontSize: 15 }}>
                                    极速登录商家中心，管理您的专属业务
                                </Text>
                            </Col>
                            <Col xs={24} md={12} style={{ display: 'flex', gap: 16, justifyContent: screens.md ? 'flex-end' : 'flex-start' }}>
                                <Button
                                    type="primary"
                                    size="large"
                                    onClick={() => navigate('/login')}
                                    style={{
                                        borderRadius: 8,
                                        fontWeight: 500,
                                        width: screens.xs ? '100%' : 'auto',
                                        height: 48,
                                        padding: '0 32px',
                                        boxShadow: '0 8px 16px rgba(24,144,255,0.2)'
                                    }}
                                >
                                    立即登录
                                </Button>
                                <Button
                                    size="large"
                                    onClick={() => navigate('/apply-status')}
                                    style={{
                                        borderRadius: 8,
                                        width: screens.xs ? '100%' : 'auto',
                                        height: 48,
                                        borderColor: '#cbd5e1',
                                        color: '#475569',
                                        background: 'transparent'
                                    }}
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
                                    delay={200 + index * 100}
                                />
                            </Col>
                        ))}
                    </Row>
                </div>
            </Content>

            <Modal
                title={
                    <div style={{ textAlign: 'center', fontSize: 20, fontWeight: 600, margin: '8px 0' }}>
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
                    style: { borderRadius: 8, height: 44, padding: '0 32px', background: !selectedRole ? undefined : 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)', border: 'none', fontWeight: 500 },
                    size: 'large'
                }}
                cancelButtonProps={{
                    style: { borderRadius: 8, height: 44, padding: '0 32px' },
                    size: 'large'
                }}
            >
                <div style={{ padding: '24px 0 8px' }}>
                    <Text strong style={{ display: 'block', marginBottom: 16, fontSize: 16, color: '#1a1a1a' }}>1. 选择商家角色</Text>
                    <Row gutter={[12, 12]}>
                        {merchantRoles.map((item) => (
                            <Col span={12} key={item.role}>
                                <div
                                    onClick={() => handleRoleSelect(item.role)}
                                    style={{
                                        padding: '16px',
                                        border: `2px solid ${selectedRole === item.role ? '#1890ff' : '#f0f0f0'} `,
                                        borderRadius: 12,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                        backgroundColor: selectedRole === item.role ? '#f0f7ff' : '#fff',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 12
                                    }}
                                >
                                    <div style={{
                                        width: 40, height: 40, borderRadius: 10,
                                        background: selectedRole === item.role ? '#1890ff' : '#f8fafc',
                                        color: selectedRole === item.role ? '#fff' : '#64748b',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 20,
                                        transition: 'all 0.2s'
                                    }}>
                                        {item.icon}
                                    </div>
                                    <Text strong style={{ color: selectedRole === item.role ? '#1890ff' : '#334155', fontSize: 15 }}>
                                        {item.title}
                                    </Text>
                                </div>
                            </Col>
                        ))}
                    </Row>

                    {(selectedRole === 'designer' || selectedRole === 'foreman') && (
                        <div style={{ marginTop: 32 }}>
                            <Text strong style={{ display: 'block', marginBottom: 16, fontSize: 16, color: '#1a1a1a' }}>2. 选择主体类型</Text>
                            <Radio.Group
                                value={entityType}
                                onChange={(event) => setEntityType(event.target.value)}
                                style={{ width: '100%', display: 'flex', gap: 12 }}
                            >
                                <Radio.Button
                                    value="personal"
                                    style={{
                                        flex: 1, textAlign: 'center', height: 48, lineHeight: '46px',
                                        borderRadius: 8, fontSize: 15,
                                        border: `2px solid ${entityType === 'personal' ? '#1890ff' : '#f0f0f0'} `
                                    }}
                                >
                                    个人资质
                                </Radio.Button>
                                <Radio.Button
                                    value="company"
                                    style={{
                                        flex: 1, textAlign: 'center', height: 48, lineHeight: '46px',
                                        borderRadius: 8, fontSize: 15,
                                        border: `2px solid ${entityType === 'company' ? '#1890ff' : '#f0f0f0'} `
                                    }}
                                >
                                    企业资质
                                </Radio.Button>
                            </Radio.Group>
                            <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'flex-start', padding: '12px 16px', background: '#f8fafc', borderRadius: 8 }}>
                                <span style={{ color: '#1890ff' }}>💡</span>
                                <Text style={{ color: '#64748b', fontSize: 13, lineHeight: 1.5 }}>
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
