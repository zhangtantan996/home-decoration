import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { usePermission } from '../hooks/usePermission';
import { Result, Button } from 'antd';

interface ProtectedRouteProps {
  /**
   * 子组件
   */
  children: React.ReactNode;

  /**
   * 需要的权限 (可选)
   * 如果不提供，只检查登录状态
   */
  permission?: string | string[];

  /**
   * 是否需要所有权限 (仅在permission为数组时有效)
   */
  requireAll?: boolean;
}

/**
 * 受保护的路由组件
 * 用于路由级别的权限控制
 *
 * @example
 * // 只需要登录
 * <Route path="/dashboard" element={
 *   <ProtectedRoute>
 *     <DashboardPage />
 *   </ProtectedRoute>
 * } />
 *
 * @example
 * // 需要特定权限
 * <Route path="/providers/designers" element={
 *   <ProtectedRoute permission="provider:designer:list">
 *     <DesignerListPage />
 *   </ProtectedRoute>
 * } />
 *
 * @example
 * // 需要多个权限中的任意一个
 * <Route path="/providers" element={
 *   <ProtectedRoute permission={['provider:designer:list', 'provider:company:list']}>
 *     <ProviderPage />
 *   </ProtectedRoute>
 * } />
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  permission,
  requireAll = false,
}) => {
  const { token, admin } = useAuthStore();
  const { hasPermission, hasAllPermissions } = usePermission();

  // 未登录跳转到登录页
  if (!token || !admin) {
    return <Navigate to="/login" replace />;
  }

  // 如果没有指定权限要求，只要登录即可访问
  if (!permission) {
    return <>{children}</>;
  }

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

  // 需要权限但无权限时显示无权限页面
  if (!hasRequiredPermission) {
    return (
      <Result
        status="403"
        title="403"
        subTitle="抱歉，您没有权限访问此页面"
        extra={
          <Button type="primary" onClick={() => window.history.back()}>
            返回上一页
          </Button>
        }
      />
    );
  }

  // 有权限时正常渲染
  return <>{children}</>;
};
