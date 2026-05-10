import type { DefaultOptionType } from 'antd/es/select';

import type { ServiceCityRegion } from '../services/regionApi';

export interface ServiceCityOption extends DefaultOptionType {
  label: string;
  value: string;
  searchText?: string;
}

export interface ServiceCityGroupOption extends DefaultOptionType {
  label: string;
  options: ServiceCityOption[];
}

export interface ServiceAreaCascaderOption {
  label: string;
  value: string;
  isLeaf?: boolean;
  loading?: boolean;
  children?: ServiceAreaCascaderOption[];
  searchText?: string;
}

export interface ServiceAreaPickerCity {
  label: string;
  value: string;
  provinceCode: string;
  provinceName: string;
  searchText: string;
}

export interface ServiceAreaPickerProvince {
  label: string;
  value: string;
  searchText: string;
  cities: ServiceAreaPickerCity[];
}

const normalizeSearchText = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[省市区县]/g, '');

const buildCitySearchText = (city: ServiceCityRegion) => {
  const parts = [
    city.name,
    city.name?.replace(/市$/, ''),
    city.parentName,
    city.parentName?.replace(/省$/, ''),
    city.code,
  ];
  return parts.map(normalizeSearchText).filter(Boolean).join(' ');
};

export const buildServiceCityGroups = (cities: ServiceCityRegion[]): ServiceCityGroupOption[] => {
  const grouped = new Map<string, ServiceCityOption[]>();
  const seenCodes = new Set<string>();

  cities.forEach((city) => {
    const code = String(city.code || '').trim();
    const name = String(city.name || '').trim();
    if (!code || !name || seenCodes.has(code)) {
      return;
    }
    seenCodes.add(code);

    const provinceName = city.parentName?.trim() || '未分组';
    const bucket = grouped.get(provinceName) || [];
    bucket.push({
      label: name,
      value: code,
      searchText: buildCitySearchText(city),
    });
    grouped.set(provinceName, bucket);
  });

  return [...grouped.entries()].map(([label, options]) => ({ label, options }));
};

export const filterServiceCityOption = (input: string, option?: DefaultOptionType) => {
  const keyword = normalizeSearchText(input);
  if (!keyword) {
    return true;
  }

  const searchText = normalizeSearchText((option as ServiceCityOption | undefined)?.searchText);
  const label = normalizeSearchText(option?.label);
  const value = normalizeSearchText(option?.value);

  return searchText.includes(keyword) || label.includes(keyword) || value.includes(keyword);
};

export const flattenServiceCityOptions = (groups: ServiceCityGroupOption[]) =>
  groups.flatMap((group) => group.options || []);

export const buildServiceAreaCascaderOptions = (cities: ServiceCityRegion[]): ServiceAreaCascaderOption[] => {
  const grouped = new Map<string, ServiceAreaCascaderOption>();
  const seenCities = new Set<string>();

  cities.forEach((city) => {
    const code = String(city.code || '').trim();
    const name = String(city.name || '').trim();
    if (!code || !name || seenCities.has(code)) {
      return;
    }
    seenCities.add(code);

    const provinceCode = String(city.parentCode || city.parentName || 'unknown').trim();
    const provinceName = city.parentName?.trim() || '未分组';
    const province = grouped.get(provinceCode) || {
      label: provinceName,
      value: provinceCode,
      isLeaf: false,
      children: [],
      searchText: normalizeSearchText(`${provinceName} ${provinceCode}`),
    };

    province.children = [
      ...(province.children || []),
      {
        label: name,
        value: code,
        isLeaf: false,
        children: [],
        searchText: buildCitySearchText(city),
      },
    ];
    grouped.set(provinceCode, province);
  });

  return [...grouped.values()];
};

