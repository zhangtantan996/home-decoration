import { request } from '@/utils/request';

export interface RegionNode {
  code: string;
  name: string;
  parentCode?: string;
}

export async function listProvinces() {
  return request<RegionNode[]>({
    url: '/regions/provinces'
  });
}

export async function listCities(provinceCode: string) {
  return request<RegionNode[]>({
    url: `/regions/provinces/${provinceCode}/cities`
  });
}

export async function listDistricts(cityCode: string) {
  return request<RegionNode[]>({
    url: `/regions/cities/${cityCode}/districts`
  });
}

export async function listRegionChildren(parentCode: string) {
  return request<RegionNode[]>({
    url: `/regions/children/${parentCode}`
  });
}
