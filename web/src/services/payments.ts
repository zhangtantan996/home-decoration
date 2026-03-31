import { requestJson } from './http';

export interface PaymentLaunchPayload {
  paymentId: number;
  channel: string;
  launchMode: 'redirect';
  launchUrl: string;
  expiresAt?: string;
}

export interface PaymentStatusPayload {
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

export interface PaymentDetailProviderPayload {
  id: number;
  name: string;
  roleText: string;
  avatar: string;
  verified: boolean;
}

export interface PaymentDetailBookingPayload {
  id: number;
  address: string;
}

export interface PaymentDetailPayload {
  paymentId: number;
  status: 'created' | 'launching' | 'pending' | 'paid' | 'closed' | 'failed' | string;
  statusText: string;
  channel: string;
  channelText: string;
  amount: number;
  subject: string;
  purposeText: string;
  bizType: string;
  bizTypeText: string;
  fundScene: string;
  fundSceneText: string;
  terminalType: string;
  terminalTypeText: string;
  outTradeNo: string;
  providerTradeNo?: string;
  createdAt: string;
  paidAt?: string;
  expiresAt?: string;
  usageDescription: string;
  actionPath?: string;
  provider?: PaymentDetailProviderPayload;
  booking?: PaymentDetailBookingPayload;
}

export async function getPaymentStatus(paymentId: number) {
  return requestJson<PaymentStatusPayload>(`/payments/${paymentId}/status`);
}

export async function getPaymentDetail(paymentId: number) {
  return requestJson<PaymentDetailPayload>(`/payments/${paymentId}`);
}
