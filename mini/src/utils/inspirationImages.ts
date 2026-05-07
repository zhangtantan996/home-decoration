import { MINI_ENV } from '@/config/env';
import { parseAbsoluteUrl, replaceAbsoluteUrlOrigin } from '@/utils/url';

const API_BASE = MINI_ENV.API_BASE_URL;

export const DEFAULT_INSPIRATION_IMAGE_PATH = '/static/inspiration/default-cover.png';
export const DEFAULT_INSPIRATION_AVATAR_PATH = '/static/inspiration/default-avatar.png';

type InspirationImageSource = {
  coverImage?: unknown;
  image?: unknown;
  images?: unknown;
};

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');
const UNSTABLE_IMAGE_HOST_FRAGMENTS = ['images.unsplash.com', 'via.placeholder.com', 'placehold.co'];

const toNonEmptyString = (value: unknown) => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
};

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => toNonEmptyString(item))
    .filter((item): item is string => Boolean(item));
};

const getAssetBaseUrl = () => {
  const normalized = trimTrailingSlash(API_BASE);

  if (/\/api\/v1$/i.test(normalized)) {
    return normalized.replace(/\/api\/v1$/i, '');
  }

  return normalized;
};

const getFallbackUrl = (path: string) => {
  const baseUrl = getAssetBaseUrl();
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
};

const normalizeFirstPartyAbsoluteUrl = (raw: string) => {
  const value = raw.trim();
  if (!/^https?:\/\//i.test(value)) {
    return value;
  }

  const assetBaseUrl = parseAbsoluteUrl(getAssetBaseUrl());
  const targetUrl = parseAbsoluteUrl(value);
  if (!assetBaseUrl || !targetUrl) {
    return value;
  }

  if (targetUrl.hostname !== assetBaseUrl.hostname) {
    return value;
  }

  return replaceAbsoluteUrlOrigin(value, getAssetBaseUrl());
};

const isKnownUnstableImageUrl = (raw: string) => {
  const value = raw.trim().toLowerCase();
  if (!value) {
    return false;
  }

  return UNSTABLE_IMAGE_HOST_FRAGMENTS.some((fragment) => value.includes(fragment));
};

const normalizeOptionalInspirationImageUrl = (value: unknown): string | undefined => {
  const raw = toNonEmptyString(value);
  if (!raw) {
    return undefined;
  }

  if (raw.startsWith('data:image/')) {
    return raw;
  }

  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(raw) && !/^https?:/i.test(raw)) {
    return undefined;
  }

  if (/^https?:\/\//i.test(raw)) {
    if (isKnownUnstableImageUrl(raw)) {
      return undefined;
    }
    return normalizeFirstPartyAbsoluteUrl(raw);
  }

  return `${getAssetBaseUrl()}/${raw.replace(/^\/+/, '')}`;
};

export const parseInspirationImages = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return toStringArray(value);
  }

  const raw = toNonEmptyString(value);
  if (!raw) {
    return [];
  }

  if (!['[', '{', '"'].includes(raw[0])) {
    return [raw];
  }

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return toStringArray(parsed);
    }

    const parsedString = toNonEmptyString(parsed);
    return parsedString ? [parsedString] : [];
  } catch {
    return [];
  }
};

export const normalizeInspirationImageUrl = (
  value: unknown,
  fallbackPath = DEFAULT_INSPIRATION_IMAGE_PATH,
) => normalizeOptionalInspirationImageUrl(value) ?? getFallbackUrl(fallbackPath);

export const getInspirationGalleryImages = (source: InspirationImageSource): string[] => {
  const candidates = [source.coverImage, source.image, ...parseInspirationImages(source.images)];
  const normalized = candidates
    .map((item) => normalizeOptionalInspirationImageUrl(item))
    .filter((item): item is string => Boolean(item));

  const uniqueImages = [...new Set(normalized)];
  return uniqueImages.length > 0
    ? uniqueImages
    : [getFallbackUrl(DEFAULT_INSPIRATION_IMAGE_PATH)];
};

export const getInspirationCoverImage = (source: InspirationImageSource) => getInspirationGalleryImages(source)[0];

export const getInspirationAvatarUrl = (value: unknown) =>
  normalizeInspirationImageUrl(value, DEFAULT_INSPIRATION_AVATAR_PATH);
