import type { AuthResponseData } from '../types/api';
import { requestJson } from './http';

interface SendCodePayload {
  phone: string;
  purpose: 'login';
}

interface SendCodeResponse {
  expiresIn: number;
  requestId?: string;
  debugCode?: string;
  debugOnly?: boolean;
}

export function sendLoginCode(payload: SendCodePayload) {
  return requestJson<SendCodeResponse>('/auth/send-code', {
    method: 'POST',
    body: payload,
    skipAuth: true,
  });
}

export function loginByCode(payload: { phone: string; code: string }) {
  return requestJson<AuthResponseData>('/auth/login', {
    method: 'POST',
    body: payload,
    skipAuth: true,
  });
}
