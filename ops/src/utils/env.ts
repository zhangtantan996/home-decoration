export type AppEnv = 'local' | 'test' | 'staging' | 'production';

const normalizeAppEnv = (raw: unknown): AppEnv => {
  const value = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (['prod', 'production', 'release'].includes(value)) return 'production';
  if (['stage', 'staging', 'pre', 'preprod', 'pre-production'].includes(value)) return 'staging';
  if (['test', 'testing'].includes(value)) return 'test';
  return 'local';
};

const normalizeRouterBasename = (raw: unknown): string => {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value || value === '/') return '/';
  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`;
  return withLeadingSlash.replace(/\/+$/, '') || '/';
};

export const getAppEnv = (): AppEnv => normalizeAppEnv(import.meta.env.VITE_APP_ENV);

export const getRouterBasename = (): string => {
  const configured = normalizeRouterBasename(import.meta.env.VITE_ROUTER_BASENAME);
  if (configured !== '/') return configured;
  return getAppEnv() === 'production' ? '/ops' : '/';
};

export const getApiBaseUrl = (): string => {
  const configured = typeof import.meta.env.VITE_API_URL === 'string'
    ? import.meta.env.VITE_API_URL.trim()
    : '';
  if (configured) return configured.replace(/\/+$/, '');
  return '/api/v1';
};
