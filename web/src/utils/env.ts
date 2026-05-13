export type AppEnv = 'local' | 'test' | 'staging' | 'production';

const normalizeAppEnv = (raw: unknown): AppEnv => {
  const value = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  switch (value) {
    case '':
    case 'local':
    case 'dev':
    case 'development':
    case 'docker':
      return 'local';
    case 'test':
    case 'testing':
      return 'test';
    case 'stage':
    case 'staging':
    case 'pre':
    case 'preprod':
    case 'pre-production':
      return 'staging';
    case 'prod':
    case 'production':
    case 'release':
      return 'production';
    default:
      return 'local';
  }
};

export const getAppEnv = (): AppEnv => normalizeAppEnv(import.meta.env.VITE_APP_ENV);

export const getRouterBasename = (): string => {
  const raw = (import.meta.env.VITE_ROUTER_BASENAME || '/').trim();
  if (!raw || raw === '/') {
    return '/';
  }
  return `/${raw.replace(/^\/+|\/+$/g, '')}`;
};

export const isUserWebFrontendEnabled = (): boolean => {
  const value = String(import.meta.env.VITE_USER_WEB_ENABLED || '').trim().toLowerCase();
  if (!value) {
    return getAppEnv() === 'local';
  }
  return ['1', 'true', 'yes', 'on'].includes(value);
};
