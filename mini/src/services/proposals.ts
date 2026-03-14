import { request } from '@/utils/request';

import type { OrderDTO, ProposalDTO } from './dto';
import type { PageData } from './types';

export type ProposalItem = ProposalDTO;

export interface ConfirmProposalResponse {
  order?: OrderDTO;
  message?: string;
}

interface ProposalDetailEnvelope {
  proposal: ProposalItem;
  order?: OrderDTO;
  hasOrder?: boolean;
}

export async function listProposals(page = 1, pageSize = 20) {
  const list = await request<ProposalItem[]>({
    url: '/proposals',
  });
  const items = Array.isArray(list) ? list : [];
  return {
    list: items.slice((page - 1) * pageSize, page * pageSize),
    total: items.length,
    page,
    pageSize,
  } satisfies PageData<ProposalItem>;
}

export async function getProposalDetail(id: number) {
  const data = await request<ProposalDetailEnvelope>({
    url: `/proposals/${id}`
  });
  return data.proposal;
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
