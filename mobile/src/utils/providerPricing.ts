export type ProviderPricingRole = 'designer' | 'foreman' | 'company';
export type ProviderQuoteStatus = 'priced' | 'negotiable';

type PricingValue = number | string | undefined | null;

interface PricingEntry {
  key: string;
  label: string;
  amount: number;
}

export interface ProviderQuoteDisplay {
  title: string;
  primary: string;
  secondary: string;
  status: ProviderQuoteStatus;
}

export interface ProviderPricingResult {
  summary: string;
  detail: string;
  quoteDisplay: ProviderQuoteDisplay;
}

const PRICING_LABELS: Record<ProviderPricingRole, Record<string, string>> = {
  designer: {
    flat: '平层',
    duplex: '复式',
    other: '其他户型',
  },
  foreman: {
    perSqm: '施工报价',
  },
  company: {
    fullPackage: '全包',
    halfPackage: '半包',
  },
};

const QUOTE_TITLES: Record<ProviderPricingRole, string> = {
  designer: '设计费',
  foreman: '施工报价',
  company: '参考报价',
};

const PRICING_ORDER: Record<ProviderPricingRole, string[]> = {
  designer: ['flat', 'duplex', 'other'],
  foreman: ['perSqm'],
  company: ['fullPackage', 'halfPackage'],
};

const AREA_UNIT_RE = /(平方米|平米|㎡|m²|m2)/i;

const toNumber = (value: PricingValue): number | null => {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
};

const trimNumber = (value: number): string => {
  if (!Number.isFinite(value)) {
    return '0';
  }
  if (Math.abs(value - Math.round(value)) < 0.001) {
    return String(Math.round(value));
  }
  return value.toFixed(1).replace(/\.0$/, '');
};

const normalizeUnit = (unit?: string): string => {
  const raw = String(unit || '').trim();
  if (!raw) {
    return '';
  }

  if (/万/.test(raw) && /全包/.test(raw)) {
    return '万/全包';
  }
  if (/万/.test(raw) && /半包/.test(raw)) {
    return '万/半包';
  }
  if (AREA_UNIT_RE.test(raw)) {
    return '/㎡';
  }
  if (/(元\/?天|元\/?日|天|日)/.test(raw)) {
    return '/天';
  }
  if (/全包/.test(raw)) {
    return '/全包';
  }
  if (/半包/.test(raw)) {
    return '/半包';
  }

  return raw.startsWith('/') ? raw.replace(AREA_UNIT_RE, '㎡') : `/${raw.replace(AREA_UNIT_RE, '㎡')}`;
};

const defaultStructuredUnit = (role: ProviderPricingRole): string => {
  switch (role) {
    case 'designer':
    case 'foreman':
    case 'company':
    default:
      return '/㎡';
  }
};

const resolveDisplayUnit = (role: ProviderPricingRole, unit?: string): string => {
  if (role === 'designer') {
    return '/㎡';
  }
  return unit || defaultStructuredUnit(role);
};

const shouldUseWan = (role: ProviderPricingRole, unit: string, amount: number): boolean => {
  if (unit.startsWith('万/')) {
    return true;
  }
  return role === 'company' && /\/(全包|半包)$/.test(unit) && amount >= 10000;
};

const joinWanUnit = (unit: string): string => (unit.startsWith('万/') ? unit.slice(1) : unit);

const formatAmount = (amount: number, role: ProviderPricingRole, unit: string): string => {
  if (shouldUseWan(role, unit, amount)) {
    return `${trimNumber(amount / 10000)}万${joinWanUnit(unit)}`;
  }
  return `¥${trimNumber(amount)}${unit}`;
};

const formatRange = (min: number, max: number, role: ProviderPricingRole, unit: string): string => {
  if (shouldUseWan(role, unit, Math.max(min, max))) {
    return `${trimNumber(min / 10000)}-${trimNumber(max / 10000)}万${joinWanUnit(unit)}`;
  }
  return `¥${trimNumber(min)}-${trimNumber(max)}${unit}`;
};

