import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface User {
    id: number;
    phone: string;
    nickname?: string;
    avatar?: string;
    userType: string;
}

interface AuthState {
    token: string | null;
    user: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;

    // Actions
    setAuth: (token: string, user: User) => Promise<void>;
    logout: () => Promise<void>;
    loadStoredAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
    token: null,
    user: null,
    isLoading: true,
    isAuthenticated: false,

    setAuth: async (token, user) => {
        try {
            await AsyncStorage.setItem('token', token);
            await AsyncStorage.setItem('user', JSON.stringify(user));
        } catch (error) {
            console.error('Failed to save auth to storage:', error);
            // 即使存储失败，仍然更新内存状态让用户可以使用
        }

        set({
            token,
            user,
            isAuthenticated: true,
            isLoading: false,
        });
    },

    logout: async () => {
        try {
            await AsyncStorage.removeItem('token');
            await AsyncStorage.removeItem('user');
        } catch (error) {
            console.error('Failed to clear auth from storage:', error);
            // 即使存储清除失败，仍然清除内存状态以强制登出
        }

        set({
            token: null,
            user: null,
            isAuthenticated: false,
        });
    },

    loadStoredAuth: async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            const userJson = await AsyncStorage.getItem('user');

            if (token && userJson) {
                const user = JSON.parse(userJson);
                set({
                    token,
                    user,
                    isAuthenticated: true,
                    isLoading: false,
                });
            } else {
                set({ isLoading: false });
            }
        } catch (error) {
            console.error('Failed to load auth:', error);
            set({ isLoading: false });
        }
    },
}));
