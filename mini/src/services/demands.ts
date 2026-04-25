import { request } from '@/utils/request';

import type { PageData } from './types';
import { uploadFile } from './uploads';

export interface DemandAttachmentItem {
  url: string;
  name: string;
  size: number;
  path?: string;
}

export interface DemandProvider {
  id: number;
  userId?: number;
  name: string;
  avatar?: string;
  rating: number;
  reviewCount: number;
  completedCnt: number;
  verified: boolean;
  providerType: number;
  subType: string;
  yearsExperience: number;
  specialty: string;
  serviceArea: string[];
}

export interface DemandProposal {
  id: number;
  summary: string;
  designFee: number;
  constructionFee: number;
  materialFee: number;
  estimatedDays: number;
  status: number;
  version: number;
  submittedAt: string;
  responseDeadline: string;
  attachments: string[];
}

export interface DemandMatch {
  id: number;
  status: string;
  assignedAt: string;
  responseDeadline: string;
  respondedAt: string;
  declineReason: string;
  proposalId?: number;
  provider: DemandProvider;
  proposal?: DemandProposal;
}

export interface DemandSummary {
  id: number;
  demandType: string;
  title: string;
  city: string;
  district: string;
  area: number;
  budgetMin: number;
  budgetMax: number;
  timeline: string;
  status: string;
  matchedCount: number;
  maxMatch: number;
  reviewNote: string;
  closedReason: string;
  createdAt: string;
  updatedAt: string;
}

export interface DemandDetail extends DemandSummary {
  address: string;
  stylePref: string;
  description: string;
  attachments: DemandAttachmentItem[];
  reviewedAt: string;
  reviewerId: number;
  matches: DemandMatch[];
}

interface DemandAttachmentDTO {
  url?: string;
  name?: string;
  size?: number;
}

interface DemandSummaryDTO {
  id: number;
  demandType?: string;
  title?: string;
  city?: string;
  district?: string;
  area?: number;
  budgetMin?: number;
  budgetMax?: number;
  timeline?: string;
  status?: string;
  matchedCount?: number;
  maxMatch?: number;
  reviewNote?: string;
  closedReason?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface DemandProposalDTO {
  id: number;
  summary?: string;
  designFee?: number;
  constructionFee?: number;
  materialFee?: number;
  estimatedDays?: number;
  status?: number;
  version?: number;
  submittedAt?: string;
  responseDeadline?: string;
  attachments?: string;
}

interface DemandProviderDTO {
  id: number;
  userId?: number;
  name?: string;
  avatar?: string;
  rating?: number;
  reviewCount?: number;
  completedCnt?: number;
  verified?: boolean;
  providerType?: number;
  subType?: string;
  yearsExperience?: number;
  specialty?: string;
  serviceArea?: string[];
}

interface DemandMatchDTO {
  id: number;
  status?: string;
  assignedAt?: string;
  responseDeadline?: string;
  respondedAt?: string;
  declineReason?: string;
  proposalId?: number;
  provider?: DemandProviderDTO;
  proposal?: DemandProposalDTO | null;
}

interface DemandDetailDTO extends DemandSummaryDTO {
  address?: string;
  stylePref?: string;
  description?: string;
  attachments?: DemandAttachmentDTO[];
  reviewedAt?: string;
  reviewerId?: number;
  matches?: DemandMatchDTO[];
}

export interface DemandUpsertPayload {
  demandType: string;
  title: string;
  city: string;
  district: string;
  address: string;
  area: number;
  budgetMin: number;
  budgetMax: number;
  timeline: string;
  stylePref: string;
  description: string;
  attachments: DemandAttachmentItem[];
}

const formatDateTime = (value?: string) => {
  const next = String(value || '').trim();
  if (!next) return '';
  const normalized = next.replace('T', ' ').replace(/\.\d+Z?$/, '').replace('Z', '');
  return normalized.slice(0, 16);
};

const parseProposalAttachments = (raw?: string) => {
  if (!raw) {
    return [] as string[];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [] as string[];
    }
    return parsed
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && 'url' in item) {
          return String((item as { url?: unknown }).url || '');
        }
        return '';
      })
      .filter(Boolean);
  } catch {
    return [] as string[];
  }
};

const adaptProvider = (dto?: DemandProviderDTO): DemandProvider => ({
  id: Number(dto?.id || 0),
  userId: Number(dto?.userId || 0) || undefined,
  name: dto?.name || `服务商 #${dto?.id || 0}`,
  avatar: dto?.avatar || '',
  rating: Number(dto?.rating || 0),
  reviewCount: Number(dto?.reviewCount || 0),
  completedCnt: Number(dto?.completedCnt || 0),
  verified: Boolean(dto?.verified),
  providerType: Number(dto?.providerType || 0),
  subType: dto?.subType || '',
  yearsExperience: Number(dto?.yearsExperience || 0),
  specialty: dto?.specialty || '',
  serviceArea: dto?.serviceArea || [],
});

