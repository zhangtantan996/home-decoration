import { Platform } from 'react-native';

// Native 环境 (iOS/Android) 默认配置
// Native 环境不支持 .env 文件直接加载，保留原有逻辑

export const getApiUrl = (): string => {
    // 只有在非开发环境（即打包打包 APK 时）切换到服务器 IP
    if (__DEV__) {
        if (Platform.OS === 'android') {
            // 真机调试：使用电脑的局域网 IP
            // 模拟器请根据需要改回 10.0.2.2
            return 'http://192.168.110.40:8080/api/v1';
        }
        // iOS 模拟器或 Web 环境
        return 'http://localhost:8080/api/v1';
    }

    // 正式环境（打发布包时使用）
    return 'http://47.99.105.195/api/v1';
};
