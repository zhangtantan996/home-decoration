import type { PageEnvelope } from '../types/api';
import type {
  ProjectBillingItemVM,
  ProjectBillingPlanVM,
  ProjectCompletionVM,
  ProjectDetailVM,
  ProjectEscrowTransactionVM,
  ProjectEscrowVM,
  ProjectFileVM,
  ProjectListItemVM,
  ProjectLogVM,
  ProjectMilestoneVM,
  ProjectPhaseVM,
} from '../types/viewModels';
import {
  MILESTONE_STATUS_LABELS,
  ORDER_STATUS_LABELS,
  PHASE_STATUS_LABELS,
  PROJECT_STATUS_LABELS,
  TRANSACTION_STATUS_LABELS,
} from '../constants/statuses';
import { compactPhone, formatArea, formatCurrency, formatDate, formatDateTime } from '../utils/format';
import { requestJson } from './http';

interface ProjectListDTO {
  id: number;
  name?: string;
  address?: string;
  currentPhase?: string;
  status?: number;
  budget?: number;
}

interface ProjectDetailResponse {
  id: number;
  name?: string;
  address?: string;
  currentPhase?: string;
  status?: number;
  startDate?: string;
  expectedEnd?: string;
  businessStage?: string;
  flowSummary?: string;
  availableActions?: string[];
  selectedQuoteTaskId?: number;
  area?: number;
  budget?: number;
  ownerName?: string;
  providerName?: string;
  providerAvatar?: string;
  providerPhone?: string;
  providerType?: number;
  escrowBalance?: number;
  completedPhotos?: string[];
  completionNotes?: string;
  completionSubmittedAt?: string;
  completionRejectedAt?: string;
  completionRejectionReason?: string;
}

interface ProjectCompletionResponse {
  projectId: number;
  businessStage?: string;
  flowSummary?: string;
  availableActions?: string[];
  completedPhotos?: string[];
  completionNotes?: string;
  completionSubmittedAt?: string;
  completionRejectedAt?: string;
  completionRejectionReason?: string;
  inspirationCaseDraftId?: number;
}

export interface ProjectDisputePayload {
  reason: string;
  evidence: string[];
}

interface ProjectPhaseDTO {
  id: number;
  name?: string;
  phaseType?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  responsiblePerson?: string;
  estimatedDays?: number;
  tasks?: Array<{ id: number; name?: string; isCompleted?: boolean }>;
}

interface ProjectMilestoneDTO {
  id: number;
  name?: string;
  seq?: number;
  amount?: number;
  status?: number | string;
  criteria?: string;
  acceptedAt?: string;
}

interface ProjectLogDTO {
  id: number;
  title?: string;
  description?: string;
  logDate?: string;
  photos?: string;
}

interface EscrowTransactionDTO {
  id: number;
  type?: string;
  amount?: number;
  status?: number;
  createdAt?: string;
}

interface EscrowDetailDTO {
  totalAmount?: number;
  frozenAmount?: number;
  availableAmount?: number;
  releasedAmount?: number;
  transactions?: EscrowTransactionDTO[];
}

interface ProjectBillDTO {
  order?: {
    id: number;
    orderNo?: string;
    totalAmount?: number;
    status?: number;
  };
  paymentPlans?: Array<{
    id: number;
    name?: string;
    amount?: number;
    status?: number;
    dueAt?: string;
  }>;
}

interface ProjectFilesDTO {
  files?: string[];
}

function parsePhotos(value?: string) {
  if (!value) {
    return [] as string[];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
  } catch {
    return [];
  }
}

function toProjectListItem(dto: ProjectListDTO): ProjectListItemVM {
  return {
    id: dto.id,
    name: dto.name || `项目 #${dto.id}`,
    address: dto.address || '地址待补充',
    currentPhase: dto.currentPhase || '待同步',
    statusText: PROJECT_STATUS_LABELS[Number(dto.status || 0)] || '处理中',
    budgetText: formatCurrency(dto.budget),
    href: `/projects/${dto.id}`,
  };
}

function adaptPhases(items: ProjectPhaseDTO[]): ProjectPhaseVM[] {
  const phaseTypeMap: Record<string, string> = {
    preparation: '开工准备',
    demolition: '拆改阶段',
    electrical: '拆改与水电',
    masonry: '泥木阶段',
    painting: '油漆阶段',
    installation: '安装阶段',
    inspection: '竣工验收',
  };

  return items.map((phase) => ({
    id: phase.id,
    name: phase.name || phaseTypeMap[phase.phaseType || ''] || '阶段',
    status: phase.status || 'pending',
    statusText: phase.estimatedDays
      ? `${PHASE_STATUS_LABELS[phase.status || 'pending'] || '处理中'} · 预计 ${phase.estimatedDays} 天`
      : PHASE_STATUS_LABELS[phase.status || 'pending'] || '处理中',
    startDate: formatDate(phase.startDate),
    endDate: formatDate(phase.endDate),
    responsiblePerson: phase.responsiblePerson || undefined,
    tasks: (phase.tasks || []).map((task) => `${task.isCompleted ? '已完成' : '待办'} · ${task.name || '任务'}`),
  }));
}

