import axios from 'axios';
import { message } from 'antd';
import { getApiBaseUrl, getRouterBasename } from '../utils/env';
import {
  OPS_ACCESS_DENIED_MESSAGE,
  hasOpsAccess,
  useAuthStore,
  type OpsUser,
} from '../stores/authStore';

export interface PageResult<T> {
  list: T[];
  total: number;
  page?: number;
  pageSize?: number;
}

export interface VisibilityBlocker {
  code: string;
  message: string;
}

export interface VisibilityData {
  publicVisible: boolean;
  blockers?: VisibilityBlocker[];
  primaryBlockerCode?: string;
  primaryBlockerMessage?: string;
}

const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 12000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    const payload = response.data;
    if (payload && typeof payload === 'object' && 'code' in payload && payload.code !== 0) {
      throw new Error(String(payload.message || '操作失败'));
    }
    return payload?.data ?? payload;
  },
  (error) => {
    const status = error?.response?.status;
    const text = error?.response?.data?.message || error?.message || '请求失败';
    const requestUrl = String(error?.config?.url || '');
    const isLoginRequest = requestUrl.includes('/admin/login');
    const sessionBoundary = !isLoginRequest && (status === 401 || (
      status === 403 && /无权访问管理接口|Token类型不匹配|账号已被禁用|管理员不存在/.test(String(text))
    ));
    if (sessionBoundary) {
      useAuthStore.getState().clearOpsSession();
      const base = getRouterBasename();
      window.location.href = `${base === '/' ? '' : base}/login`;
    }
    return Promise.reject(new Error(String(text)));
  },
);

const normalizeApiErrorMessage = (error: unknown, fallback: string): string => {
  if (!(error instanceof Error)) return fallback;
  const messageText = error.message.trim();
  if (!messageText || messageText === 'Network Error') {
    return '无法连接服务，请确认本地 API 已启动后重试';
  }
  if (/status code 50\d/.test(messageText)) {
    return '服务暂时不可用，请稍后重试';
  }
  return messageText;
};

export interface LoginResponse {
  token?: string;
  accessToken?: string;
  admin?: OpsUser;
  user?: OpsUser;
  loginStage?: string;
}

export const login = async (username: string, password: string) => {
  const data = await api.post<unknown, LoginResponse>('/admin/login', { username, password });
  const token = data.token || data.accessToken || '';
  if (!token) throw new Error('登录失败，请检查账号');
  const user = data.admin || data.user || { username };
  if (!hasOpsAccess(user)) {
    useAuthStore.getState().clearOpsSession();
    throw new Error(OPS_ACCESS_DENIED_MESSAGE);
  }
  useAuthStore.getState().setSession(token, user);
};

export const reauth = (payload: { password?: string; otpCode?: string }) =>
  api.post<{ password?: string; otpCode?: string }, { proof?: string }>('/admin/security/reauth', payload);

export interface ProviderItem {
  id: number;
  type?: string;
  providerType?: number;
  serviceAreaCodes?: string[];
  displayName?: string;
  nickname?: string;
  companyName?: string;
  avatar?: string;
  phone?: string;
  subType?: string;
  entityType?: string;
  serviceArea?: string;
  specialty?: string;
  workTypes?: string;
  highlightTags?: string;
  pricingJson?: string;
  graduateSchool?: string;
  designPhilosophy?: string;
  yearsExperience?: number;
  rating?: number;
  reviewCount?: number;
  completedCnt?: number;
  followersCount?: number;
  priceMin?: number;
  priceMax?: number;
  priceUnit?: string;
  coverImage?: string;
  serviceIntro?: string;
  teamSize?: number;
  establishedYear?: number;
  certifications?: string;
  officeAddress?: string;
  companyAlbumJson?: string;
  isSettled?: boolean;
  verified?: boolean;
  status?: number;
  publicVisible?: boolean;
  visibility?: VisibilityData;
  createdAt?: string;
}

