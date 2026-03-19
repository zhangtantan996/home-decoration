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
    NotificationOutlined,
    PictureOutlined,
    SettingOutlined,
    ShopOutlined,
    AppstoreOutlined,
    UserOutlined,
    LogoutOutlined,
    MenuFoldOutlined,
    MenuUnfoldOutlined,
} from '@ant-design/icons';
import merchantAppIcon from '../assets/branding/company-logo.png';

const { Header, Sider, Content } = Layout;

type MerchantApplicantType = 'personal' | 'studio' | 'company' | 'foreman';
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

    const normalizedApplicantType: MerchantApplicantType = (() => {
        const raw = String(provider?.applicantType || '').toLowerCase();
        if (raw === 'personal' || raw === 'studio' || raw === 'company' || raw === 'foreman') {
            return raw;
        }
        switch (Number(provider?.providerType)) {
            case 2:
                return 'company';
            case 3:
                return 'foreman';
            default:
                return 'personal';
        }
    })();

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
        switch (normalizedApplicantType) {
            case 'studio':
                return '设计工作室';
            case 'company':
                return '装修公司';
            case 'foreman':
                return '工长';
            default:
                return '设计师';
        }
    })();

    const isForeman = !isMaterialShop && normalizedProviderSubType === 'foreman';
    const isCompanyProvider = !isMaterialShop && normalizedProviderSubType === 'company';

    const serviceMenuItems: MenuProps['items'] = [
        {
            key: '/dashboard',
            icon: <DashboardOutlined />,
            label: '工作台',
        },
        {
            key: '/leads',
            icon: <NotificationOutlined />,
            label: isCompanyProvider ? '待分配线索' : '线索管理',
        },
        {
            key: '/bookings',
            icon: <CalendarOutlined />,
            label: '预约管理',
        },
        {
            key: '/proposals',
            icon: <FileTextOutlined />,
            label: isForeman ? '报价/施工方案' : '方案管理',
        },
        {
            key: '/quote-lists',
            icon: <FileTextOutlined />,
            label: '报价清单',
        },
        {
            key: '/projects',
            icon: <ProjectOutlined />,
            label: '项目执行',
        },
        ...(isForeman ? [{
            key: '/price-book',
            icon: <DollarOutlined />,
            label: '工长价格库',
        }] : []),
        {
            key: '/orders',
            icon: <DollarOutlined />,
            label: isCompanyProvider ? '订单协同' : '订单管理',
        },
        {
            key: '/complaints',
            icon: <NotificationOutlined />,
            label: '投诉响应',
        },
        {
            key: '/notifications',
            icon: <NotificationOutlined />,
            label: '通知中心',
        },
        {
            type: 'divider',
        },
        {
            key: 'finance',
            icon: <DollarOutlined />,
            label: '财务中心',
            children: [
                { key: '/income', label: isCompanyProvider ? '成交与收入' : '收入明细' },
                { key: '/withdraw', label: '提现管理' },
                { key: '/bank-accounts', label: '银行卡' },
            ],
        },
        {
            key: '/cases',
            icon: <PictureOutlined />,
            label: isForeman ? '施工案例' : (isCompanyProvider ? '公司案例' : '作品集'),
        },
        {
            key: '/settings',
            icon: <SettingOutlined />,
            label: isCompanyProvider ? '企业设置' : '账户设置',
        },
    ];

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
        : serviceMenuItems;

    const availableKeys = new Set<string>(
        (menuItems || []).flatMap((item) => {
            if (!item || typeof item !== 'object') {
                return [];
            }
            if ('children' in item && Array.isArray(item.children)) {
                return item.children
                    .flatMap((child) => (
                        child && typeof child === 'object' && 'key' in child && typeof child.key === 'string'
                            ? [child.key]
                            : []
                    ));
            }
            if ('key' in item && typeof item.key === 'string') {
                return [item.key];
            }
            return [];
        }),
    );

    const filteredMenuItems = menuItems
        .map((item) => {
            if (!item || typeof item !== 'object' || !('key' in item)) {
                return item;
            }
            if (item.key === 'finance' && 'children' in item) {
                const children = (item.children || []).filter((child) => 
                    child && typeof child === 'object' && 'key' in child && typeof child.key === 'string' && availableKeys.has(child.key)
                ) as Array<{ key: string; label: string }>;
                if (!children.length) {
                    return null;
                }
                return { ...item, children };
            }
            return typeof item.key === 'string' && availableKeys.has(item.key) ? item : null;
        })
        .filter(Boolean) as MenuProps['items'];

    const fallbackPath = isMaterialShop ? '/dashboard' : '/dashboard';
    const isPathAllowed = availableKeys.has(location.pathname)
        || (!isMaterialShop && location.pathname.startsWith('/projects/'))
        || Array.from(availableKeys).some((key) => key !== '/' && location.pathname.startsWith(`${key}/`));

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
                    selectedKeys={[location.pathname]}
                    defaultOpenKeys={[]}
                    items={filteredMenuItems}
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
            <Layout>
                <Header style={{
                    padding: '0 24px',
                    background: colorBgContainer,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxShadow: '0 1px 4px rgba(0,21,41,.08)',
                    zIndex: 1,
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
                                        <Tag color="blue" style={{ marginInlineEnd: 0 }}>{subtypeLabel}</Tag>
                                    </div>
                                </div>
                            </div>
                        </Dropdown>
                    </div>
                </Header>
                <Content style={{
                    margin: 0,
                    background: '#f0f2f5',
                    minHeight: 280,
                    overflow: 'auto',
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