function adaptMilestones(items: ProjectMilestoneDTO[]): ProjectMilestoneVM[] {
  return items.map((item) => {
    const statusKey = String(item.status ?? '0');
    return {
      id: item.id,
      name: item.name || '里程碑',
      seq: Number(item.seq || 0),
      amountText: formatCurrency(item.amount),
      status: statusKey,
      statusText: MILESTONE_STATUS_LABELS[statusKey] || '处理中',
      criteria: item.criteria || '暂无验收标准',
      acceptedAt: formatDate(item.acceptedAt),
    };
  });
}

function adaptLog(item: ProjectLogDTO): ProjectLogVM {
  return {
    id: item.id,
    title: item.title || '施工日志',
    description: item.description || '暂无日志内容',
    logDate: formatDate(item.logDate),
    photos: parsePhotos(item.photos),
  };
}

function adaptEscrowTransaction(item: EscrowTransactionDTO): ProjectEscrowTransactionVM {
  return {
    id: item.id,
    type: item.type || 'transaction',
    amountText: formatCurrency(item.amount),
    statusText: TRANSACTION_STATUS_LABELS[Number(item.status || 0)] || '处理中',
    createdAt: formatDateTime(item.createdAt),
  };
}

function adaptBillingPlan(item: NonNullable<ProjectBillDTO['paymentPlans']>[number]): ProjectBillingPlanVM {
  return {
    id: item.id,
    name: item.name || '分期计划',
    amountText: formatCurrency(item.amount),
    statusText: ORDER_STATUS_LABELS[Number(item.status || 0)] || '处理中',
    dueAt: formatDateTime(item.dueAt),
  };
}

export async function listProjects(params: { page?: number; pageSize?: number } = {}) {
  const data = await requestJson<PageEnvelope<ProjectListDTO>>('/projects', {
    query: {
      page: params.page || 1,
      pageSize: params.pageSize || 10,
    },
  });

  return {
    list: data.list.map(toProjectListItem),
    total: data.total,
    page: data.page,
    pageSize: data.pageSize,
  };
}

export async function getProjectDetail(id: number) {
  const [detail, phaseResponse, milestoneResponse] = await Promise.all([
    requestJson<ProjectDetailResponse>(`/projects/${id}`),
    requestJson<{ phases: ProjectPhaseDTO[] }>(`/projects/${id}/phases`),
    requestJson<{ milestones: ProjectMilestoneDTO[] }>(`/projects/${id}/milestones`),
  ]);

  const result: ProjectDetailVM = {
    id: detail.id,
    name: detail.name || '项目',
    address: detail.address || '地址待补充',
    currentPhase: detail.currentPhase || '待同步',
    statusText: PROJECT_STATUS_LABELS[Number(detail.status || 0)] || '处理中',
    startDateText: formatDate(detail.startDate),
    expectedEndText: formatDate(detail.expectedEnd),
    businessStage: detail.businessStage || undefined,
    flowSummary: detail.flowSummary || undefined,
    availableActions: detail.availableActions || [],
    selectedQuoteTaskId: detail.selectedQuoteTaskId || undefined,
    areaText: formatArea(detail.area),
    budgetText: formatCurrency(detail.budget),
    ownerName: detail.ownerName || '业主',
    providerName: detail.providerName || '服务商',
    providerAvatar: detail.providerAvatar || undefined,
    providerPhoneHint: compactPhone(detail.providerPhone || ''),
    providerRoleText: detail.providerType === 1 ? '设计师' : detail.providerType === 2 ? '装修公司' : detail.providerType === 3 ? '工长' : '服务商',
    escrowBalanceText: formatCurrency(detail.escrowBalance),
    phases: adaptPhases(phaseResponse.phases || []),
    milestones: adaptMilestones(milestoneResponse.milestones || []),
    completedPhotos: detail.completedPhotos || [],
    completionNotes: detail.completionNotes || undefined,
    completionSubmittedAt: formatDateTime(detail.completionSubmittedAt),
    completionRejectedAt: formatDateTime(detail.completionRejectedAt),
    completionRejectionReason: detail.completionRejectionReason || undefined,
  };

  return result;
}

export async function listProjectLogs(projectId: number, params: { page?: number; pageSize?: number } = {}) {
  const data = await requestJson<PageEnvelope<ProjectLogDTO>>(`/projects/${projectId}/logs`, {
    query: {
      page: params.page || 1,
      pageSize: params.pageSize || 5,
    },
  });

  return {
    list: data.list.map(adaptLog),
    total: data.total,
  };
}

