import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useSessionStore } from '../modules/session/sessionStore';

interface PublicOnlyRouteProps {
  children: ReactNode;
}

export function PublicOnlyRoute({ children }: PublicOnlyRouteProps) {
  const location = useLocation();
  const hasHydrated = useSessionStore((state) => state.hasHydrated);
  const accessToken = useSessionStore((state) => state.accessToken);

  if (!hasHydrated) {
    return null;
  }

  if (accessToken) {
    const redirect = new URLSearchParams(location.search).get('redirect');
    return <Navigate replace to={redirect && redirect.startsWith('/') ? redirect : '/'} />;
  }

  return <>{children}</>;
}
