export type QuoteGeneratorProviderType = "designer" | "company" | "foreman";

export interface QuoteEstimateInput {
  area: number;
  renovationType: string;
  budgetRange: string;
  providerType?: QuoteGeneratorProviderType;
}

export interface QuoteEstimateResult {
  minTotal: number;
  maxTotal: number;
  summary: string;
  budgetHint: string;
  recommendedProviderType: QuoteGeneratorProviderType;
  styleTags: string[];
  feeBreakdown: Array<{
    label: string;
    amount: number;
    note: string;
  }>;
}

const PRICE_RULES: Record<string, { min: number; max: number }> = {
  新房装修: { min: 1100, max: 1800 },
  老房翻新: { min: 1400, max: 2400 },
  局部改造: { min: 900, max: 1500 },
};

const DEFAULT_RULE = { min: 1100, max: 1800 };

const BUDGET_RANGES: Record<
  string,
  {
    min: number;
    max: number | null;
  }
> = {
  "5万以下": { min: 0, max: 50000 },
  "5-10万": { min: 50000, max: 100000 },
  "10-20万": { min: 100000, max: 200000 },
  "20-50万": { min: 200000, max: 500000 },
  "50万以上": { min: 500000, max: null },
};

const STYLE_TAGS: Record<string, string[]> = {
  low: ["现代简约", "原木自然", "耐住好打理"],
  mid: ["奶油温润", "现代轻简", "收纳优先"],
  high: ["轻奢质感", "新中式", "定制感更强"],
};

const roundToFiveThousand = (value: number) =>
  Math.max(10000, Math.round(value / 5000) * 5000);

const clampRange = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const formatWan = (value: number) => {
  const wan = value / 10000;
  if (wan >= 10 || Number.isInteger(wan)) {
    return `${Math.round(wan * 10) / 10}万`;
  }
  return `${wan.toFixed(1)}万`;
};

const resolveProviderType = (
  providerType: QuoteGeneratorProviderType | undefined,
  renovationType: string,
): QuoteGeneratorProviderType => {
  if (providerType) return providerType;
  if (renovationType === "局部改造") return "company";
  return "designer";
};

const resolveBudgetHint = (
  selectedMin: number,
  selectedMax: number | null,
  suggestedMin: number,
  suggestedMax: number,
) => {
  if (selectedMax !== null && selectedMax < suggestedMin) {
    return "当前预算偏紧，建议优先控制复杂工艺与定制比例。";
  }
  if (selectedMin > suggestedMax) {
    return "当前预算空间较充足，可考虑更完整的材料与收纳方案。";
  }
  return "当前预算与常见成交区间基本匹配，可继续进入正式沟通。";
};

export const formatEstimateRange = (minTotal: number, maxTotal: number) =>
  `${formatWan(minTotal)} - ${formatWan(maxTotal)}`;

export const calculateQuoteEstimate = (
  input: QuoteEstimateInput,
): QuoteEstimateResult => {
  const rule = PRICE_RULES[input.renovationType] || DEFAULT_RULE;
  const budgetRule = BUDGET_RANGES[input.budgetRange] || {
    min: 0,
    max: null,
  };

  const areaSuggestedMin = input.area * rule.min;
  const areaSuggestedMax = input.area * rule.max;

  let minTotal = roundToFiveThousand(
    budgetRule.min > 0
      ? Math.max(areaSuggestedMin * 0.9, budgetRule.min)
      : areaSuggestedMin,
  );
  let maxTotal = roundToFiveThousand(
    budgetRule.max
      ? Math.min(areaSuggestedMax * 1.08, budgetRule.max)
      : areaSuggestedMax * 1.12,
  );

  if (maxTotal <= minTotal) {
    if (budgetRule.max) {
      minTotal = clampRange(
        roundToFiveThousand((budgetRule.min + budgetRule.max) / 2),
        budgetRule.min || 10000,
        budgetRule.max,
      );
      maxTotal = budgetRule.max;
    } else {
      maxTotal = roundToFiveThousand(
        Math.max(areaSuggestedMax * 1.12, minTotal * 1.18),
      );
    }
  }

  if (maxTotal <= minTotal) {
    maxTotal = roundToFiveThousand(minTotal * 1.15);
  }

  const budgetMid =
    budgetRule.max === null
      ? budgetRule.min + 100000
      : (budgetRule.min + budgetRule.max) / 2;
  const styleTags =
    budgetMid < 100000
      ? STYLE_TAGS.low
      : budgetMid < 250000
        ? STYLE_TAGS.mid
        : STYLE_TAGS.high;

  const feeBreakdownPercentages = [
    { label: "基础施工", ratio: 0.34, note: "人工、辅材、现场管理" },
    { label: "主材配置", ratio: 0.31, note: "地板、瓷砖、洁具等" },
    { label: "软装定制", ratio: 0.19, note: "柜体、灯具、软装氛围" },
    { label: "设计与管理", ratio: 0.16, note: "方案深化、交付协同" },
  ];

  return {
    minTotal,
    maxTotal,
    summary: `按 ${input.area}㎡ · ${input.renovationType} 的常见成交区间估算，当前需求更适合先锁定方案方向，再进入正式报价。`,
    budgetHint: resolveBudgetHint(
      budgetRule.min,
      budgetRule.max,
      areaSuggestedMin,
      areaSuggestedMax,
    ),
    recommendedProviderType: resolveProviderType(
      input.providerType,
      input.renovationType,
    ),
    styleTags,
    feeBreakdown: feeBreakdownPercentages.map((item) => ({
      label: item.label,
      amount: roundToFiveThousand(((minTotal + maxTotal) / 2) * item.ratio),
      note: item.note,
    })),
  };
};
