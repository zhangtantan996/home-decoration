import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Button, Result, Spin } from 'antd';
import { adminAuthApi } from '../services/api';
import { useAuthStore, type AdminSecurityStatus, type AdminUser, type MenuItem } from '../stores/authStore';
import { usePermission } from '../hooks/usePermission';
import { pickAdminLandingPath } from '../utils/adminNavigation';

interface ProtectedRouteProps {
  children: React.ReactNode;
  permission?: string | string[];
  requireAll?: boolean;
}

interface AdminInfoPayload {
  accessToken?: string;
  refreshToken?: string;
  admin?: AdminUser;
  permissions?: string[];
  menus?: MenuItem[];
  security?: AdminSecurityStatus | null;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  permission,
  requireAll = false,
}) => {
  const location = useLocation();
  const {
    token,
    admin,
    menus,
    security,
    bootstrapStatus,
    setSession,
    setBootstrapStatus,
    logout,
  } = useAuthStore();
  const { hasPermission, hasAllPermissions } = usePermission();

  useEffect(() => {
    if (!token || !admin || bootstrapStatus !== 'idle') {
      return;
    }

    let cancelled = false;

    const bootstrap = async () => {
      setBootstrapStatus('loading');
      try {
        const res = (await adminAuthApi.getInfo()) as {
          code?: number;
          data?: AdminInfoPayload;
        };
        if (cancelled) {
          return;
        }
        if (res?.code !== 0 || !res?.data?.admin) {
          logout();
          return;
        }
        setSession({
          accessToken: res.data.accessToken,
          refreshToken: res.data.refreshToken,
          admin: res.data.admin,
          permissions: Array.isArray(res.data.permissions) ? res.data.permissions : [],
          menus: Array.isArray(res.data.menus) ? res.data.menus : [],
          security: res.data.security ?? null,
        });
      } catch {
        if (!cancelled) {
          logout();
        }
      } finally {
        if (!cancelled) {
          setBootstrapStatus('ready');
        }
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [admin, bootstrapStatus, logout, setBootstrapStatus, setSession, token]);

  if (!token || !admin) {
    return <Navigate to="/login" replace />;
  }

  if (bootstrapStatus === 'idle' || bootstrapStatus === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16, color: '#64748b' }}>正在校验管理员会话...</div>
        </div>
      </div>
    );
  }

  const isSetupRoute = location.pathname.startsWith('/security/setup');
  const loginStage = security?.loginStage;
  const landingPath = pickAdminLandingPath(menus);

  if (loginStage === 'setup_required' && !isSetupRoute) {
    return <Navigate to="/security/setup" replace />;
  }

  if (loginStage === 'active' && isSetupRoute) {
    return <Navigate to={landingPath} replace />;
  }

  if (!permission) {
    return <>{children}</>;
  }

  let hasRequiredPermission = false;
  if (Array.isArray(permission)) {
    hasRequiredPermission = requireAll
      ? hasAllPermissions(permission)
      : hasPermission(permission);
  } else {
    hasRequiredPermission = hasPermission(permission);
  }

  if (!hasRequiredPermission) {
    return (
      <Result
        status="403"
        title="403"
        subTitle="抱歉，您没有权限访问此页面"
        extra={(
          <Button type="primary" onClick={() => window.history.back()}>
            返回上一页
          </Button>
        )}
      />
    );
  }

  return <>{children}</>;
};

export { ProtectedRoute };
