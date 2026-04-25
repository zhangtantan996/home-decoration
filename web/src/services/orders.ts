import type { PageEnvelope } from '../types/api';
import type { OrderDetailPlanVM, OrderDetailVM, OrderListItemVM } from '../types/viewModels';
import { ORDER_STATUS_LABELS } from '../constants/statuses';
import { formatCurrency, formatDateTime } from '../utils/format';
import { detectTerminalType } from '../utils/terminal';
import {
  adaptBridgeConversionSummary,
  adaptChangeOrderSummary,
  adaptCommercialExplanation,
  adaptPayoutSummary,
  adaptProjectClosureSummary,
  adaptQuoteTruthSummary,
  adaptSettlementSummary,
} from './bridgeSummary';
import { requestJson } from './http';
import type { PaymentLaunchPayload, PaymentLaunchRequest } from './payments';

interface OrderListDTO {
  id: number;
  recordType?: 'order' | 'payment';
  orderNo?: string;
  orderType?: string;
  status?: number;
  statusText?: string;
  amount?: number;
  providerName?: string;
  address?: string;
  createdAt?: string;
  nextPayableAt?: string;
  bookingId?: number;
  proposalId?: number;
  projectId?: number;
  actionPath?: string;
}

interface OrderDetailDTO {
  id: number;
  orderNo?: string;
  orderType?: string;
  totalAmount?: number;
  paidAmount?: number;
  discount?: number;
  status?: number;
  expireAt?: string;
  paidAt?: string;
  bookingId?: number;
  projectId?: number;
  proposalId?: number;
  createdAt?: string;
  bridgeConversionSummary?: unknown;
  closureSummary?: unknown;
  quoteTruthSummary?: unknown;
  commercialExplanation?: unknown;
  changeOrderSummary?: unknown;
  settlementSummary?: unknown;
  payoutSummary?: unknown;
  financialClosureStatus?: string;
  nextPendingAction?: string;
  businessStage?: string;
  flowSummary?: string;
}

interface OrderPlanDTO {
  id: number;
  name?: string;
  amount?: number;
  status?: number;
  dueAt?: string;
}

interface OrderPlanResponse {
  plans: OrderPlanDTO[];
}

const ORDER_TYPE_LABELS: Record<string, string> = {
  design: '设计费订单',
  construction: '施工订单',
  material: '主材订单',
  survey_deposit: '量房定金',
};

function deriveOrderEntryKey(dto: OrderListDTO) {
  const recordType = dto.recordType || 'order';
  const orderType = String(dto.orderType || '').trim();
  const itemId = Number(dto.id || 0);
  const bookingId = Number(dto.bookingId || 0);

  if (recordType === 'payment') {
    const primaryBookingId = bookingId || itemId;
    return primaryBookingId > 0 ? `survey_deposit:${primaryBookingId}` : undefined;
  }

  if (itemId <= 0) {
    return undefined;
  }

  switch (orderType) {
    case 'design':
      return `design_order:${itemId}`;
    case 'construction':
      return `construction_order:${itemId}`;
    case 'material':
      return `material_order:${itemId}`;
    default:
      return undefined;
  }
}

function toOrderItem(dto: OrderListDTO): OrderListItemVM {
  const orderType = String(dto.orderType || '').trim();
  return {
    id: dto.id,
    recordType: dto.recordType || 'order',
    entryKey: deriveOrderEntryKey(dto),
    orderNo: dto.orderNo || `ORD-${dto.id}`,
    orderType: orderType || undefined,
    orderTypeText: ORDER_TYPE_LABELS[orderType] || '订单',
    status: Number(dto.status || 0),
    statusText: dto.statusText || ORDER_STATUS_LABELS[Number(dto.status || 0)] || '处理中',
    amountText: formatCurrency(dto.amount),
    providerName: dto.providerName || '服务商',
    address: dto.address || '地址待补充',
    createdAt: formatDateTime(dto.createdAt),
    nextPayableAt: formatDateTime(dto.nextPayableAt),
    bookingId: dto.bookingId || undefined,
    proposalId: dto.proposalId || undefined,
    projectId: dto.projectId || undefined,
    actionPath: dto.actionPath || undefined,
  };
}

