import request from '@/utils/request';

export interface CreateQuoteTaskRequest {
  bookingId: number;
  area: number;
  style: string;
  region: string;
  budget: number;
  description?: string;
}

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

export const createQuoteTask = (data: CreateQuoteTaskRequest): Promise<QuoteTask> => {
  return request.post('/quote-pk/tasks', data);
};

export const getQuoteTask = (taskId: number): Promise<QuoteTask> => {
  return request.get(`/quote-pk/tasks/${taskId}`);
};

export const getQuoteComparison = (taskId: number): Promise<QuoteComparisonItem[]> => {
  return request.get(`/quote-pk/tasks/${taskId}/submissions`);
};

export const selectQuote = (taskId: number, submissionId: number): Promise<void> => {
  return request.post(`/quote-pk/tasks/${taskId}/select`, { submissionId });
};
