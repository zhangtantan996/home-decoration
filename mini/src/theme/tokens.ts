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
    bgPageTop: '#F6F8FB',
    bgPageBottom: '#EEF3FA',
    bgCard: '#FFFFFF',
    surfaceCard: 'rgba(255, 255, 255, 0.92)',
    surfaceNav: 'rgba(255, 255, 255, 0.78)',
    surfaceInput: 'rgba(255, 255, 255, 0.96)',
    surfaceBorder: 'rgba(255, 255, 255, 0.78)',
    navBackOverlay: 'rgba(0, 0, 0, 0.1)',
    border: '#E4E4E7',
    borderSoft: '#F4F4F5',
    lineSoft: '#DCE3EE',
    success: '#10B981',
    successSoft: '#E8F7F1',
    successMain: '#28B08C',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
    brandSoft: '#EAF1FF',
    brandMain: '#6F90F6',
    accentBlue: '#5B8CFF',
    accentBlueSoft: '#EEF4FF',
    buttonDisabled: '#D8E3F5',
    buttonDisabledSoft: '#DCE7F8',
    textPrimary: '#111827',
    textSecondary: '#667085',
    textTertiary: '#98A2B3',
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
    card: 28,
    input: 24,
    pill: 9999,
  } as const;

export const spacing = {
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
    pageX: 32,
    blockY: 24,
    cardPadding: 32,
  } as const;

export const font = {
    xs: 20,
    caption: 24,
    body: 28,
    h3: 32,
    h2: 34,
    h1: 40,
    statusTitle: 64,
    sectionTitle: 44,
    label: 30,
  } as const;

export const shadows = {
    sm: '0 2rpx 8rpx rgba(0, 0, 0, 0.05)',
    md: '0 4rpx 16rpx rgba(0, 0, 0, 0.1)',
    lg: '0 8rpx 24rpx rgba(0, 0, 0, 0.15)',
    card: '0 12rpx 40rpx rgba(17, 24, 39, 0.06)',
    focus: '0 0 0 6rpx rgba(111, 144, 246, 0.12)',
  } as const;

export type MiniDesignTokens = {
  colors: typeof colors;
  radii: typeof radii;
  spacing: typeof spacing;
  font: typeof font;
  shadows: typeof shadows;
};
