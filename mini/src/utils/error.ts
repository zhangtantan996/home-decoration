import Taro from '@tarojs/taro';
import { MiniApiError } from './request';

const normalizeErrorMessage = (raw: string, fallback: string) => {
  const message = String(raw || '').trim();
  if (!message) {
    return fallback;
  }

  if (message.includes('无可用的平台证书')) {
    return '微信支付配置异常：缺少平台证书/公钥';
  }

  const withoutHeaders = message
    .replace(/^init client setting err:error http response:\[?/i, '')
    .split('Header:')[0]
    .split('\n')[0]
    .replace(/\]$/, '')
    .trim();

  if (!withoutHeaders) {
    return fallback;
  }

  return withoutHeaders.length > 30
    ? `${withoutHeaders.slice(0, 30)}...`
    : withoutHeaders;
};

export const getErrorMessage = (error: unknown, fallback = '操作失败') => {
  if (error instanceof MiniApiError) {
    if (error.status === 403) {
      return '无权限访问当前功能';
    }
    if (error.status === 409) {
      return '状态已变化，请刷新后重试';
    }
    return normalizeErrorMessage(error.message, fallback);
  }
  if (error instanceof Error && error.message) {
    return normalizeErrorMessage(error.message, fallback);
  }
  return fallback;
};

export const showErrorToast = (error: unknown, fallback = '操作失败') => {
  Taro.showToast({
    title: getErrorMessage(error, fallback),
    icon: 'none',
  });
};
