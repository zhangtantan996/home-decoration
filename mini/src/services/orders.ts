import { request } from '@/utils/request';
import type { PageData } from './types';

export type OrderStatus = 0 | 1 | 2 | 3;

export interface OrderItem {
  id: number;
  orderNo: string;
  orderType: string;
  totalAmount: number;
  paidAmount: number;
  discount: number;
  status: OrderStatus;
  projectId?: number;
  proposalId?: number;
  bookingId?: number;
  expireAt?: string;
  paidAt?: string;
  createdAt?: string;
}

export interface PendingPaymentItem {
  type: 'intent_fee' | 'design_fee';
  id: number;
  orderNo: string;
  amount: number;
  providerId: number;
  providerName: string;
  address?: string;
  expireAt?: string;
  createdAt?: string;
}

export async function listPendingPayments() {
  return request<{ items: PendingPaymentItem[]; total: number }>({
    url: '/orders/pending-payments'
  });
}

export async function getOrderDetail(id: number) {
  return request<OrderItem>({
    url: `/orders/${id}`
  });
}

export async function payOrder(id: number) {
  return request<{ message: string }>({
    url: `/orders/${id}/pay`,
    method: 'POST',
    showLoading: true
  });
}

export async function cancelOrder(id: number) {
  return request<{ message: string }>({
    url: `/orders/${id}`,
    method: 'DELETE',
    showLoading: true
  });
}

export async function listOrders(page = 1, pageSize = 20) {
  return request<PageData<OrderItem>>({
    url: '/orders',
    data: { page, pageSize }
  });
}
