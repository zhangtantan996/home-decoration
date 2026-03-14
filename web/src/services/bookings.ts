import type { BookingDetailVM, BookingListItemVM, BookingTimelineItemVM, ProviderRole } from '../types/viewModels';
import { formatArea, formatCurrency, formatDate, formatDateTime } from '../utils/format';
import { requestJson } from './http';

interface CreateBookingPayload {
  providerId: number;
  providerType: ProviderRole;
  address: string;
  area: number;
  renovationType: string;
  budgetRange: string;
  preferredDate: string;
  phone: string;
  notes: string;
}

interface BookingDTO {
  id: number;
  address?: string;
  area?: number;
  preferredDate?: string;
  renovationType?: string;
  budgetRange?: string;
  notes?: string;
  intentFee?: number;
  intentFeePaid?: boolean;
  status?: number;
  providerType?: string;
  updatedAt?: string;
}

interface BookingDetailResponse {
  booking: BookingDTO;
  provider?: {
    name?: string;
    avatar?: string;
    rating?: number;
    completedCnt?: number;
    yearsExperience?: number;
    specialty?: string;
    providerType?: string;
  };
  proposalId?: number;
}

const BOOKING_STATUS_MAP: Record<number, string> = {
  1: '待沟通',
  2: '已确认',
  3: '已完成',
  4: '已取消',
};

function readProviderType(value?: string): ProviderRole {
  if (value === 'company') {
    return 'company';
  }
  if (value === 'worker' || value === 'foreman') {
    return 'foreman';
  }
  return 'designer';
}

function formatProviderTypeText(type: ProviderRole) {
  if (type === 'company') {
    return '装修公司';
  }
  if (type === 'foreman') {
    return '工长施工';
  }
  return '设计师';
}

function buildBookingTimeline(dto: BookingDTO, proposalId?: number): BookingTimelineItemVM[] {
  const currentStatus = Number(dto.status || 1);
  const hasIntentFee = Boolean(dto.intentFeePaid);

  return [
    {
      title: '已提交预约',
      description: '平台已记录你的地址、面积、预算和预约时间。',
      state: 'done',
    },
    {
      title: '意向金确认',
      description: hasIntentFee ? '意向金已支付，服务商可继续推进方案。' : '支付意向金后，预约会进入报价推进阶段。',
      state: hasIntentFee ? 'done' : currentStatus === 1 ? 'active' : 'pending',
    },
    {
      title: '服务商沟通',
      description: proposalId ? '服务商已给出可查看的报价方案。' : '等待服务商响应并确认沟通时间。',
      state: proposalId ? 'done' : currentStatus >= 2 ? 'active' : 'pending',
    },
    {
      title: '进入报价确认',
      description: proposalId ? '继续查看报价详情并决定是否确认。' : '报价生成后会自动显示在这里。',
      state: proposalId ? 'active' : 'pending',
    },
  ];
}

function toBookingListItem(dto: BookingDTO): BookingListItemVM {
  const providerType = readProviderType(dto.providerType);

  return {
    id: dto.id,
    title: dto.address || `预约 #${dto.id}`,
    statusText: BOOKING_STATUS_MAP[Number(dto.status || 1)] || '处理中',
    preferredDate: formatDate(dto.preferredDate),
    budgetRange: dto.budgetRange || '预算待确认',
    address: dto.address || '地址待补充',
    href: `/bookings/${dto.id}`,
    providerType,
    providerTypeText: formatProviderTypeText(providerType),
    updatedAt: formatDateTime(dto.updatedAt),
  };
}

function adaptBookingDetail(response: BookingDetailResponse): BookingDetailVM {
  const providerType = readProviderType(response.provider?.providerType || response.booking.providerType);

  return {
    id: response.booking.id,
    statusText: BOOKING_STATUS_MAP[Number(response.booking.status || 1)] || '处理中',
    address: response.booking.address || '地址待补充',
    areaText: formatArea(response.booking.area),
    preferredDate: formatDate(response.booking.preferredDate),
    renovationType: response.booking.renovationType || '待确认',
    budgetRange: response.booking.budgetRange || '预算待确认',
    notes: response.booking.notes || '无补充说明',
    intentFeeText: formatCurrency(response.booking.intentFee),
    intentFeePaid: Boolean(response.booking.intentFeePaid),
    proposalId: response.proposalId,
    providerName: response.provider?.name || '服务商',
    providerSummary: response.provider?.specialty || `评分 ${(response.provider?.rating || 0).toFixed(1)} · ${response.provider?.completedCnt || 0} 单成交 · ${response.provider?.yearsExperience || 0} 年经验`,
    providerAvatar: response.provider?.avatar || 'https://placehold.co/120x120/e4e4e7/27272a?text=HZ',
    providerType,
    updatedAt: formatDateTime(response.booking.updatedAt),
    timeline: buildBookingTimeline(response.booking, response.proposalId),
  };
}

export async function listBookings() {
  const data = await requestJson<BookingDTO[]>('/bookings');
  return data.map(toBookingListItem);
}

export async function createBooking(payload: CreateBookingPayload) {
  const data = await requestJson<{ id: number }>('/bookings', {
    method: 'POST',
    body: payload,
  });
  return data.id;
}

export async function getBookingDetail(id: number) {
  const data = await requestJson<BookingDetailResponse>(`/bookings/${id}`);
  return adaptBookingDetail(data);
}

export async function payIntentFee(id: number) {
  await requestJson(`/bookings/${id}/pay-intent`, {
    method: 'POST',
  });
}
