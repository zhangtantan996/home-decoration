import React, { useState } from "react";
import { Layout, Menu, Grid, Button, Typography, Dropdown } from "antd";
import {
  DashboardOutlined,
  ProjectOutlined,
  UserOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
  MobileOutlined,
} from "@ant-design/icons";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useSupervisorAuthStore } from "../stores/supervisorAuthStore";
import { SUPERVISOR_THEME } from "../constants/supervisorTheme";

const { Header, Sider, Content } = Layout;
const { useBreakpoint } = Grid;
const { Text } = Typography;

const SupervisorLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const screens = useBreakpoint();
  const navigate = useNavigate();
  const location = useLocation();
  const supervisor = useSupervisorAuthStore((s) => s.supervisor);
  const logout = useSupervisorAuthStore((s) => s.logout);

  const isMobile = !screens.md;

  const menuItems = [
    { key: "/dashboard", icon: <DashboardOutlined />, label: "工作台" },
    { key: "/projects", icon: <ProjectOutlined />, label: "项目" },
    { key: "/profile", icon: <UserOutlined />, label: "个人资料" },
    { key: "/sessions", icon: <MobileOutlined />, label: "设备管理" },
  ];

  const handleMenuClick = (info: { key: string }) => {
    navigate(info.key);
  };

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const userMenuItems = [
    {
      key: "profile",
      icon: <UserOutlined />,
      label: "个人资料",
      onClick: () => navigate("/profile"),
    },
    {
      key: "sessions",
      icon: <MobileOutlined />,
      label: "设备管理",
      onClick: () => navigate("/sessions"),
    },
    { type: "divider" as const },
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: "退出登录",
      danger: true,
      onClick: handleLogout,
    },
  ];

  // Mobile layout: bottom tab bar
  if (isMobile) {
    return (
      <Layout style={{ minHeight: "100vh" }}>
        <Header
          style={{
            background: "#fff",
            padding: "0 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid #f0f0f0",
            position: "sticky",
            top: 0,
            zIndex: 100,
            height: 48,
            lineHeight: "48px",
          }}
        >
          <Text strong style={{ fontSize: 16 }}>
            监理工作台
          </Text>
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <Button type="text" icon={<UserOutlined />} size="small">
              {supervisor?.realName || "监理"}
            </Button>
          </Dropdown>
        </Header>
        <Content
          style={{ padding: "12px", paddingBottom: 72, background: "#f6f8fb" }}
        >
          <Outlet />
        </Content>
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            background: "#fff",
            borderTop: "1px solid #f0f0f0",
            display: "flex",
            justifyContent: "space-around",
            padding: "6px 0",
            zIndex: 100,
          }}
        >
          {menuItems.map((item) => (
            <div
              key={item.key}
              onClick={() => navigate(item.key)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: "4px 12px",
                cursor: "pointer",
                color: location.pathname.startsWith(item.key)
                  ? SUPERVISOR_THEME.primaryColor
                  : "#999",
                fontSize: 12,
              }}
            >
              <span style={{ fontSize: 20, marginBottom: 2 }}>{item.icon}</span>
              {item.label}
            </div>
          ))}
        </div>
      </Layout>
    );
  }

  // Desktop layout: sidebar
  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        trigger={null}
        width={220}
        style={{
          background: "#001529",
        }}
      >
        <div
          style={{
            height: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: collapsed ? 18 : 20,
            fontWeight: 600,
            borderBottom: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          {collapsed ? "监" : "监理工作台"}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ borderRight: 0 }}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: "#fff",
            padding: "0 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid #f0f0f0",
            height: 64,
          }}
        >
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
              }}
            >
              <UserOutlined />
              <Text>{supervisor?.realName || "监理"}</Text>
            </div>
          </Dropdown>
        </Header>
        <Content
          style={{
            margin: 24,
            padding: 24,
            background: "#fff",
            borderRadius: 8,
            minHeight: 280,
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default SupervisorLayout;
