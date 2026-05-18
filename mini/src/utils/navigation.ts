import Taro from '@tarojs/taro';

const TAB_BAR_PAGE_PATHS = new Set([
  '/pages/home/index',
  '/pages/inspiration/index',
  '/pages/progress/index',
  '/pages/messages/index',
  '/pages/profile/index',
]);

const stripQuery = (value: string) => value.split('?')[0] || value;

export const navigateBackWithFallback = (fallbackUrl = '/pages/profile/index') => {
  if (Taro.getCurrentPages().length > 1) {
    void Taro.navigateBack();
    return;
  }

  const pathOnly = stripQuery(fallbackUrl);
  if (TAB_BAR_PAGE_PATHS.has(pathOnly)) {
    void Taro.switchTab({ url: pathOnly });
    return;
  }

  void Taro.redirectTo({ url: fallbackUrl });
};
