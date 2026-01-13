import { useAuthStore, type AuthUser } from '@/store/auth';
import { request } from '@/utils/request';

interface TokenPayload {
  token: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthUser;
}

interface WechatLoginResult {
  needBindPhone?: boolean;
  bindToken?: string;
  expiresIn?: number;
  token?: string;
  refreshToken?: string;
  user?: AuthUser;
}

export async function loginWithWxCode(code: string) {
  const data = await request<WechatLoginResult>({
    url: '/auth/wechat/mini/login',
    method: 'POST',
    data: { code }
  });

  if (data.token && data.refreshToken && data.user) {
    useAuthStore.getState().setAuth({
      token: data.token,
      refreshToken: data.refreshToken,
      expiresIn: data.expiresIn || 0,
      user: data.user
    });
  }

  return data;
}

export async function bindPhone(bindToken: string, phoneCode: string) {
  const data = await request<TokenPayload>({
    url: '/auth/wechat/mini/bind-phone',
    method: 'POST',
    data: { bindToken, phoneCode },
    showLoading: true
  });
  useAuthStore.getState().setAuth(data);
  return data;
}
