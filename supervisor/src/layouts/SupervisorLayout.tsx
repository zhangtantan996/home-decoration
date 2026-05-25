import React, { useState } from "react";
import { Layout, Menu, Grid, Button, Typography, Dropdown, Avatar } from "antd";
import {
  DashboardOutlined,
  ProjectOutlined,
  UserOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
  MobileOutlined,
  BellOutlined,
} from "@ant-design/icons";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import SupervisorBrand from "../components/SupervisorBrand";
import { useSupervisorAuthStore } from "../stores/supervisorAuthStore";
import { SUPERVISOR_THEME } from "../constants/supervisorTheme";
import { useSupervisorDocumentBranding } from "../utils/branding";

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
  useSupervisorDocumentBranding();

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
      <Layout className="supervisor-shell">
        <Header
          className="supervisor-mobile-header"
          style={{
            background: "rgba(254, 254, 254, 0.94)",
            padding: "0 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: `1px solid ${SUPERVISOR_THEME.borderColor}`,
            position: "sticky",
            top: 0,
            zIndex: 220,
            minHeight: 58,
            height: "auto",
            lineHeight: "normal",
            backdropFilter: "blur(18px)",
          }}
        >
          <SupervisorBrand
            size="sm"
            title="禾泽云 · 监理端"
            subtitle="项目巡检工作台"
          />
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <Button
              type="text"
              icon={<UserOutlined />}
              size="small"
              style={{ maxWidth: 118, overflow: "hidden" }}
            >
              {supervisor?.realName || "监理"}
            </Button>
          </Dropdown>
        </Header>
        <Content
          style={{
            padding: "14px 0 96px",
            background: "transparent",
          }}
        >
          <Outlet />
        </Content>
        <div
          className="supervisor-mobile-tab"
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            background: "rgba(254, 254, 254, 0.96)",
            borderTop: `1px solid ${SUPERVISOR_THEME.borderColor}`,
            display: "flex",
            justifyContent: "space-around",
            padding: "8px 8px",
            zIndex: 210,
            backdropFilter: "blur(18px)",
          }}
        >
          {menuItems.map((item) => (
            <div
              key={item.key}
              className={`supervisor-mobile-tab-item ${
                location.pathname.startsWith(item.key)
                  ? "supervisor-mobile-tab-item-active"
                  : ""
              }`}
              onClick={() => navigate(item.key)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                flex: 1,
                minWidth: 0,
                minHeight: 48,
                padding: "6px 10px",
                cursor: "pointer",
                color: location.pathname.startsWith(item.key)
                  ? SUPERVISOR_THEME.primaryColor
                  : SUPERVISOR_THEME.textMuted,
                fontSize: 12,
                fontWeight: location.pathname.startsWith(item.key) ? 600 : 500,
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
    <Layout className="supervisor-shell">
      <Sider
        className="supervisor-sidebar"
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        trigger={null}
        width={220}
        style={{
          background: "rgba(251, 252, 255, 0.94)",
          borderRight: `1px solid ${SUPERVISOR_THEME.borderColor}`,
          boxShadow: "10px 0 30px rgba(23, 32, 51, 0.04)",
        }}
      >
        <div
          style={{
            height: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "flex-start",
            padding: collapsed ? 0 : "0 18px",
            borderBottom: `1px solid ${SUPERVISOR_THEME.borderColor}`,
          }}
        >
          <SupervisorBrand
            size={collapsed ? "sm" : "md"}
            hideText={collapsed}
            title="禾泽云 · 监理端"
            subtitle="项目巡检工作台"
            titleColor={SUPERVISOR_THEME.textPrimary}
            subtitleColor={SUPERVISOR_THEME.textSecondary}
          />
        </div>
        <Menu
          className="supervisor-sidebar-menu"
          theme="light"
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
            background: "rgba(254, 254, 254, 0.84)",
            padding: "0 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: `1px solid ${SUPERVISOR_THEME.borderColor}`,
            height: 64,
            position: "sticky",
            top: 0,
            zIndex: 10,
            backdropFilter: "blur(18px)",
          }}
        >
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
          <div style={{ flex: 1 }} />
          <Button
            type="text"
            aria-label="通知"
            icon={<BellOutlined />}
            style={{ marginRight: 8 }}
          />
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                cursor: "pointer",
                padding: "6px 10px",
                borderRadius: SUPERVISOR_THEME.controlRadius,
              }}
            >
              <Avatar
                size={28}
                style={{
                  background: SUPERVISOR_THEME.primaryColorLight,
                  color: SUPERVISOR_THEME.primaryColorDark,
                }}
                icon={<UserOutlined />}
              />
              <Text strong>{supervisor?.realName || "监理"}</Text>
            </div>
          </Dropdown>
        </Header>
        <Content
          style={{
            margin: 0,
            padding: 24,
            background: "transparent",
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
