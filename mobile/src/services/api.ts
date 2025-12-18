import axios from 'axios';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// @ts-ignore
import { getApiUrl } from '../config';

const BASE_URL = getApiUrl();

const api = axios.create({
    baseURL: BASE_URL,
    timeout: 10000,
    headers: { 'Content-Type': 'application/json' },
});

// 请求拦截器 - 自动添加 Token
api.interceptors.request.use(
    async (config) => {
        try {
            const token = await AsyncStorage.getItem('token');
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        } catch (error) {
            console.log('Failed to get token:', error);
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// 响应拦截器 - 处理 401
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
        if (error.response?.status === 401) {
            // Token 过期，清除本地存储
            await AsyncStorage.removeItem('token');
            await AsyncStorage.removeItem('user');
        }
        return Promise.reject(error);
    }
);

// API 接口
export const authApi = {
    login: (data: { phone: string; code?: string; password?: string; type?: 'code' | 'password' }) => api.post('/auth/login', data),
    sendCode: (phone: string) => api.post('/auth/send-code', { phone }),
    register: (data: { phone: string; code: string; nickname?: string }) =>
        api.post('/auth/register', data),
};

export const userApi = {
    getProfile: () => api.get('/user/profile'),
    updateProfile: (data: any) => api.put('/user/profile', data),
};

export const providerApi = {
    designers: (params?: any) => api.get('/designers', { params }),
    companies: (params?: any) => api.get('/companies', { params }),
    foremen: (params?: any) => api.get('/foremen', { params }),
};

export const projectApi = {
    list: () => api.get('/projects'),
    detail: (id: string) => api.get(`/projects/${id}`),
    create: (data: any) => api.post('/projects', data),
    logs: (id: string) => api.get(`/projects/${id}/logs`),
    milestones: (id: string) => api.get(`/projects/${id}/milestones`),
};

export const escrowApi = {
    getAccount: (projectId: string) => api.get(`/projects/${projectId}/escrow`),
    deposit: (projectId: string, amount: number) =>
        api.post(`/projects/${projectId}/deposit`, { amount }),
    release: (projectId: string, milestoneId: number, amount: number) =>
        api.post(`/projects/${projectId}/release`, { milestone_id: milestoneId, amount }),
};

export default api;
