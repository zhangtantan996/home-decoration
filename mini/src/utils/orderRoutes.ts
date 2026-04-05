import type { PaymentChannel, PaymentLaunchMode } from '@/services/payments';

interface SurveyDepositRouteOptions {
  autoPayChannel?: PaymentChannel;
  autoPayLaunchMode?: PaymentLaunchMode;
  orderNo?: string;
  entryKey?: string;
}

export const buildSurveyDepositDetailUrl = (bookingId: number, options?: SurveyDepositRouteOptions) => {
  const query = [`id=${bookingId}`];

  if (options?.entryKey) {
    query.push(`entryKey=${encodeURIComponent(options.entryKey)}`);
  }
  if (options?.autoPayChannel) {
    query.push(`autoPayChannel=${options.autoPayChannel}`);
  }
  if (options?.autoPayLaunchMode) {
    query.push(`autoPayLaunchMode=${options.autoPayLaunchMode}`);
  }
  if (options?.orderNo) {
    query.push(`orderNo=${encodeURIComponent(options.orderNo)}`);
  }

  return `/pages/orders/survey-deposit/index?${query.join('&')}`;
};

type SurveyDepositPaymentSourceType = 'booking_detail' | 'survey_deposit_order';

interface SurveyDepositPaymentWebviewRouteOptions {
  paymentId: number;
  launchUrl: string;
  sourceType: SurveyDepositPaymentSourceType;
  bookingId: number;
  amount?: number;
  entryKey?: string;
}

export const buildSurveyDepositPaymentWebviewUrl = (
  options: SurveyDepositPaymentWebviewRouteOptions,
) => {
  const query = [
    `paymentId=${options.paymentId}`,
    `launchUrl=${encodeURIComponent(options.launchUrl)}`,
    `sourceType=${options.sourceType}`,
    `bookingId=${options.bookingId}`,
  ];

  if (typeof options.amount === 'number' && Number.isFinite(options.amount)) {
    query.push(`amount=${options.amount}`);
  }
  if (options.entryKey) {
    query.push(`entryKey=${encodeURIComponent(options.entryKey)}`);
  }

  return `/pages/payments/webview/index?${query.join('&')}`;
};

export const formatSurveyDepositOrderNo = (bookingId: number, orderNo?: string) => {
  if (orderNo) {
    return orderNo;
  }
  return `BK${String(bookingId).padStart(8, '0')}`;
};

export const buildOrderCenterDetailUrl = (entryKey: string, legacyId?: number) => {
  const query = [`entryKey=${encodeURIComponent(entryKey)}`];
  if (legacyId) {
    query.push(`id=${legacyId}`);
  }
  return `/pages/orders/detail/index?${query.join('&')}`;
};
