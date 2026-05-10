import { api, type AdminApiResponse, type AdminListData } from './api';

// ========== 监理白名单管理 ==========

export interface AdminSupervisorWhitelistItem {
    id: number;
    phone: string;
    status: number;
    expiresAt?: string;
    note?: string;
    createdByAdminId: number;
    createdAt: string;
}

export const adminSupervisorWhitelistApi = {
    list: (params?: { page?: number; pageSize?: number; keyword?: string; status?: string }) =>
        api.get<
            AdminApiResponse<AdminListData<AdminSupervisorWhitelistItem>>,
            AdminApiResponse<AdminListData<AdminSupervisorWhitelistItem>>
        >("/admin/supervisor-whitelists", { params }),
    create: (data: { phone: string; expiresAt?: string; note?: string; reason?: string; recentReauthProof?: string }) =>
        api.post<
            AdminApiResponse<AdminSupervisorWhitelistItem>,
            AdminApiResponse<AdminSupervisorWhitelistItem>
        >("/admin/supervisor-whitelists", data),
    updateStatus: (id: number, status: number, reason?: string, recentReauthProof?: string) =>
        api.patch<AdminApiResponse, AdminApiResponse>(
            `/admin/supervisor-whitelists/${id}/status`,
            { status, reason, recentReauthProof },
        ),
};

// ========== 监理申请审核 ==========

export interface AdminSupervisorApplicationItem {
    id: number;
    phone: string;
    whitelistId: number;
    status: number;
    formJson: string;
    rejectReason?: string;
    reviewedByAdminId?: number;
    reviewedAt?: string;
    submittedAt: string;
    supervisorAccountId?: number;
    whitelistNote?: string;
}

export const adminSupervisorApplicationApi = {
    list: (params?: { page?: number; pageSize?: number; keyword?: string; status?: string }) =>
        api.get<
            AdminApiResponse<AdminListData<AdminSupervisorApplicationItem>>,
            AdminApiResponse<AdminListData<AdminSupervisorApplicationItem>>
        >("/admin/supervisor-applications", { params }),
    approve: (id: number, data?: { reason?: string; recentReauthProof?: string }) =>
        api.post<
            AdminApiResponse<{ applicationId: number; accountId: number; supervisorProfileId: number }>,
            AdminApiResponse<{ applicationId: number; accountId: number; supervisorProfileId: number }>
        >(`/admin/supervisor-applications/${id}/approve`, data || {}),
    reject: (id: number, data: { rejectReason: string; reason?: string; recentReauthProof?: string }) =>
        api.post<AdminApiResponse, AdminApiResponse>(
            `/admin/supervisor-applications/${id}/reject`,
            data,
        ),
};

// ========== 监理账号启停 ==========

export const adminSupervisorAccountApi = {
    updateStatus: (id: number, status: number, reason?: string, recentReauthProof?: string) =>
        api.patch<AdminApiResponse, AdminApiResponse>(
            `/admin/supervisor-accounts/${id}/status`,
            { status, reason, recentReauthProof },
        ),
};
