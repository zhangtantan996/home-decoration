import type { PageEnvelope } from '../types/api';
import type { ProviderCaseVM, ProviderDetailVM, ProviderListItemVM, ProviderReviewVM, ProviderRole, ReviewStatsVM } from '../types/viewModels';
import { compactPhone, formatDateTime } from '../utils/format';
import { normalizeProviderRole, parseTextArray, roleToBasePath, summarizePricing } from '../utils/provider';
import { requestJson } from './http';

interface ProviderListDTO {
  id: number;
  userPublicId?: string;
  providerType?: number | string;
  companyName?: string;
  nickname?: string;
  avatar?: string;
  rating?: number;
  reviewCount?: number;
  completedCnt?: number;
  yearsExperience?: number;
  verified?: boolean;
  specialty?: string;
  highlightTags?: string;
  serviceArea?: string;
  priceMin?: number;
  priceMax?: number;
  priceUnit?: string;
}

interface ProviderDetailResponse {
  provider?: Record<string, unknown>;
  user?: Record<string, unknown>;
  cases?: ProviderCaseDTO[];
  reviews?: ProviderReviewDTO[];
  reviewCount?: number;
}

interface ProviderCaseDTO {
  id: number;
  title?: string;
  coverImage?: string;
  style?: string;
  area?: string | number;
}

interface ProviderReviewDTO {
  id: number;
  userName?: string;
  userAvatar?: string;
  rating?: number;
  content?: string;
  createdAt?: string;
  tags?: string;
}

interface ProviderUserStatusDTO {
  isFollowed: boolean;
  isFavorited: boolean;
}

function toProviderListItem(dto: ProviderListDTO): ProviderListItemVM {
  const role = normalizeProviderRole(dto.providerType);
  const pricing = summarizePricing(dto.highlightTags, dto.priceMin, dto.priceMax, dto.priceUnit);

  return {
    id: dto.id,
    role,
    name: dto.nickname || dto.companyName || '未命名服务商',
    orgLabel: role === 'designer' ? '设计师' : role === 'company' ? '装修公司' : '工长施工',
    avatar: dto.avatar || 'https://placehold.co/1200x900/e7eaef/0f172a?text=HZ',
    summary: dto.specialty || '支持前期沟通、现场勘测与分项报价。',
    rating: Number(dto.rating || 0),
    reviewCount: Number(dto.reviewCount || 0),
    completedCount: Number(dto.completedCnt || 0),
    yearsExperience: Number(dto.yearsExperience || 0),
    verified: Boolean(dto.verified),
    priceText: pricing.priceText,
    tags: parseTextArray(dto.highlightTags).slice(0, 3),
    serviceArea: parseTextArray(dto.serviceArea),
    userPublicId: dto.userPublicId,
  };
}

function readNumericRecord(source: Record<string, unknown>, key: string) {
  const value = source[key];
  return typeof value === 'number' ? value : Number(value || 0);
}

function readStringRecord(source: Record<string, unknown>, key: string) {
  const value = source[key];
  return typeof value === 'string' ? value : String(value || '');
}

function toProviderDetail(role: ProviderRole, response: ProviderDetailResponse, cases: ProviderCaseVM[], reviews: ProviderReviewVM[], reviewStats: ReviewStatsVM): ProviderDetailVM {
  const provider = (response.provider || {}) as Record<string, unknown>;
  const user = (response.user || {}) as Record<string, unknown>;
  const pricing = summarizePricing(readStringRecord(provider, 'pricingJson'), readNumericRecord(provider, 'priceMin'), readNumericRecord(provider, 'priceMax'), readStringRecord(provider, 'priceUnit'));

  return {
    id: Number(provider.id || 0),
    role,
    name: readStringRecord(user, 'nickname') || readStringRecord(provider, 'companyName') || readStringRecord(provider, 'nickname') || '服务商',
    orgLabel: role === 'designer' ? '设计师' : role === 'company' ? '装修公司' : '工长',
    avatar: readStringRecord(user, 'avatar') || readStringRecord(provider, 'avatar') || readStringRecord(provider, 'coverImage') || 'https://placehold.co/120x120/e7eaef/0f172a?text=HZ',
    summary: readStringRecord(provider, 'specialty') || readStringRecord(provider, 'serviceIntro') || '支持前期沟通与上门勘测。',
    rating: readNumericRecord(provider, 'rating'),
    reviewCount: reviewStats.totalCount,
    completedCount: readNumericRecord(provider, 'completedCnt'),
    yearsExperience: readNumericRecord(provider, 'yearsExperience'),
    verified: Boolean(provider.verified),
    priceText: pricing.priceText,
    tags: parseTextArray(readStringRecord(provider, 'highlightTags')),
    serviceArea: parseTextArray(readStringRecord(provider, 'serviceArea')),
    userPublicId: readStringRecord(user, 'publicId') || undefined,
    coverImage: readStringRecord(provider, 'coverImage') || readStringRecord(user, 'avatar') || 'https://placehold.co/1200x540/111827/f8fafc?text=%E5%AE%B6%E8%A3%85%E7%AE%A1%E5%AE%B6',
    serviceIntro: readStringRecord(provider, 'serviceIntro') || readStringRecord(provider, 'introduction') || '可先沟通户型、预算和入住时间，再安排测量或远程方案建议。',
    officeAddress: readStringRecord(provider, 'officeAddress') || '线上沟通 + 同城到场',
    teamSize: readNumericRecord(provider, 'teamSize'),
    establishedText: readNumericRecord(provider, 'establishedYear') ? `${readNumericRecord(provider, 'establishedYear')} 年成立` : `${readNumericRecord(provider, 'yearsExperience')} 年从业经验`,
    certifications: parseTextArray(readStringRecord(provider, 'certifications')),
    priceDetails: pricing.details,
    cases,
    reviews,
    reviewStats,
    phoneHint: compactPhone(readStringRecord(user, 'phone')),
  };
}

