import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

import type { SessionUser } from '../../types/api';

interface SessionState {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: SessionUser | null;
  hasHydrated: boolean;
  setSession: (payload: { accessToken: string; refreshToken: string; expiresIn: number; user: SessionUser | null }) => void;
  clearSession: () => void;
  markHydrated: () => void;
}

const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

const storage = createJSONStorage(() => (typeof window === 'undefined' ? noopStorage : localStorage));

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      accessToken: '',
      refreshToken: '',
      expiresIn: 0,
      user: null,
      hasHydrated: false,
      setSession: ({ accessToken, refreshToken, expiresIn, user }) =>
        set({ accessToken, refreshToken, expiresIn, user }),
      clearSession: () =>
        set({ accessToken: '', refreshToken: '', expiresIn: 0, user: null }),
      markHydrated: () => set({ hasHydrated: true }),
    }),
    {
      name: 'user-web-session',
      storage,
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      },
    },
  ),
);
