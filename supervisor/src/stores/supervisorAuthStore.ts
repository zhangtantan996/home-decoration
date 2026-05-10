import { create } from "zustand";
import { getApiBaseUrl } from "../utils/env";

export interface SupervisorSession {
  accountId: number;
  supervisorId: number;
  phone: string;
  realName: string;
  cityCode: string;
  serviceArea: string;
  certifications: string;
  status: number;
  verified: boolean;
}

interface SupervisorAuthState {
  accessToken: string | null;
  refreshToken: string | null;
  sessionId: string | null;
  supervisor: SupervisorSession | null;
  isAuthenticated: boolean;

  login: (data: {
    accessToken: string;
    refreshToken: string;
    sessionId: string;
    supervisor: SupervisorSession;
  }) => void;
  setTokens: (
    accessToken: string,
    refreshToken: string,
    sessionId: string,
  ) => void;
  logout: () => void;
  updateProfile: (profile: SupervisorSession) => void;
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
  checkAuth: () => boolean;
}

const safeJsonParse = <T>(value: string | null): T | null => {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

const TOKEN_KEY = "supervisor_access_token";
const REFRESH_KEY = "supervisor_refresh_token";
const SESSION_KEY = "supervisor_session_id";
const PROFILE_KEY = "supervisor_profile";

export const useSupervisorAuthStore = create<SupervisorAuthState>(
  (set, get) => ({
    accessToken: localStorage.getItem(TOKEN_KEY),
    refreshToken: localStorage.getItem(REFRESH_KEY),
    sessionId: localStorage.getItem(SESSION_KEY),
    supervisor: safeJsonParse<SupervisorSession>(
      localStorage.getItem(PROFILE_KEY),
    ),
    isAuthenticated: !!localStorage.getItem(TOKEN_KEY),

    login: ({ accessToken, refreshToken, sessionId, supervisor }) => {
      localStorage.setItem(TOKEN_KEY, accessToken);
      localStorage.setItem(REFRESH_KEY, refreshToken);
      localStorage.setItem(SESSION_KEY, sessionId);
      localStorage.setItem(PROFILE_KEY, JSON.stringify(supervisor));
      set({
        accessToken,
        refreshToken,
        sessionId,
        supervisor,
        isAuthenticated: true,
      });
    },

    setTokens: (accessToken, refreshToken, sessionId) => {
      localStorage.setItem(TOKEN_KEY, accessToken);
      localStorage.setItem(REFRESH_KEY, refreshToken);
      localStorage.setItem(SESSION_KEY, sessionId);
      set({ accessToken, refreshToken, sessionId, isAuthenticated: true });
    },

    updateProfile: (profile: SupervisorSession) => {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
      set({ supervisor: profile });
    },

    logout: () => {
      // 尝试调用后端登出（best effort）
      const token = get().accessToken;
      if (token) {
        fetch(`${getApiBaseUrl()}/supervisor/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      }
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_KEY);
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(PROFILE_KEY);
      set({
        accessToken: null,
        refreshToken: null,
        sessionId: null,
        supervisor: null,
        isAuthenticated: false,
      });
    },

    getAccessToken: () => get().accessToken,
    getRefreshToken: () => get().refreshToken,

    checkAuth: () => {
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) {
        set({ isAuthenticated: false });
        return false;
      }
      return true;
    },
  }),
);
