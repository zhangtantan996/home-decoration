import type { AfterSalesDetailVM, AfterSalesListItemVM } from '../types/viewModels';
import { formatCurrency, formatDateTime } from '../utils/format';
import { requestJson } from './http';

interface AfterSalesDTO {
  id: number;
  bookingId?: number;
  orderNo?: string;
  type?: 'refund' | 'complaint' | 'repair';
  reason?: string;
  description?: string;
  images?: string;
  amount?: number;
  status?: number;
  reply?: string;
  resolvedAt?: string;
  createdAt?: string;
}

interface CreateAfterSalesPayload {
  bookingId: number;
  type: 'refund' | 'complaint' | 'repair';
  reason: string;
  description: string;
  amount: number;
  images: string;
}

const TYPE_LABEL_MAP: Record<NonNullable<AfterSalesDTO['type']>, string> = {
  refund: '退款申请',
  complaint: '投诉争议',
  repair: '返修申请',
};

const STATUS_LABEL_MAP: Record<number, string> = {
  0: '待处理',
  1: '处理中',
  2: '已完成',
  3: '已关闭',
};

function parseImages(value?: string) {
  if (!value) {
    return [] as string[];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
  } catch {
    return value
      .split(/\n|,|，/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
}

function toAfterSalesListItem(dto: AfterSalesDTO): AfterSalesListItemVM {
  const type = dto.type || 'complaint';
  const status = Number(dto.status || 0);

  return {
    id: dto.id,
    bookingId: Number(dto.bookingId || 0),
    orderNo: dto.orderNo || `AS-${dto.id}`,
    type,
    typeText: TYPE_LABEL_MAP[type],
    reason: dto.reason || '未填写原因',
    amountText: formatCurrency(dto.amount),
    status,
    statusText: STATUS_LABEL_MAP[status] || '处理中',
    createdAt: formatDateTime(dto.createdAt),
  };
}

export async function listAfterSales(params: { status?: number } = {}) {
  const data = await requestJson<AfterSalesDTO[]>('/after-sales', {
    query: { status: params.status },
  });
  return data.map(toAfterSalesListItem);
}

export async function getAfterSalesDetail(id: number) {
  const data = await requestJson<AfterSalesDTO>(`/after-sales/${id}`);
  const base = toAfterSalesListItem(data);

  const detail: AfterSalesDetailVM = {
    ...base,
    description: data.description || '暂无补充说明。',
    reply: data.reply || '平台尚未回复。',
    resolvedAt: formatDateTime(data.resolvedAt),
    images: parseImages(data.images),
  };

  return detail;
}

export async function createAfterSales(payload: CreateAfterSalesPayload) {
  const data = await requestJson<AfterSalesDTO>('/after-sales', {
    method: 'POST',
    body: payload,
  });
  return toAfterSalesListItem(data);
}

export async function cancelAfterSales(id: number) {
  await requestJson(`/after-sales/${id}`, {
    method: 'DELETE',
  });
}
