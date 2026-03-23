import Taro from '@tarojs/taro';

import { storage } from '@/utils/storage';

const AUTH_RETURN_URL_KEY = 'hd-mini-auth-return-url';
const DEFAULT_AFTER_LOGIN_URL = '/pages/profile/index';
const TAB_PAGE_PATHS = new Set([
  '/pages/home/index',
  '/pages/inspiration/index',
  '/pages/progress/index',
  '/pages/profile/index',
]);

const normalizePath = (value?: string) => {
  const next = String(value || '').trim();
  if (!next) return '';

  if (next.startsWith('/pages/')) {
    return next;
  }

  if (next.startsWith('pages/')) {
    return `/${next}`;
  }

  return '';
};

const stripQuery = (value: string) => value.split('?')[0] || value;

export const setPendingAuthReturnUrl = (value?: string) => {
  const target = normalizePath(value);
  if (!target) {
    storage.remove(AUTH_RETURN_URL_KEY);
    return;
  }

  storage.set(AUTH_RETURN_URL_KEY, target);
};

export const getPendingAuthReturnUrl = () => {
  return normalizePath(storage.get<string>(AUTH_RETURN_URL_KEY) || '');
};

export const clearPendingAuthReturnUrl = () => {
  storage.remove(AUTH_RETURN_URL_KEY);
};

export const resolveAuthReturnUrl = (value?: string) => {
  return normalizePath(value) || getPendingAuthReturnUrl() || DEFAULT_AFTER_LOGIN_URL;
};

export const navigateAfterAuthSuccess = async (value?: string) => {
  const target = resolveAuthReturnUrl(value);
  clearPendingAuthReturnUrl();

  if (TAB_PAGE_PATHS.has(stripQuery(target))) {
    await Taro.switchTab({ url: stripQuery(target) });
    return;
  }

  await Taro.redirectTo({ url: target });
};
