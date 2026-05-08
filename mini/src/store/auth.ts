import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { taroStorage } from '@/utils/storage';

export interface AuthUser {
  id: number;
  phone: string;
  nickname: string;
  avatar?: string;
  userType: number;
  activeRole?: string;
  providerSubType?: 'designer' | 'company' | 'foreman';
  identityId?: number;
  identityRefId?: number;
  supervisorId?: number;
  adminProfileId?: number;
}

interface AuthState {
  token: string;
  refreshToken: string;
  expiresIn: number;
  user?: AuthUser;
  tinodeToken: string;
  tinodeError: string;
  setAuth: (payload: { token: string; refreshToken: string; expiresIn: number; user?: AuthUser }) => void;
  updateTinodeAuth: (payload: { tinodeToken?: string; tinodeError?: string }) => void;
  clear: () => void;
  updateUser: (user: Partial<AuthUser>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: '',
      refreshToken: '',
      expiresIn: 0,
      user: undefined,
      tinodeToken: '',
      tinodeError: '',
      setAuth: ({ token, refreshToken, expiresIn, user }) =>
        set((state) => ({
          token,
          refreshToken,
          expiresIn,
          user: user ?? state.user
        })),
      updateTinodeAuth: ({ tinodeToken, tinodeError }) =>
        set((state) => ({
          tinodeToken: typeof tinodeToken === 'string' ? tinodeToken : state.tinodeToken,
          tinodeError: typeof tinodeError === 'string' ? tinodeError : state.tinodeError,
        })),
      clear: () =>
        set({
          token: '',
          refreshToken: '',
          expiresIn: 0,
          user: undefined,
          tinodeToken: '',
          tinodeError: '',
        }),
      updateUser: (user) => set({ user: { ...get().user, ...user } as AuthUser })
    }),
    {
      name: 'hd-mini-auth',
      storage: createJSONStorage(() => taroStorage)
    }
  )
);
