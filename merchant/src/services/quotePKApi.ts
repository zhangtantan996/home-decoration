import request from '../utils/request';

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
