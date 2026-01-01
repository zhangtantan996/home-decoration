import { Platform } from 'react-native';

// Native 环境 (iOS/Android) 默认配置
// Native 环境不支持 .env 文件直接加载，保留原有逻辑

// 获取基础 API URL (后端 Go 服务，端口 8080)
export const getApiBaseUrl = (): string => {
    if (__DEV__) {
        if (Platform.OS === 'android') {
            return 'http://192.168.110.40:8080';
        }
        return 'http://localhost:8080';
    }
    // 生产环境连接到测试服务器（端口 8888）
    return 'http://47.99.105.195:8888';
};

// 获取前端 Web URL (React Native Web 服务，通常端口 8081)
export const getWebUrl = (): string => {
    if (__DEV__) {
        if (Platform.OS === 'android') {
            return 'http://192.168.110.40:8082'; // 前端 Web 端口 (Vite)
        }
        return 'http://localhost:8082';
    }
    // 生产环境连接到测试服务器（端口 8888）
    return 'http://47.99.105.195:8888';
};

// 兼容旧代码 (API 使用)
export const getBaseUrl = getApiBaseUrl;

export const getApiUrl = (): string => {
    return `${getApiBaseUrl()}/api/v1`;
};