function readOrderPrimaryAction(order: OrderDetailDTO) {
  if (Number(order.projectId || 0) > 0) {
    return {
      path: `/projects/${order.projectId}`,
      label: '查看项目进度',
    };
  }
  if (Number(order.bookingId || 0) > 0) {
    return {
      path: `/bookings/${order.bookingId}`,
      label: '查看预约详情',
    };
  }
  if (Number(order.proposalId || 0) > 0) {
    return {
      path: `/proposals/${order.proposalId}`,
      label: '查看方案',
    };
  }
  return {
    path: '/me/orders',
    label: '返回我的订单',
  };
}

function toOrderPlanItem(dto: OrderPlanDTO): OrderDetailPlanVM {
  return {
    id: dto.id,
    name: dto.name || '支付计划',
    amountText: formatCurrency(dto.amount),
    statusText: ORDER_STATUS_LABELS[Number(dto.status || 0)] || '待处理',
    dueAt: formatDateTime(dto.dueAt),
  };
}

function toOrderDetail(dto: OrderDetailDTO, plans: OrderPlanDTO[]): OrderDetailVM {
  const action = readOrderPrimaryAction(dto);
  const status = Number(dto.status || 0);
  const orderType = String(dto.orderType || '').trim();

  return {
    id: dto.id,
    orderNo: dto.orderNo || `ORD-${dto.id}`,
    orderType,
    orderTypeText: ORDER_TYPE_LABELS[orderType] || '订单',
    status,
    statusText: ORDER_STATUS_LABELS[status] || '处理中',
    totalAmountText: formatCurrency(dto.totalAmount),
    paidAmountText: formatCurrency(dto.paidAmount),
    discountText: formatCurrency(dto.discount),
    createdAt: formatDateTime(dto.createdAt),
    paidAt: formatDateTime(dto.paidAt),
    expireAt: formatDateTime(dto.expireAt),
    bookingId: dto.bookingId || undefined,
    projectId: dto.projectId || undefined,
    proposalId: dto.proposalId || undefined,
    primaryActionPath: action.path,
    primaryActionLabel: action.label,
    canPay: status === 0,
    planItems: plans.map(toOrderPlanItem),
    bridgeConversionSummary: adaptBridgeConversionSummary(dto.bridgeConversionSummary),
    closureSummary: adaptProjectClosureSummary(dto.closureSummary),
    quoteTruthSummary: adaptQuoteTruthSummary(dto.quoteTruthSummary),
    commercialExplanation: adaptCommercialExplanation(dto.commercialExplanation),
    changeOrderSummary: adaptChangeOrderSummary(dto.changeOrderSummary),
    settlementSummary: adaptSettlementSummary(dto.settlementSummary),
    payoutSummary: adaptPayoutSummary(dto.payoutSummary),
    financialClosureStatus: dto.financialClosureStatus || undefined,
    nextPendingAction: dto.nextPendingAction || undefined,
    businessStage: dto.businessStage || undefined,
    flowSummary: dto.flowSummary || undefined,
  };
}

export async function listOrders(params: { page?: number; pageSize?: number; status?: number } = {}) {
  const data = await requestJson<PageEnvelope<OrderListDTO>>('/orders', {
    query: {
      page: params.page || 1,
      pageSize: params.pageSize || 10,
      status: params.status,
    },
  });

  return {
    list: data.list.map(toOrderItem),
    total: data.total,
    page: data.page,
    pageSize: data.pageSize,
  };
}

export async function payOrder(id: number, request?: PaymentLaunchRequest) {
  return requestJson<PaymentLaunchPayload>(`/orders/${id}/pay`, {
    method: 'POST',
    body: request || {
      channel: 'alipay',
      terminalType: detectTerminalType() === 'mobile_h5' ? 'mobile_h5' : 'mini_qr',
    },
  });
}

export async function getOrderDetail(id: number) {
  const [order, planData] = await Promise.all([
    requestJson<OrderDetailDTO>(`/orders/${id}`),
    requestJson<OrderPlanResponse>(`/orders/${id}/plans`).catch(() => ({ plans: [] })),
  ]);

  return toOrderDetail(order, planData.plans || []);
}
