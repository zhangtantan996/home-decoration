import axios from 'axios';
import { SecureStorage } from '../utils/SecureStorage';
import { authEventEmitter } from './AuthEventEmitter';
import { useAuthStore } from '../store/authStore';
import { AutoRetryGuard, type AutoRetryPolicy } from '../utils/autoRetryGuard';

// @ts-ignore
import { getApiUrl, getApiUrlCandidates } from '../config';

const BASE_URL_CANDIDATES = getApiUrlCandidates();
let activeBaseUrl = BASE_URL_CANDIDATES[0] || getApiUrl();

const api = axios.create({
    baseURL: activeBaseUrl,
    timeout: 10000,
    headers: { 'Content-Type': 'application/json' },
});

const AUTH_REFRESH_BUSINESS_KEY = 'mobile.auth.refresh';
const AUTH_REFRESH_POLICY: AutoRetryPolicy = {
    maxAutoAttempts: 1,
    pauseOnConsecutiveFailures: 1,
    baseDelayMs: 0,
    maxDelayMs: 0,
};
const authRefreshGuard = new AutoRetryGuard(AUTH_REFRESH_POLICY);

export const resetAuthRefreshGuard = () => {
    authRefreshGuard.resetByManual();
};

// 刷新 Token 辅助方法：尝试多个后端路径，兼容不同实现
const tryRefreshToken = async (refreshToken: string) => {
    if (!authRefreshGuard.shouldAttempt('auto')) {
        const state = authRefreshGuard.getState();
        console.warn('[AutoRetry]', {
            businessKey: AUTH_REFRESH_BUSINESS_KEY,
            trigger: 'auto',
            event: 'blocked',
            attempt: state.autoAttempts,
            consecutiveFailures: state.consecutiveFailures,
            pausedReason: 'max_auto_attempts_reached',
        });
        throw new Error('Refresh token blocked by guard');
    }

    authRefreshGuard.recordAttempt('auto');

    const candidates = ['/auth/refresh-token', '/auth/refreshToken', '/auth/refresh'];
    const baseUrls = [activeBaseUrl, ...BASE_URL_CANDIDATES.filter((url) => url !== activeBaseUrl)];

    let lastError: any = null;
    for (const baseUrl of baseUrls) {
        for (const path of candidates) {
        try {
            const response = await axios.post(`${baseUrl}${path}`, { refreshToken });
            const payload = response.data;

            // 兼容两种返回：1) { code:0, data:{ token, refreshToken } } 2) { token, refreshToken }
            const data = payload?.data ?? payload;
            const token = data?.token;
            const newRefreshToken = data?.refreshToken || data?.refresh_token;

            if (!token) throw new Error('Empty token in refresh response');

            activeBaseUrl = baseUrl;
            api.defaults.baseURL = baseUrl;
            authRefreshGuard.recordSuccess();
            console.info('[AutoRetry]', {
                businessKey: AUTH_REFRESH_BUSINESS_KEY,
                trigger: 'auto',
                event: 'success',
            });

            return {
                token,
                refreshToken: newRefreshToken,
            };
        } catch (err: any) {
            lastError = err;
            const status = err?.response?.status;
            if (status && ![404, 405, 501].includes(status)) {
                authRefreshGuard.recordFailure(err);
                const state = authRefreshGuard.getState();
                console.warn('[AutoRetry]', {
                    businessKey: AUTH_REFRESH_BUSINESS_KEY,
                    trigger: 'auto',
                    event: 'failure',
                    attempt: state.autoAttempts,
                    consecutiveFailures: state.consecutiveFailures,
                    paused: state.paused,
                });
                throw err;
            }
        }
    }
    }
    if (lastError) {
        authRefreshGuard.recordFailure(lastError);
        const state = authRefreshGuard.getState();
        console.warn('[AutoRetry]', {
            businessKey: AUTH_REFRESH_BUSINESS_KEY,
            trigger: 'auto',
            event: 'failure',
            attempt: state.autoAttempts,
            consecutiveFailures: state.consecutiveFailures,
            paused: state.paused,
        });
        throw lastError;
    }

    authRefreshGuard.recordFailure(new Error('Refresh token failed: no candidates succeeded'));
    throw new Error('Refresh token failed: no candidates succeeded');
};

