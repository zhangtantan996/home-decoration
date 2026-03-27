import axios from 'axios';
import { message } from 'antd';
import { getApiBaseUrl, getLoginPath } from '../utils/env';
import { useMerchantAuthStore } from '../stores/merchantAuthStore';

const API_BASE_URL = getApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

const MERCHANT_ERROR_STATUS_KEY = '__merchantHandledStatus';
const ACCESS_DENIED_MESSAGE_COOLDOWN_MS = 3000;
let lastAccessDeniedAt = 0;

type MerchantErrorPayload = {
  code?: number;
  message?: string;
  data?: Record<string, unknown>;
};

export class MerchantRequestError<T = unknown> extends Error {
  status?: number;
  code?: number;
  errorCode?: string;
  data?: T;

  constructor(message: string, options: { status?: number; code?: number; errorCode?: string; data?: T } = {}) {
    super(message);
    this.name = 'MerchantRequestError';
    this.status = options.status;
    this.code = options.code;
    this.errorCode = options.errorCode;
    this.data = options.data;
  }
}

const getApiErrorStatus = (error: unknown): number | undefined => {
  if (typeof error !== 'object' || error === null || !('response' in error)) {
    return undefined;
  }

  const response = (error as { response?: { status?: number } }).response;
  return response?.status;
};

const markMerchantErrorHandled = (error: unknown, status: 401 | 403) => {
  if (typeof error === 'object' && error !== null) {
    Object.defineProperty(error, MERCHANT_ERROR_STATUS_KEY, {
      value: status,
      configurable: true,
      enumerable: false,
      writable: true,
    });
  }
};

export const getHandledMerchantStatus = (error: unknown): 401 | 403 | undefined => {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }

  const value = (error as Record<string, unknown>)[MERCHANT_ERROR_STATUS_KEY];
  if (value === 401 || value === 403) {
    return value;
  }

  return undefined;
};

const notifyMerchantAccessDenied = () => {
  const now = Date.now();
  if (now - lastAccessDeniedAt < ACCESS_DENIED_MESSAGE_COOLDOWN_MS) {
    return;
  }

  lastAccessDeniedAt = now;
  message.error('无权限访问当前功能');
};

const normalizeMerchantError = (error: unknown) => {
  if (error instanceof MerchantRequestError) {
    return error;
  }

  const status = getApiErrorStatus(error);
  const payload = typeof error === 'object' && error !== null && 'response' in error
    ? ((error as { response?: { data?: MerchantErrorPayload } }).response?.data || undefined)
    : undefined;
  const errorCode = payload?.data && typeof payload.data === 'object' && 'errorCode' in payload.data
    ? String(payload.data.errorCode || '')
    : undefined;

  return new MerchantRequestError(payload?.message || `请求失败${status ? `(${status})` : ''}`, {
    status,
    code: payload?.code,
    errorCode,
    data: payload?.data,
  });
};

export const redirectToMerchantLogin = () => {
  useMerchantAuthStore.getState().logout();

  if (typeof window === 'undefined') {
    return;
  }

  const loginPath = getLoginPath();
  if (window.location.pathname !== loginPath) {
    window.location.replace(loginPath);
  }
};

api.interceptors.request.use(
  (config) => {
    const token = useMerchantAuthStore.getState().getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  <T>(response: { data: T }) => response.data,
  (error) => {
    const status = getApiErrorStatus(error);

    if (status === 401) {
      markMerchantErrorHandled(error, 401);
      redirectToMerchantLogin();
    }

    if (status === 403) {
      markMerchantErrorHandled(error, 403);
      notifyMerchantAccessDenied();
    }

    return Promise.reject(normalizeMerchantError(error));
  },
);

export { getApiErrorStatus };
export const isMerchantConflictError = (error: unknown) =>
  error instanceof MerchantRequestError && error.status === 409;
export default api;
