import type { UploadFile } from 'antd/es/upload/interface';

export interface AdminUploadedAsset {
  url?: string;
  path?: string;
}

export const getUploadedAssetPreviewUrl = (asset?: AdminUploadedAsset, fallback = '') =>
  String(asset?.url || asset?.path || fallback || '');

export const getUploadedAssetStoredPath = (asset?: AdminUploadedAsset, fallback = '') =>
  String(asset?.path || asset?.url || fallback || '');

export const buildUploadedAssetFile = (
  asset: AdminUploadedAsset,
  fileName: string,
  uid?: string,
): UploadFile<AdminUploadedAsset> => ({
  uid: uid || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  name: fileName,
  status: 'done',
  url: getUploadedAssetPreviewUrl(asset),
  thumbUrl: getUploadedAssetPreviewUrl(asset),
  response: asset,
});

export const getStoredPathFromUploadFile = (file: UploadFile<AdminUploadedAsset>) =>
  getUploadedAssetStoredPath(file.response, file.url || '');
