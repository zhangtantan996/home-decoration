import { request } from '@/utils/request';
import type { PageData } from './types';
import type {
  ProviderCaseDTO,
  ProviderDTO,
  ProviderDetailDTO,
  ProviderSceneDTO,
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
export type ProviderSceneItem = ProviderSceneDTO;

export interface ProviderCaseDetail {
  id: number;
  providerId: number;
  title: string;
  coverImage: string;
  style?: string;
  layout?: string;
  area?: string | number;
  description?: string;
  images?: string | string[];
  year?: string | number;
}

export interface ProviderSceneDetail {
  id: number;
  caseId: number;
  projectId: number;
  providerId: number;
  title: string;
  coverImage: string;
  description?: string;
  images?: string | string[];
  year?: string | number;
  createdAt?: string;
}

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

export async function getProviderSceneCases(type: ProviderType, id: number, page = 1, pageSize = 10) {
  return request<PageData<ProviderSceneItem>>({
    url: `/${providerBasePath(type)}/${id}/scene-cases`,
    data: { page, pageSize }
  });
}

export async function getProviderCaseDetail(id: number) {
  return request<ProviderCaseDetail>({
    url: `/provider-cases/${id}`
  });
}

export async function getProviderSceneDetail(id: number) {
  return request<ProviderSceneDetail>({
    url: `/provider-scenes/${id}`
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
