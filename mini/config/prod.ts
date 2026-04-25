import type { UserConfigExport } from "@tarojs/cli";

const PROD_API_BASE = "https://api.hezeyunchuang.com/api/v1";
const LOCAL_API_BASE = "http://127.0.0.1:8080/api/v1";
const PROD_H5_URL = "https://hezeyunchuang.com/app/";
const LOCAL_H5_URL = "http://localhost:5176/";

type AppEnv = "local" | "test" | "staging" | "production";

const normalizeAppEnv = (raw?: string): AppEnv => {
  const value = (raw || "").trim().toLowerCase();
  switch (value) {
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
    case "":
    case "local":
    case "dev":
    case "development":
    case "docker":
    default:
      return "local";
  }
};

const APP_ENV = normalizeAppEnv(
  process.env.APP_ENV || process.env.TARO_APP_ENV,
);

const resolveProdApiBase = () => {
  const injectedApiBase = (process.env.TARO_APP_API_BASE || "").trim();
  if (injectedApiBase) {
    return injectedApiBase;
  }

  return APP_ENV === "production" ? PROD_API_BASE : LOCAL_API_BASE;
};

export default {
  env: {
    TARO_APP_ENV: JSON.stringify(APP_ENV),
    TARO_APP_API_BASE: JSON.stringify(resolveProdApiBase()),
    TARO_APP_H5_URL: JSON.stringify(
      process.env.TARO_APP_H5_URL ||
        (APP_ENV === "production" ? PROD_H5_URL : LOCAL_H5_URL),
    ),
    TARO_APP_TINODE_URL: JSON.stringify(process.env.TARO_APP_TINODE_URL || ""),
    TARO_APP_TINODE_API_KEY: JSON.stringify(
      process.env.TARO_APP_TINODE_API_KEY || "",
    ),
    TARO_APP_ENABLE_NOTIFICATION_WS: JSON.stringify(
      process.env.TARO_APP_ENABLE_NOTIFICATION_WS ||
        (APP_ENV === "production" ? "true" : "false"),
    ),
  },
  mini: {
    optimizeMainPackage: {
      enable: true,
    },
  },
} satisfies UserConfigExport;
