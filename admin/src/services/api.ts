import axios from "axios";
import { message } from "antd";
import { getApiBaseUrl, getLoginPath } from "../utils/env";
import {
  useAuthStore,
  type AdminSecurityStatus,
  type AdminSessionItem,
} from "../stores/authStore";

const API_BASE_URL = getApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

type AdminHandledStatus = 401 | 403;

const ADMIN_ERROR_STATUS_KEY = "__adminHandledStatus";
const ACCESS_DENIED_MESSAGE_COOLDOWN_MS = 3000;
let lastAccessDeniedAt = 0;
let adminRefreshPromise: Promise<string | null> | null = null;

type AdminEnvelopeError = {
  code?: number;
  message?: string;
  data?: Record<string, unknown>;
};

export class AdminApiError<T = unknown> extends Error {
  status?: number;
  code?: number;
  errorCode?: string;
  data?: T;

  constructor(
    message: string,
    options: {
      status?: number;
      code?: number;
      errorCode?: string;
      data?: T;
    } = {},
  ) {
    super(message);
    this.name = "AdminApiError";
    this.status = options.status;
    this.code = options.code;
    this.errorCode = options.errorCode;
    this.data = options.data;
  }
}

const getApiErrorStatus = (error: unknown): number | undefined => {
  if (typeof error !== "object" || error === null || !("response" in error)) {
    return undefined;
  }

  const response = (error as { response?: { status?: number } }).response;
  return response?.status;
};

const markAdminErrorHandled = (error: unknown, status: AdminHandledStatus) => {
  if (typeof error === "object" && error !== null) {
    Object.defineProperty(error, ADMIN_ERROR_STATUS_KEY, {
      value: status,
      configurable: true,
      enumerable: false,
      writable: true,
    });
  }
};

const getHandledAdminStatus = (
  error: unknown,
): AdminHandledStatus | undefined => {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  const value = (error as Record<string, unknown>)[ADMIN_ERROR_STATUS_KEY];
  if (value === 401 || value === 403) {
    return value;
  }

  return undefined;
};

const notifyAdminAccessDenied = () => {
  const now = Date.now();
  if (now - lastAccessDeniedAt < ACCESS_DENIED_MESSAGE_COOLDOWN_MS) {
    return;
  }

  lastAccessDeniedAt = now;
  message.error("无权限访问当前功能");
};

const normalizeAdminError = (error: unknown) => {
  if (error instanceof AdminApiError) {
    return error;
  }

  const status = getApiErrorStatus(error);
  const payload =
    typeof error === "object" && error !== null && "response" in error
      ? (error as { response?: { data?: AdminEnvelopeError } }).response
          ?.data || undefined
      : undefined;
  const errorCode =
    payload?.data &&
    typeof payload.data === "object" &&
    "errorCode" in payload.data
      ? String(payload.data.errorCode || "")
      : undefined;

  return new AdminApiError(
    payload?.message || `请求失败${status ? `(${status})` : ""}`,
    {
      status,
      code: payload?.code,
      errorCode,
      data: payload?.data,
    },
  );
};

const redirectToAdminLogin = () => {
  useAuthStore.getState().logout();

  if (typeof window === "undefined") {
    return;
  }

  const loginPath = getLoginPath();
  if (!window.location.pathname.endsWith("/login")) {
    window.location.replace(loginPath);
  }
};

const isAdminAuthRequest = (url?: string) => {
  if (!url) {
    return false;
  }
  return url.includes("/admin/login") || url.includes("/admin/token/refresh");
};

const refreshAdminSession = async (): Promise<string | null> => {
  const refreshToken = localStorage.getItem("admin_refresh_token");
  if (!refreshToken) {
    return null;
  }

  if (!adminRefreshPromise) {
    adminRefreshPromise = axios
      .post(
        `${API_BASE_URL}/admin/token/refresh`,
        { refreshToken },
        {
          headers: { "Content-Type": "application/json" },
        },
      )
      .then((response) => {
        const payload = response.data?.data;
        if (!payload?.accessToken) {
          return null;
        }
        useAuthStore.getState().setSession({
          accessToken: payload.accessToken,
          refreshToken: payload.refreshToken,
          admin: payload.admin,
          permissions: payload.permissions || [],
          menus: payload.menus || [],
          security: payload.security || null,
        });
        return payload.accessToken as string;
      })
      .catch(() => null)
      .finally(() => {
        adminRefreshPromise = null;
      });
  }

  return adminRefreshPromise;
};

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("admin_token");
    const skipAdminAuth = Boolean(config.headers?.["X-Skip-Admin-Auth"]);
    if (token && !skipAdminAuth && !isAdminAuthRequest(config.url)) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// 响应拦截器
api.interceptors.response.use(
  <T>(response: { data: T }) => response.data,
  async (error) => {
    const status = getApiErrorStatus(error);
    const originalRequest = (error as { config?: Record<string, unknown> })
      ?.config as
      | (Record<string, unknown> & {
          headers?: Record<string, string>;
          _adminRetried?: boolean;
          url?: string;
        })
      | undefined;

    if (
      status === 401 &&
      originalRequest &&
      !originalRequest._adminRetried &&
      !isAdminAuthRequest(originalRequest.url)
    ) {
      originalRequest._adminRetried = true;
      const nextToken = await refreshAdminSession();
      if (nextToken) {
        originalRequest.headers = {
          ...(originalRequest.headers || {}),
          Authorization: `Bearer ${nextToken}`,
        };
        return api(originalRequest);
      }
    }

    if (status === 401) {
      markAdminErrorHandled(error, 401);
      redirectToAdminLogin();
    }

    if (status === 403) {
      markAdminErrorHandled(error, 403);
      notifyAdminAccessDenied();
    }

    return Promise.reject(normalizeAdminError(error));
  },
);

export { api, getApiErrorStatus, getHandledAdminStatus, redirectToAdminLogin };
export const isAdminConflictError = (error: unknown) =>
  error instanceof AdminApiError && error.status === 409;

// API 接口定义
export const authApi = {
  login: (data: { phone: string; code: string }) =>
    api.post("/auth/login", data),
  sendCode: (
    phone: string,
    purpose:
      | "login"
      | "register"
      | "identity_apply"
      | "merchant_withdraw"
      | "merchant_bank_bind"
      | "change_phone"
      | "delete_account" = "login",
    captchaToken?: string,
  ) => api.post("/auth/send-code", { phone, purpose, captchaToken }),
};

// ==================== Admin 管理员认证 ====================
export const adminAuthApi = {
  login: (data: { username: string; password: string; otpCode?: string }) =>
    api.post("/admin/login", data),
  getInfo: () => api.get("/admin/info"),
  logout: () => api.post("/admin/logout"),
  refresh: (refreshToken: string) =>
    api.post("/admin/token/refresh", { refreshToken }),
};

export interface AdminSecurityStatusResponse {
  admin: {
    id: number;
    username: string;
    nickname?: string;
    avatar?: string;
    isSuperAdmin: boolean;
    roles: string[];
    lastLoginAt?: string;
    lastLoginIp?: string;
  };
  security: AdminSecurityStatus;
  sessions: AdminSessionItem[];
  sessionCount: number;
}

export interface AdminReauthPayload {
  otpCode?: string;
  password?: string;
}

export const adminSecurityApi = {
  getStatus: () => api.get("/admin/security/status"),
  resetInitialPassword: (data: { newPassword: string }) =>
    api.post("/admin/security/password/reset-initial", data),
  beginBind2FA: () => api.post("/admin/security/2fa/bind"),
  verify2FA: (data: { otpCode: string }) =>
    api.post("/admin/security/2fa/verify", data),
  reset2FA: (data: { recentReauthProof?: string; reason?: string }) =>
    api.post("/admin/security/2fa/reset", data),
  requestRecovery: () => api.post("/admin/security/2fa/recovery/request"),
  listSessions: () => api.get("/admin/security/sessions"),
  revokeSession: (
    sid: string,
    data: { reason: string; recentReauthProof: string },
  ) => api.post(`/admin/security/sessions/${sid}/revoke`, data),
  reauth: (data: AdminReauthPayload) =>
    api.post("/admin/security/reauth", data),
};

