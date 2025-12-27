import { create } from 'zustand';
import { providerApi, materialShopApi } from '../services/api';
import { Designer, Worker, MaterialShop, ProviderDTO, toDesigner, toWorker } from '../types/provider';

interface ProviderState {
    // 数据
    designers: Designer[];
    workers: Worker[];
    materialShops: MaterialShop[];

    // 加载状态
    isDesignerLoading: boolean;
    isWorkerLoading: boolean;
    isMaterialLoading: boolean;
    designerError: string | null;
    workerError: string | null;
    materialError: string | null;

    // 分页
    designerPage: number;
    workerPage: number;
    materialPage: number;
    hasMoreDesigners: boolean;
    hasMoreWorkers: boolean;
    hasMoreMaterials: boolean;

    // 预加载时间戳 (用于判断数据新鲜度)
    lastDesignerFetch: number | null;
    lastWorkerFetch: number | null;
    lastMaterialFetch: number | null;

    // Actions
    fetchDesigners: (page?: number, refresh?: boolean) => Promise<void>;
    fetchWorkers: (page?: number, refresh?: boolean) => Promise<void>;
    fetchMaterialShops: (page?: number, refresh?: boolean, sortBy?: string, type?: string) => Promise<void>;
    preloadAll: () => Promise<void>;
    clearAll: () => void;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 分钟缓存有效期

export const useProviderStore = create<ProviderState>((set, get) => ({
    designers: [],
    workers: [],
    materialShops: [],
    isDesignerLoading: false,
    isWorkerLoading: false,
    isMaterialLoading: false,
    designerError: null,
    workerError: null,
    materialError: null,
    designerPage: 1,
    workerPage: 1,
    materialPage: 1,
    hasMoreDesigners: true,
    hasMoreWorkers: true,
    hasMoreMaterials: true,
    lastDesignerFetch: null,
    lastWorkerFetch: null,
    lastMaterialFetch: null,

    fetchDesigners: async (page = 1, refresh = false) => {
        const state = get();

        // 如果已有数据且未过期且不是强制刷新，跳过请求
        if (!refresh && state.designers.length > 0 && state.lastDesignerFetch) {
            const isStale = Date.now() - state.lastDesignerFetch > CACHE_DURATION;
            if (!isStale) return;
        }

        set({ isDesignerLoading: true, designerError: null });

        try {
            const startStr = '[PERF] fetchDesigners API';
            const startTime = Date.now();
            console.log(`${startStr} START`);
            const res = await providerApi.designers({
                page,
                pageSize: 10,
                sortBy: 'recommend',
                type: 1
            });
            const duration = Date.now() - startTime;
            console.log(`${startStr}: ${duration}ms`);
            const list = (res?.data?.list || []).map((dto: ProviderDTO) => toDesigner(dto));

            set(prev => ({
                designers: page === 1 ? list : [...prev.designers, ...list],
                designerPage: page,
                hasMoreDesigners: list.length >= 10,
                isDesignerLoading: false,
                lastDesignerFetch: Date.now(),
            }));
            console.log(`[PERF] fetchDesigners complete, ${list.length} items`);
        } catch (err: any) {
            console.log('[PERF] fetchDesigners API FAILED');
            console.error('Preload designers failed:', err);
            set({
                isDesignerLoading: false,
                designerError: err.message || '加载失败',
            });
        }
    },

    fetchWorkers: async (page = 1, refresh = false) => {
        const state = get();

        if (!refresh && state.workers.length > 0 && state.lastWorkerFetch) {
            const isStale = Date.now() - state.lastWorkerFetch > CACHE_DURATION;
            if (!isStale) return;
        }

        set({ isWorkerLoading: true, workerError: null });

        try {
            const startStr = '[PERF] fetchWorkers API';
            const startTime = Date.now();
            console.log(`${startStr} START`);
            const res = await providerApi.foremen({
                page,
                pageSize: 10,
                sortBy: 'recommend',
                type: 3
            });
            const duration = Date.now() - startTime;
            console.log(`${startStr}: ${duration}ms`);
            const list = (res?.data?.list || []).map((dto: ProviderDTO) => toWorker(dto));

            set(prev => ({
                workers: page === 1 ? list : [...prev.workers, ...list],
                workerPage: page,
                hasMoreWorkers: list.length >= 10,
                isWorkerLoading: false,
                lastWorkerFetch: Date.now(),
            }));
            console.log(`[PERF] fetchWorkers complete, ${list.length} items`);
        } catch (err: any) {
            console.log('[PERF] fetchWorkers API FAILED');
            console.error('Preload workers failed:', err);
            set({
                isWorkerLoading: false,
                workerError: err.message || '加载失败',
            });
        }
    },

    fetchMaterialShops: async (page = 1, refresh = false, sortBy = 'recommend', type = 'all') => {
        const state = get();

        if (!refresh && state.materialShops.length > 0 && state.lastMaterialFetch) {
            const isStale = Date.now() - state.lastMaterialFetch > CACHE_DURATION;
            if (!isStale) return;
        }

        set({ isMaterialLoading: true, materialError: null });

        try {
            const res = await materialShopApi.list({
                page,
                pageSize: 10,
                sortBy,
                type: type === 'all' ? undefined : type,
            });
            const list: MaterialShop[] = res?.data?.list || [];

            set(prev => ({
                materialShops: page === 1 ? list : [...prev.materialShops, ...list],
                materialPage: page,
                hasMoreMaterials: list.length >= 10,
                isMaterialLoading: false,
                lastMaterialFetch: Date.now(),
            }));
        } catch (err: any) {
            console.error('Fetch material shops failed:', err);
            set({
                isMaterialLoading: false,
                materialError: err.message || '加载失败',
            });
        }
    },

    // 一次性预加载所有首页数据
    preloadAll: async () => {
        const startStr = '[PERF] preloadAll total';
        const startTime = Date.now();
        console.log(`${startStr} START`);
        const { fetchDesigners, fetchWorkers, fetchMaterialShops } = get();
        // 并行加载，不阻塞
        await Promise.allSettled([
            fetchDesigners(1, false),
            fetchWorkers(1, false),
            fetchMaterialShops(1, false),
        ]);
        const duration = Date.now() - startTime;
        console.log(`${startStr}: ${duration}ms`);
    },

    clearAll: () => {
        set({
            designers: [],
            workers: [],
            materialShops: [],
            designerPage: 1,
            workerPage: 1,
            materialPage: 1,
            hasMoreDesigners: true,
            hasMoreWorkers: true,
            hasMoreMaterials: true,
            lastDesignerFetch: null,
            lastWorkerFetch: null,
            lastMaterialFetch: null,
        });
    },
}));

