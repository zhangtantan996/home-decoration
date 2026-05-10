import { create } from "zustand";
import {
  supervisorDashboardApi,
  type SupervisionProjectListItem,
} from "../services/supervisorApi";

interface DashboardState {
  totalProjects: number;
  recentProjects: SupervisionProjectListItem[];
  loading: boolean;
  lastFetchedAt: number | null; // Unix timestamp ms

  fetch: (force?: boolean) => Promise<void>;
}

// 缓存有效期：5 分钟
const CACHE_TTL_MS = 5 * 60 * 1000;

export const useDashboardStore = create<DashboardState>((set, get) => ({
  totalProjects: 0,
  recentProjects: [],
  loading: false,
  lastFetchedAt: null,

  fetch: async (force = false) => {
    const { lastFetchedAt, loading } = get();

    // 如果正在加载或者缓存仍然有效（且不是强制刷新），则跳过
    if (loading) return;
    if (!force && lastFetchedAt && Date.now() - lastFetchedAt < CACHE_TTL_MS)
      return;

    set({ loading: true });
    try {
      const data = await supervisorDashboardApi.getDashboard();
      set({
        totalProjects: data.totalProjects,
        recentProjects: data.recentProjects,
        lastFetchedAt: Date.now(),
      });
    } catch {
      // 静默失败，保留旧数据
    } finally {
      set({ loading: false });
    }
  },
}));