export const projectApi = {
  list: (params?: any) => api.get("/projects", { params }), // 返回 { data: { list: [], total: 0 } }
  detail: (id: string | number) => api.get(`/projects/${id}`),
  logs: (id: string | number) => api.get(`/projects/${id}/logs`),
};

// ==================== Admin 项目管理 ====================
export const adminProjectApi = {
  // 项目列表和详情
  list: (params?: {
    page?: number;
    pageSize?: number;
    status?: number;
    keyword?: string;
    businessStage?: string;
  }) => api.get("/admin/projects", { params }),
  detail: (id: string | number) => api.get(`/admin/projects/${id}`),
  updateStatus: (
    id: string | number,
    data: { status: number; currentPhase?: string },
  ) => api.put(`/admin/projects/${id}/status`, data),
  confirmConstruction: (
    id: string | number,
    data: {
      constructionProviderId?: number;
      foremanId?: number;
      reason?: string;
    },
  ) => api.post(`/admin/projects/${id}/construction/confirm`, data),
  confirmConstructionQuote: (
    id: string | number,
    data: {
      constructionQuote: number;
      materialMethod?: string;
      plannedStartDate?: string;
      expectedEnd?: string;
      reason?: string;
    },
  ) => api.post(`/admin/projects/${id}/construction/quote/confirm`, data),

  // 阶段管理
  getPhases: (id: string | number) => api.get(`/admin/projects/${id}/phases`),
  updatePhase: (
    projectId: string | number,
    phaseId: string | number,
    data: any,
  ) => api.put(`/admin/projects/${projectId}/phases/${phaseId}`, data),

  // 施工日志管理
  getLogs: (
    projectId: string | number,
    params?: { page?: number; pageSize?: number; phaseId?: string },
  ) => api.get(`/admin/projects/${projectId}/logs`, { params }),
  createLog: (
    projectId: string | number,
    phaseId: string | number,
    data: {
      title: string;
      description?: string;
      photos?: string;
      logDate?: string;
    },
  ) => api.post(`/admin/projects/${projectId}/phases/${phaseId}/logs`, data),
  updateLog: (
    logId: string | number,
    data: {
      title?: string;
      description?: string;
      photos?: string;
      logDate?: string;
    },
  ) => api.put(`/admin/logs/${logId}`, data),
  deleteLog: (logId: string | number) => api.delete(`/admin/logs/${logId}`),
};

export interface AdminSupervisionPhaseTask {
  id: number;
  name: string;
  isCompleted: boolean;
}

export interface AdminSupervisionPhase {
  id: number;
  projectId: number;
  phaseType: string;
  seq: number;
  status: string;
  responsiblePerson?: string;
  startDate?: string;
  endDate?: string;
  estimatedDays?: number;
  name: string;
  tasks?: AdminSupervisionPhaseTask[];
}

export interface AdminSupervisionWorkLog {
  id: number;
  projectId: number;
  phaseId: number;
  title: string;
  description?: string;
  photos?: string;
  logDate?: string;
  createdAt?: string;
  createdBy?: number;
}

export interface AdminSupervisionProjectItem {
  id: number;
  name: string;
  address?: string;
  ownerName?: string;
  providerName?: string;
  businessStage?: string;
  kickoffStatus?: string;
  plannedStartDate?: string;
  currentResponsible?: string;
  currentPhase?: string;
  currentPhaseStatus?: string;
  lastLogAt?: string;
  latestLogTitle?: string;
  unhandledRiskCount: number;
}

export interface AdminBridgeSupervisorSummary {
  plannedStartDate?: string;
  latestLogAt?: string;
  latestLogTitle?: string;
  unhandledRiskCount?: number;
}

export interface AdminSupervisionWorkspace {
  projectId: number;
  name: string;
  address?: string;
  ownerName?: string;
  providerName?: string;
  businessStage?: string;
  kickoffStatus?: string;
  plannedStartDate?: string;
  currentResponsible?: string;
  currentPhase?: string;
  currentPhaseStatus?: string;
  lastInspectionAt?: string;
  latestLogTitle?: string;
  unhandledRiskCount: number;
  supervisorSummary?: AdminBridgeSupervisorSummary;
  riskWarnings: AdminRiskWarningItem[];
}

export interface AdminSupervisionProjectQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  phaseStatus?: string;
  businessStage?: string;
  hasPendingRisk?: boolean;
}

export interface AdminCreateSupervisionRiskWarningInput {
  type: "delay" | "quality" | "payment" | "dispute";
  level: "low" | "medium" | "high" | "critical";
  description: string;
  phaseId?: number;
}

export const adminSupervisionApi = {
  listProjects: (params?: AdminSupervisionProjectQuery) =>
    api.get<
      AdminApiResponse<AdminListData<AdminSupervisionProjectItem>>,
      AdminApiResponse<AdminListData<AdminSupervisionProjectItem>>
    >("/admin/supervision/projects", { params }),
  getProject: (id: number) =>
    api.get<
      AdminApiResponse<AdminSupervisionWorkspace>,
      AdminApiResponse<AdminSupervisionWorkspace>
    >(`/admin/supervision/projects/${id}`),
  getPhases: (id: number) =>
    api.get<
      AdminApiResponse<{ phases: AdminSupervisionPhase[] }>,
      AdminApiResponse<{ phases: AdminSupervisionPhase[] }>
    >(`/admin/supervision/projects/${id}/phases`),
  getLogs: (
    id: number,
    params?: { page?: number; pageSize?: number; phaseId?: number },
  ) =>
    api.get<
      AdminApiResponse<
        AdminListData<AdminSupervisionWorkLog> & {
          page?: number;
          pageSize?: number;
        }
      >,
      AdminApiResponse<
        AdminListData<AdminSupervisionWorkLog> & {
          page?: number;
          pageSize?: number;
        }
      >
    >(`/admin/supervision/projects/${id}/logs`, { params }),
  updatePhase: (
    projectId: number,
    phaseId: number,
    data: {
      status?: string;
      responsiblePerson?: string;
      startDate?: string;
      endDate?: string;
      estimatedDays?: number;
    },
  ) =>
    api.put<AdminApiResponse, AdminApiResponse>(
      `/admin/supervision/projects/${projectId}/phases/${phaseId}`,
      data,
    ),
  updatePhaseTask: (
    projectId: number,
    phaseId: number,
    taskId: number,
    data: { isCompleted: boolean },
  ) =>
    api.put<AdminApiResponse, AdminApiResponse>(
      `/admin/supervision/projects/${projectId}/phases/${phaseId}/tasks/${taskId}`,
      data,
    ),
  createLog: (
    projectId: number,
    phaseId: number,
    data: {
      title: string;
      description?: string;
      photos?: string;
      logDate?: string;
    },
  ) =>
    api.post<
      AdminApiResponse<{ log: AdminSupervisionWorkLog }>,
      AdminApiResponse<{ log: AdminSupervisionWorkLog }>
    >(`/admin/supervision/projects/${projectId}/phases/${phaseId}/logs`, data),
  createRiskWarning: (
    projectId: number,
    data: AdminCreateSupervisionRiskWarningInput,
  ) =>
    api.post<
      AdminApiResponse<{ warning: AdminRiskWarningItem }>,
      AdminApiResponse<{ warning: AdminRiskWarningItem }>
    >(`/admin/supervision/projects/${projectId}/risk-warnings`, data),
};

