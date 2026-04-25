import type { ThemeConfig } from 'antd';

/**
 * Merchant Ant Design theme tokens
 * Auto-generated from shared/design-tokens/tokens.json.
 * Do not edit manually.
 */

export const merchantDesignTokens = {
    primaryColor: '#1890ff',
    primaryColorDark: '#096dd9',
    primaryColorLight: '#69b1ff',
    textPrimary: '#1e293b',
    textSecondary: '#64748b',
    textMuted: '#94a3b8',
    borderColor: '#e2e8f0',
    borderColorStrong: '#cbd5e1',
    pageBg: '#f6f8fb',
    surface: '#ffffff',
    surfaceBg: 'rgba(255, 255, 255, 0.75)',
    surfaceBorder: '1px solid rgba(255, 255, 255, 0.5)',
    surfaceShadow: '0 24px 48px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
    softShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
    hoverShadow: '0 12px 32px rgba(15, 23, 42, 0.12)',
    controlHeight: 48,
    controlRadius: 8,
    cardRadius: 24,
    sectionRadius: 16,
  } as const;

export const merchantTheme: ThemeConfig = {
  token: {
    colorPrimary: merchantDesignTokens.primaryColor,
    colorBgContainer: merchantDesignTokens.surface,
    colorBgLayout: merchantDesignTokens.pageBg,
    colorText: merchantDesignTokens.textPrimary,
    colorTextSecondary: merchantDesignTokens.textSecondary,
    colorBorder: merchantDesignTokens.borderColor,
    borderRadius: merchantDesignTokens.controlRadius,
    controlHeight: merchantDesignTokens.controlHeight,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  },
  components: {
    Card: {
      borderRadiusLG: merchantDesignTokens.cardRadius,
      boxShadowTertiary: merchantDesignTokens.softShadow,
    },
    Table: {
      borderRadiusLG: merchantDesignTokens.sectionRadius,
      headerBg: '#f8fafc',
      headerColor: merchantDesignTokens.textSecondary,
      headerSplitColor: 'transparent',
    },
    Button: {
      borderRadius: merchantDesignTokens.controlRadius,
      controlHeight: 40,
      primaryShadow: 'none',
    },
    Input: {
      borderRadius: merchantDesignTokens.controlRadius,
      controlHeight: 40,
    },
    Select: {
      borderRadius: merchantDesignTokens.controlRadius,
      controlHeight: 40,
    },
    Modal: {
      borderRadiusLG: merchantDesignTokens.sectionRadius,
    },
  },
};
