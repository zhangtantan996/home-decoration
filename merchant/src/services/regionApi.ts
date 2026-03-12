import { useState, useEffect } from 'react';
import api from './api';

// 行政区划接口类型
export interface Region {
    id: number;
    code: string;
    name: string;
    level: number;
    parentCode: string;
    enabled: boolean;
    sortOrder: number;
}

// Cascader 选项类型
export interface RegionCascaderOption {
    value: string;
    label: string;
    isLeaf?: boolean;
    loading?: boolean;
    children?: RegionCascaderOption[];
}

const unwrapRegionList = (payload: unknown): Region[] => {
    if (Array.isArray(payload)) {
        return payload as Region[];
    }

    if (payload && typeof payload === 'object' && 'data' in payload) {
        return ((payload as { data?: unknown }).data as Region[]) || [];
    }

    return [];
};

/**
 * 行政区划级联选择 Hook
 * 支持懒加载省市区三级数据
 */
export const useRegionCascader = () => {
    const [options, setOptions] = useState<RegionCascaderOption[]>([]);
    const [loading, setLoading] = useState(false);

    // 加载省份列表（初始化）
    useEffect(() => {
        loadProvinces();
    }, []);

    const loadProvinces = async () => {
        setLoading(true);
        try {
            const response = unwrapRegionList(await api.get('/regions/provinces'));
            const provinceOptions: RegionCascaderOption[] = response.map((province: Region) => ({
                value: province.code,
                label: province.name,
                isLeaf: false,
            }));
            setOptions(provinceOptions);
        } catch (error) {
            console.error('加载省份列表失败:', error);
        } finally {
            setLoading(false);
        }
    };

    // 加载城市列表
    const loadCities = async (provinceCode: string): Promise<RegionCascaderOption[]> => {
        try {
            const response = unwrapRegionList(await api.get(`/regions/provinces/${provinceCode}/cities`));
            return response.map((city: Region) => ({
                value: city.code,
                label: city.name,
                isLeaf: false,
            }));
        } catch (error) {
            console.error('加载城市列表失败:', error);
            return [];
        }
    };

    // 加载区县列表
    const loadDistricts = async (cityCode: string): Promise<RegionCascaderOption[]> => {
        try {
            const response = unwrapRegionList(await api.get(`/regions/cities/${cityCode}/districts`));
            return response.map((district: Region) => ({
                value: district.code,
                label: district.name,
                isLeaf: true,
            }));
        } catch (error) {
            console.error('加载区县列表失败:', error);
            return [];
        }
    };

    // Cascader 的 loadData 回调
    const loadData = async (selectedOptions: RegionCascaderOption[]) => {
        const targetOption = selectedOptions[selectedOptions.length - 1];
        targetOption.loading = true;

        try {
            let children: RegionCascaderOption[] = [];

            if (selectedOptions.length === 1) {
                // 加载城市
                children = await loadCities(targetOption.value);
            } else if (selectedOptions.length === 2) {
                // 加载区县
                children = await loadDistricts(targetOption.value);
            }

            targetOption.children = children;
        } finally {
            targetOption.loading = false;
            setOptions([...options]);
        }
    };

    return {
        options,
        loading,
        loadData,
    };
};

export const regionApi = {
    getChildren: (code: string) => 
        api.get(`/regions/cities/${code}/districts`).then(unwrapRegionList),
};
