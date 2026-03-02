import Taro from '@tarojs/taro';

export const getErrorMessage = (error: unknown, fallback = '操作失败') => {
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
