import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { hasRecoverableSession, useSessionStore } from '../modules/session/sessionStore';

interface PublicOnlyRouteProps {
  children: ReactNode;
}

export function PublicOnlyRoute({ children }: PublicOnlyRouteProps) {
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

  if (hasSession) {
    const redirect = new URLSearchParams(location.search).get('redirect');
    return <Navigate replace to={redirect && redirect.startsWith('/') ? redirect : '/'} />;
  }

  return <>{children}</>;
}
