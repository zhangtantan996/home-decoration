import { request } from '@/utils/request';

export type AfterSalesType = 'refund' | 'complaint' | 'repair';

export interface AfterSalesListItem {
  id: number;
  bookingId: number;
  orderNo: string;
  type: AfterSalesType;
  typeText: string;
  reason: string;
  amount: number;
  amountText: string;
  status: number;
  statusText: string;
  createdAt: string;
}

export interface AfterSalesDetail extends AfterSalesListItem {
  description: string;
  reply: string;
  resolvedAt: string;
  images: string[];
}

interface AfterSalesDTO {
  id: number;
  bookingId?: number;
  orderNo?: string;
  type?: AfterSalesType;
  reason?: string;
  description?: string;
  images?: string;
  amount?: number;
  status?: number;
  reply?: string;
  resolvedAt?: string;
  createdAt?: string;
}

export interface CreateAfterSalesPayload {
  bookingId: number;
  type: AfterSalesType;
  reason: string;
  description: string;
  amount: number;
  images: string;
}

const TYPE_LABEL_MAP: Record<AfterSalesType, string> = {
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

const formatCurrency = (amount?: number) => `¥${Number(amount || 0).toLocaleString()}`;

const formatDateTime = (value?: string) => {
  const next = String(value || '').trim();
  if (!next) return '';
  const normalized = next.replace('T', ' ').replace(/\.\d+Z?$/, '').replace('Z', '');
  return normalized.slice(0, 16);
};

const parseImages = (value?: string) => {
  if (!value) {
    return [] as string[];
  }

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item)).filter(Boolean);
    }
  } catch {
    return value
      .split(/\n|,|，/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [] as string[];
};

const toAfterSalesListItem = (dto: AfterSalesDTO): AfterSalesListItem => {
  const type = dto.type || 'complaint';
  const status = Number(dto.status || 0);

  return {
    id: dto.id,
    bookingId: Number(dto.bookingId || 0),
    orderNo: dto.orderNo || `AS-${dto.id}`,
    type,
    typeText: TYPE_LABEL_MAP[type],
    reason: dto.reason || '未填写原因',
    amount: Number(dto.amount || 0),
    amountText: formatCurrency(dto.amount),
    status,
    statusText: STATUS_LABEL_MAP[status] || '处理中',
    createdAt: formatDateTime(dto.createdAt),
  };
};

export async function listAfterSales(params: { status?: number } = {}) {
  const data = await request<AfterSalesDTO[]>({
    url: '/after-sales',
    data: { status: params.status },
  });

  return (data || []).map(toAfterSalesListItem);
}

export async function getAfterSalesDetail(id: number) {
  const data = await request<AfterSalesDTO>({
    url: `/after-sales/${id}`,
  });

  return {
    ...toAfterSalesListItem(data),
    description: data.description || '暂无补充说明。',
    reply: data.reply || '平台尚未回复。',
    resolvedAt: formatDateTime(data.resolvedAt),
    images: parseImages(data.images),
  } satisfies AfterSalesDetail;
}

export async function createAfterSales(payload: CreateAfterSalesPayload) {
  const data = await request<AfterSalesDTO>({
    url: '/after-sales',
    method: 'POST',
    data: payload,
    showLoading: true,
  });

  return toAfterSalesListItem(data);
}

export async function cancelAfterSales(id: number) {
  return request<{ message: string }>({
    url: `/after-sales/${id}`,
    method: 'DELETE',
    showLoading: true,
  });
}