export interface AdminDemandSummary {
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

export interface AdminDemandAttachment {
  url: string;
  name: string;
  size: number;
}

export interface AdminDemandProvider {
  id: number;
  userId: number;
  name: string;
  avatar: string;
  rating: number;
  completedCnt: number;
  verified: boolean;
  providerType: number;
  subType: string;
  yearsExperience: number;
  specialty: string;
  serviceArea: string[];
}

export interface AdminDemandProposal {
  id: number;
  summary: string;
  designFee: number;
  constructionFee: number;
  materialFee: number;
  estimatedDays: number;
  status: number;
  version: number;
  submittedAt?: string;
  responseDeadline?: string;
  attachments?: string;
}

export interface AdminDemandMatch {
  id: number;
  status: string;
  assignedAt?: string;
  responseDeadline?: string;
  respondedAt?: string;
  declineReason?: string;
  proposalId?: number;
  provider: AdminDemandProvider;
  proposal?: AdminDemandProposal | null;
}

export interface AdminDemandDetail extends AdminDemandSummary {
  address: string;
  stylePref: string;
  description: string;
  attachments: AdminDemandAttachment[];
  reviewedAt?: string;
  reviewerId: number;
  matches: AdminDemandMatch[];
}

export interface AdminDemandCandidate {
  provider: AdminDemandProvider;
  matchScore: number;
  scoreReason: string[];
}

export const adminDemandApi = {
  list: (params?: { page?: number; pageSize?: number; status?: string }) =>
    api.get<
      AdminApiResponse<AdminListData<AdminDemandSummary>>,
      AdminApiResponse<AdminListData<AdminDemandSummary>>
    >("/admin/demands", { params }),
  detail: (id: number) =>
    api.get<
      AdminApiResponse<AdminDemandDetail>,
      AdminApiResponse<AdminDemandDetail>
    >(`/admin/demands/${id}`),
  review: (id: number, data: { action: "approve" | "reject"; note?: string }) =>
    api.post<
      AdminApiResponse<AdminDemandSummary>,
      AdminApiResponse<AdminDemandSummary>
    >(`/admin/demands/${id}/review`, data),
  assign: (
    id: number,
    data: { providerIds: number[]; responseDeadlineHours: number },
  ) =>
    api.post<
      AdminApiResponse<{ count: number; matches: AdminDemandMatch[] }>,
      AdminApiResponse<{ count: number; matches: AdminDemandMatch[] }>
    >(`/admin/demands/${id}/assign`, data),
  candidates: (id: number, params?: { page?: number; pageSize?: number }) =>
    api.get<
      AdminApiResponse<AdminListData<AdminDemandCandidate>>,
      AdminApiResponse<AdminListData<AdminDemandCandidate>>
    >(`/admin/demands/${id}/candidates`, { params }),
};

export interface AdminComplaintItem {
  id: number;
  projectId: number;
  userId: number;
  providerId: number;
  category: string;
  title: string;
  description: string;
  status: string;
  resolution?: string;
  merchantResponse?: string;
  freezePayment?: boolean;
  createdAt: string;
  updatedAt: string;
}

export const adminComplaintApi = {
  list: () =>
    api.get<
      AdminApiResponse<AdminComplaintItem[]>,
      AdminApiResponse<AdminComplaintItem[]>
    >("/admin/complaints"),
  resolve: (
    id: number,
    data: { resolution: string; freezePayment?: boolean },
  ) =>
    api.post<
      AdminApiResponse<AdminComplaintItem>,
      AdminApiResponse<AdminComplaintItem>
    >(`/admin/complaints/${id}/resolve`, data),
};

export interface AdminProjectAuditItem {
  id: number;
  projectId: number;
  auditType: "dispute" | "refund" | "close" | string;
  status: "pending" | "in_progress" | "completed" | string;
  complaintId?: number;
  refundApplicationId?: number;
  auditNotes?: string;
  conclusion?: "continue" | "refund" | "partial_refund" | "close" | string;
  conclusionReason?: string;
  executionPlan?: Record<string, unknown> | null;
  adminId?: number;
  createdAt: string;
  completedAt?: string;
  project?: Record<string, unknown>;
  complaint?: Record<string, unknown>;
  escrow?: Record<string, unknown>;
  refundApplication?: Record<string, unknown>;
}

export interface AdminProjectAuditArbitratePayload {
  conclusion: "continue" | "refund" | "partial_refund" | "close";
  conclusionReason: string;
  executionPlan?: Record<string, unknown>;
  recentReauthProof?: string;
}

export interface AdminFinanceOverviewStatistics {
  intentFee?: number;
  designFee?: number;
  constructionFee?: number;
  [key: string]: number | undefined;
}

export interface AdminFinanceOverviewData {
  totalBalance: number;
  pendingRelease: number;
  frozenAmount: number;
  releasedToday: number;
  statistics?: AdminFinanceOverviewStatistics;
}

export interface AdminEscrowAccountItem {
  id: number;
  projectId: number;
  projectName: string;
  userId: number;
  userName: string;
  totalAmount: number;
  frozenAmount: number;
  availableAmount: number;
  status: number;
  createdAt: string;
}

export interface AdminEscrowAccountSummary {
  totalAmount?: number;
  frozenAmount?: number;
  availableAmount?: number;
}

export interface AdminEscrowAccountListData {
  list: AdminEscrowAccountItem[];
  total: number;
  summary?: AdminEscrowAccountSummary;
}

export interface AdminFinanceReconciliationItem {
  id: number;
  reconcileDate: string;
  status: "success" | "warning" | "processing" | "resolved" | string;
  findingCount: number;
  ownerAdminId: number;
  ownerNote?: string;
  resolvedByAdminId: number;
  resolutionNote?: string;
  resolvedAt?: string;
  lastRunAt: string;
  createdAt: string;
  updatedAt: string;
  summary?: Record<string, unknown>;
  findings?: Array<Record<string, unknown>>;
}

export interface AdminFinanceReconciliationDetailItem {
  id: number;
  reconciliationId: number;
  itemType: string;
  code: string;
  level: string;
  referenceType: string;
  referenceId: number;
  message: string;
  expectedCount: number;
  actualCount: number;
  expectedAmount: number;
  actualAmount: number;
  detail?: Record<string, unknown>;
  createdAt: string;
}

export interface AdminFinanceReconciliationQuery {
  page?: number;
  pageSize?: number;
  status?: string;
  startDate?: string;
  endDate?: string;
}

export interface AdminRiskWarningItem {
  id: number;
  projectId: number;
  projectName: string;
  type: string;
  level: string;
  description: string;
  status: number;
  createdAt: string;
  handledAt?: string;
  handledBy?: number;
  handleResult?: string;
}

export interface AdminRiskWarningQuery {
  page?: number;
  pageSize?: number;
  level?: string;
  type?: string;
  status?: number;
}

export interface AdminHandleRiskWarningInput {
  status: number;
  result: string;
  reason?: string;
  recentReauthProof?: string;
}

export interface AdminFinanceTransactionItem {
  id: number;
  orderId?: string;
  type: string;
  amount: number;
  projectId?: number;
  escrowId?: number;
  milestoneId?: number;
  fromUserId?: number;
  fromAccount?: string;
  toUserId?: number;
  toAccount?: string;
  status: number;
  remark?: string;
  completedAt?: string;
  createdAt: string;
}

export interface AdminFinanceTransactionQuery {
  page?: number;
  pageSize?: number;
  type?: string;
  projectId?: number;
  startDate?: string;
  endDate?: string;
}

export interface AdminFinancePayoutItem {
  id: number;
  bizType: string;
  bizId: number;
  providerId: number;
  providerName?: string;
  amount: number;
  channel: string;
  fundScene: string;
  outPayoutNo: string;
  providerPayoutNo?: string;
  status: "created" | "processing" | "paid" | "failed" | string;
  failureReason?: string;
  scheduledAt?: string;
  paidAt?: string;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminFinancePayoutDetail {
  payout?: AdminFinancePayoutItem;
  merchantIncome?: {
    id: number;
    providerId: number;
    orderId?: number;
    bookingId?: number;
    type: string;
    amount: number;
    platformFee: number;
    netAmount: number;
    status: number;
    settledAt?: string;
    payoutOrderId?: number;
    payoutStatus?: string;
    payoutFailedReason?: string;
    payoutedAt?: string;
  };
}

export interface AdminSettlementItem {
  id: number;
  bizType: string;
  bizId: number;
  projectId: number;
  projectName?: string;
  providerId: number;
  providerName?: string;
  fundScene: string;
  grossAmount: number;
  platformFee: number;
  merchantNetAmount: number;
  acceptedAt?: string;
  dueAt?: string;
  payoutOrderId?: number;
  payoutStatus?: string;
  status: string;
  failureReason?: string;
  recoveryStatus?: string;
  recoveryAmount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminBondRuleItem {
  id: number;
  providerType: number;
  providerSubType: string;
  providerSubLabel?: string;
  enabled: boolean;
  ruleType: string;
  fixedAmount: number;
  ratio: number;
  floorAmount: number;
  capAmount: number;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
}

export interface AdminBondAccountItem {
  id: number;
  providerId: number;
  providerName?: string;
  requiredAmount: number;
  paidAmount: number;
  frozenAmount: number;
  availableAmount: number;
  status: string;
  lastRuleId?: number;
  updatedAt: string;
}

export interface AdminBondAdjustInput {
  amount: number;
  reason: string;
}

export interface FreezeFundsInput {
  projectId: number;
  amount: number;
  reason: string;
  recentReauthProof?: string;
}

export interface UnfreezeFundsInput {
  projectId: number;
  amount: number;
  reason: string;
  recentReauthProof?: string;
}

export interface ManualReleaseInput {
  projectId: number;
  milestoneId: number;
  amount?: number;
  reason: string;
  recentReauthProof?: string;
}

export interface AdminAuditLogRecord {
  id: number;
  recordKind?: "request" | "business" | string;
  operatorType?: string;
  operatorId?: number;
  operationType?: string;
  resourceType?: string;
  resourceId?: number;
  reason?: string;
  result?: string;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  action?: string;
  requestBody?: string;
  clientIp?: string;
  userAgent?: string;
  statusCode?: number;
  duration?: number;
  createdAt: string;
}

export interface AdminAuditLogQuery {
  page?: number;
  pageSize?: number;
  operationType?: string;
  resourceType?: string;
  startDate?: string;
  endDate?: string;
}

export const adminProjectAuditApi = {
  list: (params?: {
    page?: number;
    pageSize?: number;
    status?: string;
    auditType?: string;
  }) =>
    api.get<
      AdminApiResponse<AdminListData<AdminProjectAuditItem>>,
      AdminApiResponse<AdminListData<AdminProjectAuditItem>>
    >("/admin/project-audits", { params }),
  detail: (id: number) =>
    api.get<
      AdminApiResponse<
        { audit: AdminProjectAuditItem } | AdminProjectAuditItem
      >,
      AdminApiResponse<{ audit: AdminProjectAuditItem } | AdminProjectAuditItem>
    >(`/admin/project-audits/${id}`),
  arbitrate: (id: number, data: AdminProjectAuditArbitratePayload) =>
    api.post<
      AdminApiResponse<AdminProjectAuditItem>,
      AdminApiResponse<AdminProjectAuditItem>
    >(`/admin/project-audits/${id}/arbitrate`, data),
};

export interface AdminRefundApplicationItem {
  id: number;
  bookingId: number;
  projectId?: number;
  orderId?: number;
  userId: number;
  refundType:
    | "intent_fee"
    | "design_fee"
    | "construction_fee"
    | "full"
    | string;
  requestedAmount: number;
  approvedAmount?: number;
  reason: string;
  evidence?: string[] | string;
  status: "pending" | "approved" | "rejected" | "completed" | string;
  adminId?: number;
  adminNotes?: string;
  createdAt: string;
  approvedAt?: string;
  rejectedAt?: string;
  completedAt?: string;
}

export const adminRefundApi = {
  list: (params?: { page?: number; pageSize?: number; status?: string }) =>
    api.get<
      AdminApiResponse<AdminListData<AdminRefundApplicationItem>>,
      AdminApiResponse<AdminListData<AdminRefundApplicationItem>>
    >("/admin/refunds", { params }),
  detail: (id: number) =>
    api.get<
      AdminApiResponse<
        | { refundApplication: AdminRefundApplicationItem }
        | AdminRefundApplicationItem
      >,
      AdminApiResponse<
        | { refundApplication: AdminRefundApplicationItem }
        | AdminRefundApplicationItem
      >
    >(`/admin/refunds/${id}`),
  approve: (
    id: number,
    data: {
      adminNotes?: string;
      approvedAmount?: number;
      recentReauthProof?: string;
    },
  ) =>
    api.post<
      AdminApiResponse<AdminRefundApplicationItem>,
      AdminApiResponse<AdminRefundApplicationItem>
    >(`/admin/refunds/${id}/approve`, data),
  reject: (
    id: number,
    data: { adminNotes: string; recentReauthProof?: string },
  ) =>
    api.post<
      AdminApiResponse<AdminRefundApplicationItem>,
      AdminApiResponse<AdminRefundApplicationItem>
    >(`/admin/refunds/${id}/reject`, data),
};

export interface AdminMerchantWithdrawItem {
  id: number;
  providerId: number;
  providerName?: string;
  orderNo: string;
  amount: number;
  bankAccount: string;
  bankName: string;
  status: number;
  statusLabel?: string;
  failReason?: string;
  approvedAt?: string;
  transferredAt?: string;
  transferVoucher?: string;
  completedAt?: string;
  createdAt: string;
}

export interface AdminMerchantWithdrawProvider {
  id: number;
  companyName?: string;
  displayName?: string;
  providerType?: number;
}

export interface AdminMerchantWithdrawIncomeItem {
  id: number;
  bookingId: number;
  type: string;
  amount: number;
  platformFee: number;
  netAmount: number;
  status: number;
  settledAt?: string;
  withdrawOrderNo?: string;
  createdAt: string;
}

export interface AdminMerchantWithdrawDetail {
  withdraw: AdminMerchantWithdrawItem;
  provider?: AdminMerchantWithdrawProvider;
  incomes: AdminMerchantWithdrawIncomeItem[];
}

export const adminWithdrawApi = {
  list: (params?: {
    page?: number;
    pageSize?: number;
    status?: number;
    providerId?: number;
  }) =>
    api.get<
      AdminApiResponse<AdminListData<AdminMerchantWithdrawItem>>,
      AdminApiResponse<AdminListData<AdminMerchantWithdrawItem>>
    >("/admin/withdraws", { params }),
  detail: (id: number) =>
    api.get<
      AdminApiResponse<AdminMerchantWithdrawDetail>,
      AdminApiResponse<AdminMerchantWithdrawDetail>
    >(`/admin/withdraws/${id}`),
  approve: (id: number, data: { remark?: string }) =>
    api.post<
      AdminApiResponse<{ withdraw: AdminMerchantWithdrawItem }>,
      AdminApiResponse<{ withdraw: AdminMerchantWithdrawItem }>
    >(`/admin/withdraws/${id}/approve`, data),
  reject: (id: number, data: { reason: string }) =>
    api.post<
      AdminApiResponse<{ withdraw: AdminMerchantWithdrawItem }>,
      AdminApiResponse<{ withdraw: AdminMerchantWithdrawItem }>
    >(`/admin/withdraws/${id}/reject`, data),
  markPaid: (id: number, data: { transferVoucher: string; remark?: string }) =>
    api.post<
      AdminApiResponse<{ withdraw: AdminMerchantWithdrawItem }>,
      AdminApiResponse<{ withdraw: AdminMerchantWithdrawItem }>
    >(`/admin/withdraws/${id}/mark-paid`, data),
};

// ==================== Admin 争议预约管理 ====================
export const adminDisputeApi = {
  // 争议预约列表
  list: (params?: { page?: number; pageSize?: number }) =>
    api.get("/admin/disputed-bookings", { params }),
  // 争议预约详情
  detail: (id: string | number) => api.get(`/admin/disputed-bookings/${id}`),
  // 处理争议
  resolve: (
    id: string | number,
    data: { resolution: string; reason?: string; refundRate?: number },
  ) => api.post(`/admin/disputed-bookings/${id}/resolve`, data),
};

export const providerApi = {
  designers: (params?: any) => api.get("/designers", { params }),
  companies: (params?: any) => api.get("/companies", { params }),
  foremen: (params?: any) => api.get("/foremen", { params }),
};

export const escrowApi = {
  detail: (projectId: string | number) =>
    api.get(`/projects/${projectId}/escrow`),
  deposit: (projectId: string | number, data: any) =>
    api.post(`/projects/${projectId}/deposit`, data),
  release: (projectId: string | number, data: any) =>
    api.post(`/projects/${projectId}/release`, data),
};

// ==================== Admin 管理接口 ====================

// 统计 API
export const adminStatsApi = {
  overview: () => api.get("/admin/stats/overview"),
  trends: (params?: { days?: number }) =>
    api.get("/admin/stats/trends", { params }),
  distribution: () => api.get("/admin/stats/distribution"),
};

// 用户管理
export const adminUserApi = {
  list: (params?: {
    page?: number;
    pageSize?: number;
    keyword?: string;
    userType?: number;
    roleType?: string;
  }) =>
    api.get<
      AdminApiResponse<AdminListData<AdminUserListItem>>,
      AdminApiResponse<AdminListData<AdminUserListItem>>
    >("/admin/users", { params }),
  detail: (id: number) => api.get(`/admin/users/${id}`),
  create: (data: any) => api.post("/admin/users", data),
  update: (id: number, data: any) => api.put(`/admin/users/${id}`, data),
  updateStatus: (id: number, status: number) =>
    api.patch(`/admin/users/${id}/status`, { status }),
  delete: (id: number) => api.delete(`/admin/users/${id}`),
  batchDelete: (userIds: number[], verificationText: string) =>
    api.post("/admin/users/batch-delete", { userIds, verificationText }),
};

export type AdminAccountStatus = "unbound" | "active" | "disabled";
export type AdminLoginStatus =
  | "unbound"
  | "enabled"
  | "disabled_by_account"
  | "disabled_by_entity";
export type AdminOperatingStatus =
  | "unopened"
  | "restricted"
  | "active"
  | "frozen";
export type AdminOnboardingStatus =
  | "none"
  | "required"
  | "pending_review"
  | "rejected"
  | "approved";

export interface AdminUserListItem {
  id: number;
  phone: string;
  nickname: string;
  avatar?: string;
  userType: number;
  roleType?: string;
  roleLabel?: string;
  status: number;
  primaryEntityType?: "provider" | "material_shop";
  primaryEntityId?: number;
  primaryEntityName?: string;
  createdAt: string;
}

export interface AdminProviderListItem {
  id: number;
  userId: number;
  providerType: number;
  subType: string;
  entityType?: string;
  companyName: string;
  realName?: string;
  rating: number;
  verified: boolean;
  status: number;
  specialty: string;
  yearsExperience: number;
  createdAt: string;
  restoreRate?: number;
  budgetControl?: number;
  priceMin: number;
  priceMax: number;
  priceUnit: string;
  coverImage: string;
  serviceIntro: string;
  teamSize: number;
  establishedYear: number;
  certifications: string;
  serviceArea: string;
  isSettled?: boolean;
  collectedSource?: string;
  sourceLabel?: string;
  accountBound?: boolean;
  accountStatus?: AdminAccountStatus;
  loginStatus?: AdminLoginStatus;
  loginEnabled?: boolean;
  completionRequired?: boolean;
  onboardingStatus?: AdminOnboardingStatus;
  operatingStatus?: AdminOperatingStatus;
  operatingEnabled?: boolean;
  platformDisplayEnabled?: boolean;
  merchantDisplayEnabled?: boolean;
  completionApplicationId?: number;
  visibility?: AdminAuditVisibility;
  actions?: AdminAuditActions;
  legacyInfo?: AdminAuditLegacyInfo;
  governanceTier?: string;
  scoreSummary?: {
    responseRate?: number;
    proposalRate?: number;
    designConfirmRate?: number;
    constructionConfirmRate?: number;
    completionRate?: number;
    acceptancePassRate?: number;
    complaintRate?: number;
    refundRate?: number;
    caseCount?: number;
    officialReviewCount?: number;
  };
  riskFlags?: string[];
  recommendedAction?: string;
  funnelMetrics?: {
    bookingsTotal?: number;
    respondedBookings?: number;
    proposalSubmittedCount?: number;
    designConfirmedCount?: number;
    constructionConfirmedCount?: number;
    completedProjectCount?: number;
  };
}

export interface AdminMaterialShopListItem {
  id: number;
  userId?: number;
  status?: number | null;
  type: string;
  name: string;
  companyName?: string;
  contactName?: string;
  contactPhone?: string;
  cover: string;
  brandLogo: string;
  rating: number;
  reviewCount: number;
  mainProducts: string;
  productCategories: string;
  address: string;
  latitude: number;
  longitude: number;
  openTime: string;
  tags: string;
  isVerified: boolean;
  isSettled?: boolean;
  collectedSource?: string;
  userPhone?: string;
  userNickname?: string;
  accountBound?: boolean;
  accountStatus?: AdminAccountStatus;
  loginStatus?: AdminLoginStatus;
  loginEnabled?: boolean;
  completionRequired?: boolean;
  onboardingStatus?: AdminOnboardingStatus;
  operatingStatus?: AdminOperatingStatus;
  operatingEnabled?: boolean;
  platformDisplayEnabled?: boolean;
  merchantDisplayEnabled?: boolean;
  completionApplicationId?: number;
  sourceLabel?: string;
  sourceApplicationId?: number;
  createdAt: string;
  visibility?: AdminAuditVisibility;
  actions?: AdminAuditActions;
  legacyInfo?: AdminAuditLegacyInfo;
}

export interface AdminMaterialShopAccountCompletionResult {
  shopId: number;
  userId: number;
  phone: string;
  createdUser: boolean;
  accountBound?: boolean;
  sourceLabel: string;
  loginEnabled: boolean;
  completionRequired?: boolean;
  onboardingStatus?: string;
  operatingEnabled?: boolean;
  completionApplicationId?: number;
}

export interface AdminProviderSettlementResult {
  providerId: number;
  userId: number;
  sourceLabel: string;
  accountBound?: boolean;
  loginEnabled: boolean;
  completionRequired?: boolean;
  onboardingStatus?: string;
  phone?: string;
  createdUser?: boolean;
}

// 服务商管理
export const adminProviderApi = {
  list: (params?: {
    page?: number;
    pageSize?: number;
    type?: number;
    verified?: boolean;
    isSettled?: boolean;
    accountStatus?: AdminAccountStatus;
    onboardingStatus?: AdminOnboardingStatus;
    operatingStatus?: AdminOperatingStatus;
  }) =>
    api.get<
      AdminApiResponse<AdminListData<AdminProviderListItem>>,
      AdminApiResponse<AdminListData<AdminProviderListItem>>
    >("/admin/providers", { params }),
  detail: (id: number) => api.get(`/admin/providers/${id}`),
  create: (data: any) => api.post("/admin/providers", data),
  update: (id: number, data: any) => api.put(`/admin/providers/${id}`, data),
  verify: (id: number, verified: boolean) =>
    api.patch(`/admin/providers/${id}/verify`, { verified }),
  updateStatus: (id: number, status: number) =>
    api.patch(`/admin/providers/${id}/status`, { status }),
  updatePlatformDisplay: (id: number, enabled: boolean) =>
    api.patch(`/admin/providers/${id}/platform-display`, { enabled }),
  claimAccount: (
    id: number,
    data: {
      phone: string;
      contactName?: string;
      nickname?: string;
      reason?: string;
      recentReauthProof?: string;
    },
  ) =>
    api.post<
      AdminApiResponse<AdminProviderSettlementResult>,
      AdminApiResponse<AdminProviderSettlementResult>
    >(`/admin/providers/${id}/claim-account`, data),
  completeSettlement: (id: number) =>
    api.post<
      AdminApiResponse<AdminProviderSettlementResult>,
      AdminApiResponse<AdminProviderSettlementResult>
    >(`/admin/providers/${id}/complete-settlement`),
};

// 主材门店管理
export const adminMaterialShopApi = {
  list: (params?: {
    page?: number;
    pageSize?: number;
    type?: string;
    isSettled?: boolean;
    accountStatus?: AdminAccountStatus;
    onboardingStatus?: AdminOnboardingStatus;
    operatingStatus?: AdminOperatingStatus;
  }) =>
    api.get<
      AdminApiResponse<AdminListData<AdminMaterialShopListItem>>,
      AdminApiResponse<AdminListData<AdminMaterialShopListItem>>
    >("/admin/material-shops", { params }),
  detail: (id: number) => api.get(`/admin/material-shops/${id}`),
  create: (data: any) => api.post("/admin/material-shops", data),
  update: (id: number, data: any) =>
    api.put(`/admin/material-shops/${id}`, data),
  delete: (id: number) => api.delete(`/admin/material-shops/${id}`),
  verify: (id: number, verified: boolean) =>
    api.patch(`/admin/material-shops/${id}/verify`, { verified }),
  updateStatus: (id: number, status: number) =>
    api.patch(`/admin/material-shops/${id}/status`, { status }),
  updatePlatformDisplay: (id: number, enabled: boolean) =>
    api.patch(`/admin/material-shops/${id}/platform-display`, { enabled }),
  completeAccount: (
    id: number,
    data: {
      phone: string;
      contactName?: string;
      nickname?: string;
      reason?: string;
      recentReauthProof?: string;
    },
  ) =>
    api.post<
      AdminApiResponse<AdminMaterialShopAccountCompletionResult>,
      AdminApiResponse<AdminMaterialShopAccountCompletionResult>
    >(`/admin/material-shops/${id}/complete-account`, data),
};

// 预约管理
export const adminBookingApi = {
  list: (params?: { page?: number; pageSize?: number; status?: number }) =>
    api.get("/admin/bookings", { params }),
  detail: (id: number) => api.get(`/admin/bookings/${id}`),
  updateStatus: (id: number, status: number) =>
    api.patch(`/admin/bookings/${id}/status`, { status }),
};

// 评价管理
export const adminReviewApi = {
  list: (params?: { page?: number; pageSize?: number; providerId?: number }) =>
    api.get("/admin/reviews", { params }),
  delete: (id: number) => api.delete(`/admin/reviews/${id}`),
};

// 操作日志
export const adminLogApi = {
  list: (params?: {
    page?: number;
    pageSize?: number;
    adminId?: number;
    action?: string;
  }) => api.get("/admin/logs", { params }),
};

export const adminAuditLogApi = {
  list: (params?: AdminAuditLogQuery) =>
    api.get<
      AdminApiResponse<AdminListData<AdminAuditLogRecord>>,
      AdminApiResponse<AdminListData<AdminAuditLogRecord>>
    >("/admin/audit-logs", { params }),
  export: (params?: Omit<AdminAuditLogQuery, "page" | "pageSize">) =>
    api.get<Blob, Blob>("/admin/audit-logs/export", {
      params,
      responseType: "blob",
    }),
};

// 管理员管理
export const adminManageApi = {
  list: (params?: { page?: number; pageSize?: number; keyword?: string }) =>
    api.get("/admin/admins", { params }),
  create: (data: any) => api.post("/admin/admins", data),
  update: (id: number, data: any) => api.put(`/admin/admins/${id}`, data),
  delete: (id: number, data?: any) =>
    api.delete(`/admin/admins/${id}`, { data }),
  updateStatus: (
    id: number,
    data: {
      status: number;
      reason?: string;
      disabledReason?: string;
      recentReauthProof?: string;
    },
  ) => api.patch(`/admin/admins/${id}/status`, data),
};

// 角色管理
export const adminRoleApi = {
  list: () => api.get("/admin/roles"),
  create: (data: any) => api.post("/admin/roles", data),
  update: (id: number, data: any) => api.put(`/admin/roles/${id}`, data),
  delete: (id: number, data?: any) =>
    api.delete(`/admin/roles/${id}`, { data }),
  getMenus: (id: number) => api.get(`/admin/roles/${id}/menus`),
  assignMenus: (
    id: number,
    menuIds: number[],
    extra?: { reason?: string; recentReauthProof?: string },
  ) => api.post(`/admin/roles/${id}/menus`, { menuIds, ...extra }),
};

// 菜单管理
export const adminMenuApi = {
  list: () => api.get("/admin/menus"),
  create: (data: any) => api.post("/admin/menus", data),
  update: (id: number, data: any) => api.put(`/admin/menus/${id}`, data),
  delete: (id: number, data?: any) =>
    api.delete(`/admin/menus/${id}`, { data }),
};

export interface IdentityApplicationItem {
  id: number;
  userId: number;
  identityType: string;
  providerSubType?: "designer" | "company" | "foreman";
  status: number; // 0=pending,1=approved,2=rejected,3=suspended
  rejectReason?: string;
  appliedAt: string;
  reviewedAt?: string;
  reviewedBy?: number;
  visibility?: AdminAuditVisibility;
  actions?: AdminAuditActions;
  legacyInfo?: AdminAuditLegacyInfo;

