import { create } from "zustand";
import { supervisorOnboardingApi } from "../services/supervisorApi";

// 本地定义，避免从 supervisorApi 跨模块 import type 引起 Vite HMR 误判
interface ServiceCityOption {
  code: string;
  name: string;
}

interface RegionState {
  cities: ServiceCityOption[];
  districtsByCity: Record<string, ServiceCityOption[]>;
  loading: boolean;

  fetchCities: () => Promise<ServiceCityOption[]>;
  fetchDistricts: (cityCode: string) => Promise<ServiceCityOption[]>;
  getCityName: (code: string) => string;
  getDistrictMap: (cityCode: string) => Record<string, string>;
}

export const useRegionStore = create<RegionState>((set, get) => ({
  cities: [],
  districtsByCity: {},
  loading: false,

  fetchCities: async () => {
    const { cities } = get();
    if (cities.length > 0) return cities;

    set({ loading: true });
    try {
      const data = await supervisorOnboardingApi.listServiceCities();
      set({ cities: data });
      return data;
    } finally {
      set({ loading: false });
    }
  },

  fetchDistricts: async (cityCode: string) => {
    if (!cityCode) return [];
    const { districtsByCity } = get();
    if (districtsByCity[cityCode]) return districtsByCity[cityCode];

    set({ loading: true });
    try {
      const data = await supervisorOnboardingApi.listDistrictsByCity(cityCode);
      set((state) => ({
        districtsByCity: { ...state.districtsByCity, [cityCode]: data },
      }));
      return data;
    } finally {
      set({ loading: false });
    }
  },

  getCityName: (code: string) => {
    const city = get().cities.find((c) => c.code === code);
    return city ? city.name : "";
  },

  getDistrictMap: (cityCode: string) => {
    const districts = get().districtsByCity[cityCode] || [];
    const map: Record<string, string> = {};
    districts.forEach((d) => {
      map[d.code] = d.name;
    });
    return map;
  },
}));
