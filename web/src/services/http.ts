import type { ApiEnvelope } from "../types/api";
import {
  isSessionExpired,
  useSessionStore,
} from "../modules/session/sessionStore";
import { toSafeUserFacingText } from "../utils/userFacingText";

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  skipAuth?: boolean;
  retry?: boolean;
}

export class WebApiError<T = unknown> extends Error {
  status?: number;
  code?: number;
  errorCode?: string;
  data?: T;

  constructor(
    message: string,
    options: {
      status?: number;
      code?: number;
      errorCode?: string;
      data?: T;
    } = {},
  ) {
    super(message);
    this.name = "WebApiError";
    this.status = options.status;
    this.code = options.code;
    this.errorCode = options.errorCode;
    this.data = options.data;
  }
}

const API_BASE = (import.meta.env.VITE_API_URL || "/api/v1").replace(/\/$/, "");
const ROUTER_BASENAME = normalizeBasename(
  import.meta.env.VITE_ROUTER_BASENAME || "/",
);

let refreshPromise: Promise<string | null> | null = null;

function normalizeBasename(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "/") {
    return "/";
  }
  return `/${trimmed.replace(/^\/+|\/+$/g, "")}`;
}

function buildUrl(path: string, query?: RequestOptions["query"]) {
  const target = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  const base = /^https?:\/\//.test(target)
    ? undefined
    : typeof window !== "undefined"
      ? window.location.origin
      : "http://127.0.0.1:8080";
  const url = base ? new URL(target, base) : new URL(target);
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value === "" || value === undefined || value === null) {
      return;
    }
    url.searchParams.set(key, String(value));
  });
  return url.toString();
}

function resolveLoginUrl() {
  const prefix = ROUTER_BASENAME === "/" ? "" : ROUTER_BASENAME;
  if (typeof window === "undefined") {
    return `${prefix}/login`;
  }
  const redirectPath =
    ROUTER_BASENAME !== "/" &&
    window.location.pathname.startsWith(ROUTER_BASENAME)
      ? window.location.pathname.slice(ROUTER_BASENAME.length) || "/"
      : window.location.pathname;
  const redirect = `${redirectPath}${window.location.search}`;
  if (!redirect || redirect === "/" || redirect.startsWith("/login")) {
    return `${prefix}/login`;
  }
  return `${prefix}/login?redirect=${encodeURIComponent(redirect)}`;
}

function redirectToLoginAfterSessionExpired() {
  useSessionStore.getState().clearSession();
  if (typeof window !== "undefined") {
    window.location.replace(resolveLoginUrl());
  }
}

async function refreshTokenOrClear(refreshToken: string) {
  if (!refreshPromise) {
    refreshPromise = safeFetch(buildUrl("/auth/refresh"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refreshToken }),
    })
      .then(async (response) => {
        const payload = (await response
          .json()
          .catch(() => null)) as ApiEnvelope<{
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
        redirectToLoginAfterSessionExpired();
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

async function resolveAuthToken(skipAuth: boolean, retry?: boolean) {
  if (skipAuth) {
    return "";
  }

  const session = useSessionStore.getState();
  if (session.accessToken && !isSessionExpired(session.expiresAt)) {
    return session.accessToken;
  }

  if (session.refreshToken && !retry) {
    const nextToken = await refreshTokenOrClear(session.refreshToken);
    if (nextToken) {
      return nextToken;
    }
    throw new Error("登录已过期，请重新登录");
  }

  return session.accessToken;
}

function normalizeRequestError(error: unknown): Error {
  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return new WebApiError("请求超时，请稍后重试");
    }
    if (
      error.message === "Failed to fetch" ||
      error.message === "Load failed"
    ) {
      return new WebApiError("服务连接失败，请稍后重试");
    }
    return error;
  }

  return new WebApiError("网络请求失败，请稍后重试");
}

async function safeFetch(input: RequestInfo | URL, init?: RequestInit) {
  try {
    return await fetch(input, init);
  } catch (error) {
    throw normalizeRequestError(error);
  }
}

export async function requestJson<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const headers = new Headers({
    "Content-Type": "application/json",
  });
  const accessToken = await resolveAuthToken(
    Boolean(options.skipAuth),
    options.retry,
  );

  if (!options.skipAuth && accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await safeFetch(buildUrl(path, options.query), {
    method: options.method || "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const session = useSessionStore.getState();

  if (
    response.status === 401 &&
    !options.skipAuth &&
    session.refreshToken &&
    !options.retry
  ) {
    const nextToken = await refreshTokenOrClear(session.refreshToken);
    if (nextToken) {
      return requestJson<T>(path, { ...options, retry: true });
    }
    throw new Error("登录已过期，请重新登录");
  }

  if (response.status === 401 && !options.skipAuth) {
    redirectToLoginAfterSessionExpired();
    throw new Error("登录已过期，请重新登录");
  }

  const payload = (await response
    .json()
    .catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok) {
    const errorCode =
      payload &&
      typeof payload.data === "object" &&
      payload.data !== null &&
      "errorCode" in payload.data
        ? String((payload.data as Record<string, unknown>).errorCode || "")
        : undefined;
    throw new WebApiError(
      toSafeUserFacingText(payload?.message, "请求失败，请稍后重试"),
      {
        status: response.status,
        code: payload?.code,
        errorCode,
        data: payload?.data,
      },
    );
  }
  if (!payload || typeof payload !== "object") {
    throw new WebApiError("响应格式错误", { status: response.status });
  }
  if (payload.code !== 0) {
    const errorCode =
      payload &&
      typeof payload.data === "object" &&
      payload.data !== null &&
      "errorCode" in payload.data
        ? String((payload.data as Record<string, unknown>).errorCode || "")
        : undefined;
    throw new WebApiError(
      toSafeUserFacingText(payload.message, "请求失败，请稍后重试"),
      {
        status: response.status,
        code: payload.code,
        errorCode,
        data: payload.data,
      },
    );
  }
  return payload.data;
}

export async function uploadFile(path: string, file: File, fieldName = "file") {
  const headers = new Headers();
  const accessToken = await resolveAuthToken(false, false);
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  const formData = new FormData();
  formData.append(fieldName, file);

  const response = await safeFetch(buildUrl(path), {
    method: "POST",
    headers,
    body: formData,
  });

  if (response.status === 401) {
    redirectToLoginAfterSessionExpired();
    throw new Error("登录已过期，请重新登录");
  }

  const payload = (await response.json().catch(() => null)) as ApiEnvelope<{
    url: string;
    path: string;
    filename?: string;
    size?: number;
    type?: string;
  }> | null;

  if (!response.ok || !payload || payload.code !== 0) {
    const errorCode =
      payload &&
      typeof payload.data === "object" &&
      payload.data !== null &&
      "errorCode" in payload.data
        ? String((payload.data as Record<string, unknown>).errorCode || "")
        : undefined;
    throw new WebApiError(
      toSafeUserFacingText(payload?.message, "上传失败，请稍后重试"),
      {
        status: response.status,
        code: payload?.code,
        errorCode,
        data: payload?.data,
      },
    );
  }

  return payload.data;
}

export function getWebApiErrorMessage(error: unknown, fallback: string) {
  return toSafeUserFacingText(
    error instanceof Error ? error.message : "",
    fallback,
  );
}

export function isWebApiConflict(error: unknown) {
  return error instanceof WebApiError && error.status === 409;
}
