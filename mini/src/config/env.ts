import { buildAbsoluteUrl, parseAbsoluteUrl } from '@/utils/url';

export type AppEnv = "local" | "test" | "staging" | "production";

const PLACEHOLDER_API_HOST_PATTERN = /api\.yourdomain\.com/i;
const LOCAL_API_HOST_PATTERN = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\b/i;

const normalizeAppEnv = (raw?: string): AppEnv => {
  const value = (raw || "").trim().toLowerCase();
  switch (value) {
    case "":
    case "local":
    case "dev":
    case "development":
    case "docker":
      return "local";
    case "test":
    case "testing":
      return "test";
    case "stage":
    case "staging":
    case "pre":
    case "preprod":
    case "pre-production":
      return "staging";
    case "prod":
    case "production":
    case "release":
      return "production";
    default:
      return "local";
  }
};

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");
const normalizePath = (value: string) => `/${value.replace(/^\/+/, "")}`;
const createApiUrl = (path: string) => {
  const apiBasePath = trimTrailingSlash(API_BASE_URL).replace(/\/+$/, '');
  const suffixPath = `${apiBasePath.replace(/^https?:\/\/[^/]+/i, '')}${normalizePath(path)}`;
  return buildAbsoluteUrl(API_BASE_URL, suffixPath);
};

const getDefaultApiBaseUrl = (appEnv: AppEnv) => {
  switch (appEnv) {
    case "local":
    case "test":
      return "http://127.0.0.1:8080/api/v1";
    default:
      return "https://api.yourdomain.com/api/v1";
  }
};

const APP_ENV = normalizeAppEnv(process.env.TARO_APP_ENV);
const API_BASE_URL = trimTrailingSlash(
  process.env.TARO_APP_API_BASE || getDefaultApiBaseUrl(APP_ENV),
);
const H5_URL = (process.env.TARO_APP_H5_URL || "").trim();
const TINODE_URL = (process.env.TARO_APP_TINODE_URL || "").trim();
const TINODE_API_KEY = (process.env.TARO_APP_TINODE_API_KEY || "").trim();
const IS_PLACEHOLDER_API_BASE = PLACEHOLDER_API_HOST_PATTERN.test(API_BASE_URL);
const IS_LOCAL_API_BASE = LOCAL_API_HOST_PATTERN.test(API_BASE_URL);
const ENABLE_NOTIFICATION_WS = (() => {
  const raw = (process.env.TARO_APP_ENABLE_NOTIFICATION_WS || "").trim().toLowerCase();
  if (raw === "true") {
    return true;
  }
  if (raw === "false") {
    return false;
  }
  return !IS_LOCAL_API_BASE;
})();

export const buildMiniApiUrl = (path: string) => createApiUrl(path);

export const buildMiniRealtimeUrl = (token: string) => {
  const httpUrl = createApiUrl("/realtime/notifications");
  const parsedUrl = parseAbsoluteUrl(httpUrl);
  if (!parsedUrl) {
    return httpUrl;
  }
  const wsProtocol = parsedUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${wsProtocol}//${parsedUrl.host}${parsedUrl.pathname}?token=${encodeURIComponent(token)}`;
};

export const MINI_ENV = {
  APP_ENV,
  API_BASE_URL,
  H5_URL,
  TINODE_URL,
  TINODE_API_KEY,
  ENABLE_NOTIFICATION_WS,
  IS_PLACEHOLDER_API_BASE,
  IS_LOCAL_API_BASE,
};
