import Geolocation from '@react-native-community/geolocation';
import { Platform, PermissionsAndroid } from 'react-native';

const OPEN_STREET_MAP_URL = 'https://nominatim.openstreetmap.org/reverse';

interface LocationResult {
    city: string;
    latitude: number;
    longitude: number;
}

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
        return new Promise((resolve, reject) => {
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
                            longitude
                        });
                    } catch (error) {
                        console.error('Reverse Geocoding Error:', error);
                        // Fallback to coordinates if network fails
                        resolve({ city: '定位失败', latitude, longitude });
                    }
                },
                (error) => {
                    console.error('Geolocation Error:', error);
                    reject(error);
                },
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
            );
        });
    }
};