  // 商家入驻扩展字段（仅当 identityType=provider 时存在）
  merchantDetails?: MerchantApplicationDetails;
}

// 作品案例展示
export interface PortfolioCaseDisplay {
  title: string;
  description?: string;
  images: string[];
  style: string;
  area: string | number;
}

export interface BusinessHoursRange {
  day: number;
  start: string;
  end: string;
}

// 商家入驻详细信息
export interface MerchantApplicationDetails {
  // 基础信息
  phone: string;
  applicantType: string; // personal, studio, company, foreman
  role: string; // designer, foreman, company
  entityType: string; // personal, company

  // 个人/负责人信息
  realName: string;
  avatar?: string;
  idCardNo: string; // 审核展示值
  idCardFront: string; // 身份证正面 URL
  idCardBack: string; // 身份证反面 URL
  legalPersonName?: string;
  legalPersonIdCardNo?: string;
  legalPersonIdCardFront?: string;
  legalPersonIdCardBack?: string;

  // 公司信息
  companyName?: string;
  licenseNo?: string;
  licenseImage?: string;
  teamSize?: number;
  officeAddress?: string;
  companyAlbum?: string[];

  // 工长扩展信息
  yearsExperience?: number;

  // 服务信息
  serviceArea?: string[]; // 服务城市名称数组
  serviceAreaCodes?: string[]; // 服务城市代码数组
  styles?: string[];
  highlightTags?: string[];
  pricing?: Record<string, number>;
  introduction?: string;
  graduateSchool?: string;
  designPhilosophy?: string;
  portfolioCases?: PortfolioCaseDisplay[];
}

export interface AdminMerchantApplicationListItem {
  id: number;
  phone: string;
  role: string;
  entityType: string;
  applicationScene?: "new_onboarding" | "claimed_completion";
  realName: string;
  companyName?: string;
  status: number;
  rejectReason?: string;
  createdAt: string;
  auditedAt?: string;
  visibility?: AdminAuditVisibility;
  actions?: AdminAuditActions;
  legacyInfo?: AdminAuditLegacyInfo;
}

export interface AdminMerchantApplicationDetail
  extends AdminMerchantApplicationListItem, MerchantApplicationDetails {
  merchantKind?: "provider";
  sourceApplicationId?: number;
  auditedBy?: number;
  visibility?: AdminAuditVisibility;
  actions?: AdminAuditActions;
  legacyInfo?: AdminAuditLegacyInfo;
}

export interface MaterialShopApplicationProductItem {
  id: number;
  name: string;
  unit: string;
  description?: string;
  price: number;
  images: string[];
  sortOrder: number;
}

export interface AdminMaterialShopApplicationListItem {
  id: number;
  phone: string;
  entityType: string;
  applicationScene?: "new_onboarding" | "claimed_completion";
  shopName: string;
  companyName?: string;
  contactName: string;
  contactPhone: string;
  status: number;
  rejectReason?: string;
  createdAt: string;
  auditedAt?: string;
  visibility?: AdminAuditVisibility;
  actions?: AdminAuditActions;
  legacyInfo?: AdminAuditLegacyInfo;
}

export interface AdminMaterialShopApplicationDetail extends AdminMaterialShopApplicationListItem {
  merchantKind?: "material_shop";
  sourceApplicationId?: number;
  businessLicenseNo?: string;
  businessLicense: string;
  legalPersonName: string;
  legalPersonIdCardNo?: string;
  legalPersonIdCardFront: string;
  legalPersonIdCardBack: string;
  businessHours?: string;
  businessHoursRanges?: BusinessHoursRange[];
  address?: string;
  shopDescription?: string;
  auditedBy?: number;
  products: MaterialShopApplicationProductItem[];
  visibility?: AdminAuditVisibility;
  actions?: AdminAuditActions;
  legacyInfo?: AdminAuditLegacyInfo;
}

export interface AdminAuditVisibilityBlocker {
  code: string;
  message: string;
}

export interface AdminAuditVisibilityPreview {
  publicVisible: boolean;
  blockers: AdminAuditVisibilityBlocker[];
  message: string;
}

export interface AdminAuditLegacyInfo {
  isLegacyPath: boolean;
  notes: string[];
}

export interface AdminAuditVisibilityEntitySnapshot {
  providerId?: number;
  providerVerified?: boolean;
  providerStatus?: number;
  shopId?: number;
  shopVerified?: boolean;
  caseId?: number;
  showInInspiration?: boolean;
}

export interface AdminAuditVisibility {
  currentLabel: string;
  publicVisible: boolean;
  blockers: AdminAuditVisibilityBlocker[];
  distributionStatus?:
    | "active"
    | "hidden_by_platform"
    | "hidden_by_merchant"
    | "blocked_by_operating"
    | "blocked_by_qualification";
  primaryBlockerCode?: string;
  primaryBlockerMessage?: string;
  platformDisplayEditable?: boolean;
  merchantDisplayEditable?: boolean;
  previewAfterApprove?: AdminAuditVisibilityPreview;
  entitySnapshot?: AdminAuditVisibilityEntitySnapshot;
}

export interface AdminAuditActions {
  rejectResubmittable: boolean;
}

export interface AdminApiResponse<T = unknown> {
  code: number;
  message?: string;
  data?: T;
}

export interface AdminListData<T> {
  list?: T[];
  total?: number;
}

export const adminMerchantApplicationApi = {
  list: (params?: {
    page?: number;
    pageSize?: number;
    status?: number;
    keyword?: string;
  }) =>
    api.get<
      AdminApiResponse<AdminListData<AdminMerchantApplicationListItem>>,
      AdminApiResponse<AdminListData<AdminMerchantApplicationListItem>>
    >("/admin/merchant-applications", { params }),
  detail: (id: number) =>
    api.get<
      AdminApiResponse<AdminMerchantApplicationDetail>,
      AdminApiResponse<AdminMerchantApplicationDetail>
    >(`/admin/merchant-applications/${id}`),
  approve: (id: number) =>
    api.post<AdminApiResponse, AdminApiResponse>(
      `/admin/merchant-applications/${id}/approve`,
    ),
  reject: (id: number, reason: string) =>
    api.post<AdminApiResponse, AdminApiResponse>(
      `/admin/merchant-applications/${id}/reject`,
      { reason },
    ),
};

export const adminMaterialShopApplicationApi = {
  list: (params?: {
    page?: number;
    pageSize?: number;
    status?: number;
    keyword?: string;
  }) =>
    api.get<
      AdminApiResponse<AdminListData<AdminMaterialShopApplicationListItem>>,
      AdminApiResponse<AdminListData<AdminMaterialShopApplicationListItem>>
    >("/admin/material-shop-applications", { params }),
  detail: (id: number) =>
    api.get<
      AdminApiResponse<AdminMaterialShopApplicationDetail>,
      AdminApiResponse<AdminMaterialShopApplicationDetail>
    >(`/admin/material-shop-applications/${id}`),
  approve: (id: number) =>
    api.post<AdminApiResponse, AdminApiResponse>(
      `/admin/material-shop-applications/${id}/approve`,
    ),
  reject: (id: number, reason: string) =>
    api.post<AdminApiResponse, AdminApiResponse>(
      `/admin/material-shop-applications/${id}/reject`,
      { reason },
    ),
};

// 身份申请审核
export const adminIdentityApplicationApi = {
  list: (params?: { page?: number; pageSize?: number; status?: number }) =>
    api.get("/admin/identity-applications", { params }),
  detail: (id: number) => api.get(`/admin/identity-applications/${id}`),
  approve: (id: number) =>
    api.post(`/admin/identity-applications/${id}/approve`),
  reject: (id: number, reason: string) =>
    api.post(`/admin/identity-applications/${id}/reject`, { reason }),
};

// 审核管理
export const adminAuditApi = {
  providers: (params?: { page?: number; pageSize?: number; status?: number }) =>
    api.get("/admin/audits/providers", { params }),
  materialShops: (params?: {
    page?: number;
    pageSize?: number;
    status?: number;
  }) => api.get("/admin/audits/material-shops", { params }),
  approve: (type: string, id: number, data: any) =>
    api.post(`/admin/audits/${type}/${id}/approve`, data),
  reject: (type: string, id: number, data: any) =>
    api.post(`/admin/audits/${type}/${id}/reject`, data),
};

// 财务管理
export const adminFinanceApi = {
  overview: () =>
    api.get<
      AdminApiResponse<AdminFinanceOverviewData>,
      AdminApiResponse<AdminFinanceOverviewData>
    >("/admin/finance/overview"),
  escrowAccounts: (params?: { page?: number; pageSize?: number }) =>
    api.get<
      AdminApiResponse<AdminEscrowAccountListData>,
      AdminApiResponse<AdminEscrowAccountListData>
    >("/admin/finance/escrow-accounts", { params }),
  transactions: (params?: AdminFinanceTransactionQuery) =>
    api.get<
      AdminApiResponse<
        AdminListData<AdminFinanceTransactionItem> & {
          page?: number;
          pageSize?: number;
        }
      >,
      AdminApiResponse<
        AdminListData<AdminFinanceTransactionItem> & {
          page?: number;
          pageSize?: number;
        }
      >
    >("/admin/finance/transactions", { params }),
  reconciliations: (params?: AdminFinanceReconciliationQuery) =>
    api.get<
      AdminApiResponse<
        AdminListData<AdminFinanceReconciliationItem> & {
          page?: number;
          pageSize?: number;
        }
      >,
      AdminApiResponse<
        AdminListData<AdminFinanceReconciliationItem> & {
          page?: number;
          pageSize?: number;
        }
      >
    >("/admin/finance/reconciliations", { params }),
  reconciliationItems: (id: number) =>
    api.get<
      AdminApiResponse<{ list?: AdminFinanceReconciliationDetailItem[] }>,
      AdminApiResponse<{ list?: AdminFinanceReconciliationDetailItem[] }>
    >(`/admin/finance/reconciliations/${id}/items`),
  runReconciliation: (date?: string) =>
    api.post<
      AdminApiResponse<{ item?: AdminFinanceReconciliationItem }>,
      AdminApiResponse<{ item?: AdminFinanceReconciliationItem }>
    >("/admin/finance/reconciliations/run", null, {
      params: date ? { date } : undefined,
    }),
  claimReconciliation: (id: number, note?: string) =>
    api.post<
      AdminApiResponse<{ item?: AdminFinanceReconciliationItem }>,
      AdminApiResponse<{ item?: AdminFinanceReconciliationItem }>
    >(`/admin/finance/reconciliations/${id}/claim`, { note }),
  resolveReconciliation: (id: number, note: string) =>
    api.post<
      AdminApiResponse<{ item?: AdminFinanceReconciliationItem }>,
      AdminApiResponse<{ item?: AdminFinanceReconciliationItem }>
    >(`/admin/finance/reconciliations/${id}/resolve`, { note }),
  exportTransactions: (
    params?: Omit<AdminFinanceTransactionQuery, "page" | "pageSize">,
  ) =>
    api.get<Blob, Blob>("/admin/finance/transactions/export", {
      params,
      responseType: "blob",
    }),
  freeze: (data: FreezeFundsInput) =>
    api.post<AdminApiResponse, AdminApiResponse>("/admin/finance/freeze", data),
  unfreeze: (data: UnfreezeFundsInput) =>
    api.post<AdminApiResponse, AdminApiResponse>(
      "/admin/finance/unfreeze",
      data,
    ),
  manualRelease: (data: ManualReleaseInput) =>
    api.post<AdminApiResponse, AdminApiResponse>(
      "/admin/finance/manual-release",
      data,
    ),
  payouts: (params?: {
    page?: number;
    pageSize?: number;
    status?: string;
    providerId?: number;
  }) =>
    api.get<
      AdminApiResponse<
        AdminListData<AdminFinancePayoutItem> & {
          page?: number;
          pageSize?: number;
        }
      >,
      AdminApiResponse<
        AdminListData<AdminFinancePayoutItem> & {
          page?: number;
          pageSize?: number;
        }
      >
    >("/admin/finance/payouts", { params }),
  payoutDetail: (id: number) =>
    api.get<
      AdminApiResponse<AdminFinancePayoutDetail>,
      AdminApiResponse<AdminFinancePayoutDetail>
    >(`/admin/finance/payouts/${id}`),
  retryPayout: (id: number) =>
    api.post<
      AdminApiResponse<{ item?: AdminFinancePayoutItem }>,
      AdminApiResponse<{ item?: AdminFinancePayoutItem }>
    >(`/admin/finance/payouts/${id}/retry`),
  settlements: (params?: {
    page?: number;
    pageSize?: number;
    status?: string;
    providerId?: number;
  }) =>
    api.get<
      AdminApiResponse<
        AdminListData<AdminSettlementItem> & {
          page?: number;
          pageSize?: number;
        }
      >,
      AdminApiResponse<
        AdminListData<AdminSettlementItem> & {
          page?: number;
          pageSize?: number;
        }
      >
    >("/admin/finance/settlements", { params }),
  retrySettlement: (id: number) =>
    api.post<
      AdminApiResponse<{ item?: AdminSettlementItem }>,
      AdminApiResponse<{ item?: AdminSettlementItem }>
    >(`/admin/finance/settlements/${id}/retry`),
  bondRules: () =>
    api.get<
      AdminApiResponse<{ list?: AdminBondRuleItem[] }>,
      AdminApiResponse<{ list?: AdminBondRuleItem[] }>
    >("/admin/finance/bond-rules"),
  updateBondRule: (id: number, data: Partial<AdminBondRuleItem>) =>
    api.put<
      AdminApiResponse<{ item?: AdminBondRuleItem }>,
      AdminApiResponse<{ item?: AdminBondRuleItem }>
    >(`/admin/finance/bond-rules/${id}`, data),
  bondAccounts: (params?: {
    page?: number;
    pageSize?: number;
    status?: string;
    providerId?: number;
  }) =>
    api.get<
      AdminApiResponse<
        AdminListData<AdminBondAccountItem> & {
          page?: number;
          pageSize?: number;
        }
      >,
      AdminApiResponse<
        AdminListData<AdminBondAccountItem> & {
          page?: number;
          pageSize?: number;
        }
      >
    >("/admin/finance/bond-accounts", { params }),
  refundBondAccount: (id: number, data: AdminBondAdjustInput) =>
    api.post<
      AdminApiResponse<{ item?: AdminBondAccountItem }>,
      AdminApiResponse<{ item?: AdminBondAccountItem }>
    >(`/admin/finance/bond-accounts/${id}/refund`, data),
  forfeitBondAccount: (id: number, data: AdminBondAdjustInput) =>
    api.post<
      AdminApiResponse<{ item?: AdminBondAccountItem }>,
      AdminApiResponse<{ item?: AdminBondAccountItem }>
    >(`/admin/finance/bond-accounts/${id}/forfeit`, data),
  withdraw: (accountId: number, data: any) =>
    api.post(`/admin/finance/escrow-accounts/${accountId}/withdraw`, data),
};

// 风险管理
export const adminRiskApi = {
  warnings: (params?: AdminRiskWarningQuery) =>
    api.get<
      AdminApiResponse<AdminListData<AdminRiskWarningItem>>,
      AdminApiResponse<AdminListData<AdminRiskWarningItem>>
    >("/admin/risk/warnings", { params }),
  handleWarning: (id: number, data: AdminHandleRiskWarningInput) =>
    api.post<AdminApiResponse, AdminApiResponse>(
      `/admin/risk/warnings/${id}/handle`,
      data,
    ),
};

export const adminLegacyRiskApi = {
  arbitrations: (params?: {
    page?: number;
    pageSize?: number;
    status?: number;
  }) => api.get("/admin/risk/arbitrations", { params }),
  updateArbitration: (id: number, data: any) =>
    api.put(`/admin/risk/arbitrations/${id}`, data),
};

// 系统设置
export const adminSettingsApi = {
  get: () => api.get("/admin/settings"),
  update: (data: any) => api.put("/admin/settings", data),
};

export interface AdminSystemConfigItem {
  key: string;
  value: string;
  description?: string;
}

export const adminSystemConfigApi = {
  list: () => api.get("/admin/system-configs"),
  batchUpdate: (data: Record<string, string>) =>
    api.put("/admin/system-configs/batch", data),
};

// 数据导出
export const adminExportApi = {
  users: (params?: any) =>
    api.get("/admin/export/users", { params, responseType: "blob" }),
  providers: (params?: any) =>
    api.get("/admin/export/providers", { params, responseType: "blob" }),
  projects: (params?: any) =>
    api.get("/admin/export/projects", { params, responseType: "blob" }),
};

// 作品审核
export const caseAuditApi = {
  list: (params?: any) => api.get("/admin/audits/cases", { params }),
  detail: (id: number) => api.get(`/admin/audits/cases/${id}`),
  approve: (id: number) => api.post(`/admin/audits/cases/${id}/approve`),
  reject: (id: number, reason: string) =>
    api.post(`/admin/audits/cases/${id}/reject`, { reason }),
};

// 作品管理
export const caseApi = {
  list: (params?: {
    page?: number;
    pageSize?: number;
    providerId?: string;
    style?: string;
  }) => api.get("/admin/cases", { params }),
  detail: (id: number) => api.get(`/admin/cases/${id}`),
  create: (data: any) => api.post("/admin/cases", data),
  update: (id: number, data: any) => api.put(`/admin/cases/${id}`, data),
  toggleInspiration: (id: number, showInInspiration: boolean) =>
    api.patch(`/admin/cases/${id}/inspiration`, { showInInspiration }),
  delete: (id: number) => api.delete(`/admin/cases/${id}`),
};

export interface AdminUploadResult {
  url: string;
  path: string;
}

export const adminUploadApi = {
  uploadImage: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    return api.post("/admin/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  },
  uploadImageData: async (file: File) => {
    const result = (await adminUploadApi.uploadImage(file)) as unknown as {
      code: number;
      message?: string;
      data?: AdminUploadResult;
    };

    if (result.code === 0 && result.data) {
      return result.data;
    }

    throw new AdminApiError(result.message || "上传失败");
  },
};

// 通知系统
export const notificationApi = {
  list: (params?: { page?: number; pageSize?: number }) =>
    api.get("/admin/notifications", { params }),
  getUnreadCount: () => api.get("/admin/notifications/unread-count"),
  markAsRead: (id: number) => api.put(`/admin/notifications/${id}/read`),
  markAllAsRead: () => api.put("/admin/notifications/read-all"),
  delete: (id: number) => api.delete(`/admin/notifications/${id}`),
};

// 身份管理
export const identityApi = {
  list: () => api.get("/identities"),
  getCurrent: () => api.get("/identities/current"),
  switch: (data: {
    identityId?: number;
    targetRole?: string;
    currentRole?: string;
  }) => api.post("/identities/switch", data),
  apply: (data: {
    identityType: "provider";
    providerSubType: "designer" | "company" | "foreman";
    applicationData?: string;
  }) => api.post("/identities/apply", data),
};

export default api;
