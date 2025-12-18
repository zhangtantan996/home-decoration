// Web 环境专用配置
// Vite 会自动替换 import.meta.env

export const getApiUrl = (): string => {
    // @ts-ignore
    return import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';
};
