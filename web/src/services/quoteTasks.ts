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
    itemName?: string;
    unit?: string;
    baselineQuantity?: number;
    quotedQuantity?: number;
    quantityChangeReason?: string;
    deviationFlag?: boolean;
    unitPriceCent?: number;
    amountCent?: number;
    remark?: string;
  }>;
  paymentPlanSummary?: Array<{
    id: number;
    orderId: number;
    seq: number;
    name: string;
    amount?: number;
    dueAt?: string;
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

interface QuoteTaskSummaryResponse {
  id: number;
  title?: string;
  status?: string;
  userConfirmationStatus?: string;
  deadlineAt?: string;
  activeSubmissionId?: number;
  businessStage?: string;
  flowSummary?: string;
}

export interface QuoteTaskSummaryVM {
  id: number;
  title: string;
  statusText: string;
  userConfirmationStatus: string;
  deadlineAt?: string;
  activeSubmissionId?: number;
  businessStage?: string;
  flowSummary?: string;
}

export async function listMyQuoteTasks(): Promise<QuoteTaskSummaryVM[]> {
  const data = await requestJson<{ list?: QuoteTaskSummaryResponse[] }>('/quote-tasks/my');
  return (data.list || []).map((item) => ({
    id: item.id,
    title: item.title || `施工报价任务 #${item.id}`,
    statusText: item.status || '处理中',
    userConfirmationStatus: item.userConfirmationStatus || 'pending',
    deadlineAt: item.deadlineAt || undefined,
    activeSubmissionId: item.activeSubmissionId || undefined,
    businessStage: item.businessStage || undefined,
    flowSummary: item.flowSummary || undefined,
  }));
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
      itemName: item.itemName || `清单项 #${item.quoteListItemId}`,
      unit: item.unit || '',
      baselineQuantity: item.baselineQuantity || undefined,
      quotedQuantity: item.quotedQuantity || undefined,
      quantityChangeReason: item.quantityChangeReason || undefined,
      deviationFlag: item.deviationFlag || false,
      unitPriceText: formatCurrency((Number(item.unitPriceCent || 0)) / 100),
      amountText: formatCurrency((Number(item.amountCent || 0)) / 100),
      remark: item.remark || '',
    })),
    paymentPlanSummary: (data.paymentPlanSummary || []).map((plan) => ({
      id: plan.id,
      orderId: plan.orderId,
      seq: plan.seq,
      name: plan.name,
      amountText: formatCurrency(Number(plan.amount || 0)),
      dueAt: plan.dueAt || undefined,
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
