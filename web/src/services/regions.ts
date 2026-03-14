import { requestJson } from './http';

interface RegionDTO {
  code: string;
  name: string;
  level: number;
  parentCode: string;
  enabled: boolean;
  sortOrder: number;
}

export async function listPublicCities() {
  const data = await requestJson<RegionDTO[]>('/regions/cities', { skipAuth: true });
  return data.map((item) => item.name).filter(Boolean);
}
