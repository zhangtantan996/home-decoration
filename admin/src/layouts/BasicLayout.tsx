import React from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { Dropdown } from 'antd';
import { ProLayout, PageContainer } from '@ant-design/pro-components';
import { useAuthStore } from '../stores/authStore';
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
} from '@ant-design/icons';

const menuData = [
    {
        path: '/dashboard',
        name: '工作台',
        icon: <DashboardOutlined />,
    },
    {
        path: '/users',
        name: '用户管理',
        icon: <UserOutlined />,
        children: [
            { path: '/users/list', name: '用户列表' },
            { path: '/users/admins', name: '管理员' },
        ],
    },
    {
        path: '/providers',
        name: '服务商管理',
        icon: <TeamOutlined />,
        children: [
            { path: '/providers/designers', name: '设计师' },
            { path: '/providers/companies', name: '装修公司' },
            { path: '/providers/foremen', name: '工长' },
            { path: '/providers/audit', name: '资质审核' },
        ],
    },
    {
        path: '/materials',
        name: '主材门店',
        icon: <ShopOutlined />,
        children: [
            { path: '/materials/list', name: '门店列表' },
            { path: '/materials/audit', name: '认证审核' },
        ],
    },
    {
        path: '/projects',
        name: '项目管理',
        icon: <ProjectOutlined />,
        children: [
            { path: '/projects/list', name: '工地列表' },
            { path: '/projects/map', name: '全景地图' },
        ],
    },
    {
        path: '/bookings',
        name: '预约管理',
        icon: <CalendarOutlined />,
    },
    {
        path: '/finance',
        name: '资金中心',
        icon: <BankOutlined />,
        children: [
            { path: '/finance/escrow', name: '托管账户' },
            { path: '/finance/transactions', name: '交易记录' },
        ],
    },
    {
        path: '/reviews',
        name: '评价管理',
        icon: <StarOutlined />,
    },
    {
        path: '/risk',
        name: '风控中心',
        icon: <SafetyOutlined />,
        children: [
            { path: '/risk/warnings', name: '风险预警' },
            { path: '/risk/arbitration', name: '仲裁中心' },
        ],
    },
    {
        path: '/logs',
        name: '操作日志',
        icon: <FileTextOutlined />,
    },
    {
        path: '/settings',
        name: '系统设置',
        icon: <SettingOutlined />,
    },
];

const BasicLayout: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { admin, logout } = useAuthStore();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <ProLayout
            title="装修管理后台"
            logo={null}
            layout="mix"
            splitMenus={false}
            fixedHeader
            fixSiderbar
            route={{ routes: menuData }}
            location={{ pathname: location.pathname }}
            menuItemRender={(item, dom) => (
                <div onClick={() => item.path && navigate(item.path)}>{dom}</div>
            )}
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
                itemRender: (route, params, routes, paths) => {
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

