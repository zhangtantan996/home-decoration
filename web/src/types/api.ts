export interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

export interface PageEnvelope<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SessionUser {
  id: number;
  publicId?: string;
  phone: string;
  nickname?: string;
  avatar?: string;
  userType?: number;
}

export interface AuthResponseData {
  token: string;
  refreshToken: string;
  expiresIn: number;
  activeRole?: string;
  providerId?: number;
  providerSubType?: string;
  user?: SessionUser;
}
