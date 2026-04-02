import Taro from '@tarojs/taro';
import { MiniApiError } from './request';

export const getErrorMessage = (error: unknown, fallback = '操作失败') => {
  if (error instanceof MiniApiError) {
    if (error.status === 403) {
      return '无权限访问当前功能';
    }
    if (error.status === 409) {
      return '状态已变化，请刷新后重试';
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
};

export const showErrorToast = (error: unknown, fallback = '操作失败') => {
  Taro.showToast({
    title: getErrorMessage(error, fallback),
    icon: 'none',
  });
};
