import { requestJson } from './http';
import { readThroughCache } from './runtimeCache';

const PUBLIC_CITY_TTL_MS = 10 * 60 * 1000;

interface RegionDTO {
  code: string;
  name: string;
  parentCode: string;
  parentName?: string;
}

export async function listPublicCities() {
  const data = await readThroughCache(
    'regions:service-cities',
    PUBLIC_CITY_TTL_MS,
    () => requestJson<RegionDTO[]>('/regions/service-cities', { skipAuth: true }),
    'public',
  );
  return data.map((item) => item.name).filter(Boolean);
}
