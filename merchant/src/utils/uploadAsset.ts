import type { UploadFile } from 'antd/es/upload/interface';

import type { MerchantUploadResult } from '../services/merchantApi';
import { toAbsoluteAssetUrl } from './env';

type UploadResponseLike = Partial<MerchantUploadResult> | undefined;
export type AssetReference = string | UploadResponseLike | { url?: string; path?: string };
const LOCAL_ASSET_PREFIXES = ['/uploads/', '/static/'];

const normalizeStoredAssetPath = (value?: string) => {
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

const normalizeAssetReference = (asset?: AssetReference) => {
  if (!asset) {
    return undefined;
  }
  if (typeof asset === 'string') {
    const path = normalizeStoredAssetPath(asset);
    return { url: toAbsoluteAssetUrl(path), path };
  }
  const path = normalizeStoredAssetPath(String(asset.path || asset.url || ''));
  const previewSource = String(asset.url || path || '');
  return {
    ...asset,
    url: toAbsoluteAssetUrl(previewSource),
    path,
  };
};

export const getAssetPreviewUrl = (asset?: AssetReference, fallback = '') => {
  const resolved = normalizeAssetReference(asset);
  const value = resolved?.url || resolved?.path || fallback;
  return String(value || '');
};

export const getAssetStoredPath = (asset?: AssetReference, fallback = '') => {
  const resolved = normalizeAssetReference(asset);
  const value = resolved?.path || resolved?.url || fallback;
  return String(value || '');
};

export const normalizeStoredAssetValue = (asset?: AssetReference, fallback = '') =>
  getAssetStoredPath(asset, fallback);

export const normalizeStoredAssetValues = (assets?: AssetReference[]) =>
  (Array.isArray(assets) ? assets : [])
    .map((asset) => normalizeStoredAssetValue(asset))
    .filter(Boolean) as string[];

export const getUploadedAssetPreviewUrl = (asset?: UploadResponseLike, fallback = '') =>
  getAssetPreviewUrl(asset, fallback);

export const getUploadedAssetStoredPath = (asset?: UploadResponseLike, fallback = '') =>
  getAssetStoredPath(asset, fallback);

export const buildUploadedAssetFile = (
  asset: MerchantUploadResult,
  fileName: string,
  uid?: string,
): UploadFile<MerchantUploadResult> => {
  const previewUrl = getUploadedAssetPreviewUrl(asset);
  return {
    uid: uid || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: fileName,
    status: 'done',
    url: previewUrl,
    thumbUrl: String(asset.thumbnailUrl || asset.thumbnailPath || previewUrl),
    response: asset,
  };
};

export const buildStoredAssetFile = (
  value?: string,
  uid?: string,
): UploadFile<MerchantUploadResult> | null => {
  if (!value) {
    return null;
  }
  const normalized = normalizeAssetReference(value);
  const previewUrl = getAssetPreviewUrl(normalized, value);
  const storedPath = getAssetStoredPath(normalized, value);
  return {
    uid: uid || storedPath || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: storedPath.split('/').pop() || 'uploaded-file',
    status: 'done',
    url: previewUrl,
    thumbUrl: previewUrl,
    response: { url: previewUrl, path: storedPath },
  };
};

export const getStoredPathFromUploadFile = (file: UploadFile<MerchantUploadResult>) =>
  getAssetStoredPath(file.response, file.url || '');

export const getStoredPathsFromUploadFiles = (files: Array<UploadFile<MerchantUploadResult>>) =>
  files
    .map((file) => getStoredPathFromUploadFile(file))
    .filter(Boolean);

export const toAssetReferenceFromUpload = (asset?: UploadResponseLike) => {
  if (!asset) {
    return undefined;
  }
  return {
    url: toAbsoluteAssetUrl(String(asset.url || asset.path || '')),
    path: normalizeStoredAssetPath(String(asset.path || asset.url || '')),
  };
};

export const toAssetReferenceFromString = (value?: string) => {
  if (!value) {
    return undefined;
  }
  const path = normalizeStoredAssetPath(value);
  return {
    url: toAbsoluteAssetUrl(path),
    path,
  };
};

export const buildUploadFileFromAssetReference = (
  asset: AssetReference,
  nameFallback: string,
  uid?: string,
) => {
  const previewUrl = getAssetPreviewUrl(asset);
  const storedPath = getAssetStoredPath(asset);
  return {
    uid: uid || storedPath || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: nameFallback,
    status: 'done',
    url: previewUrl,
    response: { url: previewUrl, path: storedPath },
  } as UploadFile<MerchantUploadResult>;
};

export const getAssetStoRedirectPaths = (assets?: AssetReference[]) =>
  (Array.isArray(assets) ? assets : [])
    .map((asset) => getAssetStoredPath(asset))
    .filter(Boolean) as string[];
