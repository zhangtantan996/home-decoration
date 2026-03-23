import type { SettingsFormVM } from '../types/viewModels';
import { requestJson } from './http';

export interface UserVerificationRecord {
  status: -1 | 0 | 1 | 2;
  message?: string;
  realName?: string;
  idCard?: string;
  idFrontImage?: string;
  idBackImage?: string;
  rejectReason?: string;
  verifiedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SubmitVerificationPayload {
  realName: string;
  idCard: string;
  idFrontImage: string;
  idBackImage: string;
}

export function getUserSettings() {
  return requestJson<SettingsFormVM>('/user/settings');
}

export async function updateUserSettings(payload: SettingsFormVM) {
  await requestJson('/user/settings', {
    method: 'PUT',
    body: payload,
  });
}

export async function changeUserPhone(payload: { newPhone: string; code: string }) {
  await requestJson('/user/change-phone', {
    method: 'POST',
    body: payload,
  });
}

export function getUserVerification() {
  return requestJson<UserVerificationRecord>('/user/verification');
}

export async function submitUserVerification(payload: SubmitVerificationPayload) {
  await requestJson('/user/verification', {
    method: 'POST',
    body: payload,
  });
}

export async function deleteUserAccount(payload: { code: string }) {
  await requestJson('/user/delete-account', {
    method: 'POST',
    body: payload,
  });
}
