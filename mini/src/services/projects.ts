import { request } from '@/utils/request';
import { MiniApiError } from '@/utils/request';
import type { PageData } from './types';
import type { ProjectDTO, ProjectDetailDTO, ProjectPhaseDTO, ProjectRiskSummaryDTO } from './dto';

export type ProjectItem = ProjectDTO;

export type ProjectPhase = ProjectPhaseDTO;

export type ProjectDetail = ProjectDetailDTO;
export type ProjectRiskSummary = ProjectRiskSummaryDTO;

export interface ProjectChangeOrder {
  id: number;
  projectId: number;
  title?: string;
  changeType?: string;
  reason?: string;
  description?: string;
  amountImpact?: number;
  timelineImpact?: number;
  status?: string;
  evidenceUrls?: string[];
  createdAt?: string;
  updatedAt?: string;
  userRejectReason?: string;
  settlementReason?: string;
  payablePlanId?: number;
}

export interface ProjectContractDetail {
  id: number;
  projectId: number;
  contractNo?: string;
  title?: string;
  totalAmount?: number;
  status?: string;
  paymentPlan?: string | string[];
  attachmentUrls?: string | string[];
  confirmedAt?: string;
}

export interface ProjectDesignDeliverableDetail {
  id: number;
  bookingId: number;
  projectId: number;
  orderId: number;
  colorFloorPlan?: string | string[];
  renderings?: string | string[];
  renderingLink?: string;
  textDescription?: string;
  cadDrawings?: string | string[];
  attachments?: string | string[];
  status?: string;
  submittedAt?: string;
  acceptedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
}

export interface ProjectCompletionDetail {
  projectId: number;
  businessStage?: string;
  flowSummary?: string;
  availableActions?: string[];
  completedPhotos?: string[];
  completionNotes?: string;
  completionSubmittedAt?: string;
  completionRejectionReason?: string;
  completionRejectedAt?: string;
  inspirationCaseDraftId?: number;
  closureSummary?: {
    completionStatus?: string;
    archiveStatus?: string;
    settlementStatus?: string;
    payoutStatus?: string;
    caseDraftStatus?: string;
    financialClosureStatus?: string;
    nextPendingAction?: string;
  };
  quoteTruthSummary?: {
    quoteListId: number;
    sourceType?: string;
    sourceId?: number;
    quantityBaseId?: number;
    quantityBaseVersion?: number;
    activeSubmissionId?: number;
    awardedProviderId?: number;
    confirmedAt?: string;
    totalCent?: number;
    estimatedDays?: number;
    revisionCount?: number;
  };
  commercialExplanation?: {
    baselineSummary?: {
      title?: string;
      sourceStage?: string;
      submittedAt?: string;
      itemCount?: number;
      highlights?: string[];
      readyForUser?: boolean;
    };
    scopeIncluded?: string[];
    scopeExcluded?: string[];
    teamSize?: number;
    workTypes?: string[];
    constructionMethodNote?: string;
    siteVisitRequired?: boolean;
  };
  changeOrderSummary?: {
    totalCount: number;
    pendingUserConfirmCount: number;
    pendingSettlementCount: number;
    settledCount: number;
    netAmountCent?: number;
    latestChangeOrderId?: number;
  };
  settlementSummary?: {
    latestSettlementId?: number;
    status?: string;
    grossAmount?: number;
    netAmount?: number;
    scheduledAt?: string;
    paidAt?: string;
  };
  payoutSummary?: {
    latestPayoutId?: number;
    status?: string;
    channel?: string;
    scheduledAt?: string;
    paidAt?: string;
    failureReason?: string;
  };
  financialClosureStatus?: string;
  nextPendingAction?: string;
}

