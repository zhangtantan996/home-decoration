import Taro from "@tarojs/taro";

import { useAuthStore } from "@/store/auth";
import { buildMiniApiUrl, MINI_ENV } from "@/config/env";
import { AutoRetryGuard, type AutoRetryPolicy } from "@/utils/autoRetryGuard";
import { getMiniDeviceLogContext } from "@/utils/deviceProfile";

interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export class MiniApiError<T = unknown> extends Error {
  status?: number;
  code?: number;
  errorCode?: string;
  data?: T;

  constructor(message: string, options: { status?: number; code?: number; errorCode?: string; data?: T } = {}) {
    super(message);
    this.name = 'MiniApiError';
    this.status = options.status;
    this.code = options.code;
    this.errorCode = options.errorCode;
    this.data = options.data;
  }
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Object.prototype.toString.call(value) === "[object Object]";

const sanitizeRequestData = <T>(value: T): T => {
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeRequestData(item))
      .filter((item) => item !== undefined) as T;
  }

  if (isPlainObject(value)) {
    const nextEntries = Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => [key, sanitizeRequestData(item)] as const);
    return Object.fromEntries(nextEntries) as T;
  }

  return value;
};

export interface RequestOptions {
  url: string;
  method?: Parameters<typeof Taro.request>[0]["method"];
  data?: any;
  header?: Record<string, string>;
  showLoading?: boolean;
  retry?: boolean;
}

const API_BASE = MINI_ENV.API_BASE_URL;
const INTERNAL_API_BASE_CONFIG_ERROR = MINI_ENV.IS_PLACEHOLDER_API_BASE
  ? "placeholder_api_base"
  : "";
const API_BASE_CONFIG_ERROR = MINI_ENV.IS_PLACEHOLDER_API_BASE
  ? "服务暂不可用，请稍后重试"
  : "";

const AUTH_REFRESH_BUSINESS_KEY = "mini.auth.refresh";
const AUTH_REFRESH_POLICY: AutoRetryPolicy = {
  maxAutoAttempts: 1,
  pauseOnConsecutiveFailures: 1,
  baseDelayMs: 0,
  maxDelayMs: 0,
};

const authRefreshGuard = new AutoRetryGuard(AUTH_REFRESH_POLICY);

if (INTERNAL_API_BASE_CONFIG_ERROR) {
  console.error("[mini][api-config]", {
    apiBase: API_BASE,
    appEnv: MINI_ENV.APP_ENV,
    message: INTERNAL_API_BASE_CONFIG_ERROR,
    device: getMiniDeviceLogContext(),
  });
} else {
  console.info("[mini][api-config]", {
    apiBase: API_BASE,
    appEnv: MINI_ENV.APP_ENV,
    device: getMiniDeviceLogContext(),
  });
}

const buildNetworkErrorMessage = (requestUrl: string, error: unknown) => {
  const rawMessage = error instanceof Error ? error.message : "";

  if (MINI_ENV.IS_PLACEHOLDER_API_BASE) {
    console.error("[mini][api-config]", {
      requestUrl,
      message: INTERNAL_API_BASE_CONFIG_ERROR,
      device: getMiniDeviceLogContext(),
    });
    return API_BASE_CONFIG_ERROR;
  }

  if (MINI_ENV.IS_LOCAL_API_BASE) {
    console.warn("[mini][network]", {
      requestUrl,
      rawMessage,
      device: getMiniDeviceLogContext(),
    });
    return "服务连接失败，请稍后重试";
  }

  if (rawMessage) {
    console.warn("[mini][network]", {
      requestUrl,
      rawMessage,
      device: getMiniDeviceLogContext(),
    });
  }
  return "请求失败，请稍后重试";
};

async function refreshAuth(refreshToken: string) {
  if (!authRefreshGuard.shouldAttempt("auto")) {
    const state = authRefreshGuard.getState();
    console.warn("[AutoRetry]", {
      businessKey: AUTH_REFRESH_BUSINESS_KEY,
      trigger: "auto",
      event: "blocked",
      attempt: state.autoAttempts,
      consecutiveFailures: state.consecutiveFailures,
      pausedReason: "max_auto_attempts_reached",
      device: getMiniDeviceLogContext(),
    });
    return null;
  }

  authRefreshGuard.recordAttempt("auto");

  const res = await Taro.request<
    ApiResponse<{ token: string; refreshToken: string; expiresIn: number }>
  >({
    url: buildMiniApiUrl("/auth/refresh"),
    method: "POST",
    data: { refreshToken },
  });

  if (res.statusCode === 200 && res.data.code === 0) {
    authRefreshGuard.recordSuccess();
    useAuthStore.getState().setAuth({
      token: res.data.data.token,
      refreshToken: res.data.data.refreshToken,
      expiresIn: res.data.data.expiresIn,
    });
    return res.data.data.token;
  }

  authRefreshGuard.recordFailure(
    new Error(res.data?.message || "refresh failed"),
  );

  const state = authRefreshGuard.getState();
  console.warn("[AutoRetry]", {
    businessKey: AUTH_REFRESH_BUSINESS_KEY,
    trigger: "auto",
    event: "failure",
    attempt: state.autoAttempts,
    consecutiveFailures: state.consecutiveFailures,
    paused: state.paused,
    device: getMiniDeviceLogContext(),
  });

  return null;
}

