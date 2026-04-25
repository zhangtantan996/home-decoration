import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import Taro from '@tarojs/taro';

import { taroStorage } from '@/utils/storage';
import { getErrorMessage } from '@/utils/error';
import { identityService, type Identity } from '@/services/identity';
import { useAuthStore } from './auth';

const deriveCurrentIdentity = (identities: Identity[]): Identity | undefined => {
  if (identities.length === 0) {
    return undefined;
  }

  const auth = useAuthStore.getState();
  const activeRole = auth.user?.activeRole;
  const providerSubType = auth.user?.providerSubType;

  if (activeRole === 'provider') {
    if (providerSubType) {
      const matchedProvider = identities.find(
        (identity) =>
          identity.identityType === 'provider' &&
          identity.providerSubType === providerSubType,
      );
      if (matchedProvider) {
        return matchedProvider;
      }
    }

    const providerIdentity = identities.find((identity) => identity.identityType === 'provider');
    if (providerIdentity) {
      return providerIdentity;
    }
  }

  if (activeRole === 'admin') {
    const adminIdentity = identities.find((identity) => identity.identityType === 'admin');
    if (adminIdentity) {
      return adminIdentity;
    }
  }

  const ownerIdentity = identities.find((identity) => identity.identityType === 'owner');
  return ownerIdentity || identities[0];
};

interface IdentityState {
  identities: Identity[];
  currentIdentity?: Identity;
  loading: boolean;
  error: string | null;
  fetchIdentities: () => Promise<void>;
  switchIdentity: (identityId: number) => Promise<void>;
  applyIdentity: (providerSubType: 'designer' | 'company' | 'foreman', applicationData?: string) => Promise<void>;
  clear: () => void;
}

export const useIdentityStore = create<IdentityState>()(
  persist(
    (set) => ({
      identities: [],
      currentIdentity: undefined,
      loading: false,
      error: null,

      fetchIdentities: async () => {
        set({ loading: true, error: null });
        try {
          const identities = await identityService.list();
          const current = deriveCurrentIdentity(identities);
          set({ identities, currentIdentity: current, loading: false });
        } catch (err) {
          const error = err instanceof Error ? err.message : '获取身份列表失败';
          set({ error, loading: false });
          throw err;
        }
      },

      switchIdentity: async (identityId: number) => {
        set({ loading: true, error: null });
        try {
          const response = await identityService.switch(identityId);

          useAuthStore.getState().setAuth({
            token: response.token,
            refreshToken: response.refreshToken,
            expiresIn: response.expiresIn
          });
          useAuthStore.getState().updateUser({
            activeRole: response.activeRole,
            ...(response.providerSubType ? { providerSubType: response.providerSubType } : {})
          });

          const identities = await identityService.list();
          const current = deriveCurrentIdentity(identities);
          set({ identities, currentIdentity: current, loading: false });

          Taro.showToast({ title: '切换成功', icon: 'success' });
        } catch (err) {
          const error = getErrorMessage(err, '切换身份失败');
          set({ error, loading: false });
          Taro.showToast({ title: error, icon: 'none' });
          throw err;
        }
      },

      applyIdentity: async (providerSubType: 'designer' | 'company' | 'foreman', applicationData?: string) => {
        set({ loading: true, error: null });
        try {
          await identityService.apply({
            identityType: 'provider',
            providerSubType,
            ...(applicationData ? { applicationData } : {}),
          });

          const identities = await identityService.list();
          set({ identities, loading: false });

          Taro.showToast({ title: '申请已提交', icon: 'success' });
        } catch (err) {
          const error = getErrorMessage(err, '申请失败');
          set({ error, loading: false });
          Taro.showToast({ title: error, icon: 'none' });
          throw err;
        }
      },

      clear: () => set({ identities: [], currentIdentity: undefined, loading: false, error: null })
    }),
    {
      name: 'hd-mini-identity',
      storage: createJSONStorage(() => taroStorage)
    }
  )
);
