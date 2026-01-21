import { request } from '@/utils/request';

export type ProviderType = 'designer' | 'company' | 'foreman';

export interface CreateBookingPayload {
  providerId: number;
  providerType: ProviderType;
  address: string;
  area: number;
  renovationType?: string;
  budgetRange?: string;
  preferredDate: string;
  phone: string;
  notes?: string;
  houseLayout?: string;
}

export interface BookingItem {
  id: number;
  providerId: number;
  providerType: number;
  address: string;
  area: number;
  renovationType?: string;
  budgetRange?: string;
  preferredDate: string;
  phone: string;
  notes?: string;
  status: number;
  intentFee: number;
  intentFeePaid: boolean;
  proposalId?: number;
  createdAt?: string;
}

export async function createBooking(payload: CreateBookingPayload) {
  return request<BookingItem>({
    url: '/bookings',
    method: 'POST',
    data: payload,
    showLoading: true
  });
}

export async function listBookings(paid?: boolean) {
  return request<BookingItem[]>({
    url: '/bookings',
    data: typeof paid === 'boolean' ? { paid } : undefined
  });
}

export async function getBookingDetail(id: number) {
  return request<BookingItem & { provider?: Record<string, unknown> }>({
    url: `/bookings/${id}`
  });
}

export async function payIntentFee(id: number) {
  return request<{ message: string }>({
    url: `/bookings/${id}/pay-intent`,
    method: 'POST',
    showLoading: true
  });
}

export async function cancelBooking(id: number) {
  return request<{ message: string }>({
    url: `/bookings/${id}/cancel`,
    method: 'DELETE',
    showLoading: true
  });
}

export async function deleteBooking(id: number) {
  return request<{ message: string }>({
    url: `/bookings/${id}`,
    method: 'DELETE',
    showLoading: true
  });
}
