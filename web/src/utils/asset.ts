const LOCAL_ASSET_PREFIXES = ['/uploads/', '/static/'];
const API_BASE = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/$/, '');

export interface AssetRef {
  path?: string;
  url?: string;
  thumbnailUrl?: string;
}

const getApiOrigin = () => {
  if (/^https?:\/\//i.test(API_BASE)) {
    return API_BASE.replace(/\/api\/v1\/?$/, '').replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'http://127.0.0.1:8080';
};

export const normalizeStoredAssetPath = (value?: string) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return '';
  }
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
  if (!trimmed) {
    return '';
  }
  if (/^(https?:|data:)/i.test(trimmed)) {
    return trimmed;
  }
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${getApiOrigin()}${path}`;
};

export const getUploadedAssetPath = (asset?: AssetRef, fallback = '') =>
  normalizeStoredAssetPath(asset?.path || asset?.url || fallback);

export const getUploadedAssetUrl = (asset?: AssetRef, fallback = '') =>
  toAbsoluteAssetUrl(asset?.url || asset?.path || fallback);
