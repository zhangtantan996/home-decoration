import type { UserConfigExport } from "@tarojs/cli";

const resolveProdApiBase = () => {
  const injectedApiBase = (process.env.TARO_APP_API_BASE || "").trim();
  if (injectedApiBase) {
    return injectedApiBase;
  }

  // 本地用 build:weapp 调试时，未显式注入环境变量也应优先连本机 Docker。
  // 真实生产发布必须通过环境变量覆盖该值。
  if (process.env.CI !== "true") {
    return "http://127.0.0.1:8080/api/v1";
  }

  return "https://api.yourdomain.com/api/v1";
};

export default {
  env: {
    TARO_APP_ENV: JSON.stringify(process.env.APP_ENV || "production"),
    TARO_APP_API_BASE: JSON.stringify(resolveProdApiBase()),
    TARO_APP_H5_URL: JSON.stringify(process.env.TARO_APP_H5_URL || ""),
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
