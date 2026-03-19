import type { ApiEnvelope } from '../types/api';
import { useSessionStore } from '../modules/session/sessionStore';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  skipAuth?: boolean;
  retry?: boolean;
}

const API_BASE = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/$/, '');
const ROUTER_BASENAME = normalizeBasename(import.meta.env.VITE_ROUTER_BASENAME || '/');

let refreshPromise: Promise<string | null> | null = null;

function normalizeBasename(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '/') {
    return '/';
  }
  return `/${trimmed.replace(/^\/+|\/+$/g, '')}`;
}

function buildUrl(path: string, query?: RequestOptions['query']) {
  const target = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  const base = /^https?:\/\//.test(target)
    ? undefined
    : typeof window !== 'undefined'
      ? window.location.origin
      : 'http://127.0.0.1:8080';
  const url = base ? new URL(target, base) : new URL(target);
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value === '' || value === undefined || value === null) {
      return;
    }
    url.searchParams.set(key, String(value));
  });
  return url.toString();
}

function resolveLoginUrl() {
  if (typeof window === 'undefined') {
    return `${ROUTER_BASENAME === '/' ? '' : ROUTER_BASENAME}/login`;
  }
  const redirectPath = ROUTER_BASENAME !== '/' && window.location.pathname.startsWith(ROUTER_BASENAME)
    ? window.location.pathname.slice(ROUTER_BASENAME.length) || '/'
    : window.location.pathname;
  const redirect = `${redirectPath}${window.location.search}`;
  const prefix = ROUTER_BASENAME === '/' ? '' : ROUTER_BASENAME;
  return `${prefix}/login?redirect=${encodeURIComponent(redirect)}`;
}

async function refreshTokenOrClear(refreshToken: string) {
  if (!refreshPromise) {
    refreshPromise = safeFetch(buildUrl('/auth/refresh'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as ApiEnvelope<{
          token: string;
          refreshToken: string;
          expiresIn: number;
        }> | null;
        if (!response.ok || !payload || payload.code !== 0) {
          throw new Error(payload?.message || `刷新失败(${response.status})`);
        }
        return payload.data;
      })
      .then((payload) => {
        useSessionStore.getState().setSession({
          accessToken: payload.token,
          refreshToken: payload.refreshToken,
          expiresIn: payload.expiresIn,
          user: useSessionStore.getState().user,
        });
        return payload.token;
      })
      .catch(() => {
        useSessionStore.getState().clearSession();
        if (typeof window !== 'undefined') {
          window.location.replace(resolveLoginUrl());
        }
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

function normalizeRequestError(error: unknown): Error {
  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      return new Error('请求超时，请稍后重试');
    }
    if (error.message === 'Failed to fetch' || error.message === 'Load failed') {
      return new Error('服务连接失败，请检查接口地址或确认后端服务已启动');
    }
    return error;
  }

  return new Error('网络请求失败，请稍后重试');
}

async function safeFetch(input: RequestInfo | URL, init?: RequestInit) {
  try {
    return await fetch(input, init);
  } catch (error) {
    throw normalizeRequestError(error);
  }
}

export async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const session = useSessionStore.getState();
  const headers = new Headers({
    'Content-Type': 'application/json',
  });

  if (!options.skipAuth && session.accessToken) {
    headers.set('Authorization', `Bearer ${session.accessToken}`);
  }

  const response = await safeFetch(buildUrl(path, options.query), {
    method: options.method || 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (response.status === 401 && !options.skipAuth && session.refreshToken && !options.retry) {
    const nextToken = await refreshTokenOrClear(session.refreshToken);
    if (nextToken) {
      return requestJson<T>(path, { ...options, retry: true });
    }
    throw new Error('登录已过期，请重新登录');
  }

  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok) {
    throw new Error(payload?.message || `请求失败(${response.status})`);
  }
  if (!payload || typeof payload !== 'object') {
    throw new Error('响应格式错误');
  }
  if (payload.code !== 0) {
    throw new Error(payload.message || `业务请求失败(code=${payload.code})`);
  }
  return payload.data;
}

export async function uploadFile(path: string, file: File, fieldName = 'file') {
  const session = useSessionStore.getState();
  const headers = new Headers();
  if (session.accessToken) {
    headers.set('Authorization', `Bearer ${session.accessToken}`);
  }
  const formData = new FormData();
  formData.append(fieldName, file);

  const response = await safeFetch(buildUrl(path), {
    method: 'POST',
    headers,
    body: formData,
  });

  const payload = (await response.json().catch(() => null)) as ApiEnvelope<{
    url: string;
    path: string;
    filename?: string;
    size?: number;
    type?: string;
  }> | null;

  if (!response.ok || !payload || payload.code !== 0) {
    throw new Error(payload?.message || `上传失败(${response.status})`);
  }

  return payload.data;
}
