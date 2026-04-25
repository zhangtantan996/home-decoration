/**
 * Mini program design tokens
 * Auto-generated from shared/design-tokens/tokens.json.
 * Do not edit manually.
 */

export const colors = {
    brand: '#D4AF37',
    primary: '#09090B',
    secondary: '#71717A',
    placeholder: '#A1A1AA',
    disabled: '#E4E4E7',
    bgPage: '#F8F9FA',
    bgCard: '#FFFFFF',
    border: '#E4E4E7',
    borderSoft: '#F4F4F5',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
    black: '#09090B',
    white: '#FFFFFF',
    gray50: '#FAFAFA',
    gray100: '#F4F4F5',
    gray200: '#E4E4E7',
    gray300: '#D4D4D8',
    gray400: '#A1A1AA',
    gray500: '#71717A',
    gray600: '#52525B',
    gray700: '#3F3F46',
    gray800: '#27272A',
    gray900: '#18181B',
  } as const;

export const radii = {
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    full: 9999,
  } as const;

export const spacing = {
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
  } as const;

export const font = {
    xs: 20,
    caption: 24,
    body: 28,
    h3: 32,
    h2: 34,
    h1: 40,
  } as const;

export const shadows = {
    sm: '0 2rpx 8rpx rgba(0, 0, 0, 0.05)',
    md: '0 4rpx 16rpx rgba(0, 0, 0, 0.1)',
    lg: '0 8rpx 24rpx rgba(0, 0, 0, 0.15)',
  } as const;

export type MiniDesignTokens = {
  colors: typeof colors;
  radii: typeof radii;
  spacing: typeof spacing;
  font: typeof font;
  shadows: typeof shadows;
};
