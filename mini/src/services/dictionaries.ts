import { request } from '@/utils/request';

export interface DictionaryOption {
  label: string;
  value: string;
}

export async function listCategories() {
  return request<Array<{ code: string; name: string }>>({
    url: '/dictionaries/categories'
  });
}

export async function getDictionary(category: string) {
  return request<DictionaryOption[]>({
    url: `/dictionaries/${category}`
  });
}