export async function getProjectEscrow(projectId: number) {
  const data = await requestJson<EscrowDetailDTO>(`/projects/${projectId}/escrow`);

  const result: ProjectEscrowVM = {
    totalAmountText: formatCurrency(data.totalAmount),
    frozenAmountText: formatCurrency(data.frozenAmount),
    releasedAmountText: formatCurrency(data.releasedAmount),
    balanceText: formatCurrency(data.availableAmount),
    transactions: (data.transactions || []).map(adaptEscrowTransaction),
  };

  return result;
}

export async function getProjectBill(projectId: number) {
  const data = await requestJson<ProjectBillDTO[]>(`/projects/${projectId}/bill`);
  return data.map<ProjectBillingItemVM>((item) => ({
    id: Number(item.order?.id || 0),
    orderNo: item.order?.orderNo || '待生成',
    amountText: formatCurrency(item.order?.totalAmount),
    statusText: ORDER_STATUS_LABELS[Number(item.order?.status || 0)] || '处理中',
    planItems: (item.paymentPlans || []).map(adaptBillingPlan),
  }));
}

export async function getProjectFiles(projectId: number) {
  const data = await requestJson<ProjectFilesDTO>(`/projects/${projectId}/files`);
  return (data.files || []).map<ProjectFileVM>((file, index) => ({
    name: `设计资料 ${index + 1}`,
    url: file,
  }));
}

export async function acceptProjectMilestone(projectId: number, milestoneId: number) {
  await requestJson(`/projects/${projectId}/accept`, {
    method: 'POST',
    body: { milestoneId },
  });
}

export async function rejectProjectMilestone(projectId: number, milestoneId: number, reason: string) {
  await requestJson(`/projects/${projectId}/milestones/${milestoneId}/reject`, {
    method: 'POST',
    body: { reason },
  });
}

export async function startProject(projectId: number, startDate?: string) {
  await requestJson(`/projects/${projectId}/start`, {
    method: 'POST',
    body: startDate ? { startDate } : {},
  });
}

/** @deprecated Legacy endpoint disabled. Use merchant completion submission + user completion approval flow. */
export async function completeProjectLegacyDisabled(_projectId: number): Promise<never> {
  const error = new Error('旧项目完工入口已禁用，请改用商家提交完工材料并由业主在整体验收页处理');
  (error as Error & { errorCode?: string }).errorCode = 'PROJECT_COMPLETE_LEGACY_DISABLED';
  throw error;
}

export async function pauseProject(projectId: number, reason: string, initiator: 'user' | 'foreman' = 'user') {
  await requestJson(`/projects/${projectId}/pause`, {
    method: 'POST',
    body: { reason, initiator },
  });
}

export async function resumeProject(projectId: number) {
  await requestJson(`/projects/${projectId}/resume`, {
    method: 'POST',
  });
}

export async function disputeProject(projectId: number, payload: ProjectDisputePayload) {
  await requestJson(`/projects/${projectId}/dispute`, {
    method: 'POST',
    body: payload,
  });
}

export async function createProjectInspirationDraft(projectId: number) {
  return requestJson<{ auditId: number; projectId: number; message: string }>(`/projects/${projectId}/inspiration-draft`, {
    method: 'POST',
  });
}

function adaptProjectCompletion(data: ProjectCompletionResponse): ProjectCompletionVM {
  return {
    projectId: data.projectId,
    businessStage: data.businessStage || undefined,
    flowSummary: data.flowSummary || undefined,
    availableActions: data.availableActions || [],
    completedPhotos: data.completedPhotos || [],
    completionNotes: data.completionNotes || '',
    completionSubmittedAt: formatDateTime(data.completionSubmittedAt),
    completionRejectedAt: formatDateTime(data.completionRejectedAt),
    completionRejectionReason: data.completionRejectionReason || undefined,
    inspirationCaseDraftId: data.inspirationCaseDraftId || undefined,
  };
}

export async function getProjectCompletion(projectId: number) {
  const data = await requestJson<{ completion: ProjectCompletionResponse }>(`/projects/${projectId}/completion`);
  return adaptProjectCompletion(data.completion);
}

export async function approveProjectCompletion(projectId: number) {
  const data = await requestJson<{ completion: ProjectCompletionResponse; auditId?: number }>(`/projects/${projectId}/completion/approve`, {
    method: 'POST',
  });
  return {
    completion: adaptProjectCompletion(data.completion),
    auditId: data.auditId,
  };
}

export async function rejectProjectCompletion(projectId: number, reason: string) {
  const data = await requestJson<{ completion: ProjectCompletionResponse }>(`/projects/${projectId}/completion/reject`, {
    method: 'POST',
    body: { reason },
  });
  return adaptProjectCompletion(data.completion);
}
