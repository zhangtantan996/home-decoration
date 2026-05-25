export const normalizeRedirectPath = (value: string | null, fallback = "/dashboard") => {
  const trimmed = (value || "").trim();
  if (!trimmed || !trimmed.startsWith("/") || trimmed.startsWith("//")) return fallback;
  if (/^\/login(?:$|[?#/])/.test(trimmed)) return fallback;
  return trimmed;
};
