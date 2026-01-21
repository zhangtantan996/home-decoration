import type { UserConfigExport } from '@tarojs/cli';

export default {
  env: {
    // 使用本地 IP 地址以便微信开发者工具可以访问 OrbStack 容器
    // 如果您的 Mac IP 地址变化,请更新这里
    TARO_APP_API_BASE: JSON.stringify(process.env.TARO_APP_API_BASE || 'http://192.168.110.128:8080/api/v1')
  }
} satisfies UserConfigExport;
