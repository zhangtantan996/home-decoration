import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useSessionStore } from '../modules/session/sessionStore';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation();
  const hasHydrated = useSessionStore((state) => state.hasHydrated);
  const accessToken = useSessionStore((state) => state.accessToken);

  if (!hasHydrated) {
    return null;
  }

  if (!accessToken) {
    const redirect = `${location.pathname}${location.search}`;
    return <Navigate replace to={`/login?redirect=${encodeURIComponent(redirect)}`} />;
  }

  return <>{children}</>;
}
