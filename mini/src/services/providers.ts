import { request } from '@/utils/request';
import type { PageData } from './types';

export type ProviderType = 'designer' | 'company' | 'foreman';

export interface ProviderListItem {
  id: number;
  userId: number;
  providerType: number;
  companyName: string;
  nickname: string;
  avatar: string;
  rating: number;
  restoreRate: number;
  budgetControl: number;
  completedCnt: number;
  verified: boolean;
  latitude: number;
  longitude: number;
  distance?: number;
  subType: string;
  yearsExperience: number;
  specialty: string;
  workTypes: string;
  reviewCount: number;
  priceMin: number;
  priceMax: number;
  priceUnit: string;
}

export interface ProviderQuery {
  type?: ProviderType | 'all' | '1' | '2' | '3';
  lat?: number;
  lng?: number;
  radius?: number;
  keyword?: string;
  sortBy?: 'rating' | 'distance' | 'price';
  page?: number;
  pageSize?: number;
  workType?: string;
  subType?: string;
}

export interface ProviderDetail {
  id: number;
  userId: number;
  providerType: number;
  companyName?: string;
  nickname?: string;
  avatar?: string;
  rating?: number;
  completedCnt?: number;
  verified?: boolean;
  coverImage?: string;
  serviceIntro?: string;
  teamSize?: number;
  establishedYear?: number;
  certifications?: string;
  serviceArea?: string;
  officeAddress?: string;
  specialty?: string;
  workTypes?: string;
  priceMin?: number;
  priceMax?: number;
  priceUnit?: string;
}

export interface ProviderCaseItem {
  id: number;
  title: string;
  coverImage: string;
  style?: string;
  area?: number;
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

export async function followProvider(id: number) {
  return request<void>({
    url: `/providers/${id}/follow`,
    method: 'POST'
  });
}

export async function unfollowProvider(id: number) {
  return request<void>({
    url: `/providers/${id}/follow`,
    method: 'DELETE'
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
