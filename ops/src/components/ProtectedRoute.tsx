import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { hasOpsAccess, useAuthStore } from '../stores/authStore';

const ProtectedRoute = () => {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const security = useAuthStore((state) => state.security);
  const location = useLocation();
  const isSetupRoute = location.pathname.startsWith('/security/setup');
  if (token && !hasOpsAccess(user)) {
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
  if (security?.loginStage === 'active' && isSetupRoute) {
    return <Navigate to="/supply" replace />;
  }
  return <Outlet />;
};

export default ProtectedRoute;
