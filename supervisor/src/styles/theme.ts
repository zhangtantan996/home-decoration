import type { ThemeConfig } from "antd";

export const supervisorDesignTokens = {
  primaryColor: "#2f80ed",
  primaryColorDark: "#1f5fbf",
  primaryColorLight: "#dbeafe",
  successColor: "#34c759",
  warningColor: "#ff9500",
  errorColor: "#ff3b30",
  textPrimary: "#172033",
  textSecondary: "#667085",
  textMuted: "#98a2b3",
  borderColor: "#e6eaf2",
  borderColorStrong: "#d0d7e2",
  pageBg: "#f5f7fb",
  sidebarBg: "#fbfcff",
  surface: "#fefefe",
  surfaceMuted: "#f8fafd",
  controlHeight: 48,
  controlRadius: 12,
  cardRadius: 18,
  sectionRadius: 16,
} as const;

export const supervisorTheme: ThemeConfig = {
  token: {
    colorPrimary: supervisorDesignTokens.primaryColor,
    colorSuccess: supervisorDesignTokens.successColor,
    colorWarning: supervisorDesignTokens.warningColor,
    colorError: supervisorDesignTokens.errorColor,
    colorBgContainer: supervisorDesignTokens.surface,
    colorBgLayout: supervisorDesignTokens.pageBg,
    colorText: supervisorDesignTokens.textPrimary,
    colorTextSecondary: supervisorDesignTokens.textSecondary,
    colorBorder: supervisorDesignTokens.borderColor,
    borderRadius: supervisorDesignTokens.controlRadius,
    borderRadiusLG: supervisorDesignTokens.cardRadius,
    borderRadiusSM: 8,
    boxShadow:
      "0 18px 42px rgba(23, 32, 51, 0.08), 0 2px 8px rgba(23, 32, 51, 0.04)",
    boxShadowSecondary: "0 8px 24px rgba(23, 32, 51, 0.06)",
    controlHeight: supervisorDesignTokens.controlHeight,
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  },
  components: {
    Card: {
      borderRadiusLG: supervisorDesignTokens.cardRadius,
      colorBorderSecondary: supervisorDesignTokens.borderColor,
      boxShadowTertiary: "0 8px 24px rgba(23, 32, 51, 0.05)",
    },
    Button: {
      borderRadius: supervisorDesignTokens.controlRadius,
      controlHeight: 40,
      primaryShadow: "none",
    },
    Input: {
      borderRadius: supervisorDesignTokens.controlRadius,
      controlHeight: 40,
    },
    Select: {
      borderRadius: supervisorDesignTokens.controlRadius,
      controlHeight: 40,
    },
    Layout: {
      bodyBg: supervisorDesignTokens.pageBg,
      headerBg: supervisorDesignTokens.surface,
      siderBg: supervisorDesignTokens.sidebarBg,
    },
    Menu: {
      itemBg: "transparent",
      itemSelectedBg: supervisorDesignTokens.primaryColorLight,
      itemSelectedColor: supervisorDesignTokens.primaryColorDark,
      itemHoverBg: supervisorDesignTokens.surfaceMuted,
      itemBorderRadius: 12,
    },
    Tabs: {
      itemSelectedColor: supervisorDesignTokens.primaryColorDark,
      inkBarColor: supervisorDesignTokens.primaryColor,
    },
  },
};
