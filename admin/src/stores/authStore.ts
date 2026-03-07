import { create } from 'zustand';

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

// 菜单项类型
interface MenuItem {
    id: number;
    parentId: number;
    title: string;
    type: number; // 1目录 2菜单 3按钮
    permission: string;
    path: string;
    component: string;
    icon: string;
    sort: number;
    children?: MenuItem[];
}

// 管理员信息
interface AdminUser {
    id: number;
    username: string;
    nickname: string;
    avatar?: string;
    isSuperAdmin: boolean;
    roles: string[];
    activeRole?: string; // 当前激活的身份类型
}

interface AuthState {
    token: string | null;
    admin: AdminUser | null;
    permissions: string[];
    menus: MenuItem[];
    isAuthenticated: boolean;

    // Actions
    login: (token: string, admin: AdminUser) => void;
    setPermissions: (permissions: string[], menus: MenuItem[]) => void;
    logout: () => void;
    checkAuth: () => boolean;
    hasPermission: (permission: string) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
    token: readStorage('admin_token'),
    admin: safeJsonParse<AdminUser | null>('admin_user', null),
    permissions: safeJsonParse<string[]>('admin_permissions', []),
    menus: safeJsonParse<MenuItem[]>('admin_menus', []),
    isAuthenticated: !!readStorage('admin_token'),

    login: (token, admin) => {
        localStorage.setItem('admin_token', token);
        localStorage.setItem('admin_user', JSON.stringify(admin));
        set({ token, admin, isAuthenticated: true });
    },

    setPermissions: (permissions, menus) => {
        localStorage.setItem('admin_permissions', JSON.stringify(permissions));
        localStorage.setItem('admin_menus', JSON.stringify(menus));
        set({ permissions, menus });
    },

    logout: () => {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        localStorage.removeItem('admin_permissions');
        localStorage.removeItem('admin_menus');
        set({ token: null, admin: null, permissions: [], menus: [], isAuthenticated: false });
    },

    checkAuth: () => {
        const token = localStorage.getItem('admin_token');
        if (!token) {
            set({ isAuthenticated: false });
            return false;
        }
        return true;
    },

    hasPermission: (permission) => {
        const { admin, permissions } = get();
        if (!admin) return false;
        // 超级管理员拥有所有权限
        if (admin.isSuperAdmin || permissions.includes('*:*:*')) return true;
        return permissions.includes(permission);
    },
}));

// 导出类型
export type { MenuItem, AdminUser };
