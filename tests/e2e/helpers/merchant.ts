import { expect, type APIRequestContext, type APIResponse, type Page } from '@playwright/test';

export interface MerchantTestEnv {
  origin: string;
  apiBaseUrl: string;
  phone: string;
  foremanPhone: string;
  code: string;
}

export interface ApiEnvelope<T = any> {
  code: number;
  message: string;
  data: T;
}

export interface MerchantLoginApiData {
  token: string;
  merchantKind?: 'provider' | 'material_shop';
  role?: string;
  entityType?: string;
  tinodeToken?: string;
  provider: {
    id: number;
    providerType: number;
    applicantType?: string;
    providerSubType?: string;
    phone?: string;
  };
}

export interface MerchantAdminTestEnv {
  username: string;
  password: string;
}

interface AdminLoginApiData {
  token: string;
}

interface MerchantApplyStatusData {
  applicationId: number;
  status: number;
  role?: string;
  entityType?: string;
}

interface MaterialShopApplyStatusData {
  applicationId: number;
  status: number;
  role?: string;
  entityType?: string;
}

export interface LegalAcceptancePayload {
  accepted: boolean;
  onboardingAgreementVersion: string;
  platformRulesVersion: string;
  privacyDataProcessingVersion: string;
}

export interface BusinessHoursRange {
  day: number;
  start: string;
  end: string;
}

const FOREMAN_REQUIRED_CASES = [
  { category: 'water', title: '水工施工展示' },
  { category: 'electric', title: '电工施工展示' },
  { category: 'wood', title: '木工施工展示' },
  { category: 'masonry', title: '瓦工施工展示' },
  { category: 'paint', title: '油漆工施工展示' },
] as const;

export function getMerchantTestEnv(): MerchantTestEnv {
  return {
    origin: process.env.MERCHANT_ORIGIN || 'http://localhost:5174',
    apiBaseUrl: process.env.E2E_API_BASE_URL || `${(process.env.API_BASE_URL || 'http://localhost:8080').replace(/\/$/, '')}/api/v1`,
    phone: process.env.MERCHANT_PHONE || '13800000001',
    foremanPhone: process.env.MERCHANT_FOREMAN_PHONE || process.env.MERCHANT_PHONE || '13800000001',
    code: process.env.MERCHANT_CODE || '123456',
  };
}

export function getMerchantAdminTestEnv(): MerchantAdminTestEnv {
  return {
    username: process.env.E2E_ADMIN_USER || 'admin',
    password: process.env.E2E_ADMIN_PASS || 'admin123',
  };
}

export function buildMerchantAppUrl(origin: string, path = '/'): string {
  const url = new URL(origin);
  const basePath = url.pathname && url.pathname !== '/' ? url.pathname.replace(/\/+$/, '') : '';
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const [pathnamePart, searchPart = ''] = normalizedPath.split('?');
  url.pathname = `${basePath}${pathnamePart}` || '/';
  url.search = searchPart ? `?${searchPart}` : '';
  url.hash = '';
  return url.toString();
}

export function buildLegalAcceptancePayload(): LegalAcceptancePayload {
  return {
    accepted: true,
    onboardingAgreementVersion: 'v1.0.0-20260305',
    platformRulesVersion: 'v1.0.0-20260305',
    privacyDataProcessingVersion: 'v1.0.0-20260305',
  };
}

export function buildBusinessHoursRanges(days = [1, 2, 3, 4, 5]): BusinessHoursRange[] {
  return days.map((day) => ({ day, start: '09:00', end: '18:00' }));
}

export function buildForemanPortfolioCases(options?: { imageCount?: number; includeOther?: boolean }) {
  const imageCount = options?.imageCount ?? 2;
  const cases = FOREMAN_REQUIRED_CASES.map((item) => ({
    category: item.category,
    description: `${item.title}说明，建议填写主要辅材品牌名与施工节点做法`,
    images: Array.from({ length: imageCount }, (_, index) => `https://example.com/${item.category}-${index + 1}.jpg`),
  }));

  if (!options?.includeOther) {
    return cases;
  }

  return [
    ...cases,
    {
      category: 'other',
      description: '其他施工展示说明',
      images: Array.from({ length: imageCount }, (_, index) => `https://example.com/other-${index + 1}.jpg`),
    },
  ];
}

export function buildMaterialProducts(count: number, options?: { imageCount?: number; unit?: string }) {
  const imageCount = options?.imageCount ?? 1;
  const unit = options?.unit ?? '套';
  return Array.from({ length: count }, (_, index) => ({
    name: `主材商品${index + 1}`,
    unit,
    price: 199 + index,
    images: Array.from({ length: imageCount }, (_, imageIndex) => `https://example.com/material-${index + 1}-${imageIndex + 1}.jpg`),
  }));
}

export function buildRandomMainlandPhone(prefix = '19'): string {
  const normalizedPrefix = /^1\d$/.test(prefix) ? prefix : '19';
  const entropy = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return `${normalizedPrefix}${entropy.slice(-9)}`.slice(0, 11);
}

function normalizePath(path: string) {
  if (path.startsWith('/')) {
    return path;
  }
  return `/${path}`;
}

