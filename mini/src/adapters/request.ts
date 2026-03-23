import { request, type RequestOptions } from '@/utils/request';

import type { RequestAdapter } from './types';

const requestAdapter: RequestAdapter = {
  request,
  get: (url, data) =>
    request({
      url,
      method: 'GET',
      data,
    } satisfies RequestOptions<unknown>) as Promise<any>,
  post: (url, data) =>
    request({
      url,
      method: 'POST',
      data,
    } satisfies RequestOptions<unknown>) as Promise<any>,
  put: (url, data) =>
    request({
      url,
      method: 'PUT',
      data,
    } satisfies RequestOptions<unknown>) as Promise<any>,
  del: (url, data) =>
    request({
      url,
      method: 'DELETE',
      data,
    } satisfies RequestOptions<unknown>) as Promise<any>,
};

export const miniRequestAdapter = requestAdapter;
