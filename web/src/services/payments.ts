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

export async function getPaymentStatus(paymentId: number) {
  return requestJson<PaymentStatusPayload>(`/payments/${paymentId}/status`);
}
