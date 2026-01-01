import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

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

// 商家认证
export const merchantAuthApi = {
    login: (data: { phone: string; code: string }) => merchantApi.post('/merchant/login', data),
    getInfo: () => merchantApi.get('/merchant/info'),
    updateInfo: (data: any) => merchantApi.put('/merchant/info', data),
    sendCode: (phone: string) => merchantApi.post('/auth/send-code', { phone }),
};

// 文件上传
export const merchantUploadApi = {
    uploadImage: (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        return merchantApi.post('/merchant/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
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

// 仪表盘
export const merchantDashboardApi = {
    stats: () => merchantApi.get('/merchant/dashboard'),
};

// 财务管理
export const merchantIncomeApi = {
    summary: () => merchantApi.get('/merchant/income/summary'),
    list: (params?: any) => merchantApi.get('/merchant/income/list', { params }),
};

export const merchantWithdrawApi = {
    list: (params?: any) => merchantApi.get('/merchant/withdraw/list', { params }),
    apply: (data: { amount: number; bankAccountId: number }) => merchantApi.post('/merchant/withdraw', data),
};

export const merchantBankAccountApi = {
    list: () => merchantApi.get('/merchant/bank-accounts'),
    add: (data: any) => merchantApi.post('/merchant/bank-accounts', data),
    delete: (id: number) => merchantApi.delete(`/merchant/bank-accounts/${id}`),
    setDefault: (id: number) => merchantApi.put(`/merchant/bank-accounts/${id}/default`),
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
export { merchantApi };

// 统一导出，方便 MerchantChat 使用
export default {
    ...merchantApi,
    getIMUserSig: () => merchantApi.get('/merchant/im/usersig'),
};

