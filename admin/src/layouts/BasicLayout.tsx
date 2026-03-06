import React from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { Dropdown } from 'antd';
import { ProLayout, PageContainer } from '@ant-design/pro-components';
import { useAuthStore } from '../stores/authStore';
import merchantAppIcon from '../assets/branding/company-logo.png';
import NotificationDropdown from '../components/NotificationDropdown';
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

const BasicLayout: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { admin, logout, menus } = useAuthStore();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    // 递归转换菜单数据格式
    const transformMenuData = (data: any[]): any[] => {
        if (!data || !Array.isArray(data)) {
            console.warn('菜单数据不是数组:', data);
            return [];
        }
        return data.map(item => ({
            path: item.path,
            name: item.title,
            icon: item.icon ? iconMap[item.icon] : null,
            children: item.children ? transformMenuData(item.children) : undefined,
            hideInMenu: !item.visible,
        }));
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
            route={{ routes: menuData }}
            location={{ pathname: location.pathname }}
            menuItemRender={(item, dom) => (
                <div onClick={() => item.path && navigate(item.path)}>{dom}</div>
            )}
            actionsRender={() => [
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
                                    key: 'logout',
                                    icon: <LogoutOutlined />,
                                    label: '退出登录',
                                    onClick: handleLogout,
                                },
                            ],
                        }}
                    >
                        {avatarDom}
                    </Dropdown>
                ),
            }}
            breadcrumbProps={{
                itemRender: (route, _params, routes, _paths) => {
                    const last = routes.indexOf(route) === routes.length - 1;
                    return last || !route.path ? (
                        <span>{route.breadcrumbName}</span>
                    ) : (
                        <Link to={route.path}>{route.breadcrumbName}</Link>
                    );
                },
            }}
        >
            <PageContainer>
                <Outlet />
            </PageContainer>
        </ProLayout>
    );
};

export default BasicLayout;

