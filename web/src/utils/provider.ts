import type { ProviderRole } from "../types/viewModels";

type PricingValue = number | string | undefined | null;
export type ProviderRatingSampleState = "none" | "small" | "stable";

const PRICING_LABELS: Record<ProviderRole, Record<string, string>> = {
  designer: {
    flat: "平层",
    duplex: "复式",
    other: "其他户型",
  },
  foreman: {
    perSqm: "施工报价",
  },
  company: {
    fullPackage: "全包",
    halfPackage: "半包",
  },
};

const PRICING_ORDER: Record<ProviderRole, string[]> = {
  designer: ["flat", "duplex", "other"],
  foreman: ["perSqm"],
  company: ["fullPackage", "halfPackage"],
};

const AREA_UNIT_RE = /(平方米|平米|㎡|m²|m2)/i;

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

function toPositiveNumber(value: PricingValue) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function trimNumber(value: number) {
  if (!Number.isFinite(value)) {
    return "0";
  }
  if (Math.abs(value - Math.round(value)) < 0.001) {
    return String(Math.round(value));
  }
  return value.toFixed(1).replace(/\.0$/, "");
}

function normalizeDisplayPriceUnit(
  unit: string | null | undefined,
  role?: ProviderRole,
  fallback = "元",
) {
  const raw = String(unit || "").trim();
  const providerFallback = role ? "元/㎡" : fallback;
  if (!raw) {
    return providerFallback;
  }
  if (AREA_UNIT_RE.test(raw)) {
    return "元/㎡";
  }
  if (/(元\/?天|元\/?日|天|日)/.test(raw)) {
    return role ? "元/㎡" : "元/天";
  }
  if (/^\/.+/.test(raw)) {
    return role ? "元/㎡" : `元${raw.replace(AREA_UNIT_RE, "平方米")}`;
  }
  if (role && /元/.test(raw)) {
    return "元/㎡";
  }
  return role ? providerFallback : raw;
}

function formatStructuredAmount(amount: number, unit: string) {
  return `${trimNumber(amount)}${unit}`;
}

function getStructuredPricingSummary(
  role: ProviderRole | undefined,
  pricingJson: string | null | undefined,
  priceUnit: string | null | undefined,
) {
  if (!role) {
    return null;
  }

  const text = String(pricingJson || "").trim();
  if (!text.startsWith("{") || !text.endsWith("}")) {
    return null;
  }

  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    const labelMap = PRICING_LABELS[role];
    const unit = normalizeDisplayPriceUnit(priceUnit, role, "元/㎡");
    const details = PRICING_ORDER[role]
      .map((key) => {
        const amount = toPositiveNumber(parsed[key] as PricingValue);
        if (!amount) {
          return null;
        }
        return `${labelMap[key]} ${formatStructuredAmount(amount, unit)}`;
      })
      .filter((item): item is string => Boolean(item));

    if (details.length > 0) {
      return {
        priceText: details[0].replace(/^[^ ]+\s+/, ""),
        details,
      };
    }

    const fallbackAmount = Object.values(parsed)
      .map((value) => toPositiveNumber(value as PricingValue))
      .find((value): value is number => value !== null);

    if (!fallbackAmount) {
      return null;
    }

    const amountText = formatStructuredAmount(fallbackAmount, unit);
    return {
      priceText: amountText,
      details: [`参考报价 ${amountText}`],
    };
  } catch {
    return null;
  }
}

export function summarizePricing(
  pricingJson: string | null | undefined,
  priceMin: number | null | undefined,
  priceMax: number | null | undefined,
  priceUnit: string | null | undefined,
  role?: ProviderRole,
) {
  const structured = getStructuredPricingSummary(role, pricingJson, priceUnit);
  const unit = normalizeDisplayPriceUnit(priceUnit, role, role ? "元/㎡" : "元");
  const tags = parseTextArray(pricingJson);
  const min = toPositiveNumber(priceMin);
  const max = toPositiveNumber(priceMax);
  if (min && max) {
    if (Math.abs(min - max) < 0.001) {
      return {
        priceText: `${trimNumber(min)}${unit}`,
        details: structured?.details || (tags.length > 0 ? tags : ["报价以现场勘测和方案深度为准"]),
      };
    }
    return {
      priceText: `${trimNumber(min)}-${trimNumber(max)}${unit}`,
      details: structured?.details || (tags.length > 0 ? tags : ["报价以现场勘测和方案深度为准"]),
    };
  }
  if (min) {
    return {
      priceText: `${trimNumber(min)}${unit}起`,
      details: structured?.details || (tags.length > 0 ? tags : ["报价以现场勘测和方案深度为准"]),
    };
  }
  if (structured) {
    return structured;
  }
  return {
    priceText: "按需报价",
    details: tags.length > 0 ? tags : ["支持先沟通需求，再给分项报价"],
  };
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
