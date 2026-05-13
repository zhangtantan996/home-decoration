import { create } from 'zustand';

export interface OpsUser {
  id?: number;
  username?: string;
  nickname?: string;
  isSuperAdmin?: boolean;
  roles?: string[];
}

export type OpsLoginStage = 'setup_required' | 'otp_required' | 'active';

export interface OpsSecurityStatus {
  loginStage: OpsLoginStage;
  securitySetupRequired?: boolean;
  mustResetPassword?: boolean;
  twoFactorEnabled?: boolean;
  twoFactorRequired?: boolean;
  passwordExpired?: boolean;
}

interface OpsSessionPayload {
  token?: string;
  user?: OpsUser | null;
  security?: OpsSecurityStatus | null;
}

interface AuthState {
  token: string;
  user: OpsUser | null;
  security: OpsSecurityStatus | null;
  setSession: (payload: OpsSessionPayload) => void;
  logout: () => void;
  clearOpsSession: () => void;
}

const STORAGE_KEYS = {
  token: 'ops_token',
  user: 'ops_user',
  security: 'ops_security',
} as const;

export const OPS_ACCESS_DENIED_MESSAGE = '该账号无 Ops 工作台访问权限，请使用管理后台对应模块';

const OPS_ALLOWED_ROLE_KEYS = new Set([
  'operations',
  'product_manager',
  'system_admin',
  'super_admin',
]);

export const hasOpsAccess = (user: OpsUser | null | undefined) => Boolean(
  user && (user.isSuperAdmin || user.roles?.some((role) => OPS_ALLOWED_ROLE_KEYS.has(role))),
);

const readOpsUser = (): OpsUser | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.user);
    if (!raw) return null;
    const user = JSON.parse(raw) as OpsUser;
    return hasOpsAccess(user) ? user : null;
  } catch {
    return null;
  }
};

const readFallbackAdminUser = (): OpsUser | null => {
  try {
    const raw = localStorage.getItem('admin_user');
    if (!raw) return null;
    const user = JSON.parse(raw) as OpsUser;
    return hasOpsAccess(user) ? user : null;
  } catch {
    return null;
  }
};

const readOpsSecurity = (): OpsSecurityStatus | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.security) || localStorage.getItem('admin_security');
    if (!raw) return null;
    return JSON.parse(raw) as OpsSecurityStatus;
  } catch {
    return null;
  }
};

const readOpsToken = (user: OpsUser | null): string => {
  const opsToken = localStorage.getItem(STORAGE_KEYS.token) || '';
  if (opsToken) return opsToken;
  if (!hasOpsAccess(user)) return '';
  return localStorage.getItem('admin_token') || '';
};

export const useAuthStore = create<AuthState>((set) => ({
  token: '',
  user: null,
  security: null,
  setSession: ({ token, user, security }) => {
    if (typeof token === 'string' && token.length > 0) {
      localStorage.setItem(STORAGE_KEYS.token, token);
    } else {
      localStorage.removeItem(STORAGE_KEYS.token);
    }
    if (user) {
      localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEYS.user);
    }
    if (security) {
      localStorage.setItem(STORAGE_KEYS.security, JSON.stringify(security));
    } else {
      localStorage.removeItem(STORAGE_KEYS.security);
    }
    set({ token: token || '', user: user || null, security: security || null });
  },
  logout: () => {
    localStorage.removeItem(STORAGE_KEYS.token);
    localStorage.removeItem(STORAGE_KEYS.user);
    localStorage.removeItem(STORAGE_KEYS.security);
    set({ token: '', user: null, security: null });
  },
  clearOpsSession: () => {
    localStorage.removeItem(STORAGE_KEYS.token);
    localStorage.removeItem(STORAGE_KEYS.user);
    localStorage.removeItem(STORAGE_KEYS.security);
    set({ token: '', user: null, security: null });
  },
}));

const fallbackUser = readFallbackAdminUser();
const bootUser = readOpsUser() || fallbackUser;
const bootSecurity = readOpsSecurity();

if (!bootUser) {
  localStorage.removeItem(STORAGE_KEYS.token);
  localStorage.removeItem(STORAGE_KEYS.user);
  localStorage.removeItem(STORAGE_KEYS.security);
}

useAuthStore.setState({
  token: readOpsToken(bootUser),
  user: bootUser,
  security: bootSecurity,
});
