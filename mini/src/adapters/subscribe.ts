import Taro from '@tarojs/taro';

type SubscribeOptions = Parameters<typeof Taro.requestSubscribeMessage>[0];

const requestSubscribeMessage = (options: SubscribeOptions) =>
  new Promise<Taro.requestSubscribeMessage.SuccessCallbackResult>((resolve, reject) => {
    Taro.requestSubscribeMessage({
      ...options,
      success: resolve,
      fail: reject,
    });
  });

export const miniSubscribeAdapter = {
  requestSubscribeMessage,
};
