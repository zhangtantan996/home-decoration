import { requestJson } from './http';

export interface PublicDictOption {
  value: string;
  label: string;
  extraData?: Record<string, unknown>;
}

export async function getDictionaryOptions(category: string) {
  return requestJson<PublicDictOption[]>(`/dictionaries/${category}`, { skipAuth: true });
}
