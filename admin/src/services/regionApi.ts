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
    serviceEnabled?: boolean;
    sortOrder: number;
    hasChildren?: boolean;
    openCityCount?: number;
    totalCityCount?: number;
    totalEnabledCityCount?: number;
}

export interface ServiceCityRegion {
    code: string;
    name: string;
    parentCode: string;
    parentName: string;
}

// Cascader 选项类型
export interface RegionCascaderOption {
    value: string;
    label: string;
    isLeaf?: boolean;
    loading?: boolean;
    children?: RegionCascaderOption[];
}

const readArrayPayload = <T,>(payload: unknown): T[] => {
    if (Array.isArray(payload)) {
        return payload as T[];
    }
    if (typeof payload === 'object' && payload !== null && 'data' in payload) {
        const data = (payload as { data?: unknown }).data;
        if (Array.isArray(data)) {
            return data as T[];
        }
        if (typeof data === 'object' && data !== null && 'list' in data) {
            const list = (data as { list?: unknown }).list;
            return Array.isArray(list) ? (list as T[]) : [];
        }
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
            const response = readArrayPayload<Region>(await api.get('/regions/provinces'));
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
            const response = readArrayPayload<Region>(await api.get(`/regions/provinces/${provinceCode}/cities`));
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
            const response = readArrayPayload<Region>(await api.get(`/regions/cities/${cityCode}/districts`));
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

/**
 * 行政区划 API (用于管理后台)
 */
export const regionApi = {
    // 获取所有行政区划（支持分页和筛选）
    list: (params?: { page?: number; pageSize?: number; level?: number; parentCode?: string }) =>
        api.get<{ list: Region[]; total: number }>('/admin/regions', { params }),

    // 启用/禁用行政区划
    toggle: (id: number, enabled: boolean) =>
        api.put(`/admin/regions/${id}/toggle`, { enabled }),

    // 开启/关闭服务开放（省级=批量影响下属城市，市级=单点）
    toggleService: (id: number, serviceEnabled: boolean, reason: string, recentReauthProof?: string) =>
        api.put(`/admin/regions/${id}/service-toggle`, {
            serviceEnabled,
            reason,
            recentReauthProof,
        }),

    // 获取子行政区划 (主要用于获取区县)
    getChildren: (code: string) => 
        api.get(`/regions/cities/${code}/districts`).then(readArrayPayload<Region>),

    // 获取开放服务城市（按后端开放策略过滤）
    getServiceCities: () =>
        api.get('/regions/service-cities').then(readArrayPayload<ServiceCityRegion>),
};
