import { Spin } from 'antd';
import { useEffect, useRef } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { getOpsInfo } from '../services/api';
import { hasOpsAccess, useAuthStore } from '../stores/authStore';

const ProtectedRoute = () => {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const permissions = useAuthStore((state) => state.permissions);
  const bootstrapStatus = useAuthStore((state) => state.bootstrapStatus);
  const security = useAuthStore((state) => state.security);
  const setSession = useAuthStore((state) => state.setSession);
  const setBootstrapStatus = useAuthStore((state) => state.setBootstrapStatus);
  const clearOpsSession = useAuthStore((state) => state.clearOpsSession);
  const location = useLocation();
  const bootstrapStatusRef = useRef(bootstrapStatus);
  const isSetupRoute = location.pathname.startsWith('/security/setup');

  useEffect(() => {
    bootstrapStatusRef.current = bootstrapStatus;
  }, [bootstrapStatus]);

  useEffect(() => {
    if (!token || !user || bootstrapStatusRef.current !== 'idle') {
      return;
    }

    let cancelled = false;

    const bootstrap = async () => {
      setBootstrapStatus('loading');
      try {
        const data = await getOpsInfo();
        if (cancelled) {
          return;
        }
        const nextUser = data.admin || data.user || null;
        const nextPermissions = Array.isArray(data.permissions) ? data.permissions : [];
        if (!nextUser || !hasOpsAccess(nextUser, nextPermissions)) {
          clearOpsSession();
          return;
        }
        setSession({
          token: data.accessToken || data.token || token,
          user: nextUser,
          permissions: nextPermissions,
          security: data.security ?? null,
        });
      } catch {
        if (!cancelled) {
          clearOpsSession();
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
  }, [clearOpsSession, setBootstrapStatus, setSession, token, user]);

  if (token && !hasOpsAccess(user, permissions)) {
    const redirect = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }
  if (!token) {
    const redirect = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }
  if (security?.loginStage === 'setup_required' && !isSetupRoute) {
    return <Navigate to="/security/setup" replace />;
  }
  if (bootstrapStatus === 'idle' || bootstrapStatus === 'loading') {
    return (
      <div className="ops-route-loading">
        <div className="ops-route-loading__inner">
          <Spin size="large" />
          <div className="ops-route-loading__text">正在校验 Ops 会话...</div>
        </div>
      </div>
    );
  }
  if (security?.loginStage === 'active' && isSetupRoute) {
    return <Navigate to="/supply" replace />;
  }
  return <Outlet />;
};

export default ProtectedRoute;
