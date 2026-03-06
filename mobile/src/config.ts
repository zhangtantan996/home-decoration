import { Platform } from 'react-native';

import { ENV } from './config/env';

const WEB_PORT = 8082;
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

function toWebUrl(apiBaseUrl: string): string {
    return apiBaseUrl.replace(/:8080\/?$/, `:${WEB_PORT}`);
}

function unique(values: string[]): string[] {
    return [...new Set(values.filter(Boolean))];
}

function safeParseUrl(raw: string): URL | null {
    try {
        return new URL(raw);
    } catch {
        return null;
    }
}

function trimTrailingSlash(raw: string): string {
    return raw.replace(/\/$/, '');
}

function replaceHost(raw: string, nextHost: string, nextPort?: string): string {
    const parsed = safeParseUrl(raw);
    if (!parsed) {
        return trimTrailingSlash(raw);
    }

    parsed.hostname = nextHost;
    if (nextPort) {
        parsed.port = nextPort;
    }
    parsed.pathname = '';
    parsed.search = '';
    parsed.hash = '';
    return trimTrailingSlash(parsed.toString());
}

function getMetroApiFallback(): string | null {
    const metroUrl = safeParseUrl(ENV.METRO_URL);
    if (!metroUrl?.hostname) {
        return null;
    }

    const hostname = metroUrl.hostname.toLowerCase();
    if (LOOPBACK_HOSTS.has(hostname)) {
        return null;
    }

    return replaceHost(getApiBaseUrl(), metroUrl.hostname, '8080');
}

export const getApiBaseUrl = (): string => ENV.API_BASE_URL;

export const getApiBaseUrlCandidates = (): string[] => {
    const primary = trimTrailingSlash(getApiBaseUrl());
    const candidates = [primary];
    const parsed = safeParseUrl(primary);

    if (__DEV__ && Platform.OS === 'android' && parsed?.hostname) {
        const hostname = parsed.hostname.toLowerCase();
        if (LOOPBACK_HOSTS.has(hostname)) {
            const metroFallback = getMetroApiFallback();
            if (metroFallback) {
                candidates.push(metroFallback);
            }
            candidates.push(replaceHost(primary, '10.0.2.2', parsed.port || '8080'));
        }
    }

    return unique(candidates);
};

export const getApiUrlCandidates = (): string[] => {
    return getApiBaseUrlCandidates().map((baseUrl) => `${trimTrailingSlash(baseUrl)}/api/v1`);
};

export const getTinodeHostCandidates = (): string[] => {
    return unique(
        getApiBaseUrlCandidates().map((baseUrl) => {
            const parsed = safeParseUrl(baseUrl);
            if (!parsed?.hostname) {
                return '';
            }

            const targetPort = parsed.port === '8888' ? '8888' : '6060';
            return `${parsed.hostname}:${targetPort}`;
        })
    );
};

export const getWebUrl = (): string => {
    if (__DEV__) {
        return toWebUrl(getApiBaseUrl());
    }
    return getApiBaseUrl();
};

export const getBaseUrl = getApiBaseUrl;

export const getApiUrl = (): string => {
    return `${trimTrailingSlash(getApiBaseUrl())}/api/v1`;
};
