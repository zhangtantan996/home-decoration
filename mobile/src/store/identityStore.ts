import { create } from 'zustand';
import { identityApi } from '../services/api';
import { useAuthStore } from './authStore';

export type IdentityType = 'owner' | 'provider' | 'admin';
export type ProviderSubType = 'designer' | 'company' | 'foreman';

export interface Identity {
    id: number;
    userId: number;
    identityType: IdentityType;
    providerSubType?: ProviderSubType;
    status: number;
    verified?: boolean;
    refId?: number;
    displayName?: string;
    createdAt: string;
    updatedAt: string;
}

interface IdentityState {
    identities: Identity[];
    currentIdentity: Identity | null;
    loading: boolean;
    error: string | null;

    fetchIdentities: () => Promise<void>;
    switchIdentity: (identityId: number, targetRole?: string) => Promise<void>;
    applyIdentity: (providerSubType: ProviderSubType, applicationData?: string) => Promise<void>;
    clearError: () => void;
}

const resolveRoleFromUser = (
    user: { activeRole?: string; providerSubType?: string; userType?: string | number } | null,
): { role: IdentityType; providerSubType?: ProviderSubType } | null => {
    if (!user) {
        return null;
    }

    if (user.activeRole === 'provider') {
        const providerSubType = normalizeProviderSubType(user.providerSubType) || 'designer';
        return { role: 'provider', providerSubType };
    }
    if (user.activeRole === 'admin') {
        return { role: 'admin' };
    }
    if (user.activeRole === 'owner') {
        return { role: 'owner' };
    }

    const userType = Number(user.userType);
    switch (userType) {
        case 2:
            return { role: 'provider', providerSubType: 'designer' };
        case 3:
            return { role: 'provider', providerSubType: 'foreman' };
        case 4:
            return { role: 'admin' };
        default:
            return { role: 'owner' };
    }
};

const normalizeProviderSubType = (value?: string | null): ProviderSubType | undefined => {
    const normalized = String(value || '').toLowerCase();
    if (normalized === 'designer') {
        return 'designer';
    }
    if (normalized === 'company') {
        return 'company';
    }
    if (normalized === 'foreman' || normalized === 'worker') {
        return 'foreman';
    }
    return undefined;
};

const normalizeIdentity = (identity: any): Identity => {
    const rawType = String(identity?.identityType || '').toLowerCase();

    let identityType: IdentityType = 'owner';
    let providerSubType = normalizeProviderSubType(identity?.providerSubType);

    if (rawType === 'admin') {
        identityType = 'admin';
    } else if (rawType === 'provider' || rawType === 'designer' || rawType === 'company' || rawType === 'foreman' || rawType === 'worker') {
        identityType = 'provider';
        if (!providerSubType) {
            providerSubType = normalizeProviderSubType(rawType);
        }
        if (!providerSubType) {
            providerSubType = 'designer';
        }
    }

    return {
        ...identity,
        identityType,
        providerSubType,
    };
};

const createFallbackIdentity = (
    role: IdentityType,
    userID: number,
    providerSubType?: ProviderSubType,
): Identity => ({
    id: 0,
    userId: userID,
    identityType: role,
    providerSubType,
    status: 1,
    displayName: '',
    createdAt: '',
    updatedAt: '',
});

export const useIdentityStore = create<IdentityState>((set, get) => ({
    identities: [],
    currentIdentity: null,
    loading: false,
    error: null,

    fetchIdentities: async () => {
        set({ loading: true, error: null });

        const authUser = useAuthStore.getState().user;
        const fallbackRole = resolveRoleFromUser(authUser);
        const fallbackIdentity = fallbackRole
            ? createFallbackIdentity(fallbackRole.role, authUser?.id || 0, fallbackRole.providerSubType)
            : null;

        try {
            let identities: Identity[] = [];
            let currentIdentity: Identity | null = null;

            try {
                const response = await identityApi.list();
                const rawList = response.data?.identities || [];
                identities = rawList.map((item: any) => normalizeIdentity(item));
            } catch {
                identities = [];
            }

            try {
                const currentResponse = await identityApi.getCurrent();
                const rawCurrent = currentResponse.data || null;
                currentIdentity = rawCurrent ? normalizeIdentity(rawCurrent) : null;
            } catch {
                currentIdentity = null;
            }

            if (!currentIdentity && identities.length > 0) {
                currentIdentity = identities.find(identity => identity.status === 1) || identities[0] || null;
            }

            if (!currentIdentity && fallbackIdentity) {
                currentIdentity = fallbackIdentity;
            }

            if (identities.length === 0 && fallbackIdentity) {
                identities = [fallbackIdentity];
            }

            set({
                identities,
                currentIdentity,
                loading: false,
                error: null,
            });
        } catch (error: any) {
            set({
                identities: fallbackIdentity ? [fallbackIdentity] : [],
                currentIdentity: fallbackIdentity,
                error: fallbackIdentity ? null : (error.response?.data?.message || '获取身份列表失败'),
                loading: false,
            });
        }
    },

    switchIdentity: async (identityId: number, targetRole?: string) => {
        set({ loading: true, error: null });
        try {
            const response = await identityApi.switch({ identityId, targetRole });
            const newToken = response.data?.token;
            const newRefreshToken = response.data?.refreshToken;
            const activeRole = response.data?.activeRole;
            const providerSubType = normalizeProviderSubType(response.data?.providerSubType);
            const user = response.data?.user;

            if (newToken) {
                await useAuthStore.getState().updateToken(newToken);

                if (newRefreshToken) {
                    await useAuthStore.getState().updateRefreshToken(newRefreshToken);
                }

                if (user) {
                    await useAuthStore.getState().updateUser({
                        ...user,
                        ...(activeRole ? { activeRole } : {}),
                        ...(providerSubType ? { providerSubType } : {}),
                    });
                } else if (useAuthStore.getState().user) {
                    await useAuthStore.getState().updateUser({
                        ...(activeRole ? { activeRole } : {}),
                        ...(providerSubType ? { providerSubType } : {}),
                    });
                }
            }

            await get().fetchIdentities();

            set({ loading: false });
        } catch (error: any) {
            const message = error?.response?.data?.message || error?.message || '切换身份失败';
            set({ loading: false, error: message });
            throw new Error(message);
        }
    },

    applyIdentity: async (providerSubType: ProviderSubType, applicationData?: string) => {
        set({ loading: true, error: null });
        try {
            await identityApi.apply({
                identityType: 'provider',
                providerSubType,
                ...(applicationData ? { applicationData } : {}),
            });

            await get().fetchIdentities();

            set({ loading: false });
        } catch (error: any) {
            const message = error?.response?.data?.message || error?.message || '申请身份失败';
            set({ loading: false, error: message });
            throw new Error(message);
        }
    },

    clearError: () => set({ error: null }),
}));
