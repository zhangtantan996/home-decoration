import { request } from '@/utils/request';

export interface Identity {
  id: number;
  userId: number;
  identityType: string;
  identityName: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface SwitchIdentityResponse {
  token: string;
  refreshToken: string;
  expiresIn: number;
  activeRole: string;
}

export interface ApplyIdentityRequest {
  identityType: string;
  documents?: string[];
}

export const identityService = {
  list: () => request<Identity[]>({ url: '/identities' }),

  getCurrent: () => request<Identity>({ url: '/identities/current' }),

  switch: (identityId: number) =>
    request<SwitchIdentityResponse>({
      url: '/identities/switch',
      method: 'POST',
      data: { identityId }
    }),

  apply: (data: ApplyIdentityRequest) =>
    request<Identity>({
      url: '/identities/apply',
      method: 'POST',
      data
    })
};
