import { request } from '@/utils/request';
import type { BridgeConversionSummaryDTO } from './dto';

export interface QuoteTaskSummary {
  id: number;
  title: string;
  status: string;
  userConfirmationStatus: string;
  deadlineAt?: string;
  activeSubmissionId?: number;
  businessStage?: string;
  flowSummary?: string;
}

export interface QuoteTaskDetail {
  id: number;
  title: string;
  status: string;
  businessStage?: string;
  flowSummary?: string;
  estimatedDays: number;
  totalAmount: number;
  submissionId: number;
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
  items: Array<{
    id: number;
    quoteListItemId: number;
    itemName?: string;
    unit?: string;
    baselineQuantity?: number;
    quotedQuantity?: number;
    quantityChangeReason?: string;
    deviationFlag?: boolean;
    unitPrice: number;
    amount: number;
    remark?: string;
  }>;
  paymentPlanSummary: Array<{
    id: number;
    orderId: number;
    seq: number;
    name: string;
    amount: number;
    status: number;
    dueAt?: string;
  }>;
  bridgeConversionSummary?: BridgeConversionSummaryDTO;
}

interface QuoteTaskSummaryDTO {
  id: number;
  title?: string;
  status?: string;
  userConfirmationStatus?: string;
  deadlineAt?: string;
  activeSubmissionId?: number;
  businessStage?: string;
  flowSummary?: string;
}

interface QuoteTaskUserViewDTO {
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
  items?: Array<{
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
    status: number;
    dueAt?: string;
  }>;
  taskSummary?: {
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
  bridgeConversionSummary?: QuoteTaskDetail['bridgeConversionSummary'];
}

export async function listMyQuoteTasks() {
  const data = await request<{ list?: QuoteTaskSummaryDTO[] }>({
    url: '/quote-tasks/my',
  });

  return (data.list || []).map<QuoteTaskSummary>((item) => ({
    id: item.id,
    title: item.title || `施工报价任务 #${item.id}`,
    status: item.status || '处理中',
    userConfirmationStatus: item.userConfirmationStatus || 'pending',
    deadlineAt: item.deadlineAt || undefined,
    activeSubmissionId: item.activeSubmissionId || undefined,
    businessStage: item.businessStage || undefined,
    flowSummary: item.flowSummary || undefined,
  }));
}

export async function getQuoteTaskDetail(id: number) {
  const data = await request<QuoteTaskUserViewDTO>({
    url: `/quote-tasks/${id}/user-view`,
  });

  return {
    id: data.quoteList.id,
    title: data.quoteList.title || `施工报价任务 #${id}`,
    status: data.quoteList.status || '处理中',
    businessStage: data.businessStage || undefined,
    flowSummary: data.flowSummary || undefined,
    estimatedDays: Number(data.submission.estimatedDays || 0),
    totalAmount: Math.round(Number(data.submission.totalCent || 0) / 100),
    submissionId: data.submission.id,
    taskSummary: {
      area: Number(data.taskSummary?.area || 0) || undefined,
      layout: data.taskSummary?.layout || undefined,
      renovationType: data.taskSummary?.renovationType || undefined,
      constructionScope: data.taskSummary?.constructionScope || undefined,
      serviceAreas: data.taskSummary?.serviceAreas || [],
      workTypes: data.taskSummary?.workTypes || [],
      houseUsage: data.taskSummary?.houseUsage || undefined,
      notes: data.taskSummary?.notes || undefined,
    },
    items: (data.items || []).map((item) => ({
      id: item.id,
      quoteListItemId: item.quoteListItemId,
      itemName: item.itemName || undefined,
      unit: item.unit || undefined,
      baselineQuantity: item.baselineQuantity || undefined,
      quotedQuantity: item.quotedQuantity || undefined,
      quantityChangeReason: item.quantityChangeReason || undefined,
      deviationFlag: item.deviationFlag || false,
      unitPrice: Math.round(Number(item.unitPriceCent || 0) / 100),
      amount: Math.round(Number(item.amountCent || 0) / 100),
      remark: item.remark || undefined,
    })),
    paymentPlanSummary: (data.paymentPlanSummary || []).map((plan) => ({
      id: plan.id,
      orderId: plan.orderId,
      seq: plan.seq,
      name: plan.name,
      amount: Number(plan.amount || 0),
      status: plan.status,
      dueAt: plan.dueAt || undefined,
    })),
    bridgeConversionSummary: data.bridgeConversionSummary,
  } satisfies QuoteTaskDetail;
}

export async function confirmQuoteTaskSubmission(submissionId: number) {
  return request<{ message?: string }>({
    url: `/quote-submissions/${submissionId}/confirm`,
    method: 'POST',
    showLoading: true,
  });
}

export async function rejectQuoteTaskSubmission(submissionId: number, reason: string) {
  return request<{ message?: string }>({
    url: `/quote-submissions/${submissionId}/reject`,
    method: 'POST',
    data: { reason },
    showLoading: true,
  });
}
