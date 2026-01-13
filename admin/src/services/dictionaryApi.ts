import axios from './api';

export interface DictOption {
    value: string;
    label: string;
}

export interface DictItem {
    id: number;
    categoryCode: string;
    value: string;
    label: string;
    description?: string;
    sortOrder: number;
    enabled: boolean;
    extraData?: Record<string, any>;
    parentValue?: string;
    createdAt: string;
    updatedAt: string;
}

export interface DictCategory {
    id: number;
    code: string;
    name: string;
    description?: string;
    sortOrder: number;
    enabled: boolean;
    icon?: string;
    createdAt: string;
    updatedAt: string;
}

export const dictionaryApi = {
    // ========== 公开接口 ==========

    /**
     * 获取字典选项
     * @param category 分类代码（如：style, layout）
     */
    getOptions: async (category: string): Promise<DictOption[]> => {
        const res = await axios.get(`/dictionaries/${category}`);
        return res.data;  // 修复：响应拦截器已返回response.data
    },

    /**
     * 获取所有分类
     */
    getCategories: async (): Promise<DictCategory[]> => {
        const res = await axios.get('/dictionaries/categories');
        return res.data;  // 修复：响应拦截器已返回response.data
    },

    // ========== 管理接口 ==========

    /**
     * 分页查询字典值
     */
    list: async (params: {
        page: number;
        pageSize: number;
        categoryCode?: string;
    }) => {
        const res = await axios.get('/admin/dictionaries', { params });
        return res;  // 修复：响应拦截器已经返回了 response.data
    },

    /**
     * 创建字典值
     */
    create: async (data: {
        categoryCode: string;
        value: string;
        label: string;
        description?: string;
        sortOrder?: number;
        extraData?: Record<string, any>;
        parentValue?: string;
    }) => {
        const res = await axios.post('/admin/dictionaries', data);
        return res;
    },

    /**
     * 更新字典值
     */
    update: async (id: number, data: {
        categoryCode: string;
        value: string;
        label: string;
        description?: string;
        sortOrder?: number;
        enabled?: boolean;
        extraData?: Record<string, any>;
        parentValue?: string;
    }) => {
        const res = await axios.put(`/admin/dictionaries/${id}`, data);
        return res;
    },

    /**
     * 删除字典值
     */
    delete: async (id: number) => {
        const res = await axios.delete(`/admin/dictionaries/${id}`);
        return res;
    },

    // ========== 分类管理（可选） ==========

    /**
     * 查询分类列表
     */
    listCategories: async () => {
        const res = await axios.get('/admin/dictionaries/categories');
        return res;
    },

    /**
     * 创建分类
     */
    createCategory: async (data: {
        code: string;
        name: string;
        description?: string;
        sortOrder?: number;
        icon?: string;
    }) => {
        const res = await axios.post('/admin/dictionaries/categories', data);
        return res;
    },

    /**
     * 更新分类
     */
    updateCategory: async (code: string, data: {
        name: string;
        description?: string;
        sortOrder?: number;
        enabled?: boolean;
        icon?: string;
    }) => {
        const res = await axios.put(`/admin/dictionaries/categories/${code}`, data);
        return res;
    },

    /**
     * 删除分类
     */
    deleteCategory: async (code: string) => {
        const res = await axios.delete(`/admin/dictionaries/categories/${code}`);
        return res;
    },
};
