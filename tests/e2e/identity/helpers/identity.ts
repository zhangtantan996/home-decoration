import type { APIRequestContext } from '@playwright/test';
import { apiGet, apiPost, expectNoServerError, expectSuccessCode, type ApiCallResult } from './api';

interface LoginData {
  token: string;
  refreshToken: string;
  user: {
    id: number;
    phone: string;
  };
}

interface AdminLoginData {
  token: string;
}

interface IdentityApplicationItem {
  id: number;
  userId: number;
  identityType: string;
  providerSubType?: string;
  status: number;
  rejectReason?: string;
}

interface IdentityListData {
  identities: Array<{
    id: number;
    identityType: string;
    providerSubType?: string;
    status: number;
  }>;
}

interface SwitchData {
  token: string;
  refreshToken: string;
  activeRole: string;
  providerSubType?: string;
  providerId?: number;
}

interface RefreshData {
  token: string;
  refreshToken: string;
  activeRole: string;
  providerSubType?: string;
  providerId?: number;
}

interface IdentityApplicationListData {
  list: IdentityApplicationItem[];
  total: number;
}

const MAX_RATE_LIMIT_RETRIES = 2;
const RATE_LIMIT_RETRY_DELAY_MS = 1200;

function isRateLimited(result: ApiCallResult<any>) {
  if (result.status === 429) {
    return true;
  }
  if (Number(result.body?.code) === 429) {
    return true;
  }
  return false;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postWithRateLimitRetry<T>(
  api: APIRequestContext,
  apiBaseUrl: string,
  path: string,
  payload: unknown,
  token: string | undefined,
  scene: string,
): Promise<ApiCallResult<T>> {
  let attempt = 0;
  let result = await apiPost<T>(api, apiBaseUrl, path, payload, token);

  while (isRateLimited(result) && attempt < MAX_RATE_LIMIT_RETRIES) {
    attempt += 1;
    await sleep(RATE_LIMIT_RETRY_DELAY_MS * attempt);
    result = await apiPost<T>(api, apiBaseUrl, path, payload, token);
  }

  if (attempt > 0 && isRateLimited(result)) {
    throw new Error(`${scene} reached 429 after retry`);
  }

  return result;
}

export async function loginUserByCode(
  api: APIRequestContext,
  apiBaseUrl: string,
  phone: string,
): Promise<LoginData> {
  const loginResult = await postWithRateLimitRetry<LoginData>(api, apiBaseUrl, '/auth/login', {
    phone,
    type: 'code',
    code: '123456',
  }, undefined, 'user login');

  expectNoServerError(loginResult.status, 'user login must not return 5xx');
  expectSuccessCode(loginResult, 'user login should succeed');

  return loginResult.body.data;
}

export async function adminLogin(
  api: APIRequestContext,
  apiBaseUrl: string,
  username: string,
  password: string,
): Promise<AdminLoginData> {
  const result = await postWithRateLimitRetry<AdminLoginData>(api, apiBaseUrl, '/admin/login', {
    username,
    password,
  }, undefined, 'admin login');

  expectNoServerError(result.status, 'admin login must not return 5xx');
  expectSuccessCode(result, 'admin login should succeed');
  return result.body.data;
}

export async function applyProviderIdentity(
  api: APIRequestContext,
  apiBaseUrl: string,
  userToken: string,
  providerSubType: string,
  runId: string,
  marker: string,
): Promise<ApiCallResult<any>> {
  return apiPost(
    api,
    apiBaseUrl,
    '/identities/apply',
    {
      identityType: 'provider',
      providerSubType,
      applicationData: JSON.stringify({ runId, marker, source: 'identity-acceptance' }),
    },
    userToken,
  );
}

export async function listPendingIdentityApplications(
  api: APIRequestContext,
  apiBaseUrl: string,
  adminToken: string,
): Promise<IdentityApplicationItem[]> {
  const result = await apiGet<IdentityApplicationListData>(
    api,
    apiBaseUrl,
    '/admin/identity-applications?page=1&pageSize=200&status=0',
    adminToken,
  );

  expectNoServerError(result.status, 'admin list identity applications must not return 5xx');
  expectSuccessCode(result, 'admin list identity applications should succeed');

  return result.body.data.list || [];
}

export async function getIdentityApplicationDetail(
  api: APIRequestContext,
  apiBaseUrl: string,
  adminToken: string,
  applicationId: number,
): Promise<IdentityApplicationItem> {
  const result = await apiGet<IdentityApplicationItem>(
    api,
    apiBaseUrl,
    `/admin/identity-applications/${applicationId}`,
    adminToken,
  );

  expectNoServerError(result.status, 'admin get identity application detail must not return 5xx');
  expectSuccessCode(result, 'admin get identity application detail should succeed');

  return result.body.data;
}

export async function approveIdentityApplication(
  api: APIRequestContext,
  apiBaseUrl: string,
  adminToken: string,
  applicationId: number,
): Promise<void> {
  const result = await apiPost(
    api,
    apiBaseUrl,
    `/admin/identity-applications/${applicationId}/approve`,
    {},
    adminToken,
  );

  expectNoServerError(result.status, 'admin approve identity application must not return 5xx');
  expectSuccessCode(result, 'admin approve identity application should succeed');
}

export async function rejectIdentityApplication(
  api: APIRequestContext,
  apiBaseUrl: string,
  adminToken: string,
  applicationId: number,
  reason: string,
): Promise<void> {
  const result = await apiPost(
    api,
    apiBaseUrl,
    `/admin/identity-applications/${applicationId}/reject`,
    { reason },
    adminToken,
  );

  expectNoServerError(result.status, 'admin reject identity application must not return 5xx');
  expectSuccessCode(result, 'admin reject identity application should succeed');
}

export async function listUserIdentities(
  api: APIRequestContext,
  apiBaseUrl: string,
  userToken: string,
): Promise<IdentityListData> {
  const result = await apiGet<IdentityListData>(api, apiBaseUrl, '/identities', userToken);
  expectNoServerError(result.status, 'list identities must not return 5xx');
  expectSuccessCode(result, 'list identities should succeed');
  return result.body.data;
}

export async function switchIdentity(
  api: APIRequestContext,
  apiBaseUrl: string,
  userToken: string,
  identityId: number,
): Promise<SwitchData> {
  const result = await apiPost<SwitchData>(
    api,
    apiBaseUrl,
    '/identities/switch',
    { identityId },
    userToken,
  );

  expectNoServerError(result.status, 'switch identity must not return 5xx');
  expectSuccessCode(result, 'switch identity should succeed');
  return result.body.data;
}

export async function refreshToken(
  api: APIRequestContext,
  apiBaseUrl: string,
  refreshTokenValue: string,
): Promise<RefreshData> {
  const result = await apiPost<RefreshData>(api, apiBaseUrl, '/auth/refresh', {
    refreshToken: refreshTokenValue,
  });

  expectNoServerError(result.status, 'refresh token must not return 5xx');
  expectSuccessCode(result, 'refresh token should succeed');
  return result.body.data;
}
