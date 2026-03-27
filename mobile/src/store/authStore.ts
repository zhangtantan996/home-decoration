import { create } from 'zustand';
import { SecureStorage } from '../utils/SecureStorage';

interface User {
    id: number;
    phone: string;
    nickname?: string;
    avatar?: string;
    userType: string;
    activeRole?: string;
    providerId?: number;
    providerSubType?: 'designer' | 'company' | 'foreman';
}

interface AuthState {
    token: string | null;
    refreshToken: string | null;
    tinodeToken: string | null;
    user: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;

    // Actions
    setAuth: (token: string, refreshToken: string, tinodeToken: string, user: User) => Promise<void>;
    logout: () => Promise<void>;
    loadStoredAuth: () => Promise<void>;
    updateToken: (token: string) => Promise<void>;
    updateRefreshToken: (refreshToken: string) => Promise<void>;
    updateUser: (user: Partial<User>) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
    token: null,
    refreshToken: null,
    tinodeToken: null,
    user: null,
    isLoading: true,
    isAuthenticated: false,

    setAuth: async (token, refreshToken, tinodeToken, user) => {
        // Update in-memory state first to avoid blocking UX on slow Keychain/Keystore.
        set({
            token,
            refreshToken,
            tinodeToken,
            user,
            isAuthenticated: true,
            isLoading: false,
        });

        try {
            // Persist in the background; failures should not block app usage.
            await SecureStorage.saveToken(token);
            await SecureStorage.saveRefreshToken(refreshToken);
            await SecureStorage.saveTinodeToken(tinodeToken);
            await SecureStorage.saveUser(user);
        } catch (error) {
            if (__DEV__) {
                console.error('Failed to save auth to secure storage:', error);
            }
        }
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

    updateRefreshToken: async (refreshToken) => {
        try {
            await SecureStorage.saveRefreshToken(refreshToken);
            set({ refreshToken });
        } catch (error) {
            if (__DEV__) {
                console.error('Failed to update refresh token:', error);
            }
        }
    },

    updateUser: async (userUpdates) => {
        const currentUser = get().user;
        if (!currentUser) {
            return;
        }

        const mergedUser = {
            ...currentUser,
            ...userUpdates,
        };

        set({ user: mergedUser });

        try {
            await SecureStorage.saveUser(mergedUser);
        } catch (error) {
            if (__DEV__) {
                console.error('Failed to update user:', error);
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
            tinodeToken: null,
            user: null,
            isAuthenticated: false,
        });
    },

    loadStoredAuth: async () => {
        try {
            const token = await SecureStorage.getToken();
            const refreshToken = await SecureStorage.getRefreshToken();
            const tinodeToken = await SecureStorage.getTinodeToken();
            const user = await SecureStorage.getUser();

            if (token && user) {
                set({
                    token,
                    refreshToken,
                    tinodeToken,
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
