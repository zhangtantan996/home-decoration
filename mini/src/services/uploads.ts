import Taro from '@tarojs/taro';

import { MINI_ENV } from '@/config/env';
import { useAuthStore } from '@/store/auth';
import { MiniApiError } from '@/utils/request';

const API_BASE = MINI_ENV.API_BASE_URL;

interface UploadResponse<T> {
  code: number;
  message: string;
  data: T;
}

interface UploadFileResult {
  url: string;
  path?: string;
  filename: string;
  size: number;
  type: string;
}

const parseUploadResponse = <T>(raw: unknown): UploadResponse<T> => {
  if (raw && typeof raw === 'object') {
    return raw as UploadResponse<T>;
  }

  if (typeof raw !== 'string') {
    throw new MiniApiError('上传响应格式错误');
  }

  try {
    return JSON.parse(raw) as UploadResponse<T>;
  } catch {
    throw new MiniApiError('上传响应格式错误');
  }
};

export async function uploadFile(filePath: string, formData?: Record<string, string>) {
  const authState = useAuthStore.getState();
  const header: Record<string, string> = {};

  if (authState.token) {
    header.Authorization = `Bearer ${authState.token}`;
  }
  if (authState.user?.activeRole) {
    header['X-Active-Role'] = authState.user.activeRole;
  }

  const res = await Taro.uploadFile({
    url: `${API_BASE}/upload`,
    filePath,
    name: 'file',
    formData,
    header,
  });

  const payload = parseUploadResponse<UploadFileResult>(res.data);

  if (res.statusCode !== 200) {
    throw new MiniApiError(payload?.message || `上传失败(${res.statusCode})`, {
      status: res.statusCode,
      code: payload?.code,
      data: payload?.data,
    });
  }

  if (payload?.code !== 0) {
    throw new MiniApiError(payload?.message || '上传失败', {
      status: res.statusCode,
      code: payload?.code,
      data: payload?.data,
    });
  }

  return payload.data;
}
