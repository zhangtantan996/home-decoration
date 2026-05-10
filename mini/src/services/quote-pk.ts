// Legacy compatibility only: quote-pk 主链已退役。
// 保留此文件仅用于历史兼容排查，不应再接入任何运行时入口。
import { request } from '@/utils/request';

export interface QuoteTask {
  id: number;
  bookingId: number;
  userId: number;
  projectId?: number;
  area: number;
  style: string;
  region: string;
  budget: number;
  description: string;
  status: string;
  expiredAt: string;
  selectedQuoteId?: number;
  createdAt: string;
  updatedAt: string;
}

export interface QuoteComparisonItem {
  submissionId: number;
  providerId: number;
  providerName: string;
  providerAvatar: string;
  rating: number;
  completedCnt: number;
  yearsExperience: number;
  totalPrice: number;
  duration: number;
  materials: string;
  description: string;
  submittedAt: string;
  status: string;
}

export const getQuoteTask = (taskId: number): Promise<QuoteTask> => {
  return request<QuoteTask>({
    url: `/quote-pk/tasks/${taskId}`,
    method: 'GET',
  });
};

export const getQuoteComparison = (taskId: number): Promise<QuoteComparisonItem[]> => {
  return request<QuoteComparisonItem[]>({
    url: `/quote-pk/tasks/${taskId}/submissions`,
    method: 'GET',
  });
};
