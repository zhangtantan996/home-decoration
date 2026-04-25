// Legacy compatibility only: quote-pk 主链已退役。
// 保留此文件仅用于历史深链诊断，不应再作为现行业务入口。
import api from './api';

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

export interface SubmitQuoteRequest {
  totalPrice: number;
  duration: number;
  materials?: string;
  description?: string;
}

export const merchantQuotePKApi = {
  getQuoteTasks: (): Promise<QuoteTask[]> => {
    return api.get('/merchant/quote-pk/tasks').then((payload) => {
      if (Array.isArray(payload)) {
        return payload as QuoteTask[];
      }

      if (payload && typeof payload === 'object' && 'data' in payload) {
        const data = (payload as { data?: unknown }).data;
        return Array.isArray(data) ? data as QuoteTask[] : [];
      }

      return [];
    });
  },

  submitQuote: (taskId: number, data: SubmitQuoteRequest): Promise<void> => {
    return api.post(`/merchant/quote-pk/tasks/${taskId}/submit`, data).then(() => undefined);
  },
};
