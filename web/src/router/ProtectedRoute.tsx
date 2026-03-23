import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { hasRecoverableSession, useSessionStore } from '../modules/session/sessionStore';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation();
  const hasHydrated = useSessionStore((state) => state.hasHydrated);
  const hasSession = useSessionStore((state) =>
    hasRecoverableSession({
      accessToken: state.accessToken,
      refreshToken: state.refreshToken,
      expiresAt: state.expiresAt,
    }),
  );

  if (!hasHydrated) {
    return null;
  }

  if (!hasSession) {
    const redirect = `${location.pathname}${location.search}`;
    return <Navigate replace to={`/login?redirect=${encodeURIComponent(redirect)}`} />;
  }

  return <>{children}</>;
}
