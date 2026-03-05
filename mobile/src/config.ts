import { ENV } from './config/env';

const WEB_PORT = 8082;

function toWebUrl(apiBaseUrl: string): string {
    // 期望形如: http://host:8080
    return apiBaseUrl.replace(/:8080\/?$/, `:${WEB_PORT}`);
}

// 获取基础 API URL (后端 Go 服务，端口 8080，注意不含 /api/v1)
export const getApiBaseUrl = (): string => ENV.API_BASE_URL;

// 获取前端 Web URL（用于分享链接；开发环境默认 8082）
export const getWebUrl = (): string => {
    if (__DEV__) {
        return toWebUrl(getApiBaseUrl());
    }
    return getApiBaseUrl();
};

// 兼容旧代码 (API 使用)
export const getBaseUrl = getApiBaseUrl;

export const getApiUrl = (): string => {
    return `${getApiBaseUrl()}/api/v1`;
};
