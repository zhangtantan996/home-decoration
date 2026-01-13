import type { UserConfigExport } from '@tarojs/cli';

export default {
  env: {
    TARO_APP_API_BASE: JSON.stringify(process.env.TARO_APP_API_BASE || 'http://localhost:8080/api/v1')
  }
} satisfies UserConfigExport;
