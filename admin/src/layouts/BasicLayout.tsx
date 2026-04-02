import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Dropdown, Input, Space } from 'antd';
import { ProLayout } from '@ant-design/pro-components';
import { adminAuthApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import merchantAppIcon from '../assets/branding/company-logo.png';
import NotificationDropdown from '../components/NotificationDropdown';
import { designTokens } from '../styles/theme';
import {
    DashboardOutlined,
    ProjectOutlined,
    TeamOutlined,
    BankOutlined,
    SafetyOutlined,
    SettingOutlined,
    UserOutlined,
    ShopOutlined,
    CalendarOutlined,
    StarOutlined,
    FileTextOutlined,
    LogoutOutlined,
    LockOutlined,
    ExclamationCircleOutlined,
    WarningOutlined,
    FileImageOutlined,
    UnorderedListOutlined,
    SearchOutlined,
} from '@ant-design/icons';

// 图标映射 - 根据后端返回的 icon 字段匹配对应的 React 组件
const iconMap: Record<string, React.ReactNode> = {
    'DashboardOutlined': <DashboardOutlined />,
    'UserOutlined': <UserOutlined />,
    'TeamOutlined': <TeamOutlined />,
    'ShopOutlined': <ShopOutlined />,
    'ProjectOutlined': <ProjectOutlined />,
    'CalendarOutlined': <CalendarOutlined />,
    'BankOutlined': <BankOutlined />,
    'StarOutlined': <StarOutlined />,
    'SafetyOutlined': <SafetyOutlined />,
    'FileTextOutlined': <FileTextOutlined />,
    'SettingOutlined': <SettingOutlined />,
    'LockOutlined': <LockOutlined />,
    'ExclamationCircleOutlined': <ExclamationCircleOutlined />,
    'WarningOutlined': <WarningOutlined />,
    'FileImageOutlined': <FileImageOutlined />,
    'UnorderedListOutlined': <UnorderedListOutlined />,
};

type MenuNode = {
    path?: string;
    title?: string;
    icon?: string;
    visible?: boolean;
    children?: MenuNode[];
};

type MenuRoute = {
    path?: string;
    name?: string;
    icon?: React.ReactNode | null;
    children?: MenuRoute[];
    hideInMenu?: boolean;
};

const isDynamicDetailPath = (path?: string) => typeof path === 'string' && /\/:[^/]+/.test(path);

const transformMenuData = (data: MenuNode[]): MenuRoute[] => {
    if (!data || !Array.isArray(data)) {
        console.warn('菜单数据不是数组:', data);
        return [];
    }
    const seenPaths = new Set<string>();

    return data.reduce<MenuRoute[]>((acc, item) => {
        if (item.path) {
            if (seenPaths.has(item.path)) {
                return acc;
            }
            seenPaths.add(item.path);
        }

        acc.push({
            path: item.path,
            name: item.title,
            icon: item.icon ? iconMap[item.icon] : null,
            children: item.children ? transformMenuData(item.children) : undefined,
            hideInMenu: !item.visible || isDynamicDetailPath(item.path),
        });

        return acc;
    }, []);
};

const BasicLayout: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { admin, logout, menus } = useAuthStore();

    const handleLogout = async () => {
        try {
            await adminAuthApi.logout();
        } catch {
            // ignore network failure, local state still needs cleanup
        } finally {
            logout();
            navigate('/login');
        }
    };

    const handleOpenSecuritySettings = () => {
        navigate('/security/settings');
    };

    const menuData = React.useMemo(() => {
        return transformMenuData(menus);
    }, [menus]);

    return (
        <ProLayout
            title="禾泽云管理后台"
            logo={<img src={merchantAppIcon} alt="禾泽云" style={{ width: 28, height: 28, borderRadius: 8 }} />}
            layout="mix"
            splitMenus={false}
            fixedHeader
            fixSiderbar
            breakpoint="lg"
            siderWidth={designTokens.sidebarWidth}
            collapsedButtonRender={false}
            token={{
                sider: {
                    colorMenuBackground: '#11203a',
                    colorTextMenu: 'rgba(255,255,255,0.72)',
                    colorTextMenuSelected: '#ffffff',
                    colorTextMenuActive: '#ffffff',
                    colorBgMenuItemSelected: 'rgba(37,99,235,0.22)',
                    colorBgMenuItemHover: 'rgba(255,255,255,0.1)',
                    colorTextMenuTitle: '#ffffff',
                    colorTextSubMenuSelected: '#ffffff',
                },
                header: {
                    colorBgHeader: '#ffffff',
                    colorHeaderTitle: designTokens.brand,
                    heightLayoutHeader: designTokens.headerHeight,
                },
                pageContainer: {
                    paddingBlockPageContainerContent: 24,
                    paddingInlinePageContainerContent: 24,
                },
            }}
            route={{ routes: menuData }}
            location={{ pathname: location.pathname }}
            menuItemRender={(item, dom) => (
                <div onClick={() => item.path && navigate(item.path)}>{dom}</div>
            )}
            actionsRender={() => [
                <Input
                    key="header-search"
                    allowClear
                    prefix={<SearchOutlined />}
                    placeholder="搜索菜单/功能"
                    className="hz-header-search"
                    style={{
                        width: 220,
                        borderRadius: designTokens.radiusSm,
                        background: designTokens.page,
                    }}
                />,
                <NotificationDropdown key="notification" />,
            ]}
            avatarProps={{
                src: admin?.avatar || 'https://gw.alipayobjects.com/zos/antfincdn/XAosXuNZyF/BiazfanxmamNRoxxVxka.png',
                title: admin?.nickname || admin?.username || '管理员',
                size: 'small',
                render: (_, avatarDom) => (
                    <Dropdown
                        menu={{
                            items: [
                                {
                                    key: 'security-settings',
                                    icon: <SafetyOutlined />,
                                    label: '安全设置',
                                    onClick: handleOpenSecuritySettings,
                                },
                                {
                                    key: 'logout',
                                    icon: <LogoutOutlined />,
                                    label: '退出登录',
                                    onClick: () => void handleLogout(),
                                },
                            ],
                        }}
                    >
                        {avatarDom}
                    </Dropdown>
                ),
            }}
            headerTitleRender={() => (
                <Space size={10} align="center" className="hz-header-brand">
                    <img src={merchantAppIcon} alt="禾泽云" className="hz-header-brand__logo" />
                    <span className="hz-page-title__heading hz-header-brand__title">禾泽云管理后台</span>
                </Space>
            )}
            breadcrumbRender={false}
        >
            <div className="hz-page-shell">
                <Outlet />
            </div>
        </ProLayout>
    );
};

export default BasicLayout;
