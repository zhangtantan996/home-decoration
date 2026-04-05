import Taro from '@tarojs/taro';

const PAYMENT_REFRESH_NOTICE_KEY = 'mini.payment.refresh.notice';
const PAYMENT_REFRESH_NOTICE_TTL_MS = 5 * 60 * 1000;

export interface PaymentRefreshNotice {
  paymentId: number;
  status: 'paid' | 'closed' | 'failed' | 'expired';
  at: number;
}

export const publishPaymentRefreshNotice = (notice: PaymentRefreshNotice) => {
  Taro.setStorageSync(PAYMENT_REFRESH_NOTICE_KEY, notice);
};

export const consumePaymentRefreshNotice = () => {
  const payload = Taro.getStorageSync(PAYMENT_REFRESH_NOTICE_KEY) as PaymentRefreshNotice | undefined;

  if (!payload || !payload.at || Date.now() - payload.at > PAYMENT_REFRESH_NOTICE_TTL_MS) {
    Taro.removeStorageSync(PAYMENT_REFRESH_NOTICE_KEY);
    return null;
  }

  Taro.removeStorageSync(PAYMENT_REFRESH_NOTICE_KEY);
  return payload;
};
