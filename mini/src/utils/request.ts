import Taro from '@tarojs/taro';
import type { TaroGeneral } from '@tarojs/taro';

import { useAuthStore } from '@/store/auth';

interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export interface RequestOptions<T> {
  url: string;
  method?: TaroGeneral.RequestOption['method'];
  data?: any;
  header?: Record<string, string>;
  showLoading?: boolean;
  retry?: boolean;
}

// 使用本地 IP 地址以便微信开发者工具可以访问 OrbStack 容器
const API_BASE = process.env.TARO_APP_API_BASE || 'http://192.168.110.128:8080/api/v1';

async function refreshAuth(refreshToken: string) {
  const res = await Taro.request<ApiResponse<{ token: string; refreshToken: string; expiresIn: number }>>({
    url: `${API_BASE}/auth/refresh`,
    method: 'POST',
    data: { refreshToken }
  });
  if (res.statusCode === 200 && res.data.code === 0) {
    useAuthStore.getState().setAuth({
      token: res.data.data.token,
      refreshToken: res.data.data.refreshToken,
      expiresIn: res.data.data.expiresIn
    });
    return res.data.data.token;
  }
  return null;
}

export async function request<T>(options: RequestOptions<T>): Promise<T> {
  const authState = useAuthStore.getState();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.header || {})
  };
  if (authState.token) {
    headers.Authorization = `Bearer ${authState.token}`;
  }

  if (options.showLoading) {
    Taro.showLoading({ title: '加载中', mask: true });
  }

  try {
    const res = await Taro.request<ApiResponse<T>>({
      url: `${API_BASE}${options.url}`,
      method: options.method || 'GET',
      data: options.data,
      header: headers
    });

    if (res.statusCode === 401 && authState.refreshToken && !options.retry) {
      const newToken = await refreshAuth(authState.refreshToken);
      if (newToken) {
        return request<T>({ ...options, retry: true });
      }
      authState.clear();
      throw new Error('登录已过期，请重新登录');
    }

    if (res.statusCode !== 200 || res.data.code !== 0) {
      throw new Error(res.data?.message || '请求失败');
    }

    return res.data.data;
  } finally {
    if (options.showLoading) {
      Taro.hideLoading();
    }
  }
}
