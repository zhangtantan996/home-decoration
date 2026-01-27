import { create } from 'zustand';
import { identityApi } from '../services/api';
import { SecureStorage } from '../utils/SecureStorage';
import { useAuthStore } from './authStore';

export interface Identity {
    id: number;
    userId: number;
    identityType: string;
    status: string;
    createdAt: string;
    updatedAt: string;
}

interface IdentityState {
    identities: Identity[];
    currentIdentity: Identity | null;
    loading: boolean;
    error: string | null;

    fetchIdentities: () => Promise<void>;
    switchIdentity: (identityId: number) => Promise<void>;
    applyIdentity: (identityType: string, documents?: string[]) => Promise<void>;
    clearError: () => void;
}

export const useIdentityStore = create<IdentityState>((set, get) => ({
    identities: [],
    currentIdentity: null,
    loading: false,
    error: null,

    fetchIdentities: async () => {
        set({ loading: true, error: null });
        try {
            const response = await identityApi.list();
            const identities = response.data?.identities || [];

            const currentResponse = await identityApi.getCurrent();
            const currentIdentity = currentResponse.data?.identity || null;

            set({
                identities,
                currentIdentity,
                loading: false,
            });
        } catch (error: any) {
            set({
                error: error.response?.data?.message || '获取身份列表失败',
                loading: false,
            });
        }
    },

    switchIdentity: async (identityId: number) => {
        set({ loading: true, error: null });
        try {
            const response = await identityApi.switch(identityId);
            const newToken = response.data?.token;
            const user = response.data?.user;

            if (newToken) {
                await SecureStorage.saveToken(newToken);

                if (user) {
                    await SecureStorage.saveUser(user);
                    useAuthStore.getState().updateToken(newToken);
                }
            }

            await get().fetchIdentities();

            set({ loading: false });
        } catch (error: any) {
            set({
                error: error.response?.data?.message || '切换身份失败',
                loading: false,
            });
            throw error;
        }
    },

    applyIdentity: async (identityType: string, documents?: string[]) => {
        set({ loading: true, error: null });
        try {
            await identityApi.apply({ identityType, documents });

            await get().fetchIdentities();

            set({ loading: false });
        } catch (error: any) {
            set({
                error: error.response?.data?.message || '申请身份失败',
                loading: false,
            });
            throw error;
        }
    },

    clearError: () => set({ error: null }),
}));
