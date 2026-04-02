import Taro from '@tarojs/taro';

import { MINI_ENV } from '@/config/env';

const API_BASE = MINI_ENV.API_BASE_URL;

export async function uploadFile(filePath: string, formData?: Record<string, string>) {
  const res = await Taro.uploadFile({
    url: `${API_BASE}/upload`,
    filePath,
    name: 'file',
    formData
  });
  if (res.statusCode !== 200) {
    throw new Error('上传失败');
  }
  const payload = JSON.parse(res.data);
  if (payload?.code !== 0) {
    throw new Error(payload?.message || '上传失败');
  }
  return payload.data as { url: string; path?: string; filename: string; size: number; type: string };
}
