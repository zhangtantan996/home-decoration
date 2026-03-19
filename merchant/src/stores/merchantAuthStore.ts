import { create } from 'zustand';
import type { MerchantProviderSession } from '../services/merchantApi';

interface MerchantAuthState {
    token: string | null;
    provider: MerchantProviderSession | null;
    tinodeToken: string | null;
    isAuthenticated: boolean;

    // Actions
    login: (data: { token: string; provider: MerchantProviderSession; tinodeToken?: string }) => void;
    logout: () => void;
    updateProvider: (provider: Partial<MerchantProviderSession>) => void;
    getToken: () => string | null;
    checkAuth: () => boolean;
}

// Defensive JSON parse helper
const safeJsonParse = <T,>(value: string | null): T | null => {
    if (!value) return null;
    try {
        return JSON.parse(value) as T;
    } catch {
        return null;
    }
};

export const useMerchantAuthStore = create<MerchantAuthState>((set, get) => ({
    token: localStorage.getItem('merchant_token'),
    provider: safeJsonParse<MerchantProviderSession>(localStorage.getItem('merchant_provider')),
    tinodeToken: localStorage.getItem('merchant_tinode_token'),
    isAuthenticated: !!localStorage.getItem('merchant_token'),

    login: ({ token, provider, tinodeToken }) => {
        localStorage.setItem('merchant_token', token);
        localStorage.setItem('merchant_provider', JSON.stringify(provider));
        if (tinodeToken) {
            localStorage.setItem('merchant_tinode_token', tinodeToken);
        }
        set({ token, provider, tinodeToken: tinodeToken || null, isAuthenticated: true });
    },

    logout: () => {
        localStorage.removeItem('merchant_token');
        localStorage.removeItem('merchant_provider');
        localStorage.removeItem('merchant_tinode_token');
        set({ token: null, provider: null, tinodeToken: null, isAuthenticated: false });
    },

    updateProvider: (partialProvider) => {
        const currentProvider = get().provider;
        if (!currentProvider) return;
        const updatedProvider = { ...currentProvider, ...partialProvider };
        localStorage.setItem('merchant_provider', JSON.stringify(updatedProvider));
        set({ provider: updatedProvider });
    },

    getToken: () => {
        return get().token;
    },

    checkAuth: () => {
        const token = localStorage.getItem('merchant_token');
        if (!token) {
            set({ isAuthenticated: false });
            return false;
        }
        return true;
    },
}));
