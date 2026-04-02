import type { PageEnvelope } from '../types/api';
import type { DemandCandidateVM, DemandDetailVM, DemandMatchVM, DemandProposalVM, DemandProviderVM, DemandSummaryVM } from '../types/viewModels';
import { formatDateTime } from '../utils/format';
import { requestJson, uploadFile } from './http';

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
  provider: DemandProviderDTO;
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

interface DemandCandidateDTO {
  provider: DemandProviderDTO;
  matchScore?: number;
  scoreReason?: string[];
}

function parseProposalAttachments(raw?: string) {
  if (!raw) {
    return [] as string[];
  }
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => {
        if (typeof item === 'string') {
          return item;
        }
        if (item && typeof item === 'object' && 'url' in item) {
          return String((item as { url: unknown }).url);
        }
        return '';
      }).filter(Boolean);
    }
  } catch {
    return [];
  }
  return [];
}

function adaptProvider(dto: DemandProviderDTO): DemandProviderVM {
  return {
    id: dto.id,
    userId: Number(dto.userId || 0),
    name: dto.name || `服务商 #${dto.id}`,
    avatar: dto.avatar || 'https://placehold.co/120x120/e4e4e7/27272a?text=SP',
    rating: Number(dto.rating || 0),
    reviewCount: Number(dto.reviewCount || 0),
    completedCnt: Number(dto.completedCnt || 0),
    verified: Boolean(dto.verified),
    providerType: Number(dto.providerType || 0),
    subType: dto.subType || '',
    yearsExperience: Number(dto.yearsExperience || 0),
    specialty: dto.specialty || '',
    serviceArea: dto.serviceArea || [],
  };
}

function adaptProposal(dto?: DemandProposalDTO | null): DemandProposalVM | undefined {
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
}

function adaptSummary(dto: DemandSummaryDTO): DemandSummaryVM {
  return {
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
  };
}

function adaptMatch(dto: DemandMatchDTO): DemandMatchVM {
  return {
    id: dto.id,
    status: dto.status || 'pending',
    assignedAt: formatDateTime(dto.assignedAt),
    responseDeadline: formatDateTime(dto.responseDeadline),
    respondedAt: formatDateTime(dto.respondedAt),
    declineReason: dto.declineReason || '',
    proposalId: dto.proposalId || undefined,
    provider: adaptProvider(dto.provider),
    proposal: adaptProposal(dto.proposal),
  };
}

export async function createDemand(payload: {
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
  attachments: Array<{ url: string; name: string; size: number; path?: string }>;
}) {
  return requestJson<DemandSummaryDTO>('/demands', {
    method: 'POST',
    body: {
      ...payload,
      attachments: payload.attachments.map((item) => ({
        url: item.path || item.url,
        name: item.name,
        size: item.size,
      })),
    },
  });
}

export async function updateDemand(id: number, payload: {
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
  attachments: Array<{ url: string; name: string; size: number; path?: string }>;
}) {
  return requestJson<DemandSummaryDTO>(`/demands/${id}`, {
    method: 'PUT',
    body: {
      ...payload,
      attachments: payload.attachments.map((item) => ({
        url: item.path || item.url,
        name: item.name,
        size: item.size,
      })),
    },
  });
}

export async function submitDemand(id: number) {
  return requestJson<{ id: number; status: string }>(`/demands/${id}/submit`, {
    method: 'POST',
  });
}

export async function listDemands(params: { status?: string; page?: number; pageSize?: number } = {}) {
  const data = await requestJson<PageEnvelope<DemandSummaryDTO>>('/demands', {
    query: {
      status: params.status,
      page: params.page || 1,
      pageSize: params.pageSize || 10,
    },
  });

  return {
    list: data.list.map(adaptSummary),
    total: data.total,
    page: data.page,
    pageSize: data.pageSize,
  };
}

export async function getDemandDetail(id: number): Promise<DemandDetailVM> {
  const data = await requestJson<DemandDetailDTO>(`/demands/${id}`);
  return {
    ...adaptSummary(data),
    address: data.address || '',
    stylePref: data.stylePref || '',
    description: data.description || '',
    attachments: (data.attachments || []).map((item) => ({
      url: item.url || '',
      name: item.name || '附件',
      size: Number(item.size || 0),
    })),
    reviewedAt: formatDateTime(data.reviewedAt),
    reviewerId: Number(data.reviewerId || 0),
    matches: (data.matches || []).map(adaptMatch),
  };
}

export async function uploadDemandAttachment(file: File) {
  return uploadFile('/upload', file);
}

export async function listDemandCandidates(id: number, params: { page?: number; pageSize?: number } = {}) {
  const data = await requestJson<PageEnvelope<DemandCandidateDTO>>(`/admin/demands/${id}/candidates`, {
    query: {
      page: params.page || 1,
      pageSize: params.pageSize || 10,
    },
  });

  return {
    list: data.list.map((item) => ({
      provider: adaptProvider(item.provider),
      matchScore: Number(item.matchScore || 0),
      scoreReason: item.scoreReason || [],
    }) satisfies DemandCandidateVM),
    total: data.total,
    page: data.page,
    pageSize: data.pageSize,
  };
}
