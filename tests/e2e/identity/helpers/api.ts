import { expect, type APIRequestContext } from '@playwright/test';

export interface ApiEnvelope<T = any> {
  code: number;
  message: string;
  data: T;
}

export interface ApiCallResult<T = any> {
  status: number;
  body: ApiEnvelope<T>;
}

function normalizePath(path: string) {
  if (!path.startsWith('/')) {
    return `/${path}`;
  }
  return path;
}

export async function apiGet<T = any>(
  api: APIRequestContext,
  baseUrl: string,
  path: string,
  token?: string,
): Promise<ApiCallResult<T>> {
  const response = await api.get(`${baseUrl}${normalizePath(path)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  let body: ApiEnvelope<T>;
  try {
    body = (await response.json()) as ApiEnvelope<T>;
  } catch {
    body = { code: response.status(), message: await response.text(), data: null as T };
  }

  return {
    status: response.status(),
    body,
  };
}

export async function apiPost<T = any>(
  api: APIRequestContext,
  baseUrl: string,
  path: string,
  payload?: unknown,
  token?: string,
): Promise<ApiCallResult<T>> {
  const response = await api.post(`${baseUrl}${normalizePath(path)}`, {
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      : {
          'Content-Type': 'application/json',
        },
    data: payload,
  });

  let body: ApiEnvelope<T>;
  try {
    body = (await response.json()) as ApiEnvelope<T>;
  } catch {
    body = { code: response.status(), message: await response.text(), data: null as T };
  }

  return {
    status: response.status(),
    body,
  };
}

export function expectNoServerError(status: number, message: string) {
  expect(status, message).toBeLessThan(500);
}

export function expectSuccessCode(result: ApiCallResult<any>, message?: string) {
  expect(result.status, message || 'HTTP status should be 200').toBe(200);
  expect(result.body.code, message || 'Business code should be 0').toBe(0);
}
