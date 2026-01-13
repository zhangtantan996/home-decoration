import type { UserConfigExport } from '@tarojs/cli';

export default {
  env: {
    TARO_APP_API_BASE: JSON.stringify(process.env.TARO_APP_API_BASE || 'https://api.yourdomain.com/api/v1')
  },
  mini: {
    optimizeMainPackage: {
      enable: true
    }
  }
} satisfies UserConfigExport;