function toCase(dto: ProviderCaseDTO): ProviderCaseVM {
  return {
    id: dto.id,
    title: dto.title || '案例',
    coverImage: dto.coverImage || 'https://placehold.co/960x720/e7eaef/0f172a?text=%E6%A1%88%E4%BE%8B',
    style: dto.style || '风格待补充',
    area: dto.area ? `${dto.area}` : '面积待补充',
  };
}

function toReview(dto: ProviderReviewDTO): ProviderReviewVM {
  return {
    id: dto.id,
    userName: dto.userName || '匿名业主',
    userAvatar: dto.userAvatar || 'https://placehold.co/80x80/e7eaef/0f172a?text=U',
    rating: Number(dto.rating || 0),
    content: dto.content || '暂无评价内容',
    createdAt: formatDateTime(dto.createdAt),
    tags: parseTextArray(dto.tags),
  };
}

export async function getRecommendedProviders() {
  const data = await requestJson<PageEnvelope<ProviderListDTO>>('/providers', {
    query: { page: 1, pageSize: 4 },
  });
  return data.list.map(toProviderListItem);
}

export async function listProviders(params: { role: ProviderRole; keyword: string; page: number; pageSize: number }) {
  const data = await requestJson<PageEnvelope<ProviderListDTO>>('/providers', {
    query: {
      type: params.role,
      keyword: params.keyword,
      page: params.page,
      pageSize: params.pageSize,
    },
  });

  return {
    list: data.list.map(toProviderListItem),
    total: data.total,
    page: data.page || params.page,
    pageSize: data.pageSize || params.pageSize,
  };
}

export async function getProviderDetail(role: ProviderRole, id: number) {
  const basePath = roleToBasePath(role);
  const detail = await requestJson<ProviderDetailResponse>(`/${basePath}/${id}`);
  const [casesData, reviewsData, reviewStats] = await Promise.all([
    requestJson<PageEnvelope<ProviderCaseDTO>>(`/${basePath}/${id}/cases`, { query: { page: 1, pageSize: 6 } }).catch(() => ({
      list: detail.cases || [],
      total: detail.cases?.length || 0,
      page: 1,
      pageSize: 6,
    })),
    requestJson<PageEnvelope<ProviderReviewDTO>>(`/${basePath}/${id}/reviews`, { query: { page: 1, pageSize: 4 } }).catch(() => ({
      list: detail.reviews || [],
      total: detail.reviews?.length || 0,
      page: 1,
      pageSize: 4,
    })),
    requestJson<ReviewStatsVM>(`/${basePath}/${id}/review-stats`).catch(() => ({
      rating: 0,
      restoreRate: 0,
      budgetControl: 0,
      totalCount: Number(detail.reviewCount || detail.reviews?.length || 0),
    })),
  ]);

  return toProviderDetail(role, detail, casesData.list.map(toCase), reviewsData.list.map(toReview), {
    rating: Number(reviewStats.rating || 0),
    restoreRate: Number(reviewStats.restoreRate || 0),
    budgetControl: Number(reviewStats.budgetControl || 0),
    totalCount: Number(reviewStats.totalCount || 0),
  });
}

export async function getProviderUserStatus(providerId: number) {
  return requestJson<ProviderUserStatusDTO>(`/providers/${providerId}/user-status`);
}

export async function followProvider(providerId: number, role: ProviderRole) {
  await requestJson(`/providers/${providerId}/follow`, {
    method: 'POST',
    query: { type: role },
  });
}

export async function unfollowProvider(providerId: number, role: ProviderRole) {
  await requestJson(`/providers/${providerId}/follow`, {
    method: 'DELETE',
    query: { type: role },
  });
}

export async function favoriteProvider(providerId: number) {
  await requestJson(`/providers/${providerId}/favorite`, {
    method: 'POST',
    query: { type: 'provider' },
  });
}

export async function unfavoriteProvider(providerId: number) {
  await requestJson(`/providers/${providerId}/favorite`, {
    method: 'DELETE',
    query: { type: 'provider' },
  });
}
