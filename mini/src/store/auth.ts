import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { storage } from '@/utils/storage';

export interface AuthUser {
  id: number;
  phone: string;
  nickname: string;
  avatar?: string;
  userType: number;
  activeRole?: string;
  providerSubType?: 'designer' | 'company' | 'foreman';
}

interface AuthState {
  token: string;
  refreshToken: string;
  expiresIn: number;
  user?: AuthUser;
  setAuth: (payload: { token: string; refreshToken: string; expiresIn: number; user?: AuthUser }) => void;
  clear: () => void;
  updateUser: (user: Partial<AuthUser>) => void;
}

const taroStorage = {
  getItem: (name: string) => {
    const value = storage.get<string>(name);
    return value ?? null;
  },
  setItem: (name: string, value: string) => storage.set(name, value),
  removeItem: (name: string) => storage.remove(name)
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: '',
      refreshToken: '',
      expiresIn: 0,
      user: undefined,
      setAuth: ({ token, refreshToken, expiresIn, user }) =>
        set((state) => ({
          token,
          refreshToken,
          expiresIn,
          user: user ?? state.user
        })),
      clear: () => set({ token: '', refreshToken: '', expiresIn: 0, user: undefined }),
      updateUser: (user) => set({ user: { ...get().user, ...user } as AuthUser })
    }),
    {
      name: 'hd-mini-auth',
      storage: createJSONStorage(() => taroStorage)
    }
  )
);
