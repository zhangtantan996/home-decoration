/**
 * Merchant Center Theme Constants
 * 
 * Unified theme configuration for merchant authentication and public pages.
 * Consolidates colors, spacing, and responsive breakpoints.
 */

export const MERCHANT_THEME = {
  // Primary brand colors - unified blue gradient
  primaryGradient: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
  primaryColor: '#1890ff',
  primaryColorDark: '#096dd9',

  // Page background - purple gradient for brand differentiation
  pageBgGradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',

  // Card dimensions
  cardWidth: 420,
  cardMaxWidth: '90vw',
  cardBorderRadius: 8,

  // Role card dimensions
  roleCardMinHeight: 200,

  // Responsive breakpoints (aligned with Ant Design Grid)
  breakpoints: {
    mobile: 576,
    tablet: 768,
    desktop: 992,
  },

  // Icon usage guidelines
  icons: {
    // 禁止使用 Emoji，必须使用 Ant Design Icons
    // 示例：
    // import { HomeOutlined, UserOutlined } from '@ant-design/icons';
    primaryColor: '#1890ff',
    size: {
      small: 14,
      default: 16,
      large: 20,
    },
  },

  // Accessibility configuration
  accessibility: {
    minTouchTarget: 44, // 最小触摸目标尺寸（WCAG 2.5.5）
    focusOutlineColor: '#1890ff',
    focusOutlineWidth: 2,
  },
} as const;

// Type export for consuming components
export type MerchantTheme = typeof MERCHANT_THEME;