export interface MaterialShopItem {
  id: number;
  name: string;
  type?: string;
  companyName?: string;
  description?: string;
  address?: string;
  contactName?: string;
  contactPhone?: string;
  cover?: string;
  brandLogo?: string;
  rating?: number;
  reviewCount?: number;
  mainProducts?: string;
  productCategories?: string;
  openTime?: string;
  businessHoursJson?: string;
  serviceArea?: string;
  mainBrands?: string;
  mainCategories?: string;
  deliveryCapability?: string;
  installationCapability?: string;
  afterSalesPolicy?: string;
  invoiceCapability?: string;
  tags?: string;
  isVerified?: boolean;
  status?: number;
  isSettled?: boolean;
  publicVisible?: boolean;
  visibility?: VisibilityData;
  createdAt?: string;
}

export interface CaseItem {
  id: number;
  providerId?: number;
  providerName?: string;
  title: string;
  coverImage?: string;
  style?: string;
  layout?: string;
  area?: string;
  price?: number;
  quoteTotalCent?: number;
  quoteCurrency?: string;
  year?: string;
  description?: string;
  images?: string[];
  showInInspiration?: boolean;
  createdAt?: string;
}

export interface BookingItem {
  id: number;
  providerId?: number;
  providerType?: string;
  userId?: number;
  phone?: string;
  address?: string;
  status?: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuditLogItem {
  id: number;
  recordKind?: 'request' | 'business' | string;
  operatorType?: string;
  operatorId?: number;
  action?: string;
  operationType?: string;
  resource?: string;
  resourceType?: string;
  resourceId?: number;
  reason?: string;
  result?: string;
  requestBody?: string;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  clientIp?: string;
  userAgent?: string;
  statusCode?: number;
  duration?: number;
  createdAt?: string;
}

export interface AuditLogQuery {
  page?: number;
  pageSize?: number;
  recordKind?: 'request' | 'business';
  operationType?: string;
  resourceType?: string;
  startDate?: string;
  endDate?: string;
}

export interface DictOption {
  value: string;
  label: string;
}

export interface RegionItem {
  id?: number;
  code: string;
  name: string;
  level?: number;
  parentCode?: string;
  parentName?: string;
}

export interface MaterialProductItem {
  id: number;
  name: string;
  unit: string;
  description?: string;
  price: number;
  images?: string[];
  coverImage?: string;
  sortOrder?: number;
  paramsJson?: string;
  status?: number;
}

const normalizePage = <T>(data: unknown): PageResult<T> => {
  const source = data as { list?: T[]; total?: number; page?: number; pageSize?: number };
  return {
    list: Array.isArray(source?.list) ? source.list : [],
    total: Number(source?.total || 0),
    page: source?.page,
    pageSize: source?.pageSize,
  };
};

const readArrayPayload = <T,>(payload: unknown): T[] => {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object' && 'data' in payload) {
    const data = (payload as { data?: unknown }).data;
    if (Array.isArray(data)) return data as T[];
    if (data && typeof data === 'object' && 'list' in data) {
      const list = (data as { list?: unknown }).list;
      return Array.isArray(list) ? list as T[] : [];
    }
  }
  return [];
};

const providerTypeParam = (type: string) => {
  if (type === 'company') return 2;
  if (type === 'foreman') return 3;
  return 1;
};

export const listProviders = async (type: string, page = 1, pageSize = 20) =>
  normalizePage<ProviderItem>(await api.get('/admin/providers', { params: { type: providerTypeParam(type), page, pageSize } }));

export const createProvider = (payload: Record<string, unknown>) => api.post('/admin/providers', payload);
export const updateProvider = (id: number, payload: Record<string, unknown>) => api.put(`/admin/providers/${id}`, payload);
export const setProviderAvailability = (id: number, enabled: boolean, reason: string, recentReauthProof: string) =>
  api.patch(`/admin/providers/${id}/availability`, { enabled, reason, recentReauthProof });
export const setProviderPlatformDisplay = (id: number, enabled: boolean, reason: string, recentReauthProof: string) =>
  api.patch(`/admin/providers/${id}/platform-display`, { enabled, reason, recentReauthProof });

