import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { hasRecoverableSession, useSessionStore } from '../modules/session/sessionStore';

interface PublicOnlyRouteProps {
  children: ReactNode;
}

function normalizeRedirectPath(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/login')) {
    return '/';
  }
  return value;
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
    return <Navigate replace to={normalizeRedirectPath(redirect)} />;
  }

  return <>{children}</>;
}