export const buildServiceAreaPickerOptions = (cities: ServiceCityRegion[]): ServiceAreaPickerProvince[] => {
  const grouped = new Map<string, ServiceAreaPickerProvince>();
  const seenCities = new Set<string>();

  cities.forEach((city) => {
    const code = String(city.code || '').trim();
    const name = String(city.name || '').trim();
    if (!code || !name || seenCities.has(code)) {
      return;
    }
    seenCities.add(code);

    const provinceCode = String(city.parentCode || city.parentName || 'unknown').trim();
    const provinceName = city.parentName?.trim() || '未分组';
    const province = grouped.get(provinceCode) || {
      label: provinceName,
      value: provinceCode,
      searchText: normalizeSearchText(`${provinceName} ${provinceCode}`),
      cities: [],
    };

    province.cities.push({
      label: name,
      value: code,
      provinceCode,
      provinceName,
      searchText: buildCitySearchText(city),
    });
    grouped.set(provinceCode, province);
  });

  return [...grouped.values()];
};

export const getServiceAreaLeafValues = (values?: unknown) => (
  Array.isArray(values)
    ? values
        .map((item) => {
          if (Array.isArray(item)) {
            return item[item.length - 1];
          }
          return item;
        })
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    : []
);

export const getServiceAreaSubmitValues = (values?: unknown) => {
  if (!Array.isArray(values)) {
    return [];
  }

  const result: string[] = [];
  values.forEach((item) => {
    if (Array.isArray(item)) {
      const path = item.map((value) => String(value || '').trim()).filter(Boolean);
      if (path.length === 0) {
        return;
      }
      if (path.length === 1) {
        result.push(path[0]);
        return;
      }
      result.push(path[1]);
      if (path.length >= 3) {
        result.push(path[path.length - 1]);
      }
      return;
    }

    const value = String(item || '').trim();
    if (value) {
      result.push(value);
    }
  });

  return Array.from(new Set(result));
};

export const normalizeServiceAreaSelectionValues = (values: unknown, provinces: ServiceAreaPickerProvince[]) => {
  const selectedProvinces = new Set<string>();
  const selectedCities = new Set<string>();
  const selectedDistricts = new Set<string>();

  if (!Array.isArray(values)) {
    return { selectedProvinces, selectedCities, selectedDistricts };
  }

  const provinceMap = new Map(provinces.map((province) => [province.value, province]));
  const provinceNameMap = new Map(provinces.map((province) => [province.label, province.value]));
  const cityToProvince = new Map<string, string>();
  const cityNameToCode = new Map<string, string>();
  provinces.forEach((province) => {
    province.cities.forEach((city) => {
      cityToProvince.set(city.value, province.value);
      cityNameToCode.set(city.label, city.value);
    });
  });

  values.forEach((item) => {
    const path = Array.isArray(item) ? item : [item];
    path
      .map((value) => String(value || '').trim())
      .filter(Boolean)
      .forEach((value) => {
        if (provinceMap.has(value)) {
          selectedProvinces.add(value);
          return;
        }
        const provinceCodeByName = provinceNameMap.get(value);
        if (provinceCodeByName) {
          selectedProvinces.add(provinceCodeByName);
          return;
        }
        const cityCode = cityNameToCode.get(value) || value;
        const provinceCode = cityToProvince.get(cityCode);
        if (provinceCode) {
          selectedProvinces.add(provinceCode);
          selectedCities.add(cityCode);
          return;
        }
        if (/^\d{6}$/.test(value) && value.endsWith('0000')) {
          if (provinceMap.has(value)) {
            selectedProvinces.add(value);
            return;
          }
        }
        if (/^\d{6}$/.test(value) && value.endsWith('00')) {
          const inferredProvinceCode = `${value.slice(0, 2)}0000`;
          if (provinceMap.has(inferredProvinceCode)) {
            selectedProvinces.add(inferredProvinceCode);
          }
          selectedCities.add(value);
          return;
        }
        if (/^\d{6}$/.test(value)) {
          const inferredCityCode = `${value.slice(0, 4)}00`;
          const inferredProvinceCode = `${value.slice(0, 2)}0000`;
          if (provinceMap.has(inferredProvinceCode)) {
            selectedProvinces.add(inferredProvinceCode);
          }
          selectedCities.add(inferredCityCode);
        }
        selectedDistricts.add(value);
      });
  });

  return { selectedProvinces, selectedCities, selectedDistricts };
};
