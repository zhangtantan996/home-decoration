import { request } from '@/utils/request';
import type { PageData } from './types';
import type {
  ProviderCaseDTO,
  ProviderDTO,
  ProviderDetailDTO,
  ProviderType,
} from './dto';

export type { ProviderType } from './dto';

export type ProviderListItem = ProviderDTO;

export interface ProviderQuery {
  type?: ProviderType | 'all' | '1' | '2' | '3';
  lat?: number;
  lng?: number;
  radius?: number;
  keyword?: string;
  sortBy?: 'rating' | 'distance' | 'price';
  page?: number;
  pageSize?: number;
  subType?: string;
}

export type ProviderDetail = ProviderDetailDTO;

export type ProviderCaseItem = ProviderCaseDTO;

export interface ProviderReviewItem {
  id: number;
  rating: number;
  content: string;
  images?: string;
  createdAt?: string;
  tags?: string;
  userName?: string;
  userAvatar?: string;
  serviceType?: string;
  area?: string;
  style?: string;
}

export interface ReviewStats {
  rating: number;
  restoreRate: number;
  budgetControl: number;
  totalCount: number;
}

export interface UserProviderStatus {
  isFollowed: boolean;
  isFavorited: boolean;
}

const providerBasePath = (type: ProviderType) => {
  switch (type) {
    case 'designer':
      return 'designers';
    case 'company':
      return 'companies';
    case 'foreman':
    default:
      return 'foremen';
  }
};

export async function listProviders(query: ProviderQuery = {}) {
  return request<PageData<ProviderListItem>>({
    url: '/providers',
    data: query
  });
}

export async function getProviderDetail(type: ProviderType, id: number) {
  return request<ProviderDetail>({
    url: `/${providerBasePath(type)}/${id}`
  });
}

export async function getProviderCases(type: ProviderType, id: number, page = 1, pageSize = 10) {
  return request<PageData<ProviderCaseItem>>({
    url: `/${providerBasePath(type)}/${id}/cases`,
    data: { page, pageSize }
  });
}

export async function getProviderReviews(
  type: ProviderType,
  id: number,
  page = 1,
  pageSize = 10,
  filter?: string
) {
  return request<PageData<ProviderReviewItem>>({
    url: `/${providerBasePath(type)}/${id}/reviews`,
    data: { page, pageSize, filter }
  });
}

export async function getReviewStats(type: ProviderType, id: number) {
  return request<ReviewStats>({
    url: `/${providerBasePath(type)}/${id}/review-stats`
  });
}

export async function getProviderUserStatus(id: number) {
  return request<UserProviderStatus>({
    url: `/providers/${id}/user-status`
  });
}

export async function followProvider(id: number, type: ProviderType) {
  return request<void>({
    url: `/providers/${id}/follow`,
    method: 'POST',
    data: { type }
  });
}

export async function unfollowProvider(id: number, type: ProviderType) {
  return request<void>({
    url: `/providers/${id}/follow`,
    method: 'DELETE',
    data: { type }
  });
}

export async function favoriteProvider(id: number) {
  return request<void>({
    url: `/providers/${id}/favorite`,
    method: 'POST'
  });
}

export async function unfavoriteProvider(id: number) {
  return request<void>({
    url: `/providers/${id}/favorite`,
    method: 'DELETE'
  });
}
