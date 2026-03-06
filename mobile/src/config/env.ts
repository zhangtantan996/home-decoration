import Config from 'react-native-config';
import { NativeModules, Platform } from 'react-native';

export type AppEnv = 'local' | 'test' | 'staging' | 'production';

/**
 * 环境配置
 *
 * Android 调试时的网络配置说明：
 *
 * 方案 1: 使用 adb reverse (推荐用于模拟器)
 * - 执行: adb reverse tcp:8080 tcp:8080
 * - 使用: localhost:8080
 * - 优点: 配置简单，与 iOS 保持一致
 * - 缺点: 需要每次手动执行或在脚本中自动执行
 *
 * 方案 2: 使用 Android 模拟器特殊 IP
 * - 使用: 10.0.2.2:8080
 * - 优点: 不需要 adb reverse
 * - 缺点: 仅适用于模拟器，真机无法使用
 *
 * 方案 3: 使用 Mac 局域网 IP
 * - 获取 IP: ifconfig | grep "inet " | grep -v 127.0.0.1
 * - 使用: 192.168.x.x:8080
 * - 优点: 模拟器和真机都适用
 * - 缺点: IP 可能变化，需要手动更新
 */

type NetworkMode = 'adb-reverse' | 'emulator-ip' | 'lan-ip';

const NETWORK_MODE: NetworkMode = 'adb-reverse';
const MAC_LAN_IP = '192.168.1.100';
const configValues = Config as Record<string, string | undefined>;

const normalizeAppEnv = (raw?: string): AppEnv => {
    const value = (raw || '').trim().toLowerCase();
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

const trimTrailingSlash = (raw: string): string => raw.replace(/\/+$/, '');

const getConfigValue = (key: string): string => {
    const raw = configValues[key];
    return typeof raw === 'string' ? raw.trim() : '';
};

const APP_ENV = normalizeAppEnv(getConfigValue('APP_ENV') || (__DEV__ ? 'local' : 'production'));

function getScriptURL(): string | null {
    if (!__DEV__) return null;
    try {
        const url = (NativeModules as any)?.SourceCode?.scriptURL;
        return typeof url === 'string' ? url : null;
    } catch {
        return null;
    }
}

function getMetroBaseUrlFromScriptURL(): string | null {
    const scriptURL = getScriptURL();
    if (!scriptURL) return null;
    const match = scriptURL.match(/^(https?:\/\/[^/]+)/);
    return match ? match[1] : null;
}

function getMetroHostFromScriptURL(): string | null {
    const scriptURL = getScriptURL();
    if (!scriptURL) return null;
    const match = scriptURL.match(/^https?:\/\/([^:/]+)(?::\d+)?(?:\/|$)/);
    return match ? match[1] : null;
}

function getLocalApiBaseUrl(): string {
    const metroHost = getMetroHostFromScriptURL();
    if (metroHost) {
        return `http://${metroHost}:8080`;
    }

    if (APP_ENV === 'test') {
        return 'http://127.0.0.1:8080';
    }

    if (Platform.OS === 'ios') {
        return 'http://localhost:8080';
    }

    switch (NETWORK_MODE) {
        case 'adb-reverse':
            return 'http://localhost:8080';
        case 'emulator-ip':
            return 'http://10.0.2.2:8080';
        case 'lan-ip':
            return `http://${MAC_LAN_IP}:8080`;
        default:
            return 'http://localhost:8080';
    }
}

function getApiBaseUrl(): string {
    const configured = trimTrailingSlash(getConfigValue('API_BASE_URL'));
    if (configured) {
        return configured;
    }

    return getLocalApiBaseUrl();
}

function getMetroUrl(): string {
    const metroBaseUrl = getMetroBaseUrlFromScriptURL();
    if (metroBaseUrl) return metroBaseUrl;

    if (Platform.OS === 'ios') {
        return 'http://localhost:8081';
    }

    switch (NETWORK_MODE) {
        case 'adb-reverse':
            return 'http://localhost:8081';
        case 'emulator-ip':
            return 'http://10.0.2.2:8081';
        case 'lan-ip':
            return `http://${MAC_LAN_IP}:8081`;
        default:
            return 'http://localhost:8081';
    }
}

function getWebBaseUrl(): string {
    const configured = trimTrailingSlash(getConfigValue('WEB_BASE_URL'));
    if (configured) {
        return configured;
    }

    if (APP_ENV === 'local' || APP_ENV === 'test') {
        return getApiBaseUrl().replace(/:8080\/?$/, ':8082');
    }

    return getApiBaseUrl();
}

export const ENV = {
    APP_ENV,
    API_BASE_URL: getApiBaseUrl(),
    API_TIMEOUT: 10000,
    WEB_BASE_URL: getWebBaseUrl(),
    METRO_URL: getMetroUrl(),
    NETWORK_MODE,
    MAC_LAN_IP,
    IS_DEV: __DEV__,
    PLATFORM: Platform.OS,
};

if (__DEV__) {
    console.log('🌐 环境配置:', {
        'APP_ENV': ENV.APP_ENV,
        'API URL': ENV.API_BASE_URL,
        'Web URL': ENV.WEB_BASE_URL,
        'Metro URL': ENV.METRO_URL,
        '网络模式': ENV.NETWORK_MODE,
        '平台': ENV.PLATFORM,
    });

    if (Platform.OS === 'android') {
        const isLocalhost =
            ENV.API_BASE_URL.includes('http://localhost:8080') ||
            ENV.API_BASE_URL.includes('http://127.0.0.1:8080');
        if (isLocalhost) {
            console.log('💡 提示: Android 使用 localhost 时，需要 ADB 反向代理:');
            console.log('   adb reverse tcp:8080 tcp:8080');
            console.log('   adb reverse tcp:8081 tcp:8081');
        } else {
            console.log('💡 提示: 当前为直连模式，请确保设备能访问该 IP，并且后端在 8080 端口运行。');
        }
    }
}

export default ENV;
