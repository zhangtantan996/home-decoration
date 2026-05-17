import { create } from 'zustand';

export interface OpsUser {
  id?: number;
  username?: string;
  nickname?: string;
  isSuperAdmin?: boolean;
  roles?: string[];
}

export type OpsLoginStage = 'setup_required' | 'otp_required' | 'active';
type BootstrapStatus = 'idle' | 'loading' | 'ready';

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
  permissions?: string[];
  security?: OpsSecurityStatus | null;
}

interface AuthState {
  token: string;
  user: OpsUser | null;
  permissions: string[];
  security: OpsSecurityStatus | null;
  bootstrapStatus: BootstrapStatus;
  setSession: (payload: OpsSessionPayload) => void;
  setBootstrapStatus: (status: BootstrapStatus) => void;
  hasPermission: (permission: string) => boolean;
  logout: () => void;
  clearOpsSession: () => void;
}

const STORAGE_KEYS = {
  token: 'ops_token',
  user: 'ops_user',
  permissions: 'ops_permissions',
  security: 'ops_security',
} as const;

export const OPS_ACCESS_DENIED_MESSAGE = '该账号无 Ops 工作台访问权限，请使用管理后台对应模块';

const OPS_ALLOWED_ROLE_KEYS = new Set([
  'operations',
  'product_manager',
  'system_admin',
  'super_admin',
]);

const OPS_WORKSPACE_PERMISSIONS = new Set([
  'dashboard:view',
  'provider:designer:list',
  'provider:company:list',
  'provider:foreman:list',
  'material:shop:list',
  'booking:list',
  'system:case:view',
  'system:log:list',
]);

export const hasOpsAccess = (
  user: OpsUser | null | undefined,
  permissions: string[] | null | undefined = [],
) => Boolean(
  user && (
    user.isSuperAdmin ||
    user.roles?.some((role) => OPS_ALLOWED_ROLE_KEYS.has(role)) ||
    permissions?.includes('*:*:*') ||
    permissions?.some((permission) => OPS_WORKSPACE_PERMISSIONS.has(permission))
  ),
);

export const hasOpsPermission = (
  user: OpsUser | null | undefined,
  permissions: string[] | null | undefined,
  permission: string,
) => Boolean(
  user && (user.isSuperAdmin || permissions?.includes('*:*:*') || permissions?.includes(permission)),
);

const readOpsUser = (): OpsUser | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.user);
    if (!raw) return null;
    const user = JSON.parse(raw) as OpsUser;
    return user || null;
  } catch {
    return null;
  }
};

const readFallbackAdminUser = (): OpsUser | null => {
  try {
    const raw = localStorage.getItem('admin_user');
    if (!raw) return null;
    const user = JSON.parse(raw) as OpsUser;
    return user || null;
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

const readOpsPermissions = (): string[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.permissions) || localStorage.getItem('admin_permissions');
    if (!raw) return [];
    const permissions = JSON.parse(raw) as unknown;
    return Array.isArray(permissions) ? permissions.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
};

const readOpsToken = (user: OpsUser | null, permissions: string[]): string => {
  const opsToken = localStorage.getItem(STORAGE_KEYS.token) || '';
  if (opsToken) return opsToken;
  if (!hasOpsAccess(user, permissions)) return '';
  return localStorage.getItem('admin_token') || '';
};

export const useAuthStore = create<AuthState>((set, get) => ({
  token: '',
  user: null,
  permissions: [],
  security: null,
  bootstrapStatus: 'ready',
  setSession: ({ token, user, permissions, security }) => {
    const current = get();
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
    const nextPermissions = permissions ?? current.permissions;
    if (permissions !== undefined) {
      localStorage.setItem(STORAGE_KEYS.permissions, JSON.stringify(nextPermissions));
    }
    if (security) {
      localStorage.setItem(STORAGE_KEYS.security, JSON.stringify(security));
    } else {
      localStorage.removeItem(STORAGE_KEYS.security);
    }
    set({
      token: token || '',
      user: user || null,
      permissions: nextPermissions,
      security: security || null,
      bootstrapStatus: 'ready',
    });
  },
  setBootstrapStatus: (status) => set({ bootstrapStatus: status }),
  hasPermission: (permission) => {
    const state = get();
    return hasOpsPermission(state.user, state.permissions, permission);
  },
  logout: () => {
    localStorage.removeItem(STORAGE_KEYS.token);
    localStorage.removeItem(STORAGE_KEYS.user);
    localStorage.removeItem(STORAGE_KEYS.permissions);
    localStorage.removeItem(STORAGE_KEYS.security);
    set({ token: '', user: null, permissions: [], security: null, bootstrapStatus: 'ready' });
  },
  clearOpsSession: () => {
    localStorage.removeItem(STORAGE_KEYS.token);
    localStorage.removeItem(STORAGE_KEYS.user);
    localStorage.removeItem(STORAGE_KEYS.permissions);
    localStorage.removeItem(STORAGE_KEYS.security);
    set({ token: '', user: null, permissions: [], security: null, bootstrapStatus: 'ready' });
  },
}));

const fallbackUser = readFallbackAdminUser();
const bootUser = readOpsUser() || fallbackUser;
const bootPermissions = readOpsPermissions();
const bootSecurity = readOpsSecurity();
const bootHasAccess = hasOpsAccess(bootUser, bootPermissions);
const bootToken = readOpsToken(bootUser, bootPermissions);

if (!bootUser || !bootHasAccess) {
  localStorage.removeItem(STORAGE_KEYS.token);
  localStorage.removeItem(STORAGE_KEYS.user);
  localStorage.removeItem(STORAGE_KEYS.permissions);
  localStorage.removeItem(STORAGE_KEYS.security);
}

useAuthStore.setState({
  token: bootHasAccess ? bootToken : '',
  user: bootHasAccess ? bootUser : null,
  permissions: bootHasAccess ? bootPermissions : [],
  security: bootSecurity,
  bootstrapStatus: bootHasAccess && bootToken ? 'idle' : 'ready',
});
