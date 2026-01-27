import { create } from 'zustand';
import { identityApi } from '../services/api';

// 身份类型
export interface Identity {
    id: number;
    identityType: 'owner' | 'provider' | 'worker' | 'admin';
    status: number; // 0=pending, 1=approved, 2=rejected, 3=suspended
    verified: boolean;
    verifiedAt?: string;
    refId?: number; // provider.id 或 worker.id
    displayName: string;
    createdAt: string;
}

interface IdentityState {
    identities: Identity[];
    currentIdentity: Identity | null;
    loading: boolean;
    error: string | null;

    // Actions
    fetchIdentities: () => Promise<void>;
    fetchCurrentIdentity: () => Promise<void>;
    switchIdentity: (targetRole: string, currentRole?: string) => Promise<string>;
    clearError: () => void;
}

export const useIdentityStore = create<IdentityState>((set, get) => ({
    identities: JSON.parse(localStorage.getItem('identities') || '[]'),
    currentIdentity: JSON.parse(localStorage.getItem('current_identity') || 'null'),
    loading: false,
    error: null,

    fetchIdentities: async () => {
        set({ loading: true, error: null });
        try {
            const response: any = await identityApi.list();
            const identities = response.data?.identities || response.identities || [];
            localStorage.setItem('identities', JSON.stringify(identities));
            set({ identities, loading: false });
        } catch (error: any) {
            set({
                error: error.response?.data?.message || '获取身份列表失败',
                loading: false
            });
        }
    },

    fetchCurrentIdentity: async () => {
        set({ loading: true, error: null });
        try {
            const response: any = await identityApi.getCurrent();
            const currentIdentity = response.data || response;
            localStorage.setItem('current_identity', JSON.stringify(currentIdentity));
            set({ currentIdentity, loading: false });
        } catch (error: any) {
            set({
                error: error.response?.data?.message || '获取当前身份失败',
                loading: false
            });
        }
    },

    switchIdentity: async (targetRole: string, currentRole?: string) => {
        set({ loading: true, error: null });
        try {
            const response: any = await identityApi.switch({ targetRole, currentRole });
            const newToken = response.data?.token || response.token;

            if (!newToken) {
                throw new Error('切换身份失败：未返回新 token');
            }

            // 更新 token
            localStorage.setItem('admin_token', newToken);

            // 重新获取当前身份
            await get().fetchCurrentIdentity();

            set({ loading: false });
            return newToken;
        } catch (error: any) {
            const errorMessage = error.response?.data?.message || error.message || '切换身份失败';
            set({ error: errorMessage, loading: false });
            throw new Error(errorMessage);
        }
    },

    clearError: () => set({ error: null }),
}));
