export const isSafeEvidenceUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 500) return false;
  if (/^(javascript|data|vbscript|file|about):/i.test(trimmed)) return false;
  if (trimmed.startsWith('/uploads/') || trimmed.startsWith('/static/')) return true;
  return /^https?:\/\//i.test(trimmed);
};

export const parseSafeEvidenceUrls = (value: string) =>
  value
    .split(/\n|,|，/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter(isSafeEvidenceUrl)
    .slice(0, 10);

export const parseEvidenceUrlInput = (value: string) => {
  const entries = value
    .split(/\n|,|，/)
    .map((item) => item.trim())
    .filter(Boolean);
  const safeUrls = entries.filter(isSafeEvidenceUrl);
  return {
    urls: safeUrls.slice(0, 10),
    invalidCount: entries.length - safeUrls.length,
    tooManyCount: Math.max(safeUrls.length - 10, 0),
  };
};
