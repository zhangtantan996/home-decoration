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

interface PaymentWebviewRouteOptions {
  paymentId: number;
  launchUrl: string;
  returnUrl?: string;
  sourceType?: SurveyDepositPaymentSourceType;
  bookingId?: number;
  amount?: number;
  entryKey?: string;
  amountLabel?: string;
}

export const buildPaymentWebviewUrl = (
  options: PaymentWebviewRouteOptions,
) => {
  const query = [
    `paymentId=${options.paymentId}`,
    `launchUrl=${encodeURIComponent(options.launchUrl)}`,
  ];

  if (options.returnUrl) {
    query.push(`returnUrl=${encodeURIComponent(options.returnUrl)}`);
  }
  if (options.sourceType) {
    query.push(`sourceType=${options.sourceType}`);
  }
  if (options.bookingId) {
    query.push(`bookingId=${options.bookingId}`);
  }

  if (typeof options.amount === 'number' && Number.isFinite(options.amount)) {
    query.push(`amount=${options.amount}`);
  }
  if (options.entryKey) {
    query.push(`entryKey=${encodeURIComponent(options.entryKey)}`);
  }
  if (options.amountLabel) {
    query.push(`amountLabel=${encodeURIComponent(options.amountLabel)}`);
  }

  return `/pages/payments/webview/index?${query.join('&')}`;
};

export const buildSurveyDepositPaymentWebviewUrl = buildPaymentWebviewUrl;

export const formatSurveyDepositOrderNo = (bookingId: number, orderNo?: string) => {
  if (orderNo) {
    return orderNo;
  }
  return `BK${String(bookingId).padStart(8, '0')}`;
};

interface OrderCenterDetailRouteOptions {
  autoPayChannel?: PaymentChannel;
  autoPayLaunchMode?: PaymentLaunchMode;
}

export const buildOrderCenterDetailUrl = (
  entryKey: string,
  legacyId?: number,
  options?: OrderCenterDetailRouteOptions,
) => {
  const query = [`entryKey=${encodeURIComponent(entryKey)}`];
  if (legacyId) {
    query.push(`id=${legacyId}`);
  }
  if (options?.autoPayChannel) {
    query.push(`autoPayChannel=${options.autoPayChannel}`);
  }
  if (options?.autoPayLaunchMode) {
    query.push(`autoPayLaunchMode=${options.autoPayLaunchMode}`);
  }
  return `/pages/orders/detail/index?${query.join('&')}`;
};
