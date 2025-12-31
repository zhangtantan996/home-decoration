import React from 'react';
import { usePermission } from '../hooks/usePermission';

interface PermissionWrapperProps {
  /**
   * 需要的权限，可以是单个权限或权限数组
   * - 单个权限: 'provider:designer:create'
   * - 权限数组: ['provider:designer:create', 'provider:designer:edit'] (满足任一即可)
   */
  permission: string | string[];

  /**
   * 子组件
   */
  children: React.ReactNode;

  /**
   * 无权限时显示的内容 (可选)
   */
  fallback?: React.ReactNode;

  /**
   * 是否需要所有权限 (仅在permission为数组时有效)
   * - true: 需要拥有所有权限
   * - false: 拥有任一权限即可 (默认)
   */
  requireAll?: boolean;
}

/**
 * 权限包装组件
 * 根据权限控制子组件的显示/隐藏
 *
 * @example
 * // 单个权限
 * <PermissionWrapper permission="provider:designer:create">
 *   <Button>新增设计师</Button>
 * </PermissionWrapper>
 *
 * @example
 * // 多个权限 (满足任一)
 * <PermissionWrapper permission={['provider:designer:create', 'provider:designer:edit']}>
 *   <Button>编辑</Button>
 * </PermissionWrapper>
 *
 * @example
 * // 需要所有权限
 * <PermissionWrapper
 *   permission={['provider:designer:create', 'system:admin:edit']}
 *   requireAll={true}
 * >
 *   <Button>高级操作</Button>
 * </PermissionWrapper>
 *
 * @example
 * // 无权限时显示fallback
 * <PermissionWrapper
 *   permission="provider:designer:delete"
 *   fallback={<Tooltip title="无权限"><Button disabled>删除</Button></Tooltip>}
 * >
 *   <Button danger>删除</Button>
 * </PermissionWrapper>
 */
export const PermissionWrapper: React.FC<PermissionWrapperProps> = ({
  permission,
  children,
  fallback = null,
  requireAll = false,
}) => {
  const { hasPermission, hasAllPermissions } = usePermission();

  // 检查权限
  let hasRequiredPermission = false;

  if (Array.isArray(permission)) {
    // 权限数组
    hasRequiredPermission = requireAll
      ? hasAllPermissions(permission)
      : hasPermission(permission);
  } else {
    // 单个权限
    hasRequiredPermission = hasPermission(permission);
  }

  // 无权限时返回fallback
  if (!hasRequiredPermission) {
    return <>{fallback}</>;
  }

  // 有权限时返回子组件
  return <>{children}</>;
};
