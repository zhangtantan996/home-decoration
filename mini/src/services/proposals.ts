import { request } from '@/utils/request';
import type { PageData } from './types';

export interface ProposalItem {
  id: number;
  bookingId: number;
  designerId: number;
  summary: string;
  designFee: number;
  constructionFee: number;
  materialFee: number;
  estimatedDays: number;
  attachments: string;
  status: number;
  version: number;
  parentProposalId?: number;
  rejectionCount: number;
  rejectionReason?: string;
  submittedAt?: string;
  userResponseDeadline?: string;
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
  return request<Record<string, unknown>>({
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
