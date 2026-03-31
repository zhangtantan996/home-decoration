import { requestJson } from './http';
import { readThroughCache } from './runtimeCache';

const PUBLIC_DICTIONARY_TTL_MS = 10 * 60 * 1000;

export interface PublicDictOption {
  value: string;
  label: string;
  extraData?: Record<string, unknown>;
}

export async function getDictionaryOptions(category: string) {
  return readThroughCache(
    `dict:${category}`,
    PUBLIC_DICTIONARY_TTL_MS,
    () => requestJson<PublicDictOption[]>(`/dictionaries/${category}`, { skipAuth: true }),
    'public',
  );
}
