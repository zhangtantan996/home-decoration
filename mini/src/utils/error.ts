import Taro from '@tarojs/taro';
import { MiniApiError } from './request';

const TECHNICAL_DETAIL_PATTERNS = [
  /\bERROR\b/i,
  /SQLSTATE/i,
  /relation\s+["'`]?\w+/i,
  /does not exist/i,
  /failed to create/i,
  /no such table/i,
  /database|schema|sql/i,
  /token|jwt/i,
  /websocket|轮询|自动刷新|fallback/i,
  /npm\s+run|docker|localhost|127\.0\.0\.1|接口地址|后端服务/i,
  /debug|mock|测试码|开发环境验证码/i,
];

const normalizeErrorMessage = (raw: string, fallback: string) => {
  const message = String(raw || '').trim();
  if (!message) {
    return fallback;
  }

  if (TECHNICAL_DETAIL_PATTERNS.some((pattern) => pattern.test(message))) {
    return fallback;
  }

  if (message.includes('无可用的平台证书')) {
    return '支付服务暂不可用，请稍后重试';
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

const getApiErrorCode = (error: MiniApiError) => {
  if (error.errorCode) {
    return error.errorCode;
  }
  if (error.data && typeof error.data === 'object' && 'errorCode' in (error.data as Record<string, unknown>)) {
    return String((error.data as Record<string, unknown>).errorCode || '');
  }
  return '';
};

export const getErrorMessage = (error: unknown, fallback = '操作失败') => {
  if (typeof error === 'string') {
    return normalizeErrorMessage(error, fallback);
  }
  if (error instanceof MiniApiError) {
    if (getApiErrorCode(error) === 'REAL_NAME_REQUIRED') {
      return '支付前请先完成实名认证';
    }
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

export const isUserCancelError = (error: unknown) => {
  const candidates: string[] = [];

  if (typeof error === 'string') {
    candidates.push(error);
  } else if (error instanceof Error) {
    candidates.push(error.message);
  } else if (error && typeof error === 'object') {
    const errLike = error as { errMsg?: unknown; message?: unknown };
    if (typeof errLike.errMsg === 'string') {
      candidates.push(errLike.errMsg);
    }
    if (typeof errLike.message === 'string') {
      candidates.push(errLike.message);
    }
  }

  return candidates.some((message) => /cancel|cancelled|用户取消|取消选择/i.test(message));
};

export const showErrorToast = (error: unknown, fallback = '操作失败') => {
  Taro.showToast({
    title: getErrorMessage(error, fallback),
    icon: 'none',
  });
};
