import type { UserConfigExport } from "@tarojs/cli";

const PROD_API_BASE = "https://api.hezeyunchuang.com/api/v1";

const resolveProdApiBase = () => {
  const injectedApiBase = (process.env.TARO_APP_API_BASE || "").trim();
  if (injectedApiBase) {
    return injectedApiBase;
  }

  return PROD_API_BASE;
};

export default {
  env: {
    TARO_APP_ENV: JSON.stringify(process.env.APP_ENV || "production"),
    TARO_APP_API_BASE: JSON.stringify(resolveProdApiBase()),
    TARO_APP_H5_URL: JSON.stringify(
      process.env.TARO_APP_H5_URL || "https://hezeyunchuang.com/app/",
    ),
    TARO_APP_TINODE_URL: JSON.stringify(process.env.TARO_APP_TINODE_URL || ""),
    TARO_APP_TINODE_API_KEY: JSON.stringify(
      process.env.TARO_APP_TINODE_API_KEY || "",
    ),
    TARO_APP_ENABLE_NOTIFICATION_WS: JSON.stringify(
      process.env.TARO_APP_ENABLE_NOTIFICATION_WS || "true",
    ),
  },
  mini: {
    optimizeMainPackage: {
      enable: true,
    },
  },
} satisfies UserConfigExport;
