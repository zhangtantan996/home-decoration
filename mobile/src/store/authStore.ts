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
    setAuth: (token: string, user: User) => void;
    logout: () => void;
    loadStoredAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
    token: null,
    user: null,
    isLoading: true,
    isAuthenticated: false,

    setAuth: (token, user) => {
        // Save to storage
        AsyncStorage.setItem('token', token);
        AsyncStorage.setItem('user', JSON.stringify(user));

        set({
            token,
            user,
            isAuthenticated: true,
            isLoading: false,
        });
    },

    logout: () => {
        AsyncStorage.removeItem('token');
        AsyncStorage.removeItem('user');

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
