import type { PageEnvelope } from '../types/api';
import type { MaterialShopListItemVM } from '../types/viewModels';
import { requestJson } from './http';

interface MaterialShopDTO {
  id: number;
  type?: string;
  name?: string;
  cover?: string;
  brandLogo?: string;
  rating?: number;
  reviewCount?: number;
  mainProducts?: string[];
  productCategories?: string[];
  address?: string;
  distance?: string;
  openTime?: string;
  tags?: string[];
  isVerified?: boolean;
  isSettled?: boolean;
}

function toMaterialShop(dto: MaterialShopDTO): MaterialShopListItemVM {
  return {
    id: dto.id,
    type: dto.type || 'showroom',
    name: dto.name || '主材门店',
    cover: dto.cover || 'https://placehold.co/960x720/e7e0da/1f2937?text=%E4%B8%BB%E6%9D%90',
    brandLogo: dto.brandLogo || undefined,
    rating: Number(dto.rating || 0),
    reviewCount: Number(dto.reviewCount || 0),
    mainProducts: dto.mainProducts || [],
    productCategories: dto.productCategories || [],
    address: dto.address || '地址待补充',
    distance: dto.distance || '附近',
    openTime: dto.openTime || '营业时间待补充',
    tags: dto.tags || [],
    isVerified: Boolean(dto.isVerified),
    isSettled: dto.isSettled,
  };
}

interface ListMaterialShopsParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  type?: string;
  keyword?: string;
  city?: string;
  ratingMin?: number;
}

export async function listMaterialShops(params: ListMaterialShopsParams = {}) {
  const data = await requestJson<PageEnvelope<MaterialShopDTO>>('/material-shops', {
    query: {
      page: params.page || 1,
      pageSize: params.pageSize || 8,
      sortBy: params.sortBy || 'recommend',
      type: params.type,
      keyword: params.keyword,
      city: params.city,
      ratingMin: params.ratingMin,
    },
  });

  return {
    list: data.list.map(toMaterialShop),
    total: data.total,
    page: data.page,
    pageSize: data.pageSize,
  };
}

export async function getMaterialShopDetail(id: number) {
  const data = await requestJson<MaterialShopDTO>(`/material-shops/${id}`);
  return toMaterialShop(data);
}
