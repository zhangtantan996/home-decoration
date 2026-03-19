const PLACEHOLDER_HOST_RE = /(placehold\.co|via\.placeholder\.com|dummyimage\.com)/i;

const CARD_PALETTES: Array<{ keywords: string[]; primary: string; secondary: string }> = [
  { keywords: ['卫浴', '五金', '洁具'], primary: '#0F766E', secondary: '#164E63' },
  { keywords: ['瓷砖', '石材', '岩板'], primary: '#C2410C', secondary: '#7C2D12' },
  { keywords: ['地板', '木门', '定制', '橱柜', '家具'], primary: '#A16207', secondary: '#4D2D18' },
  { keywords: ['灯', '照明', '电器', '家电'], primary: '#2563EB', secondary: '#1E3A8A' },
];

export function isGeneratedPlaceholder(url?: string) {
  return Boolean(url && PLACEHOLDER_HOST_RE.test(url));
}

export function extractPlaceholderTone(url?: string) {
  if (!url) return '';
  const match = url.match(/placehold\.co\/(?:\d+x\d+)\/([0-9A-Fa-f]{6})\//);
  if (!match?.[1]) return '';
  return `#${match[1].toUpperCase()}`;
}

export function buildCoverLabel(name: string, maxLength = 6) {
  const normalized = String(name || '').replace(/\s+/g, '').trim();
  if (!normalized) return '主材';
  return normalized.length > maxLength ? normalized.slice(0, maxLength) : normalized;
}

export function resolveCardPalette(seedText = '', fallbackTone = '') {
  const normalized = seedText.toLowerCase();
  const matched = CARD_PALETTES.find((palette) => palette.keywords.some((keyword) => normalized.includes(keyword.toLowerCase())));
  if (matched) {
    return matched;
  }

  const fallback = fallbackTone.trim();
  if (fallback) {
    return {
      primary: fallback,
      secondary: '#1F2937',
    };
  }

  return {
    primary: '#D97706',
    secondary: '#7C2D12',
  };
}
