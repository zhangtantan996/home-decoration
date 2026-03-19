import type { QuoteTaskDetailVM } from '../types/viewModels';
import { formatCurrency } from '../utils/format';
import { requestJson } from './http';

interface QuoteTaskUserViewResponse {
  quoteList: {
    id: number;
    title?: string;
    status?: string;
  };
  submission: {
    id: number;
    totalCent?: number;
    estimatedDays?: number;
  };
  items: Array<{
    id: number;
    quoteListItemId: number;
    unitPriceCent?: number;
    amountCent?: number;
    remark?: string;
  }>;
  taskSummary: {
    area?: number;
    layout?: string;
    renovationType?: string;
    constructionScope?: string;
    serviceAreas?: string[];
    workTypes?: string[];
    houseUsage?: string;
    notes?: string;
  };
  businessStage?: string;
  flowSummary?: string;
}

export async function getQuoteTaskDetail(id: number): Promise<QuoteTaskDetailVM> {
  const data = await requestJson<QuoteTaskUserViewResponse>(`/quote-tasks/${id}/user-view`);
  return {
    id: data.quoteList.id,
    title: data.quoteList.title || `施工报价任务 #${id}`,
    statusText: data.quoteList.status || '处理中',
    businessStage: data.businessStage || '',
    flowSummary: data.flowSummary || '',
    estimatedDays: Number(data.submission.estimatedDays || 0),
    totalFeeText: formatCurrency((Number(data.submission.totalCent || 0)) / 100),
    taskSummary: {
      area: Number(data.taskSummary.area || 0),
      layout: data.taskSummary.layout || '',
      renovationType: data.taskSummary.renovationType || '',
      constructionScope: data.taskSummary.constructionScope || '',
      serviceAreas: data.taskSummary.serviceAreas || [],
      workTypes: data.taskSummary.workTypes || [],
      houseUsage: data.taskSummary.houseUsage || '',
      notes: data.taskSummary.notes || '',
    },
    items: (data.items || []).map((item) => ({
      id: item.id,
      quoteListItemId: item.quoteListItemId,
      unitPriceText: formatCurrency((Number(item.unitPriceCent || 0)) / 100),
      amountText: formatCurrency((Number(item.amountCent || 0)) / 100),
      remark: item.remark || '',
    })),
    submissionId: data.submission.id,
  };
}

export async function confirmQuoteTaskSubmission(submissionId: number) {
  await requestJson(`/quote-submissions/${submissionId}/confirm`, {
    method: 'POST',
  });
}

export async function rejectQuoteTaskSubmission(submissionId: number, reason: string) {
  await requestJson(`/quote-submissions/${submissionId}/reject`, {
    method: 'POST',
    body: { reason },
  });
}
