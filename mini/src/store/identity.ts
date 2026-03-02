import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import Taro from '@tarojs/taro';

import { taroStorage } from '@/utils/storage';
import { identityService, type Identity } from '@/services/identity';
import { useAuthStore } from './auth';

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
          const current = await identityService.getCurrent();
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
          const current = await identityService.getCurrent();
          set({ identities, currentIdentity: current, loading: false });

          Taro.showToast({ title: '切换成功', icon: 'success' });
        } catch (err) {
          const error = err instanceof Error ? err.message : '切换身份失败';
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
          const error = err instanceof Error ? err.message : '申请失败';
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
