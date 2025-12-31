import React from 'react';
import { Card, Button, Layout, Typography, Row, Col, Space } from 'antd';
import { UserOutlined, TeamOutlined, BankOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Content } = Layout;
const { Title, Text, Paragraph } = Typography;

interface MerchantTypeCardProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    type: string;
    onClick: () => void;
}

const MerchantTypeCard: React.FC<MerchantTypeCardProps> = ({ icon, title, description, onClick }) => (
    <Card
        hoverable
        onClick={onClick}
        style={{
            textAlign: 'center',
            height: 200,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            borderRadius: 12,
            transition: 'all 0.3s',
        }}
        bodyStyle={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
        }}
    >
        <div style={{
            fontSize: 48,
            marginBottom: 16,
            color: '#1890ff',
        }}>
            {icon}
        </div>
        <Title level={5} style={{ marginBottom: 8 }}>{title}</Title>
        <Text type="secondary" style={{ fontSize: 12 }}>{description}</Text>
    </Card>
);

const MerchantEntry: React.FC = () => {
    const navigate = useNavigate();

    const handleSelectType = (type: string) => {
        navigate(`/register?type=${type}`);
    };

    const merchantTypes = [
        {
            icon: <UserOutlined />,
            title: '独立设计师',
            description: '个人设计师入驻',
            type: 'personal',
        },
        {
            icon: <TeamOutlined />,
            title: '设计工作室',
            description: '小型设计团队入驻',
            type: 'studio',
        },
        {
            icon: <BankOutlined />,
            title: '装修公司',
            description: '企业资质入驻',
            type: 'company',
        },
    ];

    return (
        <Layout style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
            <Content style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                padding: 24,
            }}>
                <Card
                    style={{
                        width: '100%',
                        maxWidth: 600,
                        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                        borderRadius: 16,
                    }}
                >
                    {/* Header */}
                    <div style={{ textAlign: 'center', marginBottom: 32 }}>
                        <Title level={2} style={{ marginBottom: 8, color: '#1890ff' }}>
                            🏠 装修平台商家中心
                        </Title>
                        <Paragraph type="secondary">
                            入驻成为服务商，获取更多订单
                        </Paragraph>
                    </div>

                    {/* 已有账号登录 */}
                    <Card
                        style={{
                            marginBottom: 24,
                            background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
                            borderRadius: 12,
                        }}
                        bodyStyle={{ padding: 20 }}
                    >
                        <Row align="middle" justify="space-between">
                            <Col>
                                <Text style={{ color: 'white', fontSize: 16 }}>已有账号？</Text>
                            </Col>
                            <Col>
                                <Button
                                    type="primary"
                                    ghost
                                    size="large"
                                    onClick={() => navigate('/login')}
                                    style={{ borderColor: 'white', color: 'white' }}
                                >
                                    登录商家中心
                                </Button>
                            </Col>
                        </Row>
                    </Card>

                    {/* 分隔线 */}
                    <div style={{
                        textAlign: 'center',
                        margin: '24px 0',
                        position: 'relative',
                    }}>
                        <div style={{
                            position: 'absolute',
                            top: '50%',
                            left: 0,
                            right: 0,
                            height: 1,
                            background: '#e8e8e8',
                        }} />
                        <Text
                            type="secondary"
                            style={{
                                background: 'white',
                                padding: '0 16px',
                                position: 'relative',
                            }}
                        >
                            或选择入驻类型
                        </Text>
                    </div>

                    {/* 入驻类型选择 */}
                    <Row gutter={[16, 16]}>
                        {merchantTypes.map((item) => (
                            <Col xs={24} sm={8} key={item.type}>
                                <MerchantTypeCard
                                    icon={item.icon}
                                    title={item.title}
                                    description={item.description}
                                    type={item.type}
                                    onClick={() => handleSelectType(item.type)}
                                />
                            </Col>
                        ))}
                    </Row>

                    {/* 查询审核进度 */}
                    <div style={{ textAlign: 'center', marginTop: 32 }}>
                        <Space>
                            <Text type="secondary">已提交申请？</Text>
                            <Button
                                type="link"
                                icon={<SearchOutlined />}
                                onClick={() => navigate('/apply-status')}
                            >
                                查询审核进度
                            </Button>
                        </Space>
                    </div>
                </Card>
            </Content>
        </Layout>
    );
};

export default MerchantEntry;
