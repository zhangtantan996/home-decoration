import { request } from '@/utils/request';

export interface UserProfile {
  id: number;
  phone: string;
  nickname: string;
  avatar?: string;
  email?: string;
  realName?: string;
  idCard?: string;
  address?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfileDTO {
  nickname?: string;
  avatar?: string;
  email?: string;
  realName?: string;
  address?: string;
}

/**
 * 获取用户资料
 */
export async function getUserProfile(): Promise<UserProfile> {
  return request<UserProfile>({
    url: '/user/profile',
    method: 'GET',
  });
}

/**
 * 更新用户资料
 */
export async function updateUserProfile(data: UpdateProfileDTO): Promise<UserProfile> {
  return request<UserProfile>({
    url: '/user/profile',
    method: 'PUT',
    data,
  });
}
