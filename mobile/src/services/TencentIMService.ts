/**
 * 腾讯云 IM 服务封装
 * 用于移动端和商家端的 IM 初始化和登录
 */
import TencentCloudChat from '@tencentcloud/chat';
import api from './api';
import { SecureStorage } from '../utils/SecureStorage';

export interface IMCredentials {
    sdkAppId: number;
    userId: string;
    userSig: string;
}

class TencentIMService {
    private credentials: IMCredentials | null = null;
    private isLoggedIn: boolean = false;
    private chat: any = null;

    /**
     * 获取 SDK 实例
     */
    getChat(): any {
        return this.chat;
    }

    /**
     * 从后端获取 IM 凭证（SDKAppID + UserSig）
     */
    async fetchCredentials(): Promise<IMCredentials | null> {
        try {
            // 使用 SecureStorage 获取 Token (与 authStore 保持一致)
            const token = await SecureStorage.getToken();
            if (!token) {
                console.warn('[TencentIM] 未登录，无法获取 IM 凭证');
                return null;
            }

            // 使用带自动刷新能力的 axios 实例，请求会自动附带 Authorization
            const res = await api.get('/im/usersig');

            this.credentials = {
                sdkAppId: res.data.sdkAppId,
                userId: String(res.data.userId),
                userSig: res.data.userSig,
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
     */
    async init(): Promise<boolean> {
        if (this.isLoggedIn && this.chat) return true;

        const credentials = await this.fetchCredentials();
        if (!credentials) {
            return false;
        }

        try {
            // 1. 创建 SDK 实例
            if (!this.chat) {
                this.chat = TencentCloudChat.create({
                    SDKAppID: credentials.sdkAppId,
                });
                // 设置日志级别
                this.chat.setLogLevel(1); // 0: normal, 1: release
            }

            // 2. 登录
            const loginRes = await this.chat.login({
                userID: credentials.userId,
                userSig: credentials.userSig,
            });

            this.isLoggedIn = true;
            console.log('[TencentIM] Login success! ✅');
            console.log('   SDKAppID:', credentials.sdkAppId);
            console.log('   UserID:', credentials.userId);
            return true;
        } catch (error) {
            console.error('[TencentIM] Init/Login failed:', error);
            this.isLoggedIn = false;
            return false;
        }
    }

    /**
     * 获取会话列表
     */
    async getConversationList(): Promise<any[]> {
        if (!this.chat) return [];
        try {
            const res = await this.chat.getConversationList();
            return res.data.conversationList || [];
        } catch (error) {
            console.error('[TencentIM] Get conversation list failed:', error);
            return [];
        }
    }

    /**
     * 登出
     */
    async logout(): Promise<void> {
        if (this.chat) {
            await this.chat.logout();
        }
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
