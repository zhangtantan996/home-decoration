import type { ProviderPriceDisplayMode, ProviderPriceDisplayVM, ProviderRole } from "../types/viewModels";

export type ProviderRatingSampleState = "none" | "small" | "stable";

export function normalizeProviderPriceDisplay(
  value?: Partial<ProviderPriceDisplayVM> | null,
): ProviderPriceDisplayVM {
  const primary = String(value?.primary || "").trim() || "按需报价";
  const details = Array.isArray(value?.details)
    ? value!.details.map((item) => String(item).trim()).filter(Boolean)
    : [];

  return {
    primary,
    secondary: String(value?.secondary || "").trim(),
    details: details.length > 0 ? details : [primary],
    mode: (value?.mode || "negotiable") as ProviderPriceDisplayMode,
  };
}

export function roleToBasePath(role: ProviderRole) {
  switch (role) {
    case "company":
      return "companies";
    case "foreman":
      return "foremen";
    case "designer":
    default:
      return "designers";
  }
}

export function normalizeProviderRole(
  value: number | string | null | undefined,
): ProviderRole {
  if (value === 2 || value === "2" || value === "company") {
    return "company";
  }
  if (value === 3 || value === "3" || value === "foreman") {
    return "foreman";
  }
  return "designer";
}

export function parseTextArray(value: string | string[] | null | undefined) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  const text = String(value || "").trim();
  if (!text) {
    return [];
  }
  if (
    (text.startsWith("[") && text.endsWith("]")) ||
    (text.startsWith("{") && text.endsWith("}"))
  ) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
      if (parsed && typeof parsed === "object") {
        return Object.entries(parsed)
          .filter(([, enabled]) => Boolean(enabled))
          .map(([key]) => key.trim())
          .filter(Boolean);
      }
    } catch {
      // ignore malformed JSON and fallback to string split.
    }
  }

  return text
    .split(/[、,，|/]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeDisplayName(value: string | null | undefined) {
  return String(value || "").trim();
}

export function isGeneratedProviderName(value: string | null | undefined) {
  const name = normalizeDisplayName(value);
  if (!name) {
    return true;
  }

  return [
    /^用户(?:\*{2,}|[0-9]{2,}|[A-Za-z0-9]{4,})$/,
    /^微信用户(?:\*{2,}|[0-9]{2,}|[A-Za-z0-9]{4,})?$/,
  ].some((pattern) => pattern.test(name));
}

export function resolveProviderDisplayName(
  _role: ProviderRole,
  companyName: string | null | undefined,
  ...nicknameCandidates: Array<string | null | undefined>
) {
  const normalizedCompanyName = normalizeDisplayName(companyName);
  const nicknames = nicknameCandidates
    .map((item) => normalizeDisplayName(item))
    .filter(Boolean);
  const readableNickname =
    nicknames.find((item) => !isGeneratedProviderName(item)) || "";
  const fallbackNickname = nicknames[0] || "";

  return (
    readableNickname ||
    normalizedCompanyName ||
    fallbackNickname ||
    "未命名服务商"
  );
}

export function getProviderRatingMeta(
  rating: number | null | undefined,
  reviewCount: number | null | undefined,
): {
  hasRating: boolean;
  scoreText: string;
  inlineText: string;
  detailText: string;
  sampleState: ProviderRatingSampleState;
} {
  const normalizedCount = Number(reviewCount || 0);
  const normalizedRating = Number(rating || 0);

  if (normalizedCount <= 0 || normalizedRating <= 0) {
    return {
      hasRating: false,
      scoreText: "暂无综合评分",
      inlineText: "暂无综合评分",
      detailText: "暂无正式评价",
      sampleState: "none",
    };
  }

  const scoreText = normalizedRating.toFixed(1);
  if (normalizedCount <= 2) {
    return {
      hasRating: true,
      scoreText,
      inlineText: `${scoreText} 分`,
      detailText: `${normalizedCount} 条正式评价`,
      sampleState: "small",
    };
  }

  return {
    hasRating: true,
    scoreText,
    inlineText: `${scoreText} 分`,
    detailText: `${normalizedCount} 条正式评价`,
    sampleState: "stable",
  };
}
