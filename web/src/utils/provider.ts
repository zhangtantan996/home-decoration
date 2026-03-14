import type { ProviderRole } from '../types/viewModels';

export function roleToBasePath(role: ProviderRole) {
  switch (role) {
    case 'company':
      return 'companies';
    case 'foreman':
      return 'foremen';
    case 'designer':
    default:
      return 'designers';
  }
}

export function normalizeProviderRole(value: number | string | null | undefined): ProviderRole {
  if (value === 2 || value === '2' || value === 'company') {
    return 'company';
  }
  if (value === 3 || value === '3' || value === 'foreman') {
    return 'foreman';
  }
  return 'designer';
}

export function parseTextArray(value: string | string[] | null | undefined) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  const text = String(value || '').trim();
  if (!text) {
    return [];
  }
  if ((text.startsWith('[') && text.endsWith(']')) || (text.startsWith('{') && text.endsWith('}'))) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
      if (parsed && typeof parsed === 'object') {
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

export function summarizePricing(pricingJson: string | null | undefined, priceMin: number | null | undefined, priceMax: number | null | undefined, priceUnit: string | null | undefined) {
  const unit = priceUnit || '元';
  const tags = parseTextArray(pricingJson);
  if (priceMin && priceMax) {
    return {
      priceText: `${priceMin}-${priceMax}${unit}`,
      details: tags.length > 0 ? tags : ['报价以现场勘测和方案深度为准'],
    };
  }
  if (priceMin) {
    return {
      priceText: `${priceMin}${unit}起`,
      details: tags.length > 0 ? tags : ['报价以现场勘测和方案深度为准'],
    };
  }
  return {
    priceText: '按需报价',
    details: tags.length > 0 ? tags : ['支持先沟通需求，再给分项报价'],
  };
}
