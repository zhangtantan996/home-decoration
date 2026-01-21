import { request } from '@/utils/request';
import type { PageData } from './types';

export interface ProjectItem {
  id: number;
  name: string;
  address: string;
  area?: number;
  budget?: number;
  status?: number;
  createdAt?: string;
}

export interface ProjectPhase {
  id: number;
  name: string;
  status: string;
  startDate?: string;
  endDate?: string;
  tasks?: Array<{ id: number; name: string; isCompleted: boolean }>;
}

export interface ProjectDetail extends ProjectItem {
  milestones?: Array<Record<string, unknown>>;
  logs?: Array<Record<string, unknown>>;
  escrow?: Record<string, unknown>;
}

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
