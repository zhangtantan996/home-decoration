import { create } from 'zustand';
import { providerApi } from '../services/api';
import { Designer, Worker, ProviderDTO, toDesigner, toWorker } from '../types/provider';

interface ProviderState {
    // 数据
    designers: Designer[];
    workers: Worker[];

    // 加载状态
    isDesignerLoading: boolean;
    isWorkerLoading: boolean;
    designerError: string | null;
    workerError: string | null;

    // 分页
    designerPage: number;
    workerPage: number;
    hasMoreDesigners: boolean;
    hasMoreWorkers: boolean;

    // 预加载时间戳 (用于判断数据新鲜度)
    lastDesignerFetch: number | null;
    lastWorkerFetch: number | null;

    // Actions
    fetchDesigners: (page?: number, refresh?: boolean) => Promise<void>;
    fetchWorkers: (page?: number, refresh?: boolean) => Promise<void>;
    preloadAll: () => Promise<void>;
    clearAll: () => void;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 分钟缓存有效期

export const useProviderStore = create<ProviderState>((set, get) => ({
    designers: [],
    workers: [],
    isDesignerLoading: false,
    isWorkerLoading: false,
    designerError: null,
    workerError: null,
    designerPage: 1,
    workerPage: 1,
    hasMoreDesigners: true,
    hasMoreWorkers: true,
    lastDesignerFetch: null,
    lastWorkerFetch: null,

    fetchDesigners: async (page = 1, refresh = false) => {
        const state = get();

        // 如果已有数据且未过期且不是强制刷新，跳过请求
        if (!refresh && state.designers.length > 0 && state.lastDesignerFetch) {
            const isStale = Date.now() - state.lastDesignerFetch > CACHE_DURATION;
            if (!isStale) return;
        }

        set({ isDesignerLoading: true, designerError: null });

        try {
            const res = await providerApi.designers({
                page,
                pageSize: 10,
                sortBy: 'recommend',
                type: 1
            });
            const list = (res?.data?.list || []).map((dto: ProviderDTO) => toDesigner(dto));

            set(prev => ({
                designers: page === 1 ? list : [...prev.designers, ...list],
                designerPage: page,
                hasMoreDesigners: list.length >= 10,
                isDesignerLoading: false,
                lastDesignerFetch: Date.now(),
            }));
        } catch (err: any) {
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
            const res = await providerApi.foremen({
                page,
                pageSize: 10,
                sortBy: 'recommend',
                type: 3
            });
            const list = (res?.data?.list || []).map((dto: ProviderDTO) => toWorker(dto));

            set(prev => ({
                workers: page === 1 ? list : [...prev.workers, ...list],
                workerPage: page,
                hasMoreWorkers: list.length >= 10,
                isWorkerLoading: false,
                lastWorkerFetch: Date.now(),
            }));
        } catch (err: any) {
            console.error('Preload workers failed:', err);
            set({
                isWorkerLoading: false,
                workerError: err.message || '加载失败',
            });
        }
    },

    // 一次性预加载所有首页数据
    preloadAll: async () => {
        const { fetchDesigners, fetchWorkers } = get();
        // 并行加载，不阻塞
        await Promise.allSettled([
            fetchDesigners(1, false),
            fetchWorkers(1, false),
        ]);
    },

    clearAll: () => {
        set({
            designers: [],
            workers: [],
            designerPage: 1,
            workerPage: 1,
            hasMoreDesigners: true,
            hasMoreWorkers: true,
            lastDesignerFetch: null,
            lastWorkerFetch: null,
        });
    },
}));
