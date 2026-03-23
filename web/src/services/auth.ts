import type { AuthResponseData } from '../types/api';
import { requestJson } from './http';

export type SendCodePurpose = 'login' | 'change_phone' | 'delete_account';

export interface SendCodePayload {
  phone: string;
  purpose: SendCodePurpose;
  captchaToken?: string;
}

export interface SendCodeResponse {
  expiresIn: number;
  requestId?: string;
  debugCode?: string;
  debugOnly?: boolean;
}

export function sendCode(payload: SendCodePayload) {
  return requestJson<SendCodeResponse>('/auth/send-code', {
    method: 'POST',
    body: payload,
    skipAuth: true,
  });
}

export function sendLoginCode(payload: Omit<SendCodePayload, 'purpose'> | SendCodePayload) {
  const { phone, captchaToken } = payload;
  return sendCode({
    phone,
    captchaToken,
    purpose: 'login',
  });
}

export function loginByCode(payload: { phone: string; code: string }) {
  return requestJson<AuthResponseData>('/auth/login', {
    method: 'POST',
    body: payload,
    skipAuth: true,
  });
}
