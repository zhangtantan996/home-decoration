import Taro from '@tarojs/taro';

import type { NavigationAdapter } from './types';

const toPromise = (cb: (options: { success: () => void; fail: (error: unknown) => void }) => void) =>
  new Promise<void>((resolve, reject) => {
    cb({
      success: resolve,
      fail: reject,
    });
  });

const navigationAdapter: NavigationAdapter = {
  navigateTo: (url) =>
    toPromise(({ success, fail }) => {
      Taro.navigateTo({ url, success, fail });
    }),
  redirectTo: (url) =>
    toPromise(({ success, fail }) => {
      Taro.redirectTo({ url, success, fail });
    }),
  switchTab: (url) =>
    toPromise(({ success, fail }) => {
      Taro.switchTab({ url, success, fail });
    }),
  navigateBack: (delta = 1) =>
    toPromise(({ success, fail }) => {
      Taro.navigateBack({ delta, success, fail });
    }),
  previewImage: (urls, current) =>
    toPromise(({ success, fail }) => {
      Taro.previewImage({ urls, current, success, fail });
    }),
};

export const miniNavigationAdapter = navigationAdapter;
