import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Dropdown, Input, Space } from 'antd';
import { ProLayout } from '@ant-design/pro-components';
import { adminAuthApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import merchantAppIcon from '../assets/branding/company-logo.png';
import NotificationDropdown from '../components/NotificationDropdown';
import { designTokens } from '../styles/theme';
import { resolveMenuTargetPath } from '../utils/menuRouting';
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
const trimTrailingSlash = (path: string) => path.replace(/\/+$/, '') || '/';

type ActiveMenuState = {
    selectedKeys: string[];
    openKeys: string[];
};

type MenuIndex = {
    parentByKey: Map<string, string | undefined>;
    hasChildren: Set<string>;
};

const transformMenuData = (data: MenuNode[], seenPaths = new Set<string>()): MenuRoute[] => {
    if (!data || !Array.isArray(data)) {
        console.warn('菜单数据不是数组:', data);
        return [];
    }

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
            children: item.children ? transformMenuData(item.children, seenPaths) : undefined,
            hideInMenu: !item.visible || isDynamicDetailPath(item.path),
        });

        return acc;
    }, []);
};

const buildMenuIndex = (routes: MenuRoute[]): MenuIndex => {
    const parentByKey = new Map<string, string | undefined>();
    const hasChildren = new Set<string>();

    const visit = (items: MenuRoute[], parentKey?: string) => {
        items.forEach((item) => {
            const key = item.path;
            if (!key) {
                return;
            }
            parentByKey.set(key, parentKey);
            if (Array.isArray(item.children) && item.children.length > 0) {
                hasChildren.add(key);
                visit(item.children, key);
            }
        });
    };

    visit(routes);
    return { parentByKey, hasChildren };
};

const routePathMatches = (routePath: string, pathname: string) => {
    const normalizedRoutePath = trimTrailingSlash(routePath);
    const normalizedPathname = trimTrailingSlash(pathname);

    if (isDynamicDetailPath(normalizedRoutePath)) {
        const pattern = normalizedRoutePath
            .split('/')
            .map((segment) => (segment.startsWith(':') ? '[^/]+' : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
            .join('/');
        return new RegExp(`^${pattern}(?:/|$)`).test(normalizedPathname);
    }

    return normalizedPathname === normalizedRoutePath || normalizedPathname.startsWith(`${normalizedRoutePath}/`);
};

const resolveActiveMenuState = (routes: MenuRoute[], pathname: string): ActiveMenuState => {
    let bestMatch: { selectedKey: string; openKeys: string[]; score: number } | undefined;

    const visit = (items: MenuRoute[], parentKeys: string[]) => {
        items.forEach((item) => {
            const key = item.path;
            if (!key || item.hideInMenu) {
                return;
            }

            const hasChildren = Array.isArray(item.children) && item.children.length > 0;
            const matches = routePathMatches(key, pathname);
            if (matches) {
                const exact = trimTrailingSlash(pathname) === trimTrailingSlash(key);
                const openKeys = hasChildren && !exact ? [...parentKeys, key] : parentKeys;
                const score = trimTrailingSlash(key).length * 10 + openKeys.length;
                if (!bestMatch || score > bestMatch.score) {
                    bestMatch = { selectedKey: key, openKeys, score };
                }
            }

            if (hasChildren) {
                visit(item.children || [], [...parentKeys, key]);
            }
        });
    };

    visit(routes, []);

    return {
        selectedKeys: bestMatch?.selectedKey ? [bestMatch.selectedKey] : [],
        openKeys: bestMatch?.openKeys || [],
    };
};

const rootKeyFor = (key: string, parentByKey: MenuIndex['parentByKey']) => {
    let current = key;
    let parent = parentByKey.get(current);

    while (parent) {
        current = parent;
        parent = parentByKey.get(current);
    }

    return current;
};

const normalizeOpenKeys = (keys: string[], menuIndex: MenuIndex) => {
    const submenuKeys = Array.from(new Set(keys)).filter((key) => menuIndex.hasChildren.has(key));
    const latestKey = submenuKeys[submenuKeys.length - 1];
    if (!latestKey) {
        return [];
    }

    const latestRoot = rootKeyFor(latestKey, menuIndex.parentByKey);
    return submenuKeys.filter((key) => rootKeyFor(key, menuIndex.parentByKey) === latestRoot);
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
    const menuIndex = React.useMemo(() => buildMenuIndex(menuData), [menuData]);
    const activeMenuState = React.useMemo(
        () => resolveActiveMenuState(menuData, location.pathname),
        [location.pathname, menuData],
    );
    const [openKeys, setOpenKeys] = React.useState<string[]>(activeMenuState.openKeys);

    React.useEffect(() => {
        setOpenKeys(activeMenuState.openKeys);
    }, [activeMenuState]);

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
            selectedKeys={activeMenuState.selectedKeys}
            openKeys={openKeys}
            onOpenChange={(keys) => {
                if (keys === false) {
                    setOpenKeys([]);
                    return;
                }
                setOpenKeys(normalizeOpenKeys(keys, menuIndex));
            }}
            menuItemRender={(item, dom) => (
                <div
                    onClick={() => {
                        const nextPath = resolveMenuTargetPath(item as MenuRoute);
                        if (nextPath) {
                            navigate(nextPath);
                        }
                    }}
                >
                    {dom}
                </div>
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
