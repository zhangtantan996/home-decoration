// Legacy compatibility only: quote-pk 主链已退役。
// 保留此文件仅用于历史深链诊断，不应再作为现行业务入口。
import api from './api';

const request = api;

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
    return request.get('/merchant/quote-pk/tasks');
  },

  submitQuote: (taskId: number, data: SubmitQuoteRequest): Promise<void> => {
    return request.post(`/merchant/quote-pk/tasks/${taskId}/submit`, data);
  },
};
