import Taro from '@tarojs/taro';
import type { TaroGeneral } from '@tarojs/taro';

import { useAuthStore } from '@/store/auth';
import { AutoRetryGuard, type AutoRetryPolicy } from '@/utils/autoRetryGuard';

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

const API_BASE = process.env.TARO_APP_API_BASE || 'http://localhost:8080/api/v1';

const AUTH_REFRESH_BUSINESS_KEY = 'mini.auth.refresh';
const AUTH_REFRESH_POLICY: AutoRetryPolicy = {
  maxAutoAttempts: 1,
  pauseOnConsecutiveFailures: 1,
  baseDelayMs: 0,
  maxDelayMs: 0,
};

const authRefreshGuard = new AutoRetryGuard(AUTH_REFRESH_POLICY);

async function refreshAuth(refreshToken: string) {
  if (!authRefreshGuard.shouldAttempt('auto')) {
    const state = authRefreshGuard.getState();
    console.warn('[AutoRetry]', {
      businessKey: AUTH_REFRESH_BUSINESS_KEY,
      trigger: 'auto',
      event: 'blocked',
      attempt: state.autoAttempts,
      consecutiveFailures: state.consecutiveFailures,
      pausedReason: 'max_auto_attempts_reached',
    });
    return null;
  }

  authRefreshGuard.recordAttempt('auto');

  const res = await Taro.request<ApiResponse<{ token: string; refreshToken: string; expiresIn: number }>>({
    url: `${API_BASE}/auth/refresh`,
    method: 'POST',
    data: { refreshToken }
  });

  if (res.statusCode === 200 && res.data.code === 0) {
    authRefreshGuard.recordSuccess();
    useAuthStore.getState().setAuth({
      token: res.data.data.token,
      refreshToken: res.data.data.refreshToken,
      expiresIn: res.data.data.expiresIn
    });
    return res.data.data.token;
  }

  authRefreshGuard.recordFailure(new Error(res.data?.message || 'refresh failed'));

  const state = authRefreshGuard.getState();
  console.warn('[AutoRetry]', {
    businessKey: AUTH_REFRESH_BUSINESS_KEY,
    trigger: 'auto',
    event: 'failure',
    attempt: state.autoAttempts,
    consecutiveFailures: state.consecutiveFailures,
    paused: state.paused,
  });

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
  if (authState.user?.activeRole) {
    headers['X-Active-Role'] = authState.user.activeRole;
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
      try {
        const newToken = await refreshAuth(authState.refreshToken);
        if (newToken) {
          return request<T>({ ...options, retry: true });
        }
      } catch (refreshError) {
        authRefreshGuard.recordFailure(refreshError);
        const state = authRefreshGuard.getState();
        console.warn('[AutoRetry]', {
          businessKey: AUTH_REFRESH_BUSINESS_KEY,
          trigger: 'auto',
          event: 'exception',
          attempt: state.autoAttempts,
          consecutiveFailures: state.consecutiveFailures,
          paused: state.paused,
        });
      }

      // After a forced re-login, allow future auto refresh attempts.
      authRefreshGuard.resetByManual();
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
