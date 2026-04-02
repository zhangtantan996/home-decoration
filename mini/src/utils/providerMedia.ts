import { MINI_ENV } from '@/config/env';
import type { ProviderCaseItem, ProviderDetail } from '@/services/providers';

const API_ORIGIN = MINI_ENV.API_BASE_URL.replace(/\/api\/v1\/?$/, '');

export const normalizeProviderMediaUrl = (raw?: string) => {
  if (!raw) return '';
  return raw.replace(/^http:\/\/localhost:8080/i, API_ORIGIN);
};

export const parseStringListValue = (raw?: unknown): string[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item).trim()).filter(Boolean);
  }

  const text = String(raw).trim();
  if (!text) return [];

  if (text.startsWith('[') && text.endsWith(']')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
    } catch {
      // ignore invalid payload
    }
  }

  if (text.includes(' · ')) {
    return text.split(' · ').map((item) => item.trim()).filter(Boolean);
  }

  return text.split(/[,，、|]/).map((item) => item.trim()).filter(Boolean);
};

const dedupeUrls = (list: string[]) => Array.from(new Set(list.filter(Boolean)));

const parseCaseImages = (item?: ProviderCaseItem) => {
  if (!item?.images) return [] as string[];
  return parseStringListValue(item.images).map((image) => normalizeProviderMediaUrl(image)).filter(Boolean);
};

export const collectCompanyAlbumImages = (detail?: ProviderDetail | null, extraCases: ProviderCaseItem[] = []) => {
  const provider = ((detail as unknown as { provider?: Record<string, unknown> })?.provider || {}) as Record<string, unknown>;
  const user = ((detail as unknown as { user?: Record<string, unknown> })?.user || {}) as Record<string, unknown>;
  const detailCases = (((detail as unknown as { cases?: ProviderCaseItem[] })?.cases) || []) as ProviderCaseItem[];
  const sourceCases = extraCases.length > 0 ? extraCases : detailCases;

  const explicitAlbum = parseStringListValue(provider.companyAlbumJson || (detail as unknown as { companyAlbumJson?: unknown })?.companyAlbumJson)
    .map((image) => normalizeProviderMediaUrl(image))
    .filter(Boolean);

  const providerShots = [
    normalizeProviderMediaUrl(String(provider.coverImage || '')),
    normalizeProviderMediaUrl(String((detail as unknown as { coverImage?: string })?.coverImage || '')),
    normalizeProviderMediaUrl(String(user.avatar || '')),
    normalizeProviderMediaUrl(String(provider.avatar || '')),
  ].filter(Boolean);

  if (explicitAlbum.length > 0) {
    return dedupeUrls([...explicitAlbum, ...providerShots]);
  }

  const caseShots = sourceCases.flatMap((item) => {
    const cover = normalizeProviderMediaUrl(item.coverImage);
    return [cover, ...parseCaseImages(item)].filter(Boolean);
  });

  return dedupeUrls([...providerShots, ...caseShots]);
};