export const getDictOptions = async (category: string) => {
  const payload = await api.get<unknown, unknown>(`/dictionaries/${category}`);
  const list = Array.isArray(payload) ? payload : (payload as { data?: unknown[] })?.data;
  return Array.isArray(list)
    ? list.map((item) => {
      const option = item as { value?: string; label?: string };
      const value = String(option.value || option.label || '');
      return { value, label: String(option.label || value) };
    }).filter((item) => item.value)
    : [];
};

export const getServiceProvinces = () =>
  api.get<unknown, unknown>('/regions/service-provinces').then(readArrayPayload<RegionItem>);

export const getServiceCities = () =>
  api.get<unknown, unknown>('/regions/service-cities').then(readArrayPayload<RegionItem>);

export const getDistrictsByCity = (cityCode: string) =>
  api.get<unknown, unknown>(`/regions/cities/${cityCode}/districts`).then(readArrayPayload<RegionItem>);

export interface UploadResult {
  url?: string;
  path?: string;
  thumbnailUrl?: string;
  thumbnailPath?: string;
}

export const uploadImage = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post<FormData, UploadResult>('/admin/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const listMaterialShops = async (page = 1, pageSize = 20) =>
  normalizePage<MaterialShopItem>(await api.get('/admin/material-shops', { params: { page, pageSize } }));

export const createMaterialShop = (payload: Record<string, unknown>) => api.post('/admin/material-shops', payload);
export const updateMaterialShop = (id: number, payload: Record<string, unknown>) => api.put(`/admin/material-shops/${id}`, payload);
export const setMaterialShopAvailability = (id: number, enabled: boolean, reason: string, recentReauthProof: string) =>
  api.patch(`/admin/material-shops/${id}/availability`, { enabled, reason, recentReauthProof });
export const setMaterialShopPlatformDisplay = (id: number, enabled: boolean, reason: string, recentReauthProof: string) =>
  api.patch(`/admin/material-shops/${id}/platform-display`, { enabled, reason, recentReauthProof });

export const listMaterialProducts = async (shopId: number) =>
  normalizePage<MaterialProductItem>(await api.get(`/admin/material-shops/${shopId}/products`));
export const createMaterialProduct = (shopId: number, payload: Record<string, unknown>) => api.post(`/admin/material-shops/${shopId}/products`, payload);
export const updateMaterialProduct = (shopId: number, productId: number, payload: Record<string, unknown>) => api.put(`/admin/material-shops/${shopId}/products/${productId}`, payload);
export const deleteMaterialProduct = (shopId: number, productId: number) => api.delete(`/admin/material-shops/${shopId}/products/${productId}`);

export const listCases = async (page = 1, pageSize = 20) =>
  normalizePage<CaseItem>(await api.get('/admin/cases', { params: { page, pageSize } }));
export const createCase = (payload: Record<string, unknown>) => api.post('/admin/cases', payload);
export const updateCase = (id: number, payload: Record<string, unknown>) => api.put(`/admin/cases/${id}`, payload);
export const deleteCase = (id: number) => api.delete(`/admin/cases/${id}`);
export const toggleCaseInspiration = (id: number, showInInspiration: boolean) => api.patch(`/admin/cases/${id}/inspiration`, { showInInspiration });

export const listBookings = async (page = 1, pageSize = 20) =>
  normalizePage<BookingItem>(await api.get('/admin/bookings', { params: { page, pageSize } }));
export const getBooking = (id: number) => api.get<unknown, BookingItem>(`/admin/bookings/${id}`);
export const updateBookingStatus = (id: number, status: number, notes?: string) =>
  api.patch(`/admin/bookings/${id}/status`, { status, notes });

export const listAuditLogs = async (params?: AuditLogQuery) =>
  normalizePage<AuditLogItem>(await api.get('/admin/audit-logs', { params }));

export const showApiError = (error: unknown, fallback = '操作失败') => {
  message.error(normalizeApiErrorMessage(error, fallback));
};
