import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { hasOpsAccess, useAuthStore } from '../stores/authStore';

const ProtectedRoute = () => {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const location = useLocation();
  if (token && !hasOpsAccess(user)) {
    const redirect = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }
  if (!token) {
    const redirect = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }
  return <Outlet />;
};

export default ProtectedRoute;
