import axios from 'axios';

// 优先使用环境变量 (本地 Docker 开发)
// 其次根据运行环境动态判断 (生产部署)
const API_BASE_URL = import.meta.env.VITE_API_URL ||
    (window.location.hostname === 'localhost'
        ? 'http://localhost:8080/api/v1'
        : '/api/v1');

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// 请求拦截器
api.interceptors.request.use(
    (config) => {
        // 优先使用管理员token
        const adminToken = localStorage.getItem('admin_token');
        const token = adminToken || localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// 响应拦截器
api.interceptors.response.use(
    (response) => response.data,
    (error) => {
        // 如果是 401 错误且不在登录页面,清除认证信息并跳转
        if (error.response?.status === 401) {
            // 只有在非登录页面才跳转,避免干扰登录页面的错误提示
            if (!window.location.pathname.includes('/login')) {
                localStorage.removeItem('admin_token');
                localStorage.removeItem('admin_user');
                localStorage.removeItem('admin_permissions');
                localStorage.removeItem('admin_menus');
                window.location.href = '/admin/login';
            }
        }
        return Promise.reject(error);
    }
);

// API 接口定义
export const authApi = {
    login: (data: { phone: string; code: string }) => api.post('/auth/login', data),
    sendCode: (phone: string) => api.post('/auth/send-code', { phone }),
};

// ==================== Admin 管理员认证 ====================
export const adminAuthApi = {
    login: (data: { username: string; password: string }) => api.post('/admin/login', data),
    getInfo: () => api.get('/admin/info'),
};

export const projectApi = {
    list: (params?: any) => api.get('/projects', { params }), // 返回 { data: { list: [], total: 0 } }
    detail: (id: string | number) => api.get(`/projects/${id}`),
    logs: (id: string | number) => api.get(`/projects/${id}/logs`),
};

// ==================== Admin 项目管理 ====================
export const adminProjectApi = {
    // 项目列表和详情
    list: (params?: { page?: number; pageSize?: number; status?: number; keyword?: string }) =>
        api.get('/admin/projects', { params }),
    detail: (id: string | number) => api.get(`/admin/projects/${id}`),
    updateStatus: (id: string | number, data: { status: number; currentPhase?: string }) =>
        api.put(`/admin/projects/${id}/status`, data),

    // 阶段管理
    getPhases: (id: string | number) => api.get(`/admin/projects/${id}/phases`),
    updatePhase: (projectId: string | number, phaseId: string | number, data: any) =>
        api.put(`/admin/projects/${projectId}/phases/${phaseId}`, data),

    // 施工日志管理
    getLogs: (projectId: string | number, params?: { page?: number; pageSize?: number; phaseId?: string }) =>
        api.get(`/admin/projects/${projectId}/logs`, { params }),
    createLog: (projectId: string | number, phaseId: string | number, data: { title: string; description?: string; photos?: string; logDate?: string }) =>
        api.post(`/admin/projects/${projectId}/phases/${phaseId}/logs`, data),
    updateLog: (logId: string | number, data: { title?: string; description?: string; photos?: string; logDate?: string }) =>
        api.put(`/admin/logs/${logId}`, data),
    deleteLog: (logId: string | number) => api.delete(`/admin/logs/${logId}`),
};

// ==================== Admin 争议预约管理 ====================
export const adminDisputeApi = {
    // 争议预约列表
    list: (params?: { page?: number; pageSize?: number }) =>
        api.get('/admin/disputed-bookings', { params }),
    // 争议预约详情
    detail: (id: string | number) => api.get(`/admin/disputed-bookings/${id}`),
    // 处理争议
    resolve: (id: string | number, data: { resolution: string; reason?: string; refundRate?: number }) =>
        api.post(`/admin/disputed-bookings/${id}/resolve`, data),
};

export const providerApi = {
    designers: (params?: any) => api.get('/designers', { params }),
    companies: (params?: any) => api.get('/companies', { params }),
    foremen: (params?: any) => api.get('/foremen', { params }),
};

export const escrowApi = {
    detail: (projectId: string | number) => api.get(`/projects/${projectId}/escrow`),
    deposit: (projectId: string | number, data: any) => api.post(`/projects/${projectId}/deposit`, data),
    release: (projectId: string | number, data: any) => api.post(`/projects/${projectId}/release`, data),
};

// ==================== Admin 管理接口 ====================

// 统计 API
export const adminStatsApi = {
    overview: () => api.get('/admin/stats/overview'),
    trends: (params?: { days?: number }) => api.get('/admin/stats/trends', { params }),
    distribution: () => api.get('/admin/stats/distribution'),
};

// 用户管理
export const adminUserApi = {
    list: (params?: { page?: number; pageSize?: number; keyword?: string; userType?: number }) =>
        api.get('/admin/users', { params }),
    detail: (id: number) => api.get(`/admin/users/${id}`),
    create: (data: any) => api.post('/admin/users', data),
    update: (id: number, data: any) => api.put(`/admin/users/${id}`, data),
    updateStatus: (id: number, status: number) => api.patch(`/admin/users/${id}/status`, { status }),
};

// 服务商管理
export const adminProviderApi = {
    list: (params?: { page?: number; pageSize?: number; type?: number; verified?: boolean }) =>
        api.get('/admin/providers', { params }),
    detail: (id: number) => api.get(`/admin/providers/${id}`),
    create: (data: any) => api.post('/admin/providers', data),
    update: (id: number, data: any) => api.put(`/admin/providers/${id}`, data),
    verify: (id: number, verified: boolean) => api.patch(`/admin/providers/${id}/verify`, { verified }),
    updateStatus: (id: number, status: number) => api.patch(`/admin/providers/${id}/status`, { status }),
};

// 主材门店管理
export const adminMaterialShopApi = {
    list: (params?: { page?: number; pageSize?: number; type?: string }) =>
        api.get('/admin/material-shops', { params }),
    detail: (id: number) => api.get(`/admin/material-shops/${id}`),
    create: (data: any) => api.post('/admin/material-shops', data),
    update: (id: number, data: any) => api.put(`/admin/material-shops/${id}`, data),
    delete: (id: number) => api.delete(`/admin/material-shops/${id}`),
    verify: (id: number, verified: boolean) => api.patch(`/admin/material-shops/${id}/verify`, { verified }),
};

// 预约管理
export const adminBookingApi = {
    list: (params?: { page?: number; pageSize?: number; status?: number }) =>
        api.get('/admin/bookings', { params }),
    detail: (id: number) => api.get(`/admin/bookings/${id}`),
    updateStatus: (id: number, status: number) => api.patch(`/admin/bookings/${id}/status`, { status }),
};

// 评价管理
export const adminReviewApi = {
    list: (params?: { page?: number; pageSize?: number; providerId?: number }) =>
        api.get('/admin/reviews', { params }),
    delete: (id: number) => api.delete(`/admin/reviews/${id}`),
};

// 操作日志
export const adminLogApi = {
    list: (params?: { page?: number; pageSize?: number; adminId?: number; action?: string }) =>
        api.get('/admin/logs', { params }),
};

// 管理员管理
export const adminManageApi = {
    list: (params?: { page?: number; pageSize?: number; keyword?: string }) =>
        api.get('/admin/admins', { params }),
    create: (data: any) => api.post('/admin/admins', data),
    update: (id: number, data: any) => api.put(`/admin/admins/${id}`, data),
    delete: (id: number) => api.delete(`/admin/admins/${id}`),
    updateStatus: (id: number, status: number) => api.patch(`/admin/admins/${id}/status`, { status }),
};

// 角色管理
export const adminRoleApi = {
    list: () => api.get('/admin/roles'),
    create: (data: any) => api.post('/admin/roles', data),
    update: (id: number, data: any) => api.put(`/admin/roles/${id}`, data),
    delete: (id: number) => api.delete(`/admin/roles/${id}`),
    getMenus: (id: number) => api.get(`/admin/roles/${id}/menus`),
    assignMenus: (id: number, menuIds: number[]) => api.post(`/admin/roles/${id}/menus`, { menuIds }),
};

// 菜单管理
export const adminMenuApi = {
    list: () => api.get('/admin/menus'),
    create: (data: any) => api.post('/admin/menus', data),
    update: (id: number, data: any) => api.put(`/admin/menus/${id}`, data),
    delete: (id: number) => api.delete(`/admin/menus/${id}`),
};

// 审核管理
export const adminAuditApi = {
    providers: (params?: { page?: number; pageSize?: number; status?: number }) =>
        api.get('/admin/audits/providers', { params }),
    materialShops: (params?: { page?: number; pageSize?: number; status?: number }) =>
        api.get('/admin/audits/material-shops', { params }),
    approve: (type: string, id: number, data: any) => api.post(`/admin/audits/${type}/${id}/approve`, data),
    reject: (type: string, id: number, data: any) => api.post(`/admin/audits/${type}/${id}/reject`, data),
};

// 财务管理
export const adminFinanceApi = {
    escrowAccounts: (params?: { page?: number; pageSize?: number }) =>
        api.get('/admin/finance/escrow-accounts', { params }),
    transactions: (params?: { page?: number; pageSize?: number; type?: string }) =>
        api.get('/admin/finance/transactions', { params }),
    withdraw: (accountId: number, data: any) => api.post(`/admin/finance/escrow-accounts/${accountId}/withdraw`, data),
};

// 风险管理
export const adminRiskApi = {
    warnings: (params?: { page?: number; pageSize?: number; level?: string }) =>
        api.get('/admin/risk/warnings', { params }),
    arbitrations: (params?: { page?: number; pageSize?: number; status?: number }) =>
        api.get('/admin/risk/arbitrations', { params }),
    handleWarning: (id: number, data: any) => api.post(`/admin/risk/warnings/${id}/handle`, data),
    updateArbitration: (id: number, data: any) => api.put(`/admin/risk/arbitrations/${id}`, data),
};

// 系统设置
export const adminSettingsApi = {
    get: () => api.get('/admin/settings'),
    update: (data: any) => api.put('/admin/settings', data),
};

// 数据导出
export const adminExportApi = {
    users: (params?: any) => api.get('/admin/export/users', { params, responseType: 'blob' }),
    providers: (params?: any) => api.get('/admin/export/providers', { params, responseType: 'blob' }),
    projects: (params?: any) => api.get('/admin/export/projects', { params, responseType: 'blob' }),
};

// 作品审核
export const caseAuditApi = {
    list: (params?: any) => api.get('/admin/audits/cases', { params }),
    detail: (id: number) => api.get(`/admin/audits/cases/${id}`),
    approve: (id: number) => api.post(`/admin/audits/cases/${id}/approve`),
    reject: (id: number, reason: string) => api.post(`/admin/audits/cases/${id}/reject`, { reason }),
};

// 作品管理
export const caseApi = {
    list: (params?: { page?: number; pageSize?: number; providerId?: string; style?: string }) =>
        api.get('/admin/cases', { params }),
    create: (data: any) => api.post('/admin/cases', data),
    update: (id: number, data: any) => api.put(`/admin/cases/${id}`, data),
    delete: (id: number) => api.delete(`/admin/cases/${id}`),
};


// 通知系统
export const notificationApi = {
    list: (params?: { page?: number; pageSize?: number }) =>
        api.get('/admin/notifications', { params }),
    getUnreadCount: () =>
        api.get('/admin/notifications/unread-count'),
    markAsRead: (id: number) =>
        api.put(`/admin/notifications/${id}/read`),
    markAllAsRead: () =>
        api.put('/admin/notifications/read-all'),
    delete: (id: number) =>
        api.delete(`/admin/notifications/${id}`),
};

export default api;
