import React, { useEffect, useState } from 'react';
import { Layout, Menu, Dropdown, Avatar, theme, Button, Tag } from 'antd';
import type { MenuProps } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import MerchantNotificationDropdown from '../components/MerchantNotificationDropdown';
import { useMerchantAuthStore } from '../stores/merchantAuthStore';
import {
    DashboardOutlined,
    CalendarOutlined,
    FileTextOutlined,
    DollarOutlined,
    ProjectOutlined,
    PictureOutlined,
    SettingOutlined,
    ShopOutlined,
    AppstoreOutlined,
    UserOutlined,
    LogoutOutlined,
    MenuFoldOutlined,
    MenuUnfoldOutlined,
    BookOutlined,
    SolutionOutlined,
} from '@ant-design/icons';
import merchantAppIcon from '../assets/branding/company-logo.png';

const { Header, Sider, Content } = Layout;

type MerchantProviderSubType = 'designer' | 'company' | 'foreman';
type MerchantKind = 'provider' | 'material_shop';

const MerchantLayout: React.FC = () => {
    const [collapsed, setCollapsed] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const {
        token: { colorBgContainer },
    } = theme.useToken();

    const provider = useMerchantAuthStore(s => s.provider);

    const merchantKind: MerchantKind = provider?.merchantKind === 'material_shop' || provider?.role === 'material_shop'
        ? 'material_shop'
        : 'provider';
    const isMaterialShop = merchantKind === 'material_shop';

    const normalizedApplicantType = String(provider?.applicantType || '').toLowerCase();

    const normalizedProviderSubType: MerchantProviderSubType = (() => {
        const raw = String(provider?.providerSubType || '').toLowerCase();
        if (raw === 'designer' || raw === 'company' || raw === 'foreman') {
            return raw;
        }
        if (normalizedApplicantType === 'company') return 'company';
        if (normalizedApplicantType === 'foreman') return 'foreman';
        return 'designer';
    })();

    const subtypeLabel = (() => {
        if (isMaterialShop) {
            return '主材商';
        }
        switch (normalizedProviderSubType) {
            case 'company':
                return '装修公司';
            case 'foreman':
                return '工长';
            default:
                return '设计师';
        }
    })();

    const identityTagLabel = (() => {
        switch (normalizedProviderSubType) {
            case 'company':
                return '装修公司';
            case 'foreman':
                return '工长';
            default:
                return '设计师';
        }
    })();

    const serviceMenuItems: MenuProps['items'] = [
        {
            key: '/dashboard',
            icon: <DashboardOutlined />,
            label: '工作台',
        },
        {
            key: '/designer-tasks',
            icon: <SolutionOutlined />,
            label: '设计师任务',
        },
        {
            key: '/bookings',
            icon: <CalendarOutlined />,
            label: '线索预约',
        },
        {
            key: '/proposals',
            icon: <FileTextOutlined />,
            label: '方案报价',
        },
        {
            key: '/projects',
            icon: <ProjectOutlined />,
            label: '项目履约',
        },
        {
            type: 'divider',
        },
        {
            key: 'finance',
            icon: <DollarOutlined />,
            label: '财务中心',
            children: [
                { key: '/income', label: '结算中心' },
                { key: '/bank-accounts', label: '银行卡' },
            ],
        },
        {
            key: '/cases',
            icon: <PictureOutlined />,
            label: '内容资产',
        },
        {
            key: '/settings',
            icon: <SettingOutlined />,
            label: '资料设置',
        },
    ];

    // Foreman-specific menu: primary work is construction quoting
    const foremanMenuItems: MenuProps['items'] = [
        {
            key: '/dashboard',
            icon: <DashboardOutlined />,
            label: '工作台',
        },
        {
            key: '/crew-tasks',
            icon: <SolutionOutlined />,
            label: '工长任务',
        },
        {
            key: '/quote-lists',
            icon: <SolutionOutlined />,
            label: '施工报价',
        },
        {
            key: '/price-book',
            icon: <BookOutlined />,
            label: '价格库',
        },
        {
            key: '/projects',
            icon: <ProjectOutlined />,
            label: '项目履约',
        },
        {
            type: 'divider',
        },
        {
            key: 'finance',
            icon: <DollarOutlined />,
            label: '财务中心',
            children: [
                { key: '/income', label: '结算中心' },
                { key: '/bank-accounts', label: '银行卡' },
            ],
        },
        {
            key: '/settings',
            icon: <SettingOutlined />,
            label: '资料设置',
        },
    ];

    const foremanAvailableKeys = new Set<string>(
        ['/dashboard', '/crew-tasks', '/quote-lists', '/price-book', '/projects', '/income', '/bank-accounts', '/settings'],
    );

    const menuItems = isMaterialShop
        ? [
            {
                key: '/dashboard',
                icon: <DashboardOutlined />,
                label: '工作台',
            },
            {
                key: '/material-shop/products',
                icon: <AppstoreOutlined />,
                label: '商品管理',
            },
            {
                key: '/material-shop/settings',
                icon: <ShopOutlined />,
                label: '店铺设置',
            },
        ]
        : normalizedProviderSubType === 'foreman'
            ? foremanMenuItems
            : serviceMenuItems;

    const availableKeys = isMaterialShop
        ? new Set<string>(['/dashboard', '/material-shop/products', '/material-shop/settings'])
        : normalizedProviderSubType === 'foreman'
            ? foremanAvailableKeys
            : new Set<string>(['/dashboard', '/designer-tasks', '/bookings', '/proposals', '/projects', '/income', '/bond', '/bank-accounts', '/cases', '/settings']);

    const resolveSelectedMenuKey = (pathname: string) => {
        if (isMaterialShop) {
            return pathname;
        }
        if (pathname.startsWith('/proposals/flow/')) {
            return '/proposals';
        }
        if (pathname.startsWith('/bookings/') && pathname.endsWith('/flow')) {
            return '/proposals';
        }
        if (pathname === '/leads' || pathname.startsWith('/bookings/')) {
            return '/bookings';
        }
        if (pathname === '/designer-tasks') {
            return '/designer-tasks';
        }
        if (pathname === '/crew-tasks') {
            return '/crew-tasks';
        }
        if (pathname.startsWith('/quote-lists') || pathname === '/price-book') {
            return '/proposals';
        }
        if (
            pathname === '/orders'
            || pathname === '/complaints'
            || pathname.startsWith('/contracts/')
            || pathname.startsWith('/projects/')
        ) {
            return '/projects';
        }
        if (pathname === '/withdraw' || pathname === '/payments/result' || pathname === '/bond') {
            return '/income';
        }
        if (pathname === '/notifications') {
            return '/dashboard';
        }
        return pathname;
    };

    const isPathAllowed = (() => {
        const pathname = location.pathname;
        if (availableKeys.has(pathname)) {
            return true;
        }
        if (isMaterialShop) {
            return false;
        }
        if (normalizedProviderSubType === 'foreman') {
            return (
                pathname === '/notifications'
                || pathname === '/withdraw'
                || pathname === '/payments/result'
                || pathname === '/crew-tasks'
                || pathname.startsWith('/quote-lists')
                || pathname.startsWith('/projects/')
                || pathname.startsWith('/contracts/')
            );
        }
        return (
            pathname === '/leads'
            || pathname === '/notifications'
            || pathname === '/price-book'
            || pathname === '/orders'
            || pathname === '/complaints'
            || pathname === '/withdraw'
            || pathname === '/payments/result'
            || pathname === '/designer-tasks'
            || pathname.startsWith('/bookings/')
            || pathname.startsWith('/proposals/flow/')
            || pathname.startsWith('/quote-lists')
            || pathname.startsWith('/projects/')
            || pathname.startsWith('/contracts/')
        );
    })();

    const fallbackPath = isMaterialShop ? '/dashboard' : '/dashboard';
    const selectedMenuKey = resolveSelectedMenuKey(location.pathname);

    useEffect(() => {
        if (!isPathAllowed) {
            navigate(fallbackPath, { replace: true });
        }
    }, [fallbackPath, isPathAllowed, navigate]);

    useEffect(() => {
        const handler = () => navigate('/login', { replace: true });
        window.addEventListener('merchant-auth-expired', handler);
        return () => window.removeEventListener('merchant-auth-expired', handler);
    }, [navigate]);

    const handleLogout = () => {
        useMerchantAuthStore.getState().logout();
        navigate('/login');
    };

    const userMenu: MenuProps = {
        items: [
            {
                key: 'profile',
                label: '个人资料',
                icon: <UserOutlined />,
                onClick: () => navigate(isMaterialShop ? '/material-shop/settings' : '/settings'),
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
        <Layout style={{ minHeight: '100vh', height: '100vh', overflow: 'hidden' }}>
            <Sider
                trigger={null}
                collapsible
                collapsed={collapsed}
                width={240}
                style={{
                    background: '#001529',
                    boxShadow: '2px 0 8px 0 rgba(29,35,41,.05)',
                    height: '100vh',
                    overflowX: 'hidden',
                    overflowY: 'auto',
                }}
            >
                <div style={{
                    height: 64,
                    margin: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    gap: 12,
                    color: 'white',
                    fontSize: 18,
                    fontWeight: 'bold',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s',
                    cursor: 'pointer',
                }} onClick={() => navigate(fallbackPath)}>
                    <img
                        src={merchantAppIcon}
                        alt="禾泽云"
                        style={{
                            width: 32,
                            height: 32,
                            borderRadius: 10,
                            flexShrink: 0,
                            boxShadow: '0 8px 16px rgba(0,0,0,0.18)',
                        }}
                    />
                    {!collapsed && (
                        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                            <span style={{ fontSize: 15, fontWeight: 700 }}>禾泽云</span>
                            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)', fontWeight: 500 }}>
                                {isMaterialShop ? '主材商中心' : `商家中心 · ${subtypeLabel}`}
                            </span>
                        </div>
                    )}
                </div>
                <Menu
                    theme="dark"
                    mode="inline"
                    selectedKeys={[selectedMenuKey]}
                    defaultOpenKeys={[]}
                    items={menuItems}
                    onClick={({ key }) => {
                        if (availableKeys.has(key)) {
                            navigate(key);
                        } else {
                            navigate(fallbackPath);
                        }
                    }}
                    style={{ borderRight: 0 }}
                />
            </Sider>
            <Layout style={{ minWidth: 0, minHeight: 0 }}>
                <Header style={{
                    padding: '0 24px',
                    background: colorBgContainer,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxShadow: '0 1px 4px rgba(0,21,41,.08)',
                    zIndex: 1,
                    flexShrink: 0,
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
                        <Dropdown menu={userMenu} placement="bottomRight">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} data-testid="merchant-layout-identity">
                                <Avatar
                                    size="large"
                                    src={provider?.avatar}
                                    icon={<UserOutlined />}
                                    style={{ backgroundColor: '#1890ff' }}
                                />
                                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                                    <span style={{ fontWeight: 500 }}>{provider?.name || 'Merchant'}</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                        <Tag color="blue" style={{ marginInlineEnd: 0 }}>{identityTagLabel}</Tag>
                                    </div>
                                </div>
                            </div>
                        </Dropdown>
                    </div>
                </Header>
                <Content style={{
                    margin: 0,
                    background: '#f0f2f5',
                    flex: 1,
                    minHeight: 0,
                    overflowX: 'hidden',
                    overflowY: 'auto',
                    position: 'relative',
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
