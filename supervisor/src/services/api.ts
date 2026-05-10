import axios from "axios";
import { message } from "antd";
import { getApiBaseUrl, getLoginPath } from "../utils/env";
import { useSupervisorAuthStore } from "../stores/supervisorAuthStore";
import { LOGOUT_REASON_KEY } from "../constants/authConstants";
import { getDeviceId } from "../utils/device";

const API_BASE_URL = getApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
    "X-Device-ID": getDeviceId(),
  },
});

const SUPERVISOR_ERROR_STATUS_KEY = "__supervisorHandledStatus";

const getApiErrorStatus = (error: unknown): number | undefined => {
  if (typeof error !== "object" || error === null || !("response" in error)) {
    return undefined;
  }
  const response = (error as { response?: { status?: number } }).response;
  return response?.status;
};

const isSessionBoundaryError = (error: unknown): boolean => {
  const status = getApiErrorStatus(error);
  if (status !== 401 && status !== 403) return false;

  const response = (error as { response?: { data?: { message?: string } } })
    .response;
  const serverMessage = response?.data?.message ?? "";
  const lowerMessage = serverMessage.toLowerCase();

  if (status === 401) return true;
  if (lowerMessage.includes("token") || lowerMessage.includes("登录"))
    return true;
  if (lowerMessage.includes("禁用") || lowerMessage.includes("不存在"))
    return true;

  return false;
};

// 是否正在刷新 token（避免并发刷新）
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

const tryRefreshToken = async (): Promise<string | null> => {
  const refreshToken = useSupervisorAuthStore.getState().getRefreshToken();
  if (!refreshToken) return null;

  try {
    const res = await axios.post(
      `${API_BASE_URL}/supervisor/token/refresh`,
      {
        refreshToken,
      },
      {
        headers: {
          "X-Device-ID": getDeviceId(),
        },
      },
    );
    const envelope = res.data as {
      code?: number;
      data?: {
        accessToken?: string;
        refreshToken?: string;
        sessionId?: string;
      };
    };
    const data = envelope.data;
    if (data?.accessToken && data.refreshToken) {
      useSupervisorAuthStore
        .getState()
        .setTokens(data.accessToken, data.refreshToken, data.sessionId || "");
      return data.accessToken;
    }
    return null;
  } catch {
    return null;
  }
};

// Request interceptor: attach access token
api.interceptors.request.use((config) => {
  const token = useSupervisorAuthStore.getState().getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: handle 401 → refresh → retry
api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const status = getApiErrorStatus(error);

    if (status === 401) {
      const errObj = error as { [SUPERVISOR_ERROR_STATUS_KEY]?: boolean };
      if (errObj[SUPERVISOR_ERROR_STATUS_KEY]) {
        return Promise.reject(error);
      }
      errObj[SUPERVISOR_ERROR_STATUS_KEY] = true;

      // 尝试刷新 token
      if (!isRefreshing) {
        isRefreshing = true;
        refreshPromise = tryRefreshToken();
      }

      try {
        const newToken = await refreshPromise;
        if (newToken) {
          // 重试原始请求
          const originalRequest = error.config;
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        }
      } finally {
        isRefreshing = false;
        refreshPromise = null;
      }

      // 刷新失败，跳登录
      useSupervisorAuthStore.getState().logout();
      window.location.replace(getLoginPath());
      return Promise.reject(error);
    }

    if (status === 403) {
      const errObj = error as { [SUPERVISOR_ERROR_STATUS_KEY]?: boolean };
      if (errObj[SUPERVISOR_ERROR_STATUS_KEY]) return Promise.reject(error);
      errObj[SUPERVISOR_ERROR_STATUS_KEY] = true;

      if (isSessionBoundaryError(error)) {
        // AUTH-3: 踢出前保存原因，让登录页展示给用户
        const kickReason = (
          error as { response?: { data?: { message?: string } } }
        ).response?.data?.message;
        if (kickReason) {
          sessionStorage.setItem(LOGOUT_REASON_KEY, kickReason);
        }
        useSupervisorAuthStore.getState().logout();
        window.location.replace(getLoginPath());
        return Promise.reject(error);
      }

      const serverMessage = (
        error as { response?: { data?: { message?: string } } }
      ).response?.data?.message;
      if (serverMessage) {
        message.error(serverMessage);
      }
      return Promise.reject(error);
    }

    return Promise.reject(error);
  },
);

export default api;
