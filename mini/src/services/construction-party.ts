import { request } from '@/utils/request';

import type { ProviderDTO } from './dto';

export interface SelectConstructionPartyRequest {
  providerId: number;
  providerType: 2 | 3; // 2: company, 3: foreman
}

export interface ConstructionPartyStatusResponse {
  status: string; // 'pending' | 'confirmed' | 'rejected'
  providerId?: number;
  providerType?: number;
  providerName?: string;
  confirmedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
}

export interface MatchedConstructionParty {
  provider: ProviderDTO;
  matchScore?: number;
  matchReason?: string;
}

export async function selectConstructionParty(
  bookingId: number,
  data: SelectConstructionPartyRequest
) {
  return request<{ message: string }>({
    url: `/bookings/${bookingId}/select-crew`,
    method: 'POST',
    data,
    showLoading: true,
  });
}
