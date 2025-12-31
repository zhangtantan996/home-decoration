import { useAuthStore } from '../stores/authStore';

/**
 * 权限Hook - 用于检查当前管理员是否有指定权限
 */
export const usePermission = () => {
  const { admin, permissions } = useAuthStore();

  /**
   * 检查是否拥有指定权限
   * @param permission 权限标识，可以是单个字符串或字符串数组
   * @returns 是否拥有权限
   */
  const hasPermission = (permission: string | string[]): boolean => {
    if (!admin) return false;

    // 超级管理员拥有所有权限
    if (admin.isSuperAdmin || permissions.includes('*:*:*')) {
      return true;
    }

    // 检查单个权限
    if (typeof permission === 'string') {
      return permissions.includes(permission);
    }

    // 检查多个权限 (满足任一即可)
    return permission.some(p => permissions.includes(p));
  };

  /**
   * 检查是否拥有所有指定权限
   * @param permissionList 权限列表
   * @returns 是否拥有所有权限
   */
  const hasAllPermissions = (permissionList: string[]): boolean => {
    if (!admin) return false;

    // 超级管理员拥有所有权限
    if (admin.isSuperAdmin || permissions.includes('*:*:*')) {
      return true;
    }

    // 检查是否拥有所有权限
    return permissionList.every(p => permissions.includes(p));
  };

  /**
   * 检查是否拥有任意一个指定权限
   * @param permissionList 权限列表
   * @returns 是否拥有任意权限
   */
  const hasAnyPermission = (permissionList: string[]): boolean => {
    if (!admin) return false;

    // 超级管理员拥有所有权限
    if (admin.isSuperAdmin || permissions.includes('*:*:*')) {
      return true;
    }

    // 检查是否拥有任意一个权限
    return permissionList.some(p => permissions.includes(p));
  };

  return {
    hasPermission,
    hasAllPermissions,
    hasAnyPermission,
  };
};
