import { useAuthStore, type AuthUser } from '@/store/auth';
import { request } from '@/utils/request';

interface SendCodeResult {
  expiresIn: number;
  requestId?: string;
  debugCode?: string;
  debugOnly?: boolean;
}

interface LoginTokenPayload {
  token: string;
  refreshToken: string;
  expiresIn: number;
  activeRole?: string;
  providerSubType?: AuthUser['providerSubType'];
  user: AuthUser;
}

interface WechatAuthorizeResult {
  url: string;
  state: string;
}

interface WechatH5LoginResult {
  needBindPhone?: boolean;
  bindToken?: string;
  expiresIn?: number;
  token?: string;
  refreshToken?: string;
  user?: AuthUser;
  activeRole?: string;
  providerSubType?: AuthUser['providerSubType'];
}

export async function sendLoginCode(phone: string) {
  return request<SendCodeResult>({
    url: '/auth/send-code',
    method: 'POST',
    data: { phone, purpose: 'login' },
    showLoading: true,
  });
}

export async function loginWithSmsCode(phone: string, code: string) {
  const data = await request<LoginTokenPayload>({
    url: '/auth/login',
    method: 'POST',
    data: { phone, code },
    showLoading: true,
  });

  useAuthStore.getState().setAuth({
    token: data.token,
    refreshToken: data.refreshToken,
    expiresIn: data.expiresIn || 0,
    user: {
      ...data.user,
      activeRole: data.activeRole,
      providerSubType: data.providerSubType,
    },
  });

  return data;
}

export async function getWechatH5AuthorizeUrl() {
  return request<WechatAuthorizeResult>({
    url: '/auth/wechat/h5/authorize',
    method: 'GET',
    showLoading: true,
  });
}

export async function wechatH5Login(code: string, state: string) {
  const data = await request<WechatH5LoginResult>({
    url: '/auth/wechat/h5/login',
    method: 'POST',
    data: { code, state },
    showLoading: true,
  });

  if (data.token && data.refreshToken && data.user) {
    useAuthStore.getState().setAuth({
      token: data.token,
      refreshToken: data.refreshToken,
      expiresIn: data.expiresIn || 0,
      user: {
        ...data.user,
        activeRole: data.activeRole,
        providerSubType: data.providerSubType,
      },
    });
  }

  return data;
}

export async function wechatH5BindPhone(bindToken: string, phone: string, code: string) {
  const data = await request<LoginTokenPayload>({
    url: '/auth/wechat/h5/bind-phone',
    method: 'POST',
    data: { bindToken, phone, code },
    showLoading: true,
  });

  useAuthStore.getState().setAuth({
    token: data.token,
    refreshToken: data.refreshToken,
    expiresIn: data.expiresIn || 0,
    user: {
      ...data.user,
      activeRole: data.activeRole,
      providerSubType: data.providerSubType,
    },
  });

  return data;
}
