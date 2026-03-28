import { request } from '@/utils/request';

export interface Identity {
  id: number;
  userId?: number;
  identityType: 'owner' | 'provider' | 'admin';
  providerSubType?: 'designer' | 'company' | 'foreman';
  identityName?: string;
  status: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SwitchIdentityResponse {
  token: string;
  refreshToken: string;
  expiresIn: number;
  activeRole: 'owner' | 'provider' | 'admin';
  providerSubType?: 'designer' | 'company' | 'foreman';
  providerId?: number;
}

export interface ApplyIdentityRequest {
  identityType: 'provider';
  providerSubType: 'designer' | 'company' | 'foreman';
  applicationData?: string;
}

export const identityService = {
  list: async () => {
    const data = await request<{ identities: Identity[] }>({ url: '/identities' });
    return data.identities || [];
  },

  switch: (identityId: number) =>
    request<SwitchIdentityResponse>({
      url: '/identities/switch',
      method: 'POST',
      data: { identityId },
    }),

  apply: (data: ApplyIdentityRequest) =>
    request<Identity>({
      url: '/identities/apply',
      method: 'POST',
      data,
    }),
};
