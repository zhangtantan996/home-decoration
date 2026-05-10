import type { ThemeConfig } from "antd";

export const supervisorDesignTokens = {
  primaryColor: "#52c41a",
  primaryColorDark: "#389e0d",
  primaryColorLight: "#95de64",
  textPrimary: "#1e293b",
  textSecondary: "#64748b",
  textMuted: "#94a3b8",
  borderColor: "#e2e8f0",
  borderColorStrong: "#cbd5e1",
  pageBg: "#f6f8fb",
  surface: "#ffffff",
  controlHeight: 48,
  controlRadius: 8,
  cardRadius: 16,
  sectionRadius: 12,
} as const;

export const supervisorTheme: ThemeConfig = {
  token: {
    colorPrimary: supervisorDesignTokens.primaryColor,
    colorBgContainer: supervisorDesignTokens.surface,
    colorBgLayout: supervisorDesignTokens.pageBg,
    colorText: supervisorDesignTokens.textPrimary,
    colorTextSecondary: supervisorDesignTokens.textSecondary,
    colorBorder: supervisorDesignTokens.borderColor,
    borderRadius: supervisorDesignTokens.controlRadius,
    controlHeight: supervisorDesignTokens.controlHeight,
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  },
  components: {
    Card: {
      borderRadiusLG: supervisorDesignTokens.cardRadius,
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
  },
};
