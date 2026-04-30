import Taro from '@tarojs/taro';

import { MiniApiError } from '@/utils/request';

export const REAL_NAME_REQUIRED_CODE = 'REAL_NAME_REQUIRED';

export const isRealNameRequiredError = (error: unknown) => (
  error instanceof MiniApiError
  && (
    error.errorCode === REAL_NAME_REQUIRED_CODE
    || (
      error.data
      && typeof error.data === 'object'
      && 'errorCode' in (error.data as Record<string, unknown>)
      && String((error.data as Record<string, unknown>).errorCode || '') === REAL_NAME_REQUIRED_CODE
    )
  )
);

export const getCurrentPageReturnUrl = () => {
  const pages = Taro.getCurrentPages();
  const current = pages[pages.length - 1] as {
    route?: string;
    options?: Record<string, string | number | undefined>;
  } | undefined;
  const route = current?.route ? `/${current.route}` : '/pages/profile/index';
  const options = current?.options || {};
  const query = Object.entries(options)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
  return query ? `${route}?${query}` : route;
};

export const buildRealNameVerificationUrl = (returnUrl = getCurrentPageReturnUrl()) => (
  `/pages/settings/account-security/verification/index?returnUrl=${encodeURIComponent(returnUrl)}`
);

export const navigateToRealNameVerification = (returnUrl?: string) => {
  void Taro.navigateTo({ url: buildRealNameVerificationUrl(returnUrl || getCurrentPageReturnUrl()) });
};
