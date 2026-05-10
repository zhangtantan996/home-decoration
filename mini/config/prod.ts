import type { UserConfigExport } from "@tarojs/cli";

const LOCAL_API_BASE = "http://127.0.0.1:8080/api/v1";
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
  if (APP_ENV === "production") {
    throw new Error("TARO_APP_API_BASE is required for production mini builds");
  }
  return LOCAL_API_BASE;
};

const resolveH5Url = () => {
  const injectedH5Url = (process.env.TARO_APP_H5_URL || "").trim();
  if (injectedH5Url) {
    return injectedH5Url;
  }
  if (APP_ENV === "production") {
    throw new Error("TARO_APP_H5_URL is required for production mini builds");
  }
  return LOCAL_H5_URL;
};

export default {
  env: {
    TARO_APP_ENV: JSON.stringify(APP_ENV),
    TARO_APP_API_BASE: JSON.stringify(resolveProdApiBase()),
    TARO_APP_H5_URL: JSON.stringify(resolveH5Url()),
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
