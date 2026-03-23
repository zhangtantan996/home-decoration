import Taro from '@tarojs/taro';

type RequestPaymentOptions = Parameters<typeof Taro.requestPayment>[0];

const requestPayment = (options: RequestPaymentOptions) =>
  new Promise<void>((resolve, reject) => {
    Taro.requestPayment({
      ...options,
      success: () => resolve(),
      fail: reject,
    });
  });

export const miniPaymentAdapter = {
  requestPayment,
};
