/**
 * Merchant Center theme constants
 * Auto-generated from shared/design-tokens/tokens.json.
 * Do not edit manually.
 */

export const MERCHANT_THEME = {
    primaryGradient: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
    primaryColor: '#1890ff',
    primaryColorDark: '#096dd9',
    primaryColorLight: '#69b1ff',
    pageBgGradient: 'linear-gradient(135deg, #f6f8fb 0%, #e9f0f9 100%)',
    accentGlowStart: 'rgba(24, 144, 255, 0.08)',
    accentGlowEnd: 'rgba(114, 46, 209, 0.05)',
    textPrimary: '#1e293b',
    textSecondary: '#64748b',
    textMuted: '#94a3b8',
    borderColor: '#e2e8f0',
    borderColorStrong: '#cbd5e1',
    surfaceBg: 'rgba(255, 255, 255, 0.75)',
    surfaceBorder: '1px solid rgba(255, 255, 255, 0.5)',
    surfaceShadow: '0 24px 48px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
    softShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
    hoverShadow: '0 12px 32px rgba(15, 23, 42, 0.12)',
    controlHeight: 48,
    controlRadius: 8,
    cardRadius: 24,
    sectionRadius: 16,
    onboarding: {
      sidebarWidth: 400,
      contentMaxWidth: 760,
      heroPadding: '64px 48px',
      contentPaddingDesktop: '48px 64px',
      contentPaddingMobile: '24px 16px',
      cardPaddingDesktop: 48,
      cardPaddingMobile: 24,
      sidebarShadow: '4px 0 24px rgba(0,0,0,0.1)',
    },
  } as const;

export type MerchantTheme = typeof MERCHANT_THEME;
