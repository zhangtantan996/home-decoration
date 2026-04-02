import { create } from 'zustand';

const STORAGE_KEYS = {
  accessToken: 'admin_token',
  refreshToken: 'admin_refresh_token',
  admin: 'admin_user',
  permissions: 'admin_permissions',
  menus: 'admin_menus',
  security: 'admin_security',
} as const;

type BootstrapStatus = 'idle' | 'loading' | 'ready';
export type AdminLoginStage = 'setup_required' | 'otp_required' | 'active';

const readStorage = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeJsonParse = <T>(key: string, fallback: T): T => {
  const raw = readStorage(key);
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    try {
      localStorage.removeItem(key);
    } catch {
      return fallback;
    }
    return fallback;
  }
};

const clearAdminStorage = () => {
  try {
    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
  } catch {
    // ignore storage cleanup failures
  }
};

export interface MenuItem {
  id: number;
  parentId: number;
  title: string;
  type: number;
  permission: string;
  path: string;
  component: string;
  icon: string;
  sort: number;
  visible?: boolean;
  children?: MenuItem[];
}

export interface AdminSecurityStatus {
  loginStage: AdminLoginStage;
  securitySetupRequired: boolean;
  mustResetPassword: boolean;
  twoFactorEnabled: boolean;
  twoFactorRequired: boolean;
  passwordExpired?: boolean;
}

export interface AdminSessionItem {
  sessionId: string;
  clientIp?: string;
  userAgent?: string;
  createdAt?: string;
  lastSeenAt?: string;
  current: boolean;
  loginStage: AdminLoginStage;
}

export interface AdminUser {
  id: number;
  username: string;
  nickname: string;
  avatar?: string;
  isSuperAdmin: boolean;
  roles: string[];
  mustResetPassword?: boolean;
  twoFactorEnabled?: boolean;
  twoFactorBoundAt?: string;
  lastLoginAt?: string;
  lastLoginIp?: string;
  activeRole?: string;
}

interface AdminSessionPayload {
  accessToken?: string;
  refreshToken?: string;
  admin?: AdminUser | null;
  permissions?: string[];
  menus?: MenuItem[];
  security?: AdminSecurityStatus | null;
}

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  admin: AdminUser | null;
  permissions: string[];
  menus: MenuItem[];
  security: AdminSecurityStatus | null;
  isAuthenticated: boolean;
  bootstrapStatus: BootstrapStatus;

  setSession: (payload: AdminSessionPayload) => void;
  setBootstrapStatus: (status: BootstrapStatus) => void;
  logout: () => void;
  checkAuth: () => boolean;
  hasPermission: (permission: string) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: readStorage(STORAGE_KEYS.accessToken),
  refreshToken: readStorage(STORAGE_KEYS.refreshToken),
  admin: safeJsonParse<AdminUser | null>(STORAGE_KEYS.admin, null),
  permissions: safeJsonParse<string[]>(STORAGE_KEYS.permissions, []),
  menus: safeJsonParse<MenuItem[]>(STORAGE_KEYS.menus, []),
  security: safeJsonParse<AdminSecurityStatus | null>(STORAGE_KEYS.security, null),
  isAuthenticated: !!readStorage(STORAGE_KEYS.accessToken),
  bootstrapStatus: readStorage(STORAGE_KEYS.accessToken) ? 'idle' : 'ready',

  setSession: ({ accessToken, refreshToken, admin, permissions, menus, security }) => {
    const current = get();
    const nextState: Partial<AuthState> = {};

    if (typeof accessToken === 'string' && accessToken.length > 0) {
      localStorage.setItem(STORAGE_KEYS.accessToken, accessToken);
      nextState.token = accessToken;
      nextState.isAuthenticated = accessToken.length > 0;
    } else {
      nextState.token = current.token;
      nextState.isAuthenticated = current.isAuthenticated;
    }
    if (typeof refreshToken === 'string' && refreshToken.length > 0) {
      localStorage.setItem(STORAGE_KEYS.refreshToken, refreshToken);
      nextState.refreshToken = refreshToken;
    } else {
      nextState.refreshToken = current.refreshToken;
    }
    if (admin !== undefined) {
      if (admin) {
        localStorage.setItem(STORAGE_KEYS.admin, JSON.stringify(admin));
      } else {
        localStorage.removeItem(STORAGE_KEYS.admin);
      }
      nextState.admin = admin;
    } else {
      nextState.admin = current.admin;
    }

    const safePermissions = permissions ?? current.permissions;
    const safeMenus = menus ?? current.menus;
    const safeSecurity = security === undefined ? current.security : security;

    if (permissions !== undefined) {
      localStorage.setItem(STORAGE_KEYS.permissions, JSON.stringify(safePermissions));
    }
    if (menus !== undefined) {
      localStorage.setItem(STORAGE_KEYS.menus, JSON.stringify(safeMenus));
    }
    if (security !== undefined) {
      if (safeSecurity) {
        localStorage.setItem(STORAGE_KEYS.security, JSON.stringify(safeSecurity));
      } else {
        localStorage.removeItem(STORAGE_KEYS.security);
      }
    }

    nextState.permissions = safePermissions;
    nextState.menus = safeMenus;
    nextState.security = safeSecurity;
    nextState.bootstrapStatus = 'ready';

    set(nextState as AuthState);
  },

  setBootstrapStatus: (bootstrapStatus) => set({ bootstrapStatus }),

  logout: () => {
    clearAdminStorage();
    set({
      token: null,
      refreshToken: null,
      admin: null,
      permissions: [],
      menus: [],
      security: null,
      isAuthenticated: false,
      bootstrapStatus: 'ready',
    });
  },

  checkAuth: () => {
    const token = readStorage(STORAGE_KEYS.accessToken);
    const refreshToken = readStorage(STORAGE_KEYS.refreshToken);
    const admin = safeJsonParse<AdminUser | null>(STORAGE_KEYS.admin, null);
    const security = safeJsonParse<AdminSecurityStatus | null>(STORAGE_KEYS.security, null);

    if (!token || !admin) {
      clearAdminStorage();
      set({
        token: null,
        refreshToken: null,
        admin: null,
        permissions: [],
        menus: [],
        security: null,
        isAuthenticated: false,
        bootstrapStatus: 'ready',
      });
      return false;
    }

    if (!get().isAuthenticated || get().token !== token) {
      set({
        token,
        refreshToken,
        admin,
        security,
        permissions: safeJsonParse<string[]>(STORAGE_KEYS.permissions, []),
        menus: safeJsonParse<MenuItem[]>(STORAGE_KEYS.menus, []),
        isAuthenticated: true,
        bootstrapStatus: 'idle',
      });
    }

    return true;
  },

  hasPermission: (permission) => {
    const { admin, permissions } = get();
    if (!admin) return false;
    if (admin.isSuperAdmin || permissions.includes('*:*:*')) return true;
    return permissions.includes(permission);
  },
}));
