import axios from 'axios';

// 优先使用环境变量 (本地 Docker 开发)
// 其次根据运行环境动态判断 (生产部署)
const API_BASE_URL = import.meta.env.VITE_API_URL ||
    (window.location.hostname === 'localhost'
        ? 'http://localhost:8080/api/v1'
        : '/api/v1');

const merchantApi = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000,
    headers: { 'Content-Type': 'application/json' },
});

// 请求拦截器 - 使用 merchant_token
merchantApi.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('merchant_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// 响应拦截器
merchantApi.interceptors.response.use(
    (response) => response.data,
    (error) => {
        if (error.response?.status === 401) {
            if (!window.location.pathname.includes('/login')) {
                localStorage.removeItem('merchant_token');
                localStorage.removeItem('merchant_provider');
                window.location.href = '/merchant/login';
            }
        }
        return Promise.reject(error);
    }
);

export interface ApiEnvelope<T> {
    code: number;
    message?: string;
    data?: T;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

const unwrapEnvelope = <T,>(payload: unknown): ApiEnvelope<T> => {
    if (isRecord(payload) && 'code' in payload) {
        return payload as unknown as ApiEnvelope<T>;
    }

    if (isRecord(payload) && 'data' in payload && isRecord(payload.data) && 'code' in payload.data) {
        return payload.data as unknown as ApiEnvelope<T>;
    }

    throw new Error('接口返回格式异常');
};

const unwrapData = <T,>(payload: unknown, fallbackMessage: string): T => {
    const envelope = unwrapEnvelope<T>(payload);
    if (envelope.code !== 0) {
        throw new Error(envelope.message || fallbackMessage);
    }
    return (envelope.data as T) ?? ({} as T);
};

export type MerchantApplicantType = 'personal' | 'studio' | 'company' | 'foreman';
export type MerchantProviderSubType = 'designer' | 'company' | 'foreman';

export interface MerchantProviderSession {
    id: number;
    name: string;
    avatar?: string;
    providerType: number;
    applicantType?: MerchantApplicantType;
    providerSubType?: MerchantProviderSubType;
    phone: string;
    verified: boolean;
}

export interface MerchantLoginData {
    token: string;
    provider: MerchantProviderSession;
    tinodeToken?: string;
}

export interface MerchantProviderInfo {
    id: number;
    name: string;
    avatar?: string;
    providerType: number;
    applicantType?: MerchantApplicantType;
    providerSubType?: MerchantProviderSubType;
    companyName: string;
    rating: number;
    completedCnt: number;
    verified: boolean;
    yearsExperience: number;
    specialty: string[];
    workTypes?: string[];
    serviceArea: string[];
    serviceAreaCodes?: string[];
    introduction: string;
    teamSize: number;
    officeAddress: string;
}

export interface MerchantServiceSetting {
    acceptBooking: boolean;
    autoConfirmHours: number;
    responseTimeDesc: string;
    priceRangeMin: number;
    priceRangeMax: number;
    serviceStyles: string[];
    servicePackages: Array<Record<string, unknown>>;
}

// 商家认证
export const merchantAuthApi = {
    login: async (data: { phone: string; code: string }) =>
        unwrapData<MerchantLoginData>(await merchantApi.post('/merchant/login', data), '登录失败'),
    getInfo: async () =>
        unwrapData<MerchantProviderInfo>(await merchantApi.get('/merchant/info'), '获取商家信息失败'),
    updateInfo: async (data: Record<string, unknown>) =>
        unwrapData<{ status?: string }>(await merchantApi.put('/merchant/info', data), '更新商家信息失败'),
    sendCode: async (phone: string) =>
        unwrapData<{ expiresIn?: number; debugCode?: string }>(
            await merchantApi.post('/auth/send-code', { phone }),
            '发送验证码失败'
        ),
    getServiceSettings: async () =>
        unwrapData<MerchantServiceSetting>(await merchantApi.get('/merchant/service-settings'), '获取服务设置失败'),
    updateServiceSettings: async (data: MerchantServiceSetting) =>
        unwrapData<{ status?: string }>(await merchantApi.put('/merchant/service-settings', data), '更新服务设置失败'),
};

export interface MerchantPortfolioCase {
    title: string;
    images: string[];
    style?: string;
    area?: string;
}

export interface MerchantApplyPayload {
    phone: string;
    code: string;
    applicantType: MerchantApplicantType;
    realName: string;
    idCardNo: string;
    idCardFront: string;
    idCardBack: string;
    companyName?: string;
    licenseNo?: string;
    licenseImage?: string;
    teamSize?: number;
    officeAddress?: string;
    yearsExperience?: number;
    workTypes?: string[];
    serviceArea: string[];
    styles?: string[];
    introduction?: string;
    portfolioCases: MerchantPortfolioCase[];
}

export interface MerchantApplyStatusData {
    applicationId: number;
    applicantType?: MerchantApplicantType;
    status: number;
    statusText: string;
    rejectReason?: string;
    createdAt: string;
    auditedAt?: string;
}

export const merchantApplyApi = {
    apply: async (data: MerchantApplyPayload) =>
        unwrapData<{ applicationId: number; message?: string }>(await merchantApi.post('/merchant/apply', data), '提交申请失败'),
    status: async (phone: string) =>
        unwrapData<MerchantApplyStatusData>(await merchantApi.get(`/merchant/apply/${encodeURIComponent(phone)}/status`), '查询申请状态失败'),
    resubmit: async (id: number, data: MerchantApplyPayload) =>
        unwrapData<{ applicationId: number; message?: string }>(await merchantApi.post(`/merchant/apply/${id}/resubmit`, data), '重新提交申请失败'),
};

export interface MerchantUploadResult {
    url: string;
    path?: string;
}

// 文件上传
export const merchantUploadApi = {
    uploadImage: (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        return merchantApi.post('/merchant/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    },
    uploadImageData: async (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        return unwrapData<MerchantUploadResult>(
            await merchantApi.post('/merchant/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            }),
            '上传失败'
        );
    },
};

// 预约管理
export const merchantBookingApi = {
    list: () => merchantApi.get('/merchant/bookings'),
    detail: (id: number) => merchantApi.get(`/merchant/bookings/${id}`),
    handle: (id: number, action: 'confirm' | 'reject') => merchantApi.put(`/merchant/bookings/${id}/handle`, { action }),
};

// 方案管理
export const merchantProposalApi = {
    list: () => merchantApi.get('/merchant/proposals'),
    detail: (id: number) => merchantApi.get(`/merchant/proposals/${id}`),
    submit: (data: {
        bookingId: number;
        summary: string;
        designFee: number;
        constructionFee: number;
        materialFee: number;
        estimatedDays: number;
        attachments?: string;
    }) => merchantApi.post('/merchant/proposals', data),
    update: (id: number, data: {
        summary: string;
        designFee: number;
        constructionFee: number;
        materialFee: number;
        estimatedDays: number;
        attachments?: string;
    }) => merchantApi.put(`/merchant/proposals/${id}`, data),
    cancel: (id: number) => merchantApi.delete(`/merchant/proposals/${id}`),
    reopen: (id: number) => merchantApi.post(`/merchant/proposals/${id}/reopen`),
    // 重新提交方案（生成新版本）
    resubmit: (data: {
        proposalId: number;
        summary: string;
        designFee: number;
        constructionFee: number;
        materialFee: number;
        estimatedDays: number;
        attachments?: string;
    }) => merchantApi.post('/merchant/proposals/resubmit', data),
    // 获取拒绝信息
    getRejectionInfo: (id: number) => merchantApi.get(`/merchant/proposals/${id}/rejection-info`),
};

// 订单管理
export const merchantOrderApi = {
    list: () => merchantApi.get('/merchant/orders'),
};

export interface MerchantDashboardStats {
    todayBookings: number;
    pendingProposals: number;
    activeProjects: number;
    totalRevenue: number;
    monthRevenue: number;
    bookings?: {
        pending: number;
        confirmed: number;
    };
    proposals?: {
        pending: number;
        confirmed: number;
    };
    orders?: {
        pending: number;
        paid: number;
    };
}

// 仪表盘
export const merchantDashboardApi = {
    stats: async () => unwrapData<MerchantDashboardStats>(await merchantApi.get('/merchant/dashboard'), '获取工作台数据失败'),
};

export interface MerchantIncomeSummary {
    totalIncome: number;
    pendingSettle: number;
    settledAmount: number;
    withdrawnAmount: number;
    availableAmount: number;
}

export interface MerchantIncomeListData<T> {
    list: T[];
    total: number;
    page: number;
    pageSize: number;
}

// 财务管理
export const merchantIncomeApi = {
    summary: async () => unwrapData<MerchantIncomeSummary>(await merchantApi.get('/merchant/income/summary'), '获取收入概览失败'),
    list: async <T = Record<string, unknown>>(params?: Record<string, unknown>) =>
        unwrapData<MerchantIncomeListData<T>>(await merchantApi.get('/merchant/income/list', { params }), '获取收入列表失败'),
};

export interface MerchantWithdrawListData<T> {
    list: T[];
    total: number;
    page: number;
    pageSize: number;
}

export const merchantWithdrawApi = {
    list: async <T = Record<string, unknown>>(params?: Record<string, unknown>) =>
        unwrapData<MerchantWithdrawListData<T>>(await merchantApi.get('/merchant/withdraw/list', { params }), '获取提现记录失败'),
    apply: async (data: { amount: number; bankAccountId: number; verificationCode: string }) =>
        unwrapData<{ withdrawId: number; orderNo: string; message?: string }>(await merchantApi.post('/merchant/withdraw', data), '提交提现申请失败'),
};

export interface MerchantBankAccountInfo {
    id: number;
    accountName: string;
    accountNo: string;
    bankName: string;
    branchName: string;
    isDefault: boolean;
}

export const merchantBankAccountApi = {
    list: async () =>
        unwrapData<{ list: MerchantBankAccountInfo[] }>(await merchantApi.get('/merchant/bank-accounts'), '获取银行账户失败'),
    add: async (data: { accountName: string; accountNo: string; bankName: string; branchName?: string; isDefault?: boolean; verificationCode: string }) =>
        unwrapData<{ id: number; message?: string }>(await merchantApi.post('/merchant/bank-accounts', data), '添加银行账户失败'),
    delete: async (id: number) =>
        unwrapData<{ message?: string }>(await merchantApi.delete(`/merchant/bank-accounts/${id}`), '删除银行账户失败'),
    setDefault: async (id: number) =>
        unwrapData<{ message?: string }>(await merchantApi.put(`/merchant/bank-accounts/${id}/default`), '设置默认账户失败'),
};

// 作品集管理
export const merchantCaseApi = {
    list: (params?: any) => merchantApi.get('/merchant/cases', { params }),
    detail: (id: number) => merchantApi.get(`/merchant/cases/${id}`),
    create: (data: any) => merchantApi.post('/merchant/cases', data),
    update: (id: number, data: any) => merchantApi.put(`/merchant/cases/${id}`, data),
    delete: (id: number) => merchantApi.delete(`/merchant/cases/${id}`),
    reorder: (orders: { id: number; sortOrder: number }[]) => merchantApi.put('/merchant/cases/reorder', { orders }),
    cancelAudit: (auditId: number) => merchantApi.delete(`/merchant/cases/audit/${auditId}`), // 取消审核
};

// 通知系统
export const merchantNotificationApi = {
    list: (params?: { page?: number; pageSize?: number }) =>
        merchantApi.get('/merchant/notifications', { params }),
    getUnreadCount: () =>
        merchantApi.get('/merchant/notifications/unread-count'),
    markAsRead: (id: number) =>
        merchantApi.put(`/merchant/notifications/${id}/read`),
    markAllAsRead: () =>
        merchantApi.put('/merchant/notifications/read-all'),
    delete: (id: number) =>
        merchantApi.delete(`/merchant/notifications/${id}`),
};

// 导出带有 getIMUserSig 方法的对象
export { merchantApi, unwrapEnvelope, unwrapData };

// 统一导出，方便 MerchantChat 使用
export default {
    ...merchantApi,
    getIMUserSig: () => merchantApi.get('/merchant/im/usersig'),
    // Tinode helper (maps app user identifier -> tinode user id like `usrXXXX`).
    getTinodeUserId: (userIdentifier: number | string) => merchantApi.get(`/merchant/tinode/userid/${encodeURIComponent(String(userIdentifier))}`),
    resolveTinodeUserId: (userIdentifier: number | string) => merchantApi.get(`/merchant/tinode/userid/${encodeURIComponent(String(userIdentifier))}`),
};
