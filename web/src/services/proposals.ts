import type { ProposalDetailVM, ProposalListItemVM, ProposalOrderPlanVM } from '../types/viewModels';
import { ORDER_STATUS_LABELS, PROPOSAL_STATUS_LABELS } from '../constants/statuses';
import { formatCurrency, formatDateTime } from '../utils/format';
import { requestJson } from './http';

interface ProposalDTO {
  id: number;
  sourceType?: string;
  demandId?: number;
  demandMatchId?: number;
  summary?: string;
  designFee?: number;
  constructionFee?: number;
  materialFee?: number;
  estimatedDays?: number;
  status?: number;
  version?: number;
  rejectionReason?: string;
  submittedAt?: string;
  userResponseDeadline?: string;
  previewPackageJson?: string;
  deliveryPackageJson?: string;
}

interface OrderDTO {
  id?: number;
  orderNo?: string;
  totalAmount?: number;
  status?: number;
  projectId?: number;
}

interface ProposalResponse {
  proposal: ProposalDTO;
  order?: OrderDTO | null;
  hasOrder?: boolean;
  deliveryUnlocked?: boolean;
}

type ProposalPackage = {
  summary?: string;
  floorPlanImages?: string[];
  effectPreviewImages?: string[];
  effectPreviewLinks?: string[];
  effectImages?: string[];
  effectLinks?: string[];
  description?: string;
  cadFiles?: string[];
  attachments?: string[];
  hasCad?: boolean;
  hasAttachments?: boolean;
};

function parsePackage(value?: string): ProposalPackage {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed as ProposalPackage;
    }
  } catch {}
  return {};
}

interface PaymentPlanResponse {
  plans: Array<{
    id: number;
    name?: string;
    amount?: number;
    status?: number;
    dueAt?: string;
  }>;
}

function toProposalListItem(dto: ProposalDTO): ProposalListItemVM {
  const status = Number(dto.status || 0);
  const isDemand = dto.sourceType === 'demand' && Number(dto.demandId || 0) > 0;

  return {
    id: dto.id,
    summary: dto.summary || `报价 #${dto.id}`,
    status,
    statusText: PROPOSAL_STATUS_LABELS[status] || '处理中',
    designFeeText: formatCurrency(dto.designFee),
    submittedAt: formatDateTime(dto.submittedAt),
    href: isDemand ? `/demands/${dto.demandId}/compare` : `/proposals/${dto.id}`,
  };
}

function adaptPlans(data: PaymentPlanResponse | null): ProposalOrderPlanVM[] {
  return (data?.plans || []).map((plan) => ({
    id: plan.id,
    name: plan.name || '分期',
    amountText: formatCurrency(plan.amount),
    statusText: ORDER_STATUS_LABELS[Number(plan.status || 0)] || '待处理',
    dueAt: formatDateTime(plan.dueAt),
  }));
}

export async function listProposals() {
  const data = await requestJson<ProposalDTO[]>('/proposals');
  return data.map(toProposalListItem);
}

export async function getProposalDetail(id: number) {
  const data = await requestJson<ProposalResponse>(`/proposals/${id}`);
  const orderId = data.order?.id;
  const planData = orderId ? await requestJson<PaymentPlanResponse>(`/orders/${orderId}/plans`) : null;

  const designFee = Number(data.proposal.designFee || 0);
  const constructionFee = Number(data.proposal.constructionFee || 0);
  const materialFee = Number(data.proposal.materialFee || 0);
  const total = designFee + constructionFee + materialFee;
  const proposalStatus = Number(data.proposal.status || 0);
  const orderStatus = typeof data.order?.status === 'number' ? data.order.status : null;

  let blockingReason = '';
  let canConfirm = proposalStatus === 1;
  if (data.hasOrder && orderStatus === 0) {
    canConfirm = false;
    blockingReason = '设计费订单已生成，需先完成支付或处理现有订单。';
  } else if (data.hasOrder && orderStatus === 1) {
    canConfirm = false;
    blockingReason = '该报价已确认并已支付。';
  } else if (proposalStatus !== 1) {
    canConfirm = false;
    blockingReason = '当前报价状态不允许再次确认。';
  }

  const result: ProposalDetailVM = {
    id: data.proposal.id,
    status: proposalStatus,
    statusText: PROPOSAL_STATUS_LABELS[proposalStatus] || '处理中',
    version: Number(data.proposal.version || 1),
    summary: data.proposal.summary || '暂无方案概述',
    estimatedDays: Number(data.proposal.estimatedDays || 0),
    submittedAt: formatDateTime(data.proposal.submittedAt),
    responseDeadline: formatDateTime(data.proposal.userResponseDeadline),
    designFeeText: formatCurrency(designFee),
    constructionFeeText: formatCurrency(constructionFee),
    materialFeeText: formatCurrency(materialFee),
    totalFeeText: formatCurrency(total),
    rejectionReason: data.proposal.rejectionReason || '',
    hasOrder: Boolean(data.hasOrder),
    orderId: orderId || undefined,
    orderStatusText: orderStatus === null ? '未生成订单' : ORDER_STATUS_LABELS[orderStatus] || '处理中',
    orderStatus,
    orderNo: data.order?.orderNo || '待生成',
    projectId: data.order?.projectId,
    planItems: adaptPlans(planData),
    canConfirm,
    blockingReason,
    deliveryUnlocked: Boolean(data.deliveryUnlocked),
    };

  const previewPackage = parsePackage(data.proposal.previewPackageJson);
  const deliveryPackage = parsePackage(data.proposal.deliveryPackageJson);
  result.previewSummary = previewPackage.summary || '';
  result.previewFloorPlanImages = previewPackage.floorPlanImages || [];
  result.previewEffectImages = previewPackage.effectPreviewImages || [];
  result.previewEffectLinks = previewPackage.effectPreviewLinks || [];
  result.previewHasCad = Boolean(previewPackage.hasCad);
  result.previewHasAttachments = Boolean(previewPackage.hasAttachments);
  result.deliveryDescription = deliveryPackage.description || '';
  result.deliveryFloorPlanImages = deliveryPackage.floorPlanImages || [];
  result.deliveryEffectImages = deliveryPackage.effectImages || [];
  result.deliveryEffectLinks = deliveryPackage.effectLinks || [];
  result.deliveryCadFiles = deliveryPackage.cadFiles || [];
  result.deliveryAttachments = deliveryPackage.attachments || [];

  return result;
}

export async function confirmProposal(id: number) {
  await requestJson(`/proposals/${id}/confirm`, {
    method: 'POST',
  });
}