const adaptProposal = (dto?: DemandProposalDTO | null): DemandProposal | undefined => {
  if (!dto) {
    return undefined;
  }

  return {
    id: dto.id,
    summary: dto.summary || '暂无方案说明',
    designFee: Number(dto.designFee || 0),
    constructionFee: Number(dto.constructionFee || 0),
    materialFee: Number(dto.materialFee || 0),
    estimatedDays: Number(dto.estimatedDays || 0),
    status: Number(dto.status || 0),
    version: Number(dto.version || 1),
    submittedAt: formatDateTime(dto.submittedAt),
    responseDeadline: formatDateTime(dto.responseDeadline),
    attachments: parseProposalAttachments(dto.attachments),
  };
};

const adaptSummary = (dto: DemandSummaryDTO): DemandSummary => ({
  id: dto.id,
  demandType: dto.demandType || 'renovation',
  title: dto.title || `需求 #${dto.id}`,
  city: dto.city || '',
  district: dto.district || '',
  area: Number(dto.area || 0),
  budgetMin: Number(dto.budgetMin || 0),
  budgetMax: Number(dto.budgetMax || 0),
  timeline: dto.timeline || '',
  status: dto.status || 'draft',
  matchedCount: Number(dto.matchedCount || 0),
  maxMatch: Number(dto.maxMatch || 0),
  reviewNote: dto.reviewNote || '',
  closedReason: dto.closedReason || '',
  createdAt: formatDateTime(dto.createdAt),
  updatedAt: formatDateTime(dto.updatedAt),
});

const adaptMatch = (dto: DemandMatchDTO): DemandMatch => ({
  id: Number(dto.id || 0),
  status: dto.status || 'pending',
  assignedAt: formatDateTime(dto.assignedAt),
  responseDeadline: formatDateTime(dto.responseDeadline),
  respondedAt: formatDateTime(dto.respondedAt),
  declineReason: dto.declineReason || '',
  proposalId: Number(dto.proposalId || 0) || undefined,
  provider: adaptProvider(dto.provider),
  proposal: adaptProposal(dto.proposal),
});

const buildAttachmentPayload = (attachments: DemandAttachmentItem[]) => {
  return attachments.map((item) => ({
    url: item.path || item.url,
    name: item.name,
    size: item.size,
  }));
};

export async function createDemand(payload: DemandUpsertPayload) {
  return request<DemandSummaryDTO>({
    url: '/demands',
    method: 'POST',
    data: {
      ...payload,
      attachments: buildAttachmentPayload(payload.attachments),
    },
    showLoading: true,
  });
}

export async function updateDemand(id: number, payload: DemandUpsertPayload) {
  return request<DemandSummaryDTO>({
    url: `/demands/${id}`,
    method: 'PUT',
    data: {
      ...payload,
      attachments: buildAttachmentPayload(payload.attachments),
    },
    showLoading: true,
  });
}

export async function submitDemand(id: number) {
  return request<{ id: number; status: string }>({
    url: `/demands/${id}/submit`,
    method: 'POST',
    showLoading: true,
  });
}

export async function listDemands(params: { status?: string; page?: number; pageSize?: number } = {}) {
  const data = await request<PageData<DemandSummaryDTO>>({
    url: '/demands',
    data: {
      status: params.status,
      page: params.page || 1,
      pageSize: params.pageSize || 10,
    },
  });

  return {
    list: (data.list || []).map(adaptSummary),
    total: Number(data.total || 0),
    page: Number(data.page || params.page || 1),
    pageSize: Number(data.pageSize || params.pageSize || 10),
  } satisfies PageData<DemandSummary>;
}

export async function getDemandDetail(id: number) {
  const data = await request<DemandDetailDTO>({
    url: `/demands/${id}`,
  });

  return {
    ...adaptSummary(data),
    address: data.address || '',
    stylePref: data.stylePref || '',
    description: data.description || '',
    attachments: (data.attachments || []).map((item) => ({
      url: item.url || '',
      name: item.name || '附件',
      size: Number(item.size || 0),
      path: item.url || '',
    })),
    reviewedAt: formatDateTime(data.reviewedAt),
    reviewerId: Number(data.reviewerId || 0),
    matches: (data.matches || []).map(adaptMatch),
  } satisfies DemandDetail;
}

export async function uploadDemandAttachment(filePath: string) {
  return uploadFile(filePath);
}
