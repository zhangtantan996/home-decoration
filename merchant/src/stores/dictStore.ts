import { create } from 'zustand';
import { dictionaryApi } from '../services/dictionaryApi';
import type { DictOption } from '../services/dictionaryApi';

interface DictState {
    // 字典数据（按分类存储）
    dictionaries: Record<string, DictOption[]>;

    // 加载状态
    loading: Record<string, boolean>;

    // 方法
    loadDict: (category: string) => Promise<void>;
    getDictOptions: (category: string) => DictOption[];
    clearDict: (category: string) => void;
    clearAllDicts: () => void;
}

// 降级常量（当API失败时使用）
const FALLBACK_DICTS: Record<string, DictOption[]> = {
    style: [
        { value: '现代简约', label: '现代简约' },
        { value: '北欧风格', label: '北欧风格' },
        { value: '新中式', label: '新中式' },
        { value: '轻奢风格', label: '轻奢风格' },
        { value: '美式风格', label: '美式风格' },
        { value: '欧式风格', label: '欧式风格' },
        { value: '日式风格', label: '日式风格' },
        { value: '工业风格', label: '工业风格' },
        { value: '法式风格', label: '法式风格' },
        { value: '地中海风格', label: '地中海风格' },
    ],
    layout: [
        { value: '一室', label: '一室' },
        { value: '一室一厅', label: '一室一厅' },
        { value: '两室一厅', label: '两室一厅' },
        { value: '两室两厅', label: '两室两厅' },
        { value: '三室一厅', label: '三室一厅' },
        { value: '三室两厅', label: '三室两厅' },
        { value: '四室及以上', label: '四室及以上' },
        { value: '复式', label: '复式' },
        { value: '别墅', label: '别墅' },
        { value: '其他', label: '其他' },
    ],
    budget_range: [
        { value: '5万以下', label: '5万以下' },
        { value: '5-10万', label: '5-10万' },
        { value: '10-15万', label: '10-15万' },
        { value: '15-20万', label: '15-20万' },
        { value: '20-30万', label: '20-30万' },
        { value: '30万以上', label: '30万以上' },
    ],
    renovation_type: [
        { value: '全包', label: '全包' },
        { value: '半包', label: '半包' },
        { value: '局部改造', label: '局部改造' },
        { value: '软装设计', label: '软装设计' },
    ],
};

export const useDictStore = create<DictState>((set, get) => ({
    dictionaries: {},
    loading: {},

    // 加载字典数据
    loadDict: async (category: string) => {
        const { dictionaries, loading } = get();

        // 如果已加载或正在加载，跳过
        if (dictionaries[category] || loading[category]) {
            return;
        }

        // 设置加载状态
        set(state => ({
            loading: { ...state.loading, [category]: true }
        }));

        try {
            const options = await dictionaryApi.getOptions(category);
            set(state => ({
                dictionaries: { ...state.dictionaries, [category]: options },
                loading: { ...state.loading, [category]: false }
            }));
        } catch (error) {
            console.error(`Failed to load dict: ${category}`, error);

            // 降级到硬编码常量
            const fallback = FALLBACK_DICTS[category] || [];
            set(state => ({
                dictionaries: { ...state.dictionaries, [category]: fallback },
                loading: { ...state.loading, [category]: false }
            }));
        }
    },

    // 获取字典选项
    getDictOptions: (category: string) => {
        const { dictionaries } = get();
        return dictionaries[category] || [];
    },

    // 清除指定字典缓存
    clearDict: (category: string) => {
        set(state => {
            const newDicts = { ...state.dictionaries };
            delete newDicts[category];
            return { dictionaries: newDicts };
        });
    },

    // 清除所有字典缓存
    clearAllDicts: () => {
        set({ dictionaries: {}, loading: {} });
    },
}));
