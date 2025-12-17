import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

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
        const token = localStorage.getItem('token');
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
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
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

export const projectApi = {
    list: (params?: any) => api.get('/projects', { params }), // 返回 { data: { list: [], total: 0 } }
    detail: (id: string | number) => api.get(`/projects/${id}`),
    logs: (id: string | number) => api.get(`/projects/${id}/logs`),
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

export default api;
