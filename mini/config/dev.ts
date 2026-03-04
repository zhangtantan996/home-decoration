import type { UserConfigExport } from '@tarojs/cli';

export default {
  env: {
    // 通过环境变量统一注入 API 地址，避免本地硬编码 IP
    TARO_APP_API_BASE: JSON.stringify(process.env.TARO_APP_API_BASE || 'http://127.0.0.1:8080/api/v1'),
    // H5 Dev 默认使用浏览器调试；小程序 WebView 真机通常需要 HTTPS 域名
    TARO_APP_H5_URL: JSON.stringify(process.env.TARO_APP_H5_URL || 'http://localhost:5176/'),
    // Tinode (IM) 配置：建议通过环境变量注入，代码内做兜底推导
    TARO_APP_TINODE_URL: JSON.stringify(process.env.TARO_APP_TINODE_URL || ''),
    TARO_APP_TINODE_API_KEY: JSON.stringify(process.env.TARO_APP_TINODE_API_KEY || '')
  }
} satisfies UserConfigExport;
