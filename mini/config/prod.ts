import type { UserConfigExport } from '@tarojs/cli';

export default {
  env: {
    TARO_APP_ENV: JSON.stringify(process.env.APP_ENV || 'production'),
    TARO_APP_API_BASE: JSON.stringify(process.env.TARO_APP_API_BASE || 'https://api.yourdomain.com/api/v1'),
    TARO_APP_H5_URL: JSON.stringify(process.env.TARO_APP_H5_URL || ''),
    TARO_APP_TINODE_URL: JSON.stringify(process.env.TARO_APP_TINODE_URL || ''),
    TARO_APP_TINODE_API_KEY: JSON.stringify(process.env.TARO_APP_TINODE_API_KEY || '')
  },
  mini: {
    optimizeMainPackage: {
      enable: true
    }
  }
} satisfies UserConfigExport;
