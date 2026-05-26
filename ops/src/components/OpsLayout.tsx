import { AppstoreOutlined, DownOutlined, FileTextOutlined, HomeFilled, LogoutOutlined, ProjectOutlined, ScheduleOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { Avatar, Dropdown, Layout, Menu, Typography } from 'antd';
import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import companyLogo from '../assets/branding/company-logo.png';
import { useAuthStore } from '../stores/authStore';

const { Header, Content, Sider } = Layout;

const baseItems = [
  { key: '/dashboard', icon: <HomeFilled />, label: '工作台首页' },
  { key: '/providers', icon: <AppstoreOutlined />, label: '服务商' },
  { key: '/inspirations', icon: <FileTextOutlined />, label: '灵感编辑' },
  { key: '/bookings', icon: <ScheduleOutlined />, label: '预约记录' },
  { key: '/audit-logs', icon: <UnorderedListOutlined />, label: '操作记录' },
];

const projectsItem = { key: '/projects', icon: <ProjectOutlined />, label: '项目管理' };

const MenuToggleIcon = ({ collapsed }: { collapsed: boolean }) => (
  <svg className="ops-shell__collapse-svg" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 5.5h10" />
    <path d="M4 12h10" />
    <path d="M4 18.5h10" />
    {collapsed ? (
      <path d="M16 8l4 4-4 4" />
    ) : (
      <path d="M20 8l-4 4 4 4" />
    )}
  </svg>
);

const OpsLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const canAccessProjects = useAuthStore((state) => state.hasPermission('project:list'));
  const logout = useAuthStore((state) => state.logout);
  const [menuCollapsed, setMenuCollapsed] = useState(false);
  const items = canAccessProjects ? [...baseItems, projectsItem] : baseItems;
  const accountMenuItems = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: () => {
        logout();
        navigate('/login');
      },
    },
  ];

  return (
    <Layout className="ops-shell">
      <Header className="ops-shell__header">
        <div className="ops-shell__brand">
          <img className="ops-shell__brand-mark" src={companyLogo} alt="公司 Logo" />
          <div>
            <div className="ops-shell__brand-title">禾泽云 · 运营平台</div>
          </div>
        </div>
        <div className="ops-shell__header-actions">
          <Dropdown menu={{ items: accountMenuItems }} trigger={['click']} placement="bottomRight">
            <button type="button" className="ops-shell__account">
              <Avatar size={40}>{(user?.nickname || user?.username || '运').slice(0, 1)}</Avatar>
              <div className="ops-shell__account-text">
                <Typography.Text strong>{user?.nickname || user?.username || '超级管理员'}</Typography.Text>
                <Typography.Text type="secondary">内部维护账号</Typography.Text>
              </div>
              <DownOutlined className="ops-shell__account-arrow" />
            </button>
          </Dropdown>
        </div>
      </Header>
      <Layout className="ops-shell__body">
        <Sider width={menuCollapsed ? 84 : 236} className={`ops-shell__sider ${menuCollapsed ? 'ops-shell__sider--collapsed' : ''}`}>
          <Menu
            mode="inline"
            className="ops-shell__menu"
            selectedKeys={[items.find((item) => location.pathname.startsWith(item.key))?.key || '/providers']}
            items={items}
            onClick={({ key }) => navigate(key)}
          />
          <button type="button" className="ops-shell__collapse" onClick={() => setMenuCollapsed((value) => !value)}>
            <MenuToggleIcon collapsed={menuCollapsed} />
            <span>{menuCollapsed ? '展开菜单' : '收起菜单'}</span>
          </button>
        </Sider>
        <Content className="ops-shell__content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default OpsLayout;
