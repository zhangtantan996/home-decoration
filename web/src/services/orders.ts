import type { PageEnvelope } from '../types/api';
import type { OrderListItemVM } from '../types/viewModels';
import { ORDER_STATUS_LABELS } from '../constants/statuses';
import { formatCurrency, formatDateTime } from '../utils/format';
import { detectTerminalType } from '../utils/terminal';
import { requestJson } from './http';
import type { PaymentLaunchPayload } from './payments';

interface OrderListDTO {
  id: number;
  recordType?: 'order' | 'payment';
  orderNo?: string;
  status?: number;
  statusText?: string;
  amount?: number;
  providerName?: string;
  address?: string;
  nextPayableAt?: string;
  proposalId?: number;
  projectId?: number;
  actionPath?: string;
}

function toOrderItem(dto: OrderListDTO): OrderListItemVM {
  return {
    id: dto.id,
    recordType: dto.recordType || 'order',
    orderNo: dto.orderNo || `ORD-${dto.id}`,
    status: Number(dto.status || 0),
    statusText: dto.statusText || ORDER_STATUS_LABELS[Number(dto.status || 0)] || '处理中',
    amountText: formatCurrency(dto.amount),
    providerName: dto.providerName || '服务商',
    address: dto.address || '地址待补充',
    nextPayableAt: formatDateTime(dto.nextPayableAt),
    proposalId: dto.proposalId || undefined,
    projectId: dto.projectId || undefined,
    actionPath: dto.actionPath || undefined,
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

export async function payOrder(id: number) {
  return requestJson<PaymentLaunchPayload>(`/orders/${id}/pay`, {
    method: 'POST',
    body: { terminalType: detectTerminalType() },
  });
}