// 正在刷新的标志
let isRefreshing = false;
// 刷新失败的请求队列
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });

    failedQueue = [];
};


const getRetryBaseUrl = (currentBaseUrl?: string): string | null => {
    const current = currentBaseUrl || activeBaseUrl;
    const currentIndex = BASE_URL_CANDIDATES.indexOf(current);
    if (currentIndex < 0) {
        return BASE_URL_CANDIDATES.length > 1 ? BASE_URL_CANDIDATES[1] : null;
    }
    return BASE_URL_CANDIDATES[currentIndex + 1] || null;
};

const shouldRetryWithAlternateBaseUrl = (error: any, request: any): boolean => {
    if (!request || request._hostRetried) {
        return false;
    }

    const method = String(request.method || 'get').toLowerCase();
    if (method !== 'get') {
        return false;
    }

    if (BASE_URL_CANDIDATES.length < 2) {
        return false;
    }

    if (!error.response) {
        return true;
    }

    return error.response.status >= 500;
};

// 请求拦截器 - 自动添加 Token
api.interceptors.request.use(
    async (config) => {
        try {
            const token = await SecureStorage.getToken();
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        } catch (error) {
            if (__DEV__) {
                console.log('Failed to get token:', error);
            }
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// 响应拦截器 - 处理 401 及业务错误
api.interceptors.response.use(
    (response) => {
        // 如果后端返回了业务错误码 (非0)，手动抛出错误
        const res = response.data;
        if (res.code && res.code !== 0) {
            // 构造一个类似 AxiosError 的对象，以便前端 catch 块能统一处理
            const error = new Error(res.message || 'Error') as any;
            error.response = {
                status: 200,
                data: res
            };
            return Promise.reject(error);
        }
        return res;
    },
    async (error) => {
        const originalRequest = error.config;

        if (shouldRetryWithAlternateBaseUrl(error, originalRequest)) {
            const retryBaseUrl = getRetryBaseUrl(originalRequest?.baseURL);
            if (retryBaseUrl) {
                try {
                    const retryResponse = await api({
                        ...originalRequest,
                        _hostRetried: true,
                        baseURL: retryBaseUrl,
                    });
                    activeBaseUrl = retryBaseUrl;
                    api.defaults.baseURL = retryBaseUrl;
                    return retryResponse;
                } catch (retryError) {
                    error = retryError;
                }
            }
        }

        // 如果是 401 错误且不是刷新 Token 请求
        if (error.response?.status === 401 && !originalRequest._retry) {
            if (isRefreshing) {
                // 正在刷新，将请求加入队列
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                }).then(token => {
                    originalRequest.headers.Authorization = 'Bearer ' + token;
                    return api(originalRequest);
                }).catch(err => {
                    return Promise.reject(err);
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                const refreshToken = await SecureStorage.getRefreshToken();

                if (!refreshToken) {
                    throw new Error('No refresh token');
                }

                // 调用刷新 Token 接口
                const {
                    token,
                    refreshToken: newRefreshToken,
                } = await tryRefreshToken(refreshToken);

                // 保存新的 Token（同步内存状态 + 安全存储）
                await useAuthStore.getState().updateToken(token);
                if (newRefreshToken) {
                    await useAuthStore.getState().updateRefreshToken(newRefreshToken);
                }

                // 更新请求头
                api.defaults.headers.common.Authorization = 'Bearer ' + token;
                originalRequest.headers.Authorization = 'Bearer ' + token;

                processQueue(null, token);
                isRefreshing = false;

                // 重试原请求
                return api(originalRequest);
            } catch (refreshError: any) {
                processQueue(refreshError, null);
                isRefreshing = false;

                const status = refreshError?.response?.status;
                // 对于 404/405/501 表示后端未实现刷新，不清空本地，交给上层处理
                if (status && [404, 405, 501].includes(status)) {
                    return Promise.reject(refreshError);
                }

                // Token 刷新失败，清除本地存储
                await SecureStorage.clearAll();

                // 发送会话过期事件，由 App 根组件处理跳转
                authEventEmitter.emit('session_expired', {
                    reason: 'refresh_token_failed',
                    message: '登录已过期，请重新登录',
                });

                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);

// API 接口
export const authApi = {
    login: (data: { phone: string; code?: string; password?: string; type?: 'code' | 'password' }) => api.post('/auth/login', data),
    sendCode: (
        phone: string,
        purpose: 'login' | 'register' | 'merchant_withdraw' | 'merchant_bank_bind' | 'identity_apply' = 'login',
        captchaToken?: string,
    ) => api.post('/auth/send-code', { phone, purpose, captchaToken }),
    register: (data: { phone: string; code: string; nickname?: string }) =>
        api.post('/auth/register', data),
};

export const userApi = {
    getProfile: () => api.get('/user/profile'),
    updateProfile: (data: any) => api.put('/user/profile', data),
    favorites: (params: { type: 'case' | 'material_shop'; page?: number; pageSize?: number }) =>
        api.get<any>('/user/favorites', { params }),
};

export const providerApi = {
    designers: (params?: any) => api.get<any>('/designers', { params }),
    designerDetail: (id: number) => api.get<any>(`/designers/${id}`),
    companies: (params?: any) => api.get<any>('/companies', { params }),
    companyDetail: (id: number) => api.get<any>(`/companies/${id}`),
    foremen: (params?: any) => api.get<any>('/foremen', { params }),
    foremanDetail: (id: number) => api.get<any>(`/foremen/${id}`),
    // 案例和评价
    getCases: (type: 'designers' | 'companies' | 'foremen', id: number, page = 1) =>
        api.get<any>(`/${type}/${id}/cases`, { params: { page, pageSize: 10 } }),
    getReviews: (type: 'designers' | 'companies' | 'foremen', id: number, page = 1, filter = 'all') =>
        api.get<any>(`/${type}/${id}/reviews`, { params: { page, pageSize: 10, filter } }),
    getReviewStats: (type: 'designers' | 'companies' | 'foremen', id: number) =>
        api.get<any>(`/${type}/${id}/review-stats`),
    // 关注/收藏
    follow: (id: number, type = 'designer') =>
        api.post(`/providers/${id}/follow`, null, { params: { type } }),
    unfollow: (id: number, type = 'designer') =>
        api.delete(`/providers/${id}/follow`, { params: { type } }),
    favorite: (id: number, type = 'provider') =>
        api.post(`/providers/${id}/favorite`, null, { params: { type } }),
    unfavorite: (id: number, type = 'provider') =>
        api.delete(`/providers/${id}/favorite`, { params: { type } }),
    getUserStatus: (id: number) =>
        api.get<{ isFollowed: boolean; isFavorited: boolean }>(`/providers/${id}/user-status`),
};

export const caseApi = {
    getDetail: (caseId: number) => api.get<any>(`/cases/${caseId}`),
    getQuote: (caseId: number) => api.get<any>(`/cases/${caseId}/quote`),
};

export const projectApi = {
    list: () => api.get('/projects'),
    detail: (id: string) => api.get(`/projects/${id}`),
    create: (data: any) => api.post('/projects', data),
    logs: (id: string) => api.get(`/projects/${id}/logs`),
    milestones: (id: string) => api.get(`/projects/${id}/milestones`),
    phases: (projectId: string) => api.get<any>(`/projects/${projectId}/phases`),
};

export const phaseApi = {
    update: (phaseId: string, data: { status?: string; responsiblePerson?: string; startDate?: string; endDate?: string }) =>
        api.put(`/phases/${phaseId}`, data),
    updateTask: (phaseId: string, taskId: string, data: { isCompleted: boolean }) =>
        api.put(`/phases/${phaseId}/tasks/${taskId}`, data),
};

export const escrowApi = {
    getAccount: (projectId: string) => api.get(`/projects/${projectId}/escrow`),
    deposit: (projectId: string, amount: number) =>
        api.post(`/projects/${projectId}/deposit`, { amount }),
    release: (projectId: string, milestoneId: number, amount: number) =>
        api.post(`/projects/${projectId}/release`, { milestone_id: milestoneId, amount }),
};

export const bookingApi = {
    list: (params?: { paid?: boolean }) => api.get<any>('/bookings', { params }),
    create: (data: any) => api.post('/bookings', data),
    getDetail: (id: number) => api.get<any>(`/bookings/${id}`),
    payIntent: (id: number) => api.post<any>(`/bookings/${id}/pay-intent`),
    cancel: (id: number) => api.delete<any>(`/bookings/${id}/cancel`),
    delete: (id: number) => api.delete<any>(`/bookings/${id}`),
};

export const afterSalesApi = {
    list: (params?: { status?: number }) => api.get<any>('/after-sales', { params }),
    create: (data: { bookingId: number; type: string; reason: string; description?: string; images?: string; amount?: number }) =>
        api.post<any>('/after-sales', data),
    getDetail: (id: number) => api.get<any>(`/after-sales/${id}`),
    cancel: (id: number) => api.delete<any>(`/after-sales/${id}`),
};

export const chatApi = {
    getConversations: () => api.get<any>('/chat/conversations'),
    getMessages: (conversationId: string, page = 1, pageSize = 20) =>
        api.get<any>('/chat/messages', { params: { conversationId, page, pageSize } }),
    getUnreadCount: () => api.get<any>('/chat/unread-count'),
};

// Tinode helper endpoints
export const tinodeApi = {
    // Maps app user identifier (id/publicId) -> tinode user topic id like `usrXXXX`.
    getTinodeUserId: (userIdentifier: number | string) => api.get<any>(`/tinode/userid/${userIdentifier}`),
    // Backward-compatible alias.
    getUserId: (userIdentifier: number | string) => api.get<any>(`/tinode/userid/${userIdentifier}`),
    clearTopicMessages: (topic: string) =>
        api.delete<any>(`/tinode/topic/${encodeURIComponent(topic)}/messages`),
};

export const reportApi = {
    submitChatReport: (data: { topic: string; reason: string; partner?: string }) =>
        api.post<any>('/reports/chat', data),
};

export const materialShopApi = {
    list: (params?: { page?: number; pageSize?: number; sortBy?: string; type?: string }) =>
        api.get<any>('/material-shops', { params }),
    detail: (id: number) => api.get<any>(`/material-shops/${id}`),
    favorite: (id: number) => api.post<any>(`/material-shops/${id}/favorite`),
    unfavorite: (id: number) => api.delete<any>(`/material-shops/${id}/favorite`),
};

// ========== 业务流程扩展 ==========

export const proposalApi = {
    // 获取我收到的方案列表
    list: () => api.get<any>('/proposals'),
    // 获取待处理数量
    pendingCount: () => api.get<{ count: number }>('/proposals/pending-count'),
    // 获取方案详情
    detail: (id: number) => api.get<any>(`/proposals/${id}`),
    // 根据预约获取方案
    getByBooking: (bookingId: number) => api.get<any>(`/bookings/${bookingId}/proposal`),
    // 确认方案
    confirm: (id: number) => api.post<any>(`/proposals/${id}/confirm`),
    // 拒绝方案（支持拒绝原因）
    reject: (id: number, data: { reason: string }) => api.post<any>(`/proposals/${id}/reject`, data),
    // 获取方案版本历史
    getVersionHistory: (bookingId: number) => api.get<any>(`/proposals/booking/${bookingId}/history`),
};

export const orderApi = {
    // 获取所有待付款项（意向金+设计费）
    listPendingPayments: () => {
        return api.get<any>('/orders/pending-payments');
    },
    // 获取订单详情
    detail: (id: number) => api.get<any>(`/orders/${id}`),
    // 支付订单
    pay: (orderId: number) => api.post<any>(`/orders/${orderId}/pay`),
    // 支付分期款项
    payPlan: (planId: number) => {
        return api.post(`/orders/plans/${planId}/pay`);
    },
    cancel: (orderId: number) => {
        return api.delete(`/orders/${orderId}`);
    },
};

export const billApi = {
    // 生成账单
    generate: (projectId: number, data: {
        designFee: number;
        constructionFee: number;
        materialFee: number;
        paymentType?: 'milestone' | 'onetime';
    }) => api.post<any>(`/projects/${projectId}/bill`, { projectId, ...data }),
    // 获取账单
    get: (projectId: number) => api.get<any>(`/projects/${projectId}/bill`),
    // 获取项目文件（需付设计费）
    getFiles: (projectId: number) => api.get<any>(`/projects/${projectId}/files`),
};

export const configApi = {
    // 获取意向金金额
    getIntentFee: () => api.get<{ intentFee: number }>('/config/intent-fee'),
};

// ========== 通知系统 ==========

export const notificationApi = {
    // 获取通知列表
    list: (params?: { page?: number; pageSize?: number }) =>
        api.get<any>('/notifications', { params }),
    // 获取未读数量
    getUnreadCount: () =>
        api.get<{ count: number }>('/notifications/unread-count'),
    // 标记单个通知为已读
    markAsRead: (id: number) =>
        api.put<any>(`/notifications/${id}/read`),
    // 标记全部已读
    markAllAsRead: () =>
        api.put<any>('/notifications/read-all'),
    // 删除通知
    delete: (id: number) =>
        api.delete<any>(`/notifications/${id}`),
};

// 文件上传
export const fileApi = {
    upload: async (file: { uri: string; type: string; name: string }) => {
        const formData = new FormData();
        formData.append('file', {
            uri: file.uri,
            type: file.type,
            name: file.name,
        } as any);

        return api.post<{ url: string; filename: string; size: number }>('/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
    },
};

export default api;


export const inspirationApi = {
    list: (params?: { page?: number; pageSize?: number; style?: string; layout?: string; priceMin?: number; priceMax?: number }) =>
        api.get<any>('/inspiration', { params }),
    like: (id: number) => api.post<any>(`/inspiration/${id}/like`),
    unlike: (id: number) => api.delete<any>(`/inspiration/${id}/like`),
    favorite: (id: number) => api.post<any>(`/inspiration/${id}/favorite`),
    unfavorite: (id: number) => api.delete<any>(`/inspiration/${id}/favorite`),
    comments: (id: number, params?: { page?: number; pageSize?: number }) =>
        api.get<any>(`/inspiration/${id}/comments`, { params }),
    createComment: (id: number, content: string) =>
        api.post<any>(`/inspiration/${id}/comments`, { content }),
};

// ========== 用户设置 ==========
export const userSettingsApi = {
    changePassword: (data: { oldPassword?: string; newPassword: string }) =>
        api.post('/user/change-password', data),
    changePhone: (data: { newPhone: string; code: string }) =>
        api.post('/user/change-phone', data),
    deleteAccount: (data: { code: string }) =>
        api.post('/user/delete-account', data),
    getVerification: () => api.get<any>('/user/verification'),
    submitVerification: (data: any) => api.post('/user/verification', data),
    getDevices: () => api.get<any>('/user/devices'),
    removeDevice: (id: number) => api.delete(`/user/devices/${id}`),
    removeAllDevices: () => api.delete('/user/devices'),
    getSettings: () => api.get<any>('/user/settings'),
    updateSettings: (data: any) => api.put('/user/settings', data),
    submitFeedback: (data: { type: string; content: string; contact?: string; images?: string }) =>
        api.post('/user/feedback', data),
};
