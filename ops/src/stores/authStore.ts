import { create } from 'zustand';

export interface OpsUser {
  id?: number;
  username?: string;
  nickname?: string;
  isSuperAdmin?: boolean;
  roles?: string[];
}

interface AuthState {
  token: string;
  user: OpsUser | null;
  setSession: (token: string, user: OpsUser | null) => void;
  logout: () => void;
  clearOpsSession: () => void;
}

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
    const raw = localStorage.getItem('ops_user');
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

const readOpsToken = (user: OpsUser | null): string => {
  const opsToken = localStorage.getItem('ops_token') || '';
  if (opsToken) return opsToken;
  if (!hasOpsAccess(user)) return '';
  return localStorage.getItem('admin_token') || '';
};

export const useAuthStore = create<AuthState>((set) => ({
  token: '',
  user: null,
  setSession: (token, user) => {
    localStorage.setItem('ops_token', token);
    if (user) {
      localStorage.setItem('ops_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('ops_user');
    }
    set({ token, user });
  },
  logout: () => {
    localStorage.removeItem('ops_token');
    localStorage.removeItem('ops_user');
    set({ token: '', user: null });
  },
  clearOpsSession: () => {
    localStorage.removeItem('ops_token');
    localStorage.removeItem('ops_user');
    set({ token: '', user: null });
  },
}));

const fallbackUser = readFallbackAdminUser();
const bootUser = readOpsUser() || fallbackUser;

if (!bootUser) {
  localStorage.removeItem('ops_token');
  localStorage.removeItem('ops_user');
}

useAuthStore.setState({
  token: readOpsToken(bootUser),
  user: bootUser,
});
