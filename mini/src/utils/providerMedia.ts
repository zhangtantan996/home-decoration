import { MINI_ENV } from '@/config/env';
import type { ProviderCaseItem, ProviderDetail } from '@/services/providers';
import { getLoopbackHostname, getLoopbackIPv4 } from '@/utils/localAddress';
import { parseAbsoluteUrl, replaceAbsoluteUrlOrigin } from '@/utils/url';

const API_ORIGIN = MINI_ENV.API_BASE_URL.replace(/\/api\/v1\/?$/, '');
const UNSTABLE_IMAGE_HOST_FRAGMENTS = ['images.unsplash.com', 'via.placeholder.com'];
const FIRST_PARTY_ASSET_PREFIXES = ['/uploads/', '/static/'];
const firstPartyHost = parseAbsoluteUrl(API_ORIGIN)?.hostname || '';
const KNOWN_SECURE_FIRST_PARTY_HOSTS = new Set(firstPartyHost ? [firstPartyHost] : []);
export const DEFAULT_PROVIDER_AVATAR_URL = `${API_ORIGIN}/static/inspiration/default-avatar.png`;
export const DEFAULT_PROVIDER_COVER_URL = `${API_ORIGIN}/static/inspiration/default-cover.png`;

const normalizeFirstPartyAbsoluteUrl = (raw: string) => {
  const value = raw.trim();
  if (!/^https?:\/\//i.test(value)) {
    return value;
  }

  const currentOrigin = parseAbsoluteUrl(API_ORIGIN);
  const targetUrl = parseAbsoluteUrl(value);
  if (!currentOrigin || !targetUrl) {
    return value;
  }

  if (KNOWN_SECURE_FIRST_PARTY_HOSTS.has(targetUrl.hostname) && currentOrigin.protocol === 'https:') {
    return `https://${targetUrl.host}${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;
  }

  if (targetUrl.hostname !== currentOrigin.hostname) {
    return value;
  }

  return replaceAbsoluteUrlOrigin(value, API_ORIGIN);
};

const normalizeFirstPartyAssetPath = (raw: string) => {
  const value = raw.trim();
  if (!value) {
    return value;
  }
  if (FIRST_PARTY_ASSET_PREFIXES.some((prefix) => value.startsWith(prefix))) {
    return `${API_ORIGIN}${value}`;
  }
  if (/^(uploads|static)\//i.test(value)) {
    return `${API_ORIGIN}/${value.replace(/^\/+/, '')}`;
  }
  return value;
};

const LEGACY_LOOPBACK_HOSTS = new Set([
  getLoopbackHostname(),
  getLoopbackIPv4(),
]);

const normalizeLegacyLoopbackMediaUrl = (raw: string) => {
  const value = raw.trim();
  const parsed = parseAbsoluteUrl(value);
  if (!parsed || !LEGACY_LOOPBACK_HOSTS.has(parsed.hostname.toLowerCase())) {
    return value;
  }
  return replaceAbsoluteUrlOrigin(value, API_ORIGIN);
};

const isKnownUnstableImageUrl = (raw: string) => {
  const value = raw.trim().toLowerCase();
  if (!value) return false;
  return UNSTABLE_IMAGE_HOST_FRAGMENTS.some((fragment) => value.includes(fragment));
};

export const normalizeProviderMediaUrl = (raw?: string, fallback = '') => {
  if (!raw) return fallback;
  const normalized = normalizeFirstPartyAssetPath(
    normalizeFirstPartyAbsoluteUrl(normalizeLegacyLoopbackMediaUrl(raw)),
  ).trim();
  if (!normalized) return fallback;
  if (isKnownUnstableImageUrl(normalized)) {
    return fallback;
  }
  return normalized;
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
const pickFirstValidMediaUrl = (values: Array<string | undefined>, fallback = '') => {
  for (const value of values) {
    const normalized = normalizeProviderMediaUrl(value, '');
    if (normalized) {
      return normalized;
    }
  }

  return fallback;
};

const parseCaseImages = (item?: ProviderCaseItem) => {
  if (!item?.images) return [] as string[];
  return parseStringListValue(item.images).map((image) => normalizeProviderMediaUrl(image)).filter(Boolean);
};

const collectCaseShots = (cases: ProviderCaseItem[] = []) =>
  dedupeUrls(cases.flatMap((item) => {
    const cover = normalizeProviderMediaUrl(item.coverImage);
    return [cover, ...parseCaseImages(item)].filter(Boolean);
  }));

export const collectCompanyAlbumImages = (detail?: ProviderDetail | null, extraCases: ProviderCaseItem[] = []) => {
  const provider = ((detail as unknown as { provider?: Record<string, unknown> })?.provider || {}) as Record<string, unknown>;
  const detailCases = (((detail as unknown as { cases?: ProviderCaseItem[] })?.cases) || []) as ProviderCaseItem[];
  const sourceCases = extraCases.length > 0 ? extraCases : detailCases;

  const explicitAlbum = parseStringListValue(provider.companyAlbumJson || (detail as unknown as { companyAlbumJson?: unknown })?.companyAlbumJson)
    .map((image) => normalizeProviderMediaUrl(image))
    .filter(Boolean);

  const providerShots = [
    normalizeProviderMediaUrl(String(provider.coverImage || '')),
    normalizeProviderMediaUrl(String((detail as unknown as { coverImage?: string })?.coverImage || '')),
  ].filter(Boolean);

  if (explicitAlbum.length > 0) {
    return dedupeUrls([...explicitAlbum, ...providerShots]);
  }

  const caseShots = collectCaseShots(sourceCases);

  return dedupeUrls([...providerShots, ...caseShots]);
};

export const resolveProviderAvatarUrl = ({
  provider,
  detail,
  user,
}: {
  provider?: Record<string, unknown> | null;
  detail?: Record<string, unknown> | null;
  user?: { avatar?: string } | null;
}) =>
  pickFirstValidMediaUrl(
    [
      String(provider?.avatar || ''),
      String(detail?.avatar || ''),
      user?.avatar,
    ],
    DEFAULT_PROVIDER_AVATAR_URL,
  );

export const resolveProviderCoverUrl = ({
  provider,
  detail,
  companyAlbumImages = [],
  cases = [],
}: {
  provider?: Record<string, unknown> | null;
  detail?: Record<string, unknown> | null;
  companyAlbumImages?: string[];
  cases?: ProviderCaseItem[];
}) => {
  const albumShots = dedupeUrls(
    companyAlbumImages.map((image) => normalizeProviderMediaUrl(image)).filter(Boolean),
  );
  const caseShots = collectCaseShots(cases);

  return pickFirstValidMediaUrl(
    [
      String(provider?.coverImage || ''),
      String(detail?.coverImage || ''),
      albumShots[0],
      caseShots[0],
    ],
    DEFAULT_PROVIDER_COVER_URL,
  );
};

export const resolveMaterialBrandLogoUrl = (brandLogo?: string) =>
  pickFirstValidMediaUrl([brandLogo], '');

export const resolveMaterialCoverUrl = ({
  cover,
  productImages = [],
  fallback = DEFAULT_PROVIDER_COVER_URL,
}: {
  cover?: string;
  productImages?: string[];
  fallback?: string;
}) =>
  pickFirstValidMediaUrl(
    [
      cover,
      ...productImages,
    ],
    fallback,
  );