async function parseEnvelope<T>(response: APIResponse): Promise<ApiEnvelope<T>> {
  try {
    return (await response.json()) as ApiEnvelope<T>;
  } catch {
    return {
      code: response.status,
      message: await response.text(),
      data: null as T,
    };
  }
}

export async function merchantApiGet<T = any>(
  request: APIRequestContext,
  baseUrl: string,
  path: string,
  token?: string,
) {
  const response = await request.get(`${baseUrl}${normalizePath(path)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  return {
    status: response.status(),
    body: await parseEnvelope<T>(response),
  };
}

export async function merchantApiPost<T = any>(
  request: APIRequestContext,
  baseUrl: string,
  path: string,
  payload?: unknown,
  token?: string,
) {
  const response = await request.post(`${baseUrl}${normalizePath(path)}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    data: payload,
  });

  return {
    status: response.status(),
    body: await parseEnvelope<T>(response),
  };
}

export async function merchantApiPut<T = any>(
  request: APIRequestContext,
  baseUrl: string,
  path: string,
  payload?: unknown,
  token?: string,
) {
  const response = await request.put(`${baseUrl}${normalizePath(path)}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    data: payload,
  });

  return {
    status: response.status(),
    body: await parseEnvelope<T>(response),
  };
}

export async function loginMerchantByApi(
  request: APIRequestContext,
  apiBaseUrl: string,
  phone: string,
  code: string,
): Promise<MerchantLoginApiData> {
  const result = await merchantApiPost<MerchantLoginApiData>(request, apiBaseUrl, '/merchant/login', {
    phone,
    code,
  });

  expect(result.status, 'merchant login should not return 5xx').toBeLessThan(500);
  expect(result.status, 'merchant login http status should be 200').toBe(200);
  expect(result.body.code, `merchant login business code should be 0, message=${result.body.message}`).toBe(0);
  expect(result.body.data?.token, 'merchant login should return token').toBeTruthy();

  return result.body.data;
}

export async function loginAdminByApi(
  request: APIRequestContext,
  apiBaseUrl: string,
  username: string,
  password: string,
): Promise<string> {
  const result = await merchantApiPost<AdminLoginApiData>(request, apiBaseUrl, '/admin/login', {
    username,
    password,
  });

  expect(result.status, 'admin login should return HTTP 200').toBe(200);
  expect(result.body.code, `admin login business code should be 0, message=${result.body.message}`).toBe(0);
  expect(result.body.data?.token, 'admin login should return token').toBeTruthy();

  return result.body.data.token;
}

export async function getMerchantApplyStatusByPhone(
  request: APIRequestContext,
  apiBaseUrl: string,
  phone: string,
) {
  return merchantApiGet<MerchantApplyStatusData>(request, apiBaseUrl, `/merchant/apply/${phone}/status`);
}

export async function getMaterialShopApplyStatusByPhone(
  request: APIRequestContext,
  apiBaseUrl: string,
  phone: string,
) {
  return merchantApiGet<MaterialShopApplyStatusData>(request, apiBaseUrl, `/material-shop/apply/${phone}/status`);
}

export async function approveMerchantApplication(
  request: APIRequestContext,
  apiBaseUrl: string,
  adminToken: string,
  applicationId: number,
) {
  return merchantApiPost<{ providerId: number }>(
    request,
    apiBaseUrl,
    `/admin/merchant-applications/${applicationId}/approve`,
    {},
    adminToken,
  );
}

export async function rejectMerchantApplication(
  request: APIRequestContext,
  apiBaseUrl: string,
  adminToken: string,
  applicationId: number,
  reason = 'E2E reject for resubmit validation',
) {
  return merchantApiPost<{ message: string }>(
    request,
    apiBaseUrl,
    `/admin/merchant-applications/${applicationId}/reject`,
    { reason },
    adminToken,
  );
}

export async function approveMaterialShopApplication(
  request: APIRequestContext,
  apiBaseUrl: string,
  adminToken: string,
  applicationId: number,
) {
  return merchantApiPost<{ shopId: number }>(
    request,
    apiBaseUrl,
    `/admin/material-shop-applications/${applicationId}/approve`,
    {},
    adminToken,
  );
}

export async function rejectMaterialShopApplication(
  request: APIRequestContext,
  apiBaseUrl: string,
  adminToken: string,
  applicationId: number,
  reason = 'E2E reject for resubmit validation',
) {
  return merchantApiPost<{ message: string }>(
    request,
    apiBaseUrl,
    `/admin/material-shop-applications/${applicationId}/reject`,
    { reason },
    adminToken,
  );
}

export async function loginMerchantByUi(
  page: Page,
  origin: string,
  phone: string,
  code: string,
): Promise<void> {
  const base = origin.replace(/\/$/, '');
  await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded' });

  await page.getByPlaceholder('请输入11位手机号').fill(phone);
  await page.getByPlaceholder('请输入6位验证码').fill(code);

  await page.getByRole('button', { name: /登\s*录/ }).click();
  await page.waitForURL(
    (url) => {
      const path = url.pathname;
      return path.endsWith('/dashboard') || path.endsWith('/material-shop/settings');
    },
    { timeout: 30_000 },
  );
}
