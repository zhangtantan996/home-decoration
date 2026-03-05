import { request } from '@/utils/request';

export interface RefreshTinodeTokenResult {
  tinodeToken: string;
  tinodeError: string;
}

export async function refreshTinodeToken() {
  return request<RefreshTinodeTokenResult>({
    url: '/tinode/refresh-token',
    method: 'POST',
  });
}

export interface TinodeUserIdResult {
  tinodeUserId: string;
}

export async function getTinodeUserId(userId: string | number) {
  return request<TinodeUserIdResult>({
    url: `/tinode/userid/${encodeURIComponent(String(userId))}`,
  });
}

