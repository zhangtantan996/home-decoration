import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

import type { SessionUser } from '../../types/api';

interface SessionState {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  expiresAt: number;
  user: SessionUser | null;
  hasHydrated: boolean;
  setSession: (payload: { accessToken: string; refreshToken: string; expiresIn: number; user: SessionUser | null }) => void;
  clearSession: () => void;
  markHydrated: () => void;
}

const SESSION_EXPIRY_SKEW_MS = 5 * 1000;

export function resolveSessionExpiresAt(expiresIn: number, now = Date.now()) {
  return now + Math.max(0, expiresIn) * 1000;
}

export function isSessionExpired(expiresAt: number, now = Date.now()) {
  return !expiresAt || expiresAt <= now + SESSION_EXPIRY_SKEW_MS;
}

export function hasRecoverableSession(session: Pick<SessionState, 'accessToken' | 'refreshToken' | 'expiresAt'>) {
  if (session.refreshToken) {
    return true;
  }

  return Boolean(session.accessToken) && !isSessionExpired(session.expiresAt);
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
      expiresAt: 0,
      user: null,
      hasHydrated: false,
      setSession: ({ accessToken, refreshToken, expiresIn, user }) =>
        set({
          accessToken,
          refreshToken,
          expiresIn,
          expiresAt: resolveSessionExpiresAt(expiresIn),
          user,
        }),
      clearSession: () =>
        set({ accessToken: '', refreshToken: '', expiresIn: 0, expiresAt: 0, user: null }),
      markHydrated: () => set({ hasHydrated: true }),
    }),
    {
      name: 'user-web-session',
      storage,
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
        if (state && !hasRecoverableSession(state) && (state.accessToken || state.refreshToken || state.user)) {
          state.clearSession();
        }
      },
    },
  ),
);
