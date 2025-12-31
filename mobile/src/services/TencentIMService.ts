/**
 * 腾讯云 IM 服务封装
 * 用于移动端和商家端的 IM 初始化和登录
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiUrl } from '../config';

export interface IMCredentials {
    sdkAppId: number;
    userId: string;
    userSig: string;
}

class TencentIMService {
    private credentials: IMCredentials | null = null;
    private isLoggedIn: boolean = false;

    /**
     * 从后端获取 IM 凭证（SDKAppID + UserSig）
     */
    async fetchCredentials(): Promise<IMCredentials | null> {
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) {
                console.warn('[TencentIM] 未登录，无法获取 IM 凭证');
                return null;
            }

            const response = await fetch(`${getApiUrl()}/im/usersig`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json() as any;
            if (data.code !== 0) {
                console.error('[TencentIM] 获取凭证失败:', data.message);
                return null;
            }

            this.credentials = {
                sdkAppId: data.data.sdkAppId,
                userId: data.data.userId,
                userSig: data.data.userSig,
            };

            return this.credentials;
        } catch (error) {
            console.error('[TencentIM] 获取凭证异常:', error);
            return null;
        }
    }

    /**
     * 获取当前凭证（如果已缓存）
     */
    getCredentials(): IMCredentials | null {
        return this.credentials;
    }

    /**
     * 初始化并登录 IM
     * 注意：TUIKit 组件会自动处理 SDK 初始化，这里只需提供凭证
     */
    async init(): Promise<boolean> {
        const credentials = await this.fetchCredentials();
        if (!credentials) {
            return false;
        }
        this.isLoggedIn = true;
        return true;
    }

    /**
     * 登出
     */
    logout(): void {
        this.credentials = null;
        this.isLoggedIn = false;
    }

    /**
     * 是否已登录
     */
    getIsLoggedIn(): boolean {
        return this.isLoggedIn;
    }
}

export default new TencentIMService();
