import { MINI_CHAT_ENABLED } from '@/config/features';
import { useAuthStore, type AuthUser } from '@/store/auth';
import { refreshTinodeToken } from '@/services/tinode';
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

async function refreshTinodeAuthBestEffort() {
  if (!MINI_CHAT_ENABLED) {
    useAuthStore.getState().updateTinodeAuth({ tinodeToken: '', tinodeError: '' });
    return;
  }

  try {
    const result = await refreshTinodeToken();
    useAuthStore.getState().updateTinodeAuth({
      tinodeToken: result.tinodeToken || '',
      tinodeError: result.tinodeError || '',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tinode token 获取失败';
    useAuthStore.getState().updateTinodeAuth({ tinodeToken: '', tinodeError: message });
  }
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

    await refreshTinodeAuthBestEffort();
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
  await refreshTinodeAuthBestEffort();
  return data;
}
