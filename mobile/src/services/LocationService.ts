import Geolocation from '@react-native-community/geolocation';
import { Platform, PermissionsAndroid } from 'react-native';

const OPEN_STREET_MAP_URL = 'https://nominatim.openstreetmap.org/reverse';

interface LocationResult {
    city: string;
    latitude: number;
    longitude: number;
    success?: boolean;
    error?: string;
}

// 默认城市坐标 (西安)
const DEFAULT_LOCATION = {
    city: '西安',
    latitude: 34.341568,
    longitude: 108.940174,
};

export const LocationService = {
    requestPermission: async (): Promise<boolean> => {
        if (Platform.OS === 'ios') {
            Geolocation.requestAuthorization();
            return true;
        }

        try {
            const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                {
                    title: "定位权限申请",
                    message: "我们需要获取您的位置以提供更好的服务",
                    buttonNeutral: "稍后询问",
                    buttonNegative: "取消",
                    buttonPositive: "确定"
                }
            );
            return granted === PermissionsAndroid.RESULTS.GRANTED;
        } catch (err) {
            console.warn(err);
            return false;
        }
    },

    getCurrentCity: (): Promise<LocationResult> => {
        return new Promise((resolve) => {
            Geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords;
                    try {
                        const response = await fetch(
                            `${OPEN_STREET_MAP_URL}?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`,
                            {
                                headers: {
                                    'User-Agent': 'HomeDecorationApp/1.0'
                                }
                            }
                        );
                        const data = await response.json() as any;

                        // Extract city name (handle different OSM address formats)
                        const address = data.address || {};
                        const city = address.city || address.town || address.county || address.state || '未知城市';

                        // Clean up city name (remove "市")
                        const cleanCity = city.replace(/市$/, '');

                        resolve({
                            city: cleanCity,
                            latitude,
                            longitude,
                            success: true,
                        });
                    } catch (error) {
                        console.warn('逆地理编码失败,使用坐标位置:', error);
                        // Fallback to coordinates if network fails
                        resolve({ 
                            city: '定位失败', 
                            latitude, 
                            longitude,
                            success: true,
                        });
                    }
                },
                (error) => {
                    console.warn('定位失败,使用默认城市 (西安):', error.message);
                    // ✅ 关键修复: 不要 reject,而是 resolve 默认值
                    resolve({
                        ...DEFAULT_LOCATION,
                        success: false,
                        error: error.message,
                    });
                },
                {
                    enableHighAccuracy: false,  // 优先使用网络定位 (更快)
                    timeout: 10000,             // 10 秒超时
                    maximumAge: 300000,         // 5 分钟缓存
                }
            );
        });
    }
};
