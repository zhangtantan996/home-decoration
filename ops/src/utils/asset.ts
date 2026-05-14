import { getApiBaseUrl } from './env';

const LOCAL_ASSET_PREFIXES = ['/uploads/', '/static/'];

const getApiOrigin = () => {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) return '';
  if (/^https?:\/\//i.test(apiBaseUrl)) {
    return apiBaseUrl.replace(/\/api\/v1\/?$/, '').replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return '';
};

export interface AssetRef {
  path?: string;
  url?: string;
  thumbnailUrl?: string;
  thumbnailPath?: string;
}

export const normalizeStoredAssetPath = (value?: string) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  if (LOCAL_ASSET_PREFIXES.some((prefix) => trimmed.startsWith(prefix))) {
    return trimmed;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      if (LOCAL_ASSET_PREFIXES.some((prefix) => parsed.pathname.startsWith(prefix))) {
        return parsed.pathname;
      }
    } catch {
      return trimmed;
    }
  }
  return trimmed;
};

export const toAbsoluteAssetUrl = (value?: string) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  if (/^(https?:|data:)/i.test(trimmed)) {
    return trimmed;
  }
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const origin = getApiOrigin();
  return origin ? `${origin}${path}` : path;
};

export const getAssetStoredPath = (asset?: string | AssetRef, fallback = '') => {
  if (!asset) return normalizeStoredAssetPath(fallback);
  if (typeof asset === 'string') {
    return normalizeStoredAssetPath(asset || fallback);
  }
  return normalizeStoredAssetPath(String(asset.path || asset.url || fallback || ''));
};

export const getAssetPreviewUrl = (asset?: string | AssetRef, fallback = '') => {
  if (!asset) return toAbsoluteAssetUrl(fallback);
  if (typeof asset === 'string') {
    return toAbsoluteAssetUrl(asset || fallback);
  }
  return toAbsoluteAssetUrl(String(asset.url || asset.path || fallback || ''));
};

export const splitStoredAssetText = (value?: string) =>
  String(value || '')
    .split(/[,，\n]/)
    .map((item) => normalizeStoredAssetPath(item))
    .filter(Boolean);

export const joinStoredAssetText = (values?: string[]) =>
  (Array.isArray(values) ? values : [])
    .map((item) => normalizeStoredAssetPath(item))
    .filter(Boolean)
    .join('，');
