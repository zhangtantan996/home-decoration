import api from "./api";

type ApiEnvelope<T> = {
  code?: number;
  message?: string;
  data?: T;
};

const unwrapData = async <T>(request: Promise<ApiEnvelope<T>>): Promise<T> => {
  const response = await request;
  if (response.code !== 0 || response.data === undefined) {
    throw new Error(response.message || "请求失败");
  }
  return response.data;
};

// ============ Auth ============

export const supervisorAuthApi = {
  sendCode: (phone: string) =>
    unwrapData<{
      expiresIn?: number;
      requestId?: string;
      debugCode?: string;
      debugOnly?: boolean;
    }>(
      api.post("/supervisor/send-code", {
        phone,
        purpose: "supervisor_login",
      }) as Promise<
        ApiEnvelope<{
          expiresIn?: number;
          requestId?: string;
          debugCode?: string;
          debugOnly?: boolean;
        }>
      >,
    ),

  login: (phone: string, code: string) =>
    api.post("/supervisor/login", { phone, code }),
};

// ============ Onboarding ============

export interface SupervisorOnboardingStatus {
  status: "required" | "pending_review" | "rejected" | "approved";
  message?: string;
  applicationId?: number;
  rejectReason?: string;
  formData?: any;
}

export interface ServiceCityOption {
  code: string;
  name: string;
}

export const supervisorOnboardingApi = {
  sendCode: (phone: string) =>
    unwrapData<{ message?: string }>(
      api.post("/supervisor/onboarding/send-code", { phone }) as Promise<
        ApiEnvelope<{ message?: string }>
      >,
    ),

  checkEligibility: (phone: string) =>
    unwrapData<{ status: string }>(
      api.get("/supervisor/onboarding/check-eligibility", {
        params: { phone },
      }) as Promise<ApiEnvelope<{ status: string }>>,
    ),

  uploadImage: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return unwrapData<{ url: string; path: string }>(
      api.post("/supervisor/onboarding/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      }) as Promise<ApiEnvelope<{ url: string; path: string }>>,
    );
  },

  getStatus: (phone: string) =>
    unwrapData<SupervisorOnboardingStatus>(
      api.get("/supervisor/onboarding/status", {
        params: { phone },
      }) as Promise<ApiEnvelope<SupervisorOnboardingStatus>>,
    ),

  submit: (phone: string, code: string, form: Record<string, unknown>) =>
    unwrapData<{ status: string; applicationId: number; message?: string }>(
      api.post("/supervisor/onboarding/submit", {
        phone,
        code,
        form,
      }) as Promise<
        ApiEnvelope<{ status: string; applicationId: number; message?: string }>
      >,
    ),

  listServiceCities: () =>
    unwrapData<ServiceCityOption[]>(
      api.get("/regions/service-cities") as Promise<
        ApiEnvelope<ServiceCityOption[]>
      >,
    ),

  listDistrictsByCity: (cityCode: string) =>
    unwrapData<ServiceCityOption[]>(
      api.get(`/regions/cities/${cityCode}/districts`) as Promise<
        ApiEnvelope<ServiceCityOption[]>
      >,
    ),
};

// ============ Profile ============

export const supervisorProfileApi = {
  getInfo: () =>
    unwrapData(api.get("/supervisor/info") as Promise<ApiEnvelope<unknown>>),
};

// ============ Dashboard ============

export const supervisorDashboardApi = {
  getDashboard: () =>
    unwrapData<{
      totalProjects: number;
      recentProjects: SupervisionProjectListItem[];
    }>(
      api.get("/supervisor/dashboard") as Promise<
        ApiEnvelope<{
          totalProjects: number;
          recentProjects: SupervisionProjectListItem[];
        }>
      >,
    ),
};

// ============ Projects ============

export interface SupervisionProjectListItem {
  id: number;
  name: string;
  address: string;
  ownerName: string;
  providerName: string;
  businessStage: string;
  kickoffStatus: string;
  plannedStartDate: string | null;
  currentResponsible: string;
  currentPhase: string;
  currentPhaseStatus: string;
  lastLogAt: string | null;
  latestLogTitle: string;
  unhandledRiskCount: number;
}

export interface SupervisionProjectWorkspace {
  projectId: number;
  name: string;
  address: string;
  ownerName: string;
  providerName: string;
  businessStage: string;
  kickoffStatus: string;
  plannedStartDate: string | null;
  currentResponsible: string;
  currentPhase: string;
  currentPhaseStatus: string;
  lastInspectionAt: string | null;
  latestLogTitle: string;
  unhandledRiskCount: number;
  riskWarnings: RiskWarning[];
}

