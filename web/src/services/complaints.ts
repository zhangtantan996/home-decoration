import type { ComplaintListItemVM } from '../types/viewModels';
import { formatDateTime } from '../utils/format';
import { requestJson } from './http';

interface ComplaintDTO {
  id: number;
  projectId?: number;
  category?: string;
  title?: string;
  description?: string;
  status?: string;
  resolution?: string;
  merchantResponse?: string;
  freezePayment?: boolean;
  createdAt?: string;
}

function adaptComplaint(dto: ComplaintDTO): ComplaintListItemVM {
  return {
    id: dto.id,
    projectId: Number(dto.projectId || 0),
    category: dto.category || 'other',
    title: dto.title || `投诉 #${dto.id}`,
    description: dto.description || '',
    status: dto.status || 'submitted',
    resolution: dto.resolution || '',
    merchantResponse: dto.merchantResponse || '',
    freezePayment: Boolean(dto.freezePayment),
    createdAt: formatDateTime(dto.createdAt),
  };
}

export async function listComplaints() {
  const data = await requestJson<ComplaintDTO[]>('/complaints');
  return data.map(adaptComplaint);
}

export async function getComplaint(id: number) {
  const data = await requestJson<ComplaintDTO>(`/complaints/${id}`);
  return adaptComplaint(data);
}

export async function createComplaint(payload: {
  projectId: number;
  category: string;
  title: string;
  description: string;
  evidenceUrls: string[];
}) {
  const data = await requestJson<ComplaintDTO>('/complaints', {
    method: 'POST',
    body: payload,
  });
  return adaptComplaint(data);
}
