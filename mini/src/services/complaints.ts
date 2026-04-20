import { request } from '@/utils/request';

export interface ComplaintListItem {
  id: number;
  projectId: number;
  category: string;
  title: string;
  description: string;
  status: string;
  resolution: string;
  merchantResponse: string;
  freezePayment: boolean;
  createdAt: string;
}

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

const formatDateTime = (value?: string) => {
  const next = String(value || '').trim();
  if (!next) return '';
  const normalized = next.replace('T', ' ').replace(/\.\d+Z?$/, '').replace('Z', '');
  return normalized.slice(0, 16);
};

const adaptComplaint = (dto: ComplaintDTO): ComplaintListItem => ({
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
});

export async function listComplaints() {
  const data = await request<ComplaintDTO[]>({
    url: '/complaints',
  });

  return (data || []).map(adaptComplaint);
}

export async function getComplaint(id: number) {
  const data = await request<ComplaintDTO>({
    url: `/complaints/${id}`,
  });

  return adaptComplaint(data);
}

export async function createComplaint(payload: {
  projectId: number;
  category: string;
  title: string;
  description: string;
  evidenceUrls: string[];
}) {
  const data = await request<ComplaintDTO>({
    url: '/complaints',
    method: 'POST',
    data: payload,
    showLoading: true,
  });

  return adaptComplaint(data);
}