export interface RiskWarning {
  id: number;
  projectId: number;
  type: string;
  level: string;
  description: string;
  status: number;
  createdAt: string;
}

export const supervisorProjectApi = {
  list: (params?: {
    page?: number;
    pageSize?: number;
    keyword?: string;
    phaseStatus?: string;
    businessStage?: string;
    hasPendingRisk?: boolean;
  }) =>
    unwrapData<{
      list: SupervisionProjectListItem[];
      total: number;
      page: number;
      pageSize: number;
    }>(
      api.get("/supervisor/projects", { params }) as Promise<
        ApiEnvelope<{
          list: SupervisionProjectListItem[];
          total: number;
          page: number;
          pageSize: number;
        }>
      >,
    ),

  get: (id: number) =>
    unwrapData<SupervisionProjectWorkspace>(
      api.get(`/supervisor/projects/${id}`) as Promise<
        ApiEnvelope<SupervisionProjectWorkspace>
      >,
    ),

  getPhases: (id: number) =>
    unwrapData<{ phases: ProjectPhaseView[] }>(
      api.get(`/supervisor/projects/${id}/phases`) as Promise<
        ApiEnvelope<{ phases: ProjectPhaseView[] }>
      >,
    ),
};

// ============ Logs ============

export interface WorkLog {
  id: number;
  projectId: number;
  phaseId: number;
  title: string;
  description: string;
  photos: string;
  logDate: string;
  createdAt: string;
}

export const supervisorLogApi = {
  list: (
    projectId: number,
    params?: { page?: number; pageSize?: number; phaseId?: number },
  ) =>
    unwrapData<{
      list: WorkLog[];
      total: number;
      page: number;
      pageSize: number;
    }>(
      api.get(`/supervisor/projects/${projectId}/logs`, { params }) as Promise<
        ApiEnvelope<{
          list: WorkLog[];
          total: number;
          page: number;
          pageSize: number;
        }>
      >,
    ),

  uploadImage: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return unwrapData<{ url: string; path: string }>(
      api.post("/supervisor/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      }) as Promise<ApiEnvelope<{ url: string; path: string }>>,
    );
  },

  create: (
    projectId: number,
    phaseId: number,
    data: {
      title: string;
      description: string;
      photos?: string;
      logDate?: string;
    },
  ) =>
    unwrapData<{ log: WorkLog }>(
      api.post(
        `/supervisor/projects/${projectId}/phases/${phaseId}/logs`,
        data,
      ) as Promise<ApiEnvelope<{ log: WorkLog }>>,
    ),

  syncBatch: (
    projectId: number,
    drafts: {
      phaseId: number;
      description: string;
      photos: string[];
      offlineCreatedAt: string;
    }[],
  ) =>
    unwrapData<{
      results: { index: number; success: boolean; error?: string }[];
    }>(
      api.post(`/supervisor/projects/${projectId}/logs/sync`, {
        drafts,
      }) as Promise<
        ApiEnvelope<{
          results: { index: number; success: boolean; error?: string }[];
        }>
      >,
    ),
};

// ============ Phases ============

export interface ProjectPhaseView {
  id: number;
  projectId: number;
  phaseType: string;
  status: string;
  responsiblePerson: string;
  startDate: string | null;
  endDate: string | null;
  name: string;
}

export const supervisorPhaseApi = {
  update: (
    projectId: number,
    phaseId: number,
    data: {
      status?: string;
      responsiblePerson?: string;
      startDate?: string;
      endDate?: string;
    },
  ) =>
    unwrapData<{ phaseId: number }>(
      api.put(
        `/supervisor/projects/${projectId}/phases/${phaseId}`,
        data,
      ) as Promise<ApiEnvelope<{ phaseId: number }>>,
    ),

  updateTask: (
    projectId: number,
    phaseId: number,
    taskId: number,
    data: { completed?: boolean },
  ) =>
    unwrapData<{ taskId: number }>(
      api.put(
        `/supervisor/projects/${projectId}/phases/${phaseId}/tasks/${taskId}`,
        data,
      ) as Promise<ApiEnvelope<{ taskId: number }>>,
    ),
};

// ============ Risk Warnings ============

export const supervisorRiskApi = {
  create: (
    projectId: number,
    data: {
      type: string;
      level: string;
      description: string;
      phaseId?: number;
    },
  ) =>
    unwrapData<{ warning: RiskWarning }>(
      api.post(
        `/supervisor/projects/${projectId}/risk-warnings`,
        data,
      ) as Promise<ApiEnvelope<{ warning: RiskWarning }>>,
    ),
};
