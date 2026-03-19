import type { ThemeConfig } from 'antd';

export const designTokens = {
  brand: '#0a1628',
  brandSoft: 'rgba(10,22,40,0.05)',
  accent: '#2563eb',
  accentSoft: 'rgba(37,99,235,0.07)',
  accentLight: '#dbeafe',
  surface: '#ffffff',
  page: '#f5f6f8',
  muted: '#64748b',
  border: '#e5e7eb',
  borderSoft: '#f1f3f5',
  success: '#059669',
  successSoft: 'rgba(5,150,105,0.08)',
  warning: '#d97706',
  warningSoft: 'rgba(217,119,6,0.08)',
  danger: '#dc2626',
  dangerSoft: 'rgba(220,38,38,0.08)',
  radiusSm: 10,
  radiusMd: 14,
  radiusLg: 20,
  radiusXl: 24,
  shadowCard: '0 1px 3px rgba(0,0,0,0.04), 0 6px 16px rgba(0,0,0,0.03)',
  shadowHover: '0 4px 12px rgba(0,0,0,0.06), 0 12px 28px rgba(0,0,0,0.05)',
  sidebarWidth: 240,
  sidebarCollapsedWidth: 68,
  headerHeight: 60,
} as const;

export const adminTheme: ThemeConfig = {
  token: {
    colorPrimary: designTokens.accent,
    colorBgContainer: designTokens.surface,
    colorBgLayout: designTokens.page,
    colorText: '#1a1a2e',
    colorTextSecondary: designTokens.muted,
    colorBorder: designTokens.border,
    borderRadius: designTokens.radiusSm,
    fontFamily: "'Inter', 'Noto Sans SC', 'PingFang SC', system-ui, sans-serif",
  },
  components: {
    Card: {
      borderRadiusLG: designTokens.radiusMd,
      boxShadowTertiary: designTokens.shadowCard,
    },
    Table: {
      borderRadiusLG: designTokens.radiusMd,
      headerBg: '#f8f9fb',
      headerColor: designTokens.muted,
      headerSplitColor: 'transparent',
      rowHoverBg: 'rgba(37,99,235,0.03)',
    },
    Button: {
      borderRadius: designTokens.radiusSm,
      controlHeight: 40,
      primaryShadow: 'none',
    },
    Input: {
      borderRadius: designTokens.radiusSm,
      controlHeight: 40,
    },
    Select: {
      borderRadius: designTokens.radiusSm,
      controlHeight: 40,
    },
    Tag: {
      borderRadiusSM: 6,
    },
    Modal: {
      borderRadiusLG: designTokens.radiusLg,
    },
    Drawer: {
      borderRadiusLG: 0,
    },
  },
};
