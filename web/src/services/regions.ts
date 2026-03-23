import { requestJson } from './http';

interface RegionDTO {
  code: string;
  name: string;
  parentCode: string;
  parentName?: string;
}

export async function listPublicCities() {
  const data = await requestJson<RegionDTO[]>('/regions/service-cities', { skipAuth: true });
  return data.map((item) => item.name).filter(Boolean);
}
