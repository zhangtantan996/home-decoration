import { request } from '@/utils/request';

import type {
  FavoriteItemDTO,
  InspirationAuthorDTO,
  InspirationCommentDTO,
  InspirationDetailDTO,
  InspirationItemDTO,
} from './dto';
import type { PageData } from './types';

export interface InspirationListQuery {
  page?: number;
  pageSize?: number;
  style?: string;
  layout?: string;
  priceMin?: number;
  priceMax?: number;
}

export interface InspirationCommentQuery {
  page?: number;
  pageSize?: number;
}

interface InspirationDetailRaw {
  id: number;
  providerId?: number;
  title?: string;
  coverImage?: string;
  style?: string;
  layout?: string;
  area?: string;
  price?: number;
  description?: string;
  images?: string | string[];
  likeCount?: number;
  commentCount?: number;
  isLiked?: boolean;
  isFavorited?: boolean;
  author?: InspirationAuthorDTO;
}

const normalizeImages = (images: InspirationDetailRaw['images']) => {
  if (Array.isArray(images)) {
    return images.filter((item): item is string => typeof item === 'string' && item.length > 0);
  }

  if (typeof images !== 'string' || !images) {
    return [];
  }

  try {
    const parsed = JSON.parse(images);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string' && item.length > 0);
    }
  } catch (error) {
    if (images.startsWith('http://') || images.startsWith('https://') || images.startsWith('/')) {
      return [images];
    }
  }

  return [];
};

const normalizeDetail = (raw: InspirationDetailRaw): InspirationDetailDTO => {
  return {
    id: raw.id,
    providerId: raw.providerId,
    title: raw.title || '未命名案例',
    coverImage: raw.coverImage || '',
    style: raw.style || '',
    layout: raw.layout || '',
    area: raw.area || '',
    price: raw.price || 0,
    description: raw.description || '',
    images: normalizeImages(raw.images),
    likeCount: raw.likeCount || 0,
    commentCount: raw.commentCount || 0,
    isLiked: Boolean(raw.isLiked),
    isFavorited: Boolean(raw.isFavorited),
    author: raw.author,
  };
};

export const inspirationService = {
  list: (query: InspirationListQuery = {}) =>
    request<PageData<InspirationItemDTO>>({
      url: '/inspiration',
      data: query,
    }),

  detail: async (id: number) => {
    const raw = await request<InspirationDetailRaw>({
      url: `/cases/${id}`,
    });
    return normalizeDetail(raw);
  },

  like: (id: number) =>
    request<{ likeCount: number; isLiked: boolean }>({
      url: `/inspiration/${id}/like`,
      method: 'POST',
    }),

  unlike: (id: number) =>
    request<{ likeCount: number; isLiked: boolean }>({
      url: `/inspiration/${id}/like`,
      method: 'DELETE',
    }),

  favorite: (id: number) =>
    request<{ message: string }>({
      url: `/inspiration/${id}/favorite`,
      method: 'POST',
    }),

  unfavorite: (id: number) =>
    request<{ message: string }>({
      url: `/inspiration/${id}/favorite`,
      method: 'DELETE',
    }),

  comments: (id: number, query: InspirationCommentQuery = {}) =>
    request<PageData<InspirationCommentDTO>>({
      url: `/inspiration/${id}/comments`,
      data: query,
    }),

  createComment: (id: number, content: string) =>
    request<InspirationCommentDTO>({
      url: `/inspiration/${id}/comments`,
      method: 'POST',
      data: { content },
      showLoading: true,
    }),

  // 获取案例报价
  getQuote: (id: number) =>
    request<CaseQuote>({
      url: `/cases/${id}/quote`,
    }),
};

export interface QuoteItem {
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  description?: string;
}

export interface CaseQuote {
  caseId: number;
  totalAmount: number;
  items: QuoteItem[];
  notes?: string;
}

export const favoriteService = {
  listCases: (page = 1, pageSize = 20) =>
    request<PageData<FavoriteItemDTO>>({
      url: '/user/favorites',
      data: { type: 'case', page, pageSize },
    }),

  listMaterialShops: (page = 1, pageSize = 20) =>
    request<PageData<FavoriteItemDTO>>({
      url: '/user/favorites',
      data: { type: 'material_shop', page, pageSize },
    }),
};
