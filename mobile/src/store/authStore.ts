import { create } from 'zustand';
import { SecureStorage } from '../utils/SecureStorage';

interface User {
    id: number;
    phone: string;
    nickname?: string;
    avatar?: string;
    userType: string;
}

interface AuthState {
    token: string | null;
    refreshToken: string | null;
    user: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;

    // Actions
    setAuth: (token: string, refreshToken: string, user: User) => Promise<void>;
    logout: () => Promise<void>;
    loadStoredAuth: () => Promise<void>;
    updateToken: (token: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
    token: null,
    refreshToken: null,
    user: null,
    isLoading: true,
    isAuthenticated: false,

    setAuth: async (token, refreshToken, user) => {
        try {
            // 使用 Keychain 安全存储
            await SecureStorage.saveToken(token);
            await SecureStorage.saveRefreshToken(refreshToken);
            await SecureStorage.saveUser(user);
        } catch (error) {
            if (__DEV__) {
                console.error('Failed to save auth to secure storage:', error);
            }
            // 即使存储失败，仍然更新内存状态让用户可以使用
        }

        set({
            token,
            refreshToken,
            user,
            isAuthenticated: true,
            isLoading: false,
        });
    },

    updateToken: async (token) => {
        try {
            await SecureStorage.saveToken(token);
            set({ token });
        } catch (error) {
            if (__DEV__) {
                console.error('Failed to update token:', error);
            }
        }
    },

    logout: async () => {
        try {
            await SecureStorage.clearAll();
        } catch (error) {
            if (__DEV__) {
                console.error('Failed to clear auth from secure storage:', error);
            }
            // 即使存储清除失败，仍然清除内存状态以强制登出
        }

        set({
            token: null,
            refreshToken: null,
            user: null,
            isAuthenticated: false,
        });
    },

    loadStoredAuth: async () => {
        try {
            const token = await SecureStorage.getToken();
            const refreshToken = await SecureStorage.getRefreshToken();
            const user = await SecureStorage.getUser();

            if (token && user) {
                set({
                    token,
                    refreshToken,
                    user,
                    isAuthenticated: true,
                    isLoading: false,
                });
            } else {
                set({ isLoading: false });
            }
        } catch (error) {
            if (__DEV__) {
                console.error('Failed to load auth:', error);
            }
            set({ isLoading: false });
        }
    },
}));
