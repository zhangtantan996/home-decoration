import { getRouterBasename } from './env';

export type AdminNotificationNavigationTarget =
  | { type: 'internal'; path: string }
  | { type: 'external'; href: string };

const ADMIN_BASENAME = '/admin';
const SAFE_EXTERNAL_PROTOCOLS = new Set(['http:', 'https:']);

const normalizePathname = (pathname: string) => {
  const path = pathname.trim();
  if (!path) return '/';
  return path.startsWith('/') ? path : `/${path}`;
};

const stripPrefix = (pathname: string, prefix: string) => {
  if (!prefix || prefix === '/') return pathname;
  if (pathname === prefix) return '/';
  return pathname.startsWith(`${prefix}/`) ? pathname.slice(prefix.length) || '/' : pathname;
};

const stripKnownAdminBasename = (pathname: string) => {
  const basename = getRouterBasename();
  let nextPath = normalizePathname(pathname);
  nextPath = stripPrefix(nextPath, basename);
  nextPath = stripPrefix(nextPath, ADMIN_BASENAME);
  return normalizePathname(nextPath);
};

const isApiPath = (pathname: string) => pathname === '/api' || pathname.startsWith('/api/');

const appendQuery = (pathname: string, search: string, extra: Record<string, string | number | undefined> = {}) => {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  Object.entries(extra).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  });
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
};

const normalizeLegacyAdminRoute = (pathname: string, search: string) => {
  let match = pathname.match(/^\/finance\/payments\/(\d+)$/);
  if (match) {
    return appendQuery('/finance/transactions', search, { paymentOrderId: match[1] });
  }

  match = pathname.match(/^\/finance\/reconciliation\/(\d+)(?:\/(?:differences|refund-differences|settlement-differences))?$/);
  if (match) {
    return appendQuery('/finance/reconciliations', search, { reconciliationId: match[1] });
  }

  match = pathname.match(/^\/reconciliation\/(\d+)\/differences$/);
  if (match) {
    return appendQuery('/finance/reconciliations', search, { reconciliationId: match[1] });
  }

  match = pathname.match(/^\/finance\/refunds\/(\d+)$/);
  if (match) {
    return appendQuery('/refunds', search, { refundOrderId: match[1] });
  }

  match = pathname.match(/^\/finance\/settlements\/(\d+)$/);
  if (match) {
    return appendQuery('/finance/settlements', search, { settlementOrderId: match[1] });
  }

  match = pathname.match(/^\/finance\/payouts\/(\d+)$/);
  if (match) {
    return appendQuery('/finance/payouts', search, { payoutId: match[1] });
  }

  return `${pathname}${search}`;
};

const getWindowOrigin = () => {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'http://localhost';
};

const resolveInternalTarget = (pathname: string, search = '', hash = ''): AdminNotificationNavigationTarget | null => {
  const strippedPathname = stripKnownAdminBasename(pathname);
  if (isApiPath(strippedPathname)) {
    return null;
  }
  const normalizedPath = normalizeLegacyAdminRoute(strippedPathname, search);
  return { type: 'internal', path: `${normalizedPath}${hash}` };
};

export const resolveAdminNotificationNavigation = (actionUrl?: string): AdminNotificationNavigationTarget | null => {
  const raw = String(actionUrl || '').trim();
  if (!raw || raw.startsWith('?') || raw.startsWith('#')) {
    return null;
  }

  try {
    const hasProtocol = /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(raw);
    const origin = getWindowOrigin();
    const parsed = new URL(hasProtocol || raw.startsWith('/') ? raw : `/${raw}`, origin);

    if (!SAFE_EXTERNAL_PROTOCOLS.has(parsed.protocol)) {
      return null;
    }

    if (parsed.origin === origin) {
      return resolveInternalTarget(parsed.pathname, parsed.search, parsed.hash);
    }

    return { type: 'external', href: parsed.href };
  } catch {
    return null;
  }
};
