import type { PageEnvelope } from '../types/api';
import type { InspirationDetailVM, InspirationListItemVM } from '../types/viewModels';
import { formatCurrency } from '../utils/format';
import { parseTextArray } from '../utils/provider';
import { requestJson } from './http';

interface AuthorDTO {
  id?: number;
  name?: string;
  avatar?: string;
}

interface InspirationItemDTO {
  id: number;
  title?: string;
  coverImage?: string;
  style?: string;
  layout?: string;
  area?: string;
  price?: number;
  likeCount?: number;
  commentCount?: number;
  isLiked?: boolean;
  isFavorited?: boolean;
  author?: AuthorDTO;
}

interface InspirationDetailDTO {
  id: number;
  title?: string;
  coverImage?: string;
  images?: string;
  style?: string;
  layout?: string;
  area?: string;
  price?: number;
  description?: string;
  likeCount?: number;
  commentCount?: number;
  isLiked?: boolean;
  isFavorited?: boolean;
  author?: AuthorDTO;
}

function toInspirationCard(dto: InspirationItemDTO): InspirationListItemVM {
  return {
    id: dto.id,
    title: dto.title || '装修灵感',
    coverImage: dto.coverImage || 'https://placehold.co/960x720/e7e0da/1f2937?text=%E7%81%B5%E6%84%9F',
    style: dto.style || '风格待补充',
    layout: dto.layout || '户型待补充',
    area: dto.area || '面积待补充',
    priceText: formatCurrency(dto.price),
    authorName: dto.author?.name || '平台推荐',
    authorAvatar: dto.author?.avatar || 'https://placehold.co/80x80/e7e0da/1f2937?text=AU',
    likeCount: Number(dto.likeCount || 0),
    commentCount: Number(dto.commentCount || 0),
  };
}

export async function listInspiration(params: { page?: number; pageSize?: number } = {}) {
  const data = await requestJson<PageEnvelope<InspirationItemDTO>>('/inspiration', {
    query: {
      page: params.page || 1,
      pageSize: params.pageSize || 6,
    },
  });

  return {
    list: data.list.map(toInspirationCard),
    total: data.total,
    page: data.page,
    pageSize: data.pageSize,
  };
}

export async function getInspirationDetail(id: number) {
  const data = await requestJson<InspirationDetailDTO>(`/cases/${id}`);
  const galleryImages = parseTextArray(data.images);
  const baseCard = toInspirationCard(data);

  const detail: InspirationDetailVM = {
    ...baseCard,
    description: data.description || '案例详情待补充。',
    galleryImages: galleryImages.length > 0 ? galleryImages : [baseCard.coverImage],
    isLiked: Boolean(data.isLiked),
    isFavorited: Boolean(data.isFavorited),
  };

  return detail;
}
