import Taro from '@tarojs/taro';

export const showMiniUnsupportedPaymentNotice = async (content: string) => {
  await Taro.showModal({
    title: '暂不支持',
    content,
    showCancel: false,
  });
};
