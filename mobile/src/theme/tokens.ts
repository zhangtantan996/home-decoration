/**
 * React Native design tokens
 * Auto-generated from shared/design-tokens/tokens.json.
 * Do not edit manually.
 */

export const colors = {
    brand: '#D4AF37',
    primary: '#09090B',
    secondary: '#71717A',
    placeholder: '#A1A1AA',
    disabled: '#D4D4D8',
    bgPage: '#FAFAFA',
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

export const spacing = {
    xs: 8,
    sm: 12,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  } as const;

export const radii = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    full: 9999,
  } as const;

export const typography = {
    xs: 10,
    caption: 12,
    body: 14,
    h3: 16,
    lg: 18,
    h2: 18,
    h1: 20,
  } as const;

export const shadows = {
    sm: '0 2px 8px rgba(0, 0, 0, 0.05)',
    md: '0 4px 16px rgba(0, 0, 0, 0.1)',
    lg: '0 8px 24px rgba(0, 0, 0, 0.15)',
  } as const;

export type DesignTokens = {
  colors: typeof colors;
  spacing: typeof spacing;
  radii: typeof radii;
  typography: typeof typography;
  shadows: typeof shadows;
};
