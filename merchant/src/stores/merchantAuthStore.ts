import { create } from 'zustand';
import type { MerchantOnboardingStatus, MerchantProviderSession } from '../services/merchantApi';

interface MerchantAuthState {
    token: string | null;
    provider: MerchantProviderSession | null;
    tinodeToken: string | null;
    isAuthenticated: boolean;
    completionRequired: boolean;
    onboardingStatus: MerchantOnboardingStatus;
    completionApplicationId?: number | null;

    // Actions
    login: (data: {
        token: string;
        provider: MerchantProviderSession;
        tinodeToken?: string;
        completionRequired?: boolean;
        onboardingStatus?: MerchantOnboardingStatus;
        completionApplicationId?: number;
    }) => void;
    logout: () => void;
    updateProvider: (provider: Partial<MerchantProviderSession>) => void;
    setOnboardingState: (state: {
        completionRequired?: boolean;
        onboardingStatus?: MerchantOnboardingStatus;
        completionApplicationId?: number | null;
    }) => void;
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
    completionRequired: localStorage.getItem('merchant_completion_required') === 'true',
    onboardingStatus: (localStorage.getItem('merchant_onboarding_status') as MerchantOnboardingStatus | null) || 'approved',
    completionApplicationId: (() => {
        const raw = localStorage.getItem('merchant_completion_application_id');
        if (!raw) return null;
        const parsed = Number(raw);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    })(),

    login: ({ token, provider, tinodeToken, completionRequired, onboardingStatus, completionApplicationId }) => {
        localStorage.setItem('merchant_token', token);
        localStorage.setItem('merchant_provider', JSON.stringify(provider));
        if (tinodeToken) {
            localStorage.setItem('merchant_tinode_token', tinodeToken);
        }
        const normalizedCompletionRequired = Boolean(completionRequired ?? provider.completionRequired);
        const normalizedOnboardingStatus = onboardingStatus ?? provider.onboardingStatus ?? 'approved';
        const normalizedCompletionApplicationId = completionApplicationId ?? provider.completionApplicationId ?? null;
        localStorage.setItem('merchant_completion_required', String(normalizedCompletionRequired));
        localStorage.setItem('merchant_onboarding_status', normalizedOnboardingStatus);
        if (normalizedCompletionApplicationId) {
            localStorage.setItem('merchant_completion_application_id', String(normalizedCompletionApplicationId));
        } else {
            localStorage.removeItem('merchant_completion_application_id');
        }
        set({
            token,
            provider,
            tinodeToken: tinodeToken || null,
            isAuthenticated: true,
            completionRequired: normalizedCompletionRequired,
            onboardingStatus: normalizedOnboardingStatus,
            completionApplicationId: normalizedCompletionApplicationId,
        });
    },

    logout: () => {
        localStorage.removeItem('merchant_token');
        localStorage.removeItem('merchant_provider');
        localStorage.removeItem('merchant_tinode_token');
        localStorage.removeItem('merchant_completion_required');
        localStorage.removeItem('merchant_onboarding_status');
        localStorage.removeItem('merchant_completion_application_id');
        set({
            token: null,
            provider: null,
            tinodeToken: null,
            isAuthenticated: false,
            completionRequired: false,
            onboardingStatus: 'approved',
            completionApplicationId: null,
        });
    },

    updateProvider: (partialProvider) => {
        const currentProvider = get().provider;
        if (!currentProvider) return;
        const updatedProvider: MerchantProviderSession = {
            ...currentProvider,
            ...partialProvider,
        };
        localStorage.setItem('merchant_provider', JSON.stringify(updatedProvider));
        set({ provider: updatedProvider });
    },

    setOnboardingState: ({ completionRequired, onboardingStatus, completionApplicationId }) => {
        const nextCompletionRequired = completionRequired ?? get().completionRequired;
        const nextOnboardingStatus = onboardingStatus ?? get().onboardingStatus;
        const nextCompletionApplicationId = completionApplicationId ?? get().completionApplicationId ?? null;
        localStorage.setItem('merchant_completion_required', String(nextCompletionRequired));
        localStorage.setItem('merchant_onboarding_status', nextOnboardingStatus);
        if (nextCompletionApplicationId) {
            localStorage.setItem('merchant_completion_application_id', String(nextCompletionApplicationId));
        } else {
            localStorage.removeItem('merchant_completion_application_id');
        }
        const currentProvider = get().provider;
        const provider: MerchantProviderSession | null = currentProvider
            ? {
                ...currentProvider,
                completionRequired: nextCompletionRequired,
                onboardingStatus: nextOnboardingStatus,
                completionApplicationId: nextCompletionApplicationId ?? undefined,
            }
            : null;
        if (provider) {
            localStorage.setItem('merchant_provider', JSON.stringify(provider));
        }
        set({
            provider,
            completionRequired: nextCompletionRequired,
            onboardingStatus: nextOnboardingStatus,
            completionApplicationId: nextCompletionApplicationId,
        });
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
