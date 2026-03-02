import { request } from '@/utils/request';
import type { PageData } from './types';
import type { OrderDTO, PendingPaymentDTO } from './dto';

export type OrderStatus = 0 | 1 | 2 | 3;

export type OrderItem = OrderDTO & { status: OrderStatus };

export type PendingPaymentItem = PendingPaymentDTO;

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

// 注意：后端暂无 GET /orders 端点，使用 /orders/pending-payments 代替
// 如需完整订单列表，需后端新增 GET /orders 端点
export async function listOrders(page = 1, pageSize = 20) {
  return request<PageData<OrderItem>>({
    url: '/orders/pending-payments',
    data: { page, pageSize }
  });
}

// 分期付款相关接口
export interface InstallmentPlan {
  id: number;
  orderId: number;
  seq: number;
  amount: number;
  dueDate: string;
  status: 'pending' | 'paid' | 'overdue';
  paidAt?: string;
}

export async function getInstallmentPlans(orderId: number) {
  return request<{ plans: InstallmentPlan[] }>({
    url: `/orders/${orderId}/plans`
  });
}

export async function payInstallment(planId: number) {
  return request<{ message: string }>({
    url: `/orders/plans/${planId}/pay`,
    method: 'POST',
    showLoading: true
  });
}
