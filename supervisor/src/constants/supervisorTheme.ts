export const SUPERVISOR_THEME = {
  primaryGradient: "linear-gradient(135deg, #4f9cff 0%, #2f80ed 100%)",
  primaryColor: "#2f80ed",
  primaryColorDark: "#1f5fbf",
  primaryColorLight: "#dbeafe",
  successColor: "#34c759",
  warningColor: "#ff9500",
  errorColor: "#ff3b30",
  pageBg: "#f5f7fb",
  surface: "#fefefe",
  surfaceMuted: "#f8fafd",
  textPrimary: "#172033",
  textSecondary: "#667085",
  textMuted: "#98a2b3",
  borderColor: "#e6eaf2",
  borderColorStrong: "#d0d7e2",
  softShadow:
    "0 18px 42px rgba(23, 32, 51, 0.08), 0 2px 8px rgba(23, 32, 51, 0.04)",
  subtleShadow: "0 8px 24px rgba(23, 32, 51, 0.06)",
  controlHeight: 48,
  controlRadius: 12,
  cardRadius: 18,
  sectionRadius: 16,
} as const;

export type SupervisorTheme = typeof SUPERVISOR_THEME;
