export type AppEnv = 'local' | 'test' | 'staging' | 'production';

const normalizeAppEnv = (raw: unknown): AppEnv => {
    const value = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
    switch (value) {
        case '':
        case 'local':
        case 'dev':
        case 'development':
        case 'docker':
            return 'local';
        case 'test':
        case 'testing':
            return 'test';
        case 'stage':
        case 'staging':
        case 'pre':
        case 'preprod':
        case 'pre-production':
            return 'staging';
        case 'prod':
        case 'production':
        case 'release':
            return 'production';
        default:
            return 'local';
    }
};

const normalizeRouterBasename = (raw: unknown): string => {
    const value = typeof raw === 'string' ? raw.trim() : '';

    if (!value || value === '/') {
        return '/';
    }

    const withLeadingSlash = value.startsWith('/') ? value : `/${value}`;
    return withLeadingSlash.replace(/\/+$/, '') || '/';
};

export const getAppEnv = (): AppEnv => normalizeAppEnv(import.meta.env.VITE_APP_ENV);
const getRuntimeMode = (): AppEnv => {
    const configured = normalizeAppEnv(import.meta.env.VITE_APP_ENV);
    if (configured !== 'local') {
        return configured;
    }

    return import.meta.env.PROD ? 'production' : 'local';
};

export const getRouterBasename = (): string => {
    const configured = normalizeRouterBasename(import.meta.env.VITE_ROUTER_BASENAME);
    if (configured !== '/') {
        return configured;
    }

    return getRuntimeMode() === 'production' ? '/admin' : '/';
};

export const getLoginPath = (): string => {
    const basename = getRouterBasename();
    return basename === '/' ? '/login' : `${basename}/login`;
};

export const getApiBaseUrl = (): string => {
    const configured = typeof import.meta.env.VITE_API_URL === 'string'
        ? import.meta.env.VITE_API_URL.trim()
        : '';

    if (configured) {
        return configured.replace(/\/+$/, '');
    }

    return getRuntimeMode() === 'local' ? 'http://localhost:8080/api/v1' : '/api/v1';
};

export const getApiOrigin = (): string => {
    const apiBaseUrl = getApiBaseUrl();
    if (!apiBaseUrl) return '';
    if (apiBaseUrl.startsWith('http://') || apiBaseUrl.startsWith('https://')) {
        return apiBaseUrl.replace(/\/api\/v1\/?$/, '').replace(/\/+$/, '');
    }
    return apiBaseUrl.replace(/\/api\/v1\/?$/, '').replace(/\/+$/, '');
};

export const toAbsoluteAssetUrl = (path: string): string => {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
        return path;
    }
    return `${getApiOrigin()}${path}`;
};
