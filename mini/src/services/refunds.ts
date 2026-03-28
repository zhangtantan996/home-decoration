import { request } from '@/utils/request';

import type { RefundApplicationDTO, RefundSummaryDTO } from './dto';

export type RefundApplicationItem = RefundApplicationDTO;
export type RefundSummary = RefundSummaryDTO;

export interface CreateRefundApplicationPayload {
  refundType: 'intent_fee' | 'design_fee' | 'construction_fee' | 'full';
  reason: string;
  evidence?: string[];
}

export interface RefundListQuery {
  bookingId?: number;
  status?: 'pending' | 'approved' | 'rejected' | 'completed' | '';
  page?: number;
  pageSize?: number;
}

export async function createRefundApplication(bookingId: number, payload: CreateRefundApplicationPayload) {
  return request<{ refundApplication: RefundApplicationItem }>({
    url: `/bookings/${bookingId}/refund`,
    method: 'POST',
    data: payload,
    showLoading: true,
  });
}

export async function listMyRefundApplications(query: RefundListQuery = {}) {
  return request<{
    list: RefundApplicationItem[];
    count: number;
    total: number;
    page: number;
    pageSize: number;
  }>({
    url: '/refunds/my',
    data: {
      bookingId: query.bookingId,
      status: query.status,
      page: query.page || 1,
      pageSize: query.pageSize || 20,
    },
  });
}