export async function request<T>(options: RequestOptions): Promise<T> {
  if (API_BASE_CONFIG_ERROR) {
    throw new Error(API_BASE_CONFIG_ERROR);
  }

  const requestData = sanitizeRequestData(options.data);
  const authState = useAuthStore.getState();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.header || {}),
  };
  if (authState.token) {
    headers.Authorization = `Bearer ${authState.token}`;
  }
  if (authState.user?.activeRole) {
    headers["X-Active-Role"] = authState.user.activeRole;
  }

  if (options.showLoading) {
    Taro.showLoading({ title: "加载中", mask: true });
  }

  try {
    const requestUrl = buildMiniApiUrl(options.url);
    const res = await (async () => {
      try {
        return await Taro.request<ApiResponse<T>>({
          url: requestUrl,
          method: options.method || "GET",
          data: requestData,
          header: headers,
        });
      } catch (requestError) {
        throw new Error(buildNetworkErrorMessage(requestUrl, requestError));
      }
    })();

    if (res.statusCode === 401 && authState.refreshToken && !options.retry) {
      try {
        const newToken = await refreshAuth(authState.refreshToken);
        if (newToken) {
          return request<T>({ ...options, retry: true });
        }
      } catch (refreshError) {
        authRefreshGuard.recordFailure(refreshError);
        const state = authRefreshGuard.getState();
        console.warn("[AutoRetry]", {
          businessKey: AUTH_REFRESH_BUSINESS_KEY,
          trigger: "auto",
          event: "exception",
          attempt: state.autoAttempts,
          consecutiveFailures: state.consecutiveFailures,
          paused: state.paused,
          device: getMiniDeviceLogContext(),
        });
      }

      // After a forced re-login, allow future auto refresh attempts.
      authRefreshGuard.resetByManual();
      authState.clear();
      throw new Error("登录已过期，请重新登录");
    }

    if (res.statusCode !== 200) {
      const responseData = res.data as unknown;
      const responseObject = (
        responseData && typeof responseData === 'object'
      )
        ? responseData as Record<string, unknown>
        : null;
      const responseMessage = (
        responseObject
        && 'message' in responseObject
      )
        ? String(responseObject.message || '')
        : '';
      const responseCode = (
        responseObject
        && 'code' in responseObject
      )
        ? Number(responseObject.code || 0)
        : undefined;
      const errorCode = (
        responseObject
        && responseObject.data
        && typeof responseObject.data === 'object'
        && 'errorCode' in (responseObject.data as Record<string, unknown>)
      )
        ? String((responseObject.data as Record<string, unknown>).errorCode || '')
        : undefined;

      throw new MiniApiError(responseMessage || `请求失败(${res.statusCode})`, {
        status: res.statusCode,
        code: responseCode,
        errorCode,
        data: responseData,
      });
    }

    if (!res.data || typeof res.data !== "object") {
      throw new MiniApiError("响应格式错误", { status: res.statusCode });
    }

    const apiResponse = res.data as ApiResponse<T>;
    if (apiResponse.code !== 0) {
      const errorCode = apiResponse.data && typeof apiResponse.data === 'object' && 'errorCode' in (apiResponse.data as Record<string, unknown>)
        ? String((apiResponse.data as Record<string, unknown>).errorCode || '')
        : undefined;
      throw new MiniApiError(apiResponse.message || `请求失败(code=${apiResponse.code})`, {
        status: [401, 403, 409].includes(apiResponse.code) ? apiResponse.code : res.statusCode,
        code: apiResponse.code,
        errorCode,
        data: apiResponse.data,
      });
    }

    return apiResponse.data;
  } finally {
    if (options.showLoading) {
      Taro.hideLoading();
    }
  }
}