export interface ChangeOrderDecisionPayload {
  reason?: string;
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
  void payload;
  throw new MiniApiError('业主侧旧建项目入口已禁用，请改用施工报价确认主链', {
    status: 409,
    code: 409,
    errorCode: 'PROJECT_CREATE_LEGACY_DISABLED',
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

export async function getProjectContract(projectId: number) {
  return request<ProjectContractDetail>({
    url: `/projects/${projectId}/contract`,
  });
}

export async function confirmProjectContract(contractId: number) {
  return request<ProjectContractDetail>({
    url: `/contracts/${contractId}/confirm`,
    method: 'POST',
    showLoading: true,
  });
}

export async function getProjectDesignDeliverable(projectId: number) {
  return request<ProjectDesignDeliverableDetail>({
    url: `/projects/${projectId}/design-deliverable`,
  });
}

export async function acceptProjectDesignDeliverable(deliverableId: number) {
  return request<ProjectDesignDeliverableDetail>({
    url: `/design-deliverables/${deliverableId}/accept`,
    method: 'POST',
    showLoading: true,
  });
}

export async function rejectProjectDesignDeliverable(deliverableId: number, reason: string) {
  return request<ProjectDesignDeliverableDetail>({
    url: `/design-deliverables/${deliverableId}/reject`,
    method: 'POST',
    data: { reason },
    showLoading: true,
  });
}

export async function listProjectChangeOrders(projectId: number) {
  return request<ProjectChangeOrder[]>({
    url: `/projects/${projectId}/change-orders`,
  });
}

export async function confirmProjectChangeOrder(changeOrderId: number, payload: ChangeOrderDecisionPayload = {}) {
  return request<{ changeOrder?: ProjectChangeOrder }>({
    url: `/change-orders/${changeOrderId}/confirm`,
    method: 'POST',
    data: payload,
    showLoading: true,
  });
}

export async function rejectProjectChangeOrder(changeOrderId: number, payload: ChangeOrderDecisionPayload = {}) {
  return request<{ changeOrder?: ProjectChangeOrder }>({
    url: `/change-orders/${changeOrderId}/reject`,
    method: 'POST',
    data: payload,
    showLoading: true,
  });
}

export async function pauseProject(id: number, payload: { reason: string; initiator?: string }) {
  return request<{ project: ProjectDetail }>({
    url: `/projects/${id}/pause`,
    method: 'POST',
    data: payload,
    showLoading: true,
  });
}

export async function resumeProject(id: number) {
  return request<{ project: ProjectDetail }>({
    url: `/projects/${id}/resume`,
    method: 'POST',
    showLoading: true,
  });
}

export async function submitProjectDispute(id: number, payload: { reason: string; evidence?: string[] }) {
  return request<{ project: ProjectDetail; complaintId?: number; auditId?: number }>({
    url: `/projects/${id}/dispute`,
    method: 'POST',
    data: payload,
    showLoading: true,
  });
}

export async function getProjectLogs(id: number, page = 1, pageSize = 20) {
  return request<PageData<Record<string, unknown>>>({
    url: `/projects/${id}/logs`,
    data: { page, pageSize }
  });
}

export async function createProjectLog(id: number, description: string, photos: string) {
  void id;
  void description;
  void photos;
  throw new MiniApiError('业主侧施工日志入口已禁用，请使用商家侧施工日志入口', {
    status: 403,
    code: 403,
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
  void id;
  void milestoneId;
  throw new MiniApiError('业主侧旧放款入口已禁用，请改用正式验收与结算链路', {
    status: 409,
    code: 409,
    errorCode: 'PROJECT_RELEASE_LEGACY_DISABLED',
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

export async function rejectMilestone(projectId: number, milestoneId: number, reason: string) {
  return request<{ message: string }>({
    url: `/projects/${projectId}/milestones/${milestoneId}/reject`,
    method: 'POST',
    data: { reason },
    showLoading: true,
  });
}

export async function getProjectCompletion(projectId: number) {
  return request<{ completion: ProjectCompletionDetail }>({
    url: `/projects/${projectId}/completion`,
  });
}

export async function approveProjectCompletion(projectId: number) {
  return request<{ completion: ProjectCompletionDetail; auditId?: number }>({
    url: `/projects/${projectId}/completion/approve`,
    method: 'POST',
    showLoading: true,
  });
}

export async function rejectProjectCompletion(projectId: number, reason: string) {
  return request<{ completion: ProjectCompletionDetail }>({
    url: `/projects/${projectId}/completion/reject`,
    method: 'POST',
    data: { reason },
    showLoading: true,
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
