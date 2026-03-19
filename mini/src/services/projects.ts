import { request } from '@/utils/request';
import type { PageData } from './types';
import type { ProjectDTO, ProjectDetailDTO, ProjectPhaseDTO } from './dto';

export type ProjectItem = ProjectDTO;

export type ProjectPhase = ProjectPhaseDTO;

export type ProjectDetail = ProjectDetailDTO;

export interface CreateProjectPayload {
  proposalId?: number;
  materialMethod: 'self' | 'platform';
  crewId?: number;
  entryStartDate: string;
  entryEndDate: string;
  name?: string;
  address?: string;
  area?: number;
  budget?: number;
}

export async function createProject(payload: CreateProjectPayload) {
  return request<{ id: number }>({
    url: '/projects',
    method: 'POST',
    data: payload,
    showLoading: true
  });
}

export async function listProjects(page = 1, pageSize = 10) {
  return request<PageData<ProjectItem>>({
    url: '/projects',
    data: { page, pageSize }
  });
}

export async function getProjectDetail(id: number) {
  return request<ProjectDetail>({
    url: `/projects/${id}`
  });
}

export async function getProjectLogs(id: number, page = 1, pageSize = 20) {
  return request<PageData<Record<string, unknown>>>({
    url: `/projects/${id}/logs`,
    data: { page, pageSize }
  });
}

export async function createProjectLog(id: number, description: string, photos: string) {
  return request<{ message: string }>({
    url: `/projects/${id}/logs`,
    method: 'POST',
    data: { description, photos },
    showLoading: true
  });
}

export async function getProjectPhases(id: number) {
  return request<{ phases: ProjectPhase[] }>({
    url: `/projects/${id}/phases`
  });
}

export async function updatePhase(phaseId: number, payload: { status: string; startDate?: string; endDate?: string }) {
  return request<{ message: string }>({
    url: `/phases/${phaseId}`,
    method: 'PUT',
    data: payload,
    showLoading: true
  });
}

export async function updatePhaseTask(phaseId: number, taskId: number, payload: { isCompleted: boolean }) {
  return request<{ message: string }>({
    url: `/phases/${phaseId}/tasks/${taskId}`,
    method: 'PUT',
    data: payload,
    showLoading: true
  });
}

export async function getEscrowAccount(id: number) {
  return request<Record<string, unknown>>({
    url: `/projects/${id}/escrow`
  });
}

export async function depositEscrow(id: number, amount: number, milestoneId?: number) {
  return request<{ message: string }>({
    url: `/projects/${id}/deposit`,
    method: 'POST',
    data: { amount, milestoneId },
    showLoading: true
  });
}

export async function releaseEscrow(id: number, milestoneId: number) {
  return request<{ message: string }>({
    url: `/projects/${id}/release`,
    method: 'POST',
    data: { milestoneId },
    showLoading: true
  });
}

/**
 * 获取项目验收节点列表
 */
export interface Milestone {
  id: number;
  projectId: number;
  seq: number;
  name: string;
  description?: string;
  amount: number;
  status: 'pending' | 'completed' | 'rejected' | 'paid' | 'in_progress';
  acceptedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export async function getProjectMilestones(id: number) {
  const data = await request<{ milestones: Array<Milestone & { status: number | string; criteria?: string; paidAt?: string }> }>({
    url: `/projects/${id}/milestones`
  });

  const normalizeStatus = (status: number | string): Milestone['status'] => {
    if (status === 1 || status === 'in_progress') return 'in_progress';
    if (status === 2 || status === 'rejected') return 'rejected';
    if (status === 3 || status === 'completed') return 'completed';
    if (status === 4 || status === 'paid') return 'paid';
    return 'pending';
  };

  return {
    milestones: (data.milestones || []).map((item) => ({
      ...item,
      description: item.description || item.criteria,
      status: normalizeStatus(item.status),
    })),
  };
}

/**
 * 确认验收节点
 */
export async function acceptMilestone(projectId: number, milestoneId: number) {
  return request<{ message: string }>({
    url: `/projects/${projectId}/accept`,
    method: 'POST',
    data: { milestoneId },
    showLoading: true
  });
}

/**
 * 获取项目账单
 */
export interface ProjectBill {
  projectId: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  items: Array<{
    id: number;
    name: string;
    amount: number;
    status: 'pending' | 'paid';
    paidAt?: string;
  }>;
}

export async function getProjectBill(id: number) {
  return request<ProjectBill>({
    url: `/projects/${id}/bill`
  });
}

/**
 * 获取项目文件列表
 */
export interface ProjectFile {
  id: number;
  projectId: number;
  name: string;
  url: string;
  type: string;
  size: number;
  uploadedAt: string;
}

export async function getProjectFiles(id: number) {
  return request<{ files: ProjectFile[] }>({
    url: `/projects/${id}/files`
  });
}
