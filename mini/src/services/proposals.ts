import { request } from '@/utils/request';

import type { OrderDTO, ProposalDTO } from './dto';
import type { PageData } from './types';

export type ProposalItem = ProposalDTO;

export interface ConfirmProposalResponse {
  order?: OrderDTO;
  message?: string;
}

export async function listProposals(page = 1, pageSize = 20) {
  return request<PageData<ProposalItem>>({
    url: '/proposals',
    data: { page, pageSize }
  });
}

export async function getProposalDetail(id: number) {
  return request<ProposalItem>({
    url: `/proposals/${id}`
  });
}

export async function confirmProposal(id: number) {
  return request<ConfirmProposalResponse>({
    url: `/proposals/${id}/confirm`,
    method: 'POST',
    showLoading: true
  });
}

export async function rejectProposal(id: number, reason: string) {
  return request<{ message: string }>({
    url: `/proposals/${id}/reject`,
    method: 'POST',
    data: { reason },
    showLoading: true
  });
}

export async function getProposalHistory(bookingId: number) {
  return request<ProposalItem[]>({
    url: `/proposals/booking/${bookingId}/history`
  });
}

export async function getProposalPendingCount() {
  return request<{ count: number }>({
    url: '/proposals/pending-count'
  });
}
