import type { ContractVM } from '../types/viewModels';
import { formatDateTime } from '../utils/format';
import { requestJson } from './http';

interface ContractDTO {
  id: number;
  projectId?: number;
  demandId?: number;
  providerId?: number;
  userId?: number;
  contractNo?: string;
  title?: string;
  totalAmount?: number;
  paymentPlan?: string;
  attachmentUrls?: string;
  status?: string;
  confirmedAt?: string;
}

function parseJSONList<T>(raw: string | undefined, fallback: T): T {
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function adaptContract(dto: ContractDTO): ContractVM {
  return {
    id: dto.id,
    projectId: Number(dto.projectId || 0),
    demandId: Number(dto.demandId || 0),
    providerId: Number(dto.providerId || 0),
    userId: Number(dto.userId || 0),
    contractNo: dto.contractNo || '',
    title: dto.title || '装修合同',
    totalAmount: Number(dto.totalAmount || 0),
    status: dto.status || 'draft',
    paymentPlan: parseJSONList(dto.paymentPlan, []),
    attachmentUrls: parseJSONList(dto.attachmentUrls, []),
    confirmedAt: formatDateTime(dto.confirmedAt),
  };
}

export async function getProjectContract(projectId: number) {
  const data = await requestJson<ContractDTO>(`/projects/${projectId}/contract`);
  return adaptContract(data);
}

export async function confirmContract(contractId: number) {
  const data = await requestJson<ContractDTO>(`/contracts/${contractId}/confirm`, {
    method: 'POST',
  });
  return adaptContract(data);
}
