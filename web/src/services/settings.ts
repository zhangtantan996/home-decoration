import type { SettingsFormVM } from '../types/viewModels';
import { requestJson } from './http';

export async function getUserSettings() {
  return requestJson<SettingsFormVM>('/user/settings');
}

export async function updateUserSettings(payload: SettingsFormVM) {
  await requestJson('/user/settings', {
    method: 'PUT',
    body: payload,
  });
}
