import { Platform } from 'react-native';

// Native 环境 (iOS/Android) 默认配置
// Native 环境不支持 .env 文件直接加载，保留原有逻辑

export const getApiUrl = (): string => {
    if (Platform.OS === 'android') {
        // 真机调试：使用电脑的局域网 IP
        // 模拟器请改回 10.0.2.2
        return 'http://192.168.110.40:8080/api/v1';
    }
    // iOS 模拟器用 localhost
    return 'http://localhost:8080/api/v1';
};
