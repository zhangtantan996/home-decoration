import React, { useState } from 'react';
import { Card, Button, Layout, Typography, Row, Col, Space, Modal, Radio, Grid } from 'antd';
import { UserOutlined, BankOutlined, ToolOutlined, ShopOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { MERCHANT_THEME } from '../../constants/merchantTheme';

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
}

const MerchantTypeCard: React.FC<MerchantTypeCardProps> = ({ icon, title, description, onClick }) => (
    <Card
        hoverable
        onClick={onClick}
        style={{
            textAlign: 'center',
            height: MERCHANT_THEME.roleCardMinHeight,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            borderRadius: 12,
            transition: 'all 0.3s',
        }}
        styles={{
            body: {
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
            },
        }}
    >
        <div style={{ fontSize: 48, marginBottom: 16, color: MERCHANT_THEME.primaryColor }}>
            {icon}
        </div>
        <Title level={5} style={{ marginBottom: 8 }}>{title}</Title>
        <Text type="secondary" style={{ fontSize: 12 }}>{description}</Text>
    </Card>
);

const MerchantEntry: React.FC = () => {
    const navigate = useNavigate();
    const screens = useBreakpoint();
    const [applyModalOpen, setApplyModalOpen] = useState(false);
    const [selectedRole, setSelectedRole] = useState<MerchantApplyRole | ''>('');
    const [entityType, setEntityType] = useState<MerchantEntityType>('personal');

    const merchantRoles: Array<{
        icon: React.ReactNode;
        title: string;
        description: string;
        role: MerchantApplyRole;
    }> = [
        {
            icon: <UserOutlined />,
            title: '设计师入驻',
            description: '独立设计师或设计工作室，提供专业设计服务',
            role: 'designer',
        },
        {
            icon: <ToolOutlined />,
            title: '工长入驻',
            description: '个人工长或施工团队，承接装修施工项目',
            role: 'foreman',
        },
        {
            icon: <BankOutlined />,
            title: '装修公司入驻',
            description: '具备企业资质的装修公司，提供一站式服务',
            role: 'company',
        },
        {
            icon: <ShopOutlined />,
            title: '主材商入驻',
            description: '主材门店或供应商，提供建材产品销售',
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
        <Layout style={{ minHeight: '100vh', background: MERCHANT_THEME.pageBgGradient }}>
            <Content
                style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: screens.xs ? 16 : 24,
                }}
            >
                <Card
                    style={{
                        width: '100%',
                        maxWidth: 760,
                        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                        borderRadius: 16,
                    }}
                    styles={{ body: { padding: screens.xs ? 16 : 24 } }}
                >
                    <div style={{ textAlign: 'center', marginBottom: 32 }}>
                        <Title level={2} style={{ marginBottom: 8, color: MERCHANT_THEME.primaryColor }}>
                            🏠 装修平台商家中心
                        </Title>
                        <Paragraph type="secondary">统一入口：我要入驻 / 已有账号登录</Paragraph>
                    </div>

                    <Card
                        style={{
                            marginBottom: 24,
                            background: MERCHANT_THEME.primaryGradient,
                            borderRadius: 12,
                        }}
                        styles={{ body: { padding: screens.xs ? 16 : 20 } }}
                    >
                        <Row align="middle" justify="space-between" gutter={[12, 12]}>
                            <Col xs={24} sm={12}>
                                <Text style={{ color: 'white', fontSize: 16 }}>开始商家流程</Text>
                            </Col>
                            <Col xs={24} sm={12} style={{ display: 'flex', gap: 8, justifyContent: screens.xs ? 'flex-start' : 'flex-end', flexWrap: 'wrap' }}>
                                <Button type="primary" size={screens.xs ? "middle" : "large"} onClick={() => openApplyFlow()} style={{ flex: screens.xs ? 1 : undefined }}>
                                    我要入驻
                                </Button>
                                <Button
                                    type="primary"
                                    ghost
                                    size={screens.xs ? "middle" : "large"}
                                    onClick={() => navigate('/login')}
                                    style={{ borderColor: 'white', color: 'white', flex: screens.xs ? 1 : undefined }}
                                >
                                    登录商家中心
                                </Button>
                            </Col>
                        </Row>
                    </Card>

                    <Row gutter={[16, 16]}>
                        {merchantRoles.map((item) => (
                            <Col xs={24} sm={12} key={item.role}>
                                <MerchantTypeCard
                                    icon={item.icon}
                                    title={item.title}
                                    description={item.description}
                                    onClick={() => openApplyFlow(item.role)}
                                />
                            </Col>
                        ))}
                    </Row>

                    <div style={{ textAlign: 'center', marginTop: 32 }}>
                        <Space>
                            <Text type="secondary">已提交申请？</Text>
                            <Button type="link" icon={<SearchOutlined />} onClick={() => navigate('/apply-status')}>
                                查询审核进度
                            </Button>
                        </Space>
                    </div>
                </Card>
            </Content>

            <Modal
                title="选择入驻方式"
                open={applyModalOpen}
                onCancel={() => setApplyModalOpen(false)}
                onOk={handleStartApply}
                okText="下一步"
                cancelText="取消"
                okButtonProps={{ disabled: !selectedRole }}
            >
                <Row gutter={[12, 12]}>
                    {merchantRoles.map((item) => (
                        <Col span={12} key={item.role}>
                            <Card
                                hoverable
                                size="small"
                                onClick={() => handleRoleSelect(item.role)}
                                style={{ borderColor: selectedRole === item.role ? '#1677ff' : undefined }}
                            >
                                <Space direction="vertical" size={4}>
                                    <Space>
                                        {item.icon}
                                        <Text strong>{item.title}</Text>
                                    </Space>
                                    <Text type="secondary" style={{ fontSize: 12 }}>{item.description}</Text>
                                </Space>
                            </Card>
                        </Col>
                    ))}
                </Row>

                {(selectedRole === 'designer' || selectedRole === 'foreman') && (
                    <div style={{ marginTop: 16 }}>
                        <Text style={{ display: 'block', marginBottom: 8 }}>主体类型</Text>
                        <Radio.Group
                            value={entityType}
                            onChange={(event) => setEntityType(event.target.value)}
                            optionType="button"
                            buttonStyle="solid"
                            options={[
                                { label: '个人', value: 'personal' },
                                { label: '公司', value: 'company' },
                            ]}
                        />
                    </div>
                )}
            </Modal>
        </Layout>
    );
};

export default MerchantEntry;