const parseStructuredPricing = (
  role: ProviderPricingRole,
  pricingJson?: string,
): { entries: PricingEntry[]; unknownAmount?: number } => {
  const text = String(pricingJson || '').trim();
  if (!text) {
    return { entries: [] };
  }

  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { entries: [] };
    }

    const labelMap = PRICING_LABELS[role];
    const entries = PRICING_ORDER[role]
      .map((key) => {
        const amount = toNumber(parsed[key] as PricingValue);
        if (!amount) {
          return null;
        }
        return { key, label: labelMap[key], amount };
      })
      .filter((entry): entry is PricingEntry => Boolean(entry));

    const unknownAmount = Object.entries(parsed)
      .filter(([key]) => !labelMap[key])
      .map(([, value]) => toNumber(value as PricingValue))
      .find((value): value is number => value !== null);

    return { entries, unknownAmount };
  } catch {
    return { entries: [] };
  }
};

const buildResult = ({
  role,
  summary,
  detail,
  primary,
  secondary,
  status,
}: {
  role: ProviderPricingRole;
  summary: string;
  detail: string;
  primary: string;
  secondary: string;
  status: ProviderQuoteStatus;
}): ProviderPricingResult => ({
  summary,
  detail,
  quoteDisplay: {
    title: QUOTE_TITLES[role],
    primary,
    secondary,
    status,
  },
});

const buildNaturalFallback = (role: ProviderPricingRole): ProviderPricingResult =>
  buildResult({
    role,
    summary: '报价面议',
    detail: role === 'designer' ? '按需求报价' : '按需求沟通',
    primary: '报价面议',
    secondary: '按需求沟通',
    status: 'negotiable',
  });

export const formatProviderPricing = ({
  role,
  pricingJson,
  priceMin,
  priceMax,
  priceUnit,
}: {
  role: ProviderPricingRole;
  pricingJson?: string;
  priceMin?: PricingValue;
  priceMax?: PricingValue;
  priceUnit?: string;
}): ProviderPricingResult => {
  const structured = parseStructuredPricing(role, pricingJson);
  const structuredUnit = defaultStructuredUnit(role);
  const normalizedUnit = normalizeUnit(priceUnit);
  const displayUnit = resolveDisplayUnit(role, normalizedUnit);

  if (structured.entries.length > 0) {
    const summaryEntry = structured.entries[0];
    const summary = `${summaryEntry.label} ${formatAmount(summaryEntry.amount, role, structuredUnit)}`;
    const detail = structured.entries
      .map((entry) => `${entry.label} ${formatAmount(entry.amount, role, structuredUnit)}`)
      .join(' · ');
    return buildResult({
      role,
      summary,
      detail,
      primary: formatAmount(summaryEntry.amount, role, displayUnit),
      secondary: structured.entries.length > 1 ? detail : '',
      status: 'priced',
    });
  }

  if (structured.unknownAmount) {
    const amountText = formatAmount(structured.unknownAmount, role, displayUnit);
    return buildResult({
      role,
      summary: amountText,
      detail: `其他报价 ${amountText}`,
      primary: amountText,
      secondary: `其他报价 ${amountText}`,
      status: 'priced',
    });
  }

  const min = toNumber(priceMin);
  const max = toNumber(priceMax);

  if (min && max) {
    const rangeText = formatRange(min, max, role, displayUnit);
    return buildResult({
      role,
      summary: rangeText,
      detail: rangeText,
      primary: rangeText,
      secondary: '',
      status: 'priced',
    });
  }

  if (min || max) {
    const amount = min || max;
    if (!amount) {
      return buildNaturalFallback(role);
    }
    const amountText = formatAmount(amount, role, displayUnit);
    return buildResult({
      role,
      summary: amountText,
      detail: amountText,
      primary: amountText,
      secondary: '部分报价信息',
      status: 'priced',
    });
  }

  return buildNaturalFallback(role);
};

export const normalizePricingUnit = normalizeUnit;
