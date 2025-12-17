import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { ProLayout, PageContainer } from '@ant-design/pro-components';
import {
    DashboardOutlined,
    ProjectOutlined,
    TeamOutlined,
    BankOutlined,
    SafetyOutlined,
    SettingOutlined,
} from '@ant-design/icons';

const menuData = [
    {
        path: '/dashboard',
        name: '工作台',
        icon: <DashboardOutlined />,
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
        path: '/finance',
        name: '资金中心',
        icon: <BankOutlined />,
        children: [
            { path: '/finance/escrow', name: '托管账户' },
            { path: '/finance/transactions', name: '交易记录' },
        ],
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
        path: '/settings',
        name: '系统设置',
        icon: <SettingOutlined />,
    },
];

const BasicLayout: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();

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
                src: 'https://gw.alipayobjects.com/zos/antfincdn/XAosXuNZyF/BiazfanxmamNRoxxVxka.png',
                title: '管理员',
                size: 'small',
            }}
        >
            <PageContainer>
                <Outlet />
            </PageContainer>
        </ProLayout>
    );
};

export default BasicLayout;
