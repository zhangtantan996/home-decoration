import { MINI_ENV } from '@/config/env';
import { request } from '@/utils/request';
import { buildAbsoluteUrl, parseAbsoluteUrl } from '@/utils/url';

export type PaymentChannel = 'alipay' | 'wechat';

export type PaymentLaunchMode = 'redirect' | 'qr_code' | 'wechat_jsapi';

export interface WechatMiniPayParams {
  timeStamp: string;
  nonceStr: string;
  package: string;
  signType: 'RSA' | 'HMAC-SHA256' | 'MD5';
  paySign: string;
}

export interface MiniPaymentLaunchResponse {
  paymentId: number;
  channel: PaymentChannel | string;
  launchMode: PaymentLaunchMode | string;
  launchUrl?: string;
  qrCodeImageUrl?: string;
  wechatPayParams?: WechatMiniPayParams;
  expiresAt?: string;
}

export interface PaymentStatusResponse {
  paymentId: number;
  status: 'created' | 'launching' | 'pending' | 'paid' | 'closed' | 'failed' | string;
  channel: string;
  amount: number;
  subject: string;
  paidAt?: string;
  expiresAt?: string;
  terminalType: string;
  returnContext?: Record<string, unknown>;
}

export async function getPaymentStatus(paymentId: number) {
  return request<PaymentStatusResponse>({
    url: `/payments/${paymentId}/status`,
  });
}

export const normalizePaymentLaunchUrl = (rawUrl?: string) => {
  const value = String(rawUrl || '').trim();
  if (!value) {
    return '';
  }

  const parsedValue = parseAbsoluteUrl(value);
  if (parsedValue) {
    return parsedValue.href;
  }

  if (!value.startsWith('/')) {
    return value;
  }

  const apiOrigin = MINI_ENV.API_BASE_URL.replace(/\/api\/v1\/?$/, '');
  return buildAbsoluteUrl(apiOrigin, value);
};
