import { requestJson } from './http';

export interface LegacyQuoteComparisonItem {
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

export async function getLegacyQuoteComparison(taskId: number) {
  return requestJson<LegacyQuoteComparisonItem[]>(`/quote-pk/tasks/${taskId}/submissions`);
}
