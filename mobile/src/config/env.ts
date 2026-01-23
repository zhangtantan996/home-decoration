import { Platform } from 'react-native';

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

// 配置选项
type NetworkMode = 'adb-reverse' | 'emulator-ip' | 'lan-ip';

// 选择你的网络模式
let NETWORK_MODE: NetworkMode = 'adb-reverse'; // 默认使用 adb reverse

// 如果使用 LAN IP 模式，请在这里填写你的 Mac IP 地址
// 获取方法: 在终端执行 ifconfig | grep "inet " | grep -v 127.0.0.1
const MAC_LAN_IP = '192.168.1.100'; // 请替换为你的实际 IP

/**
 * 获取 API 基础 URL
 */
function getApiBaseUrl(): string {
    if (Platform.OS === 'ios') {
        // iOS 模拟器直接使用 localhost
        return 'http://localhost:8080';
    }

    // Android 根据配置的网络模式选择
    switch (NETWORK_MODE) {
        case 'adb-reverse':
            // 使用 adb reverse，需要执行: adb reverse tcp:8080 tcp:8080
            return 'http://localhost:8080';

        case 'emulator-ip':
            // 使用 Android 模拟器特殊 IP（仅模拟器可用）
            return 'http://10.0.2.2:8080';

        case 'lan-ip':
            // 使用 Mac 的局域网 IP（模拟器和真机都可用）
            return `http://${MAC_LAN_IP}:8080`;

        default:
            return 'http://localhost:8080';
    }
}

/**
 * 获取 Metro Bundler URL (用于开发调试)
 */
function getMetroUrl(): string {
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

// 导出配置
export const ENV = {
    // API 配置
    API_BASE_URL: getApiBaseUrl(),
    API_TIMEOUT: 10000,

    // Metro 配置
    METRO_URL: getMetroUrl(),

    // 网络模式信息（用于调试）
    NETWORK_MODE,
    MAC_LAN_IP,

    // 环境标识
    IS_DEV: __DEV__,
    PLATFORM: Platform.OS,
};

// 开发环境下打印配置信息
if (__DEV__) {
    console.log('🌐 环境配置:', {
        'API URL': ENV.API_BASE_URL,
        'Metro URL': ENV.METRO_URL,
        '网络模式': ENV.NETWORK_MODE,
        '平台': ENV.PLATFORM,
    });

    if (Platform.OS === 'android' && NETWORK_MODE === 'adb-reverse') {
        console.log('💡 提示: 当前使用 adb reverse 模式，请确保已执行:');
        console.log('   adb reverse tcp:8080 tcp:8080');
        console.log('   adb reverse tcp:8081 tcp:8081');
    }
}

export default ENV;
