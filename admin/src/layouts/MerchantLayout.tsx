import React, { useState } from 'react';
import { Layout, Menu, Dropdown, Avatar, theme, Button } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import MerchantNotificationDropdown from '../components/MerchantNotificationDropdown';
import {
    DashboardOutlined,
    CalendarOutlined,
    FileTextOutlined,
    DollarOutlined,

    PictureOutlined,
    SettingOutlined,
    UserOutlined,
    LogoutOutlined,
    MenuFoldOutlined,
    MenuUnfoldOutlined,
} from '@ant-design/icons';

const { Header, Sider, Content } = Layout;

const MerchantLayout: React.FC = () => {
    const [collapsed, setCollapsed] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const {
        token: { colorBgContainer },
    } = theme.useToken();

    const provider = JSON.parse(localStorage.getItem('merchant_provider') || '{}');

    const menuItems = [
        {
            key: '/dashboard',
            icon: <DashboardOutlined />,
            label: '工作台',
        },
        {
            key: '/bookings',
            icon: <CalendarOutlined />,
            label: '预约管理',
        },
        {
            key: '/proposals',
            icon: <FileTextOutlined />,
            label: '方案管理',
        },
        {
            key: '/orders',
            icon: <DollarOutlined />,
            label: '订单管理',
        },
        {
            type: 'divider',
        },
        {
            key: 'finance',
            icon: <DollarOutlined />,
            label: '财务中心',
            children: [
                { key: '/income', label: '收入明细' },
                { key: '/withdraw', label: '提现管理' },
                { key: '/bank-accounts', label: '银行卡' },
            ],
        },
        {
            key: '/cases',
            icon: <PictureOutlined />,
            label: '作品集',
        },
        {
            key: '/settings',
            icon: <SettingOutlined />,
            label: '账户设置',
        },
    ];

    const handleLogout = () => {
        localStorage.removeItem('merchant_token');
        localStorage.removeItem('merchant_provider');
        navigate('/login');
    };

    const userMenu = {
        items: [
            {
                key: 'profile',
                label: '个人资料',
                icon: <UserOutlined />,
                onClick: () => navigate('/settings'),
            },
            {
                type: 'divider',
            },
            {
                key: 'logout',
                label: '退出登录',
                icon: <LogoutOutlined />,
                danger: true,
                onClick: handleLogout,
            },
        ],
    };

    return (
        <Layout style={{ minHeight: '100vh' }}>
            <Sider
                trigger={null}
                collapsible
                collapsed={collapsed}
                width={240}
                style={{
                    background: '#001529',
                    boxShadow: '2px 0 8px 0 rgba(29,35,41,.05)',
                }}
            >
                <div style={{
                    height: 64,
                    margin: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    color: 'white',
                    fontSize: 18,
                    fontWeight: 'bold',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s',
                    cursor: 'pointer'
                }} onClick={() => navigate('/dashboard')}>
                    {collapsed ? '商' : '商家中心'}
                </div>
                <Menu
                    theme="dark"
                    mode="inline"
                    selectedKeys={[location.pathname]}
                    defaultOpenKeys={[]}
                    items={menuItems as any}
                    onClick={({ key }) => navigate(key)}
                    style={{ borderRight: 0 }}
                />
            </Sider>
            <Layout>
                <Header style={{
                    padding: '0 24px',
                    background: colorBgContainer,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxShadow: '0 1px 4px rgba(0,21,41,.08)',
                    zIndex: 1
                }}>
                    <Button
                        type="text"
                        icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                        onClick={() => setCollapsed(!collapsed)}
                        style={{
                            fontSize: '16px',
                            width: 64,
                            height: 64,
                        }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                        <MerchantNotificationDropdown />
                        <Dropdown menu={userMenu as any} placement="bottomRight">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                                <Avatar
                                    size="large"
                                    src={provider.avatar}
                                    icon={<UserOutlined />}
                                    style={{ backgroundColor: '#1890ff' }}
                                />
                                <span style={{ fontWeight: 500 }}>{provider.name || 'Merchant'}</span>
                            </div>
                        </Dropdown>
                    </div>
                </Header>
                <Content style={{
                    margin: 0,
                    background: '#f0f2f5',
                    minHeight: 280,
                    overflow: 'auto',
                    position: 'relative'
                }}>
                    <div style={{ padding: 24, maxWidth: 1600, margin: '0 auto' }}>
                        <Outlet />
                    </div>
                </Content>
            </Layout>
        </Layout>
    );
};

export default MerchantLayout;
