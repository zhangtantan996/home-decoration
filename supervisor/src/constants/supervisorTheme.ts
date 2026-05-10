export const SUPERVISOR_THEME = {
  primaryGradient: "linear-gradient(135deg, #52c41a 0%, #389e0d 100%)",
  primaryColor: "#52c41a",
  primaryColorDark: "#389e0d",
  primaryColorLight: "#95de64",
  textPrimary: "#1e293b",
  textSecondary: "#64748b",
  textMuted: "#94a3b8",
  borderColor: "#e2e8f0",
  controlHeight: 48,
  controlRadius: 8,
  cardRadius: 16,
  sectionRadius: 12,
} as const;

export type SupervisorTheme = typeof SUPERVISOR_THEME;
