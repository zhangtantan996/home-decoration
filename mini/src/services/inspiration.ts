import { request } from '@/utils/request';
import {
  getInspirationAvatarUrl,
  getInspirationCoverImage,
  getInspirationGalleryImages,
} from '@/utils/inspirationImages';

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

const normalizeAuthor = (author?: InspirationAuthorDTO): InspirationAuthorDTO => ({
  id: author?.id || 0,
  name: author?.name || '官方',
  avatar: getInspirationAvatarUrl(author?.avatar),
});

const normalizeListItem = (raw: Partial<InspirationItemDTO>): InspirationItemDTO => ({
  id: raw.id || 0,
  title: raw.title || '未命名案例',
  coverImage: getInspirationCoverImage(raw),
  style: raw.style || '',
  layout: raw.layout || '',
  area: raw.area || '',
  price: raw.price || 0,
  likeCount: raw.likeCount || 0,
  commentCount: raw.commentCount || 0,
  isLiked: Boolean(raw.isLiked),
  isFavorited: Boolean(raw.isFavorited),
  author: normalizeAuthor(raw.author),
});

const normalizeDetail = (raw: InspirationDetailRaw): InspirationDetailDTO => {
  const galleryImages = getInspirationGalleryImages(raw);

  return {
    id: raw.id,
    providerId: raw.providerId,
    title: raw.title || '未命名案例',
    coverImage: galleryImages[0],
    style: raw.style || '',
    layout: raw.layout || '',
    area: raw.area || '',
    price: raw.price || 0,
    description: raw.description || '',
    images: galleryImages.slice(1),
    likeCount: raw.likeCount || 0,
    commentCount: raw.commentCount || 0,
    isLiked: Boolean(raw.isLiked),
    isFavorited: Boolean(raw.isFavorited),
    author: normalizeAuthor(raw.author),
  };
};

export const inspirationService = {
  list: async (query: InspirationListQuery = {}) => {
    const pageData = await request<PageData<InspirationItemDTO>>({
      url: '/inspiration',
      data: query,
    });

    return {
      ...pageData,
      list: (pageData.list || []).map((item) => normalizeListItem(item)),
    };
  },

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
