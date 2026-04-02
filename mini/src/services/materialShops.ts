import { request } from '@/utils/request';

import type { PageData } from './types';

export interface MaterialShopItem {
  id: number;
  type: string;
  name: string;
  cover: string;
  brandLogo?: string;
  rating: number;
  reviewCount: number;
  mainProducts: string[];
  productCategories: string[];
  address: string;
  distance: string;
  openTime: string;
  tags: string[];
  isVerified: boolean;
  isSettled?: boolean;
  products: MaterialShopProductItem[];
}

export interface MaterialShopProductItem {
  id: number;
  name: string;
  unit: string;
  description: string;
  price: number;
  images: string[];
  coverImage?: string;
}

export interface MaterialShopQuery {
  page?: number;
  pageSize?: number;
  sortBy?: 'recommend' | 'distance';
  type?: string;
}

interface MaterialShopDTO {
  id?: number;
  type?: string;
  name?: string;
  cover?: string;
  brandLogo?: string;
  rating?: number;
  reviewCount?: number;
  mainProducts?: string[];
  productCategories?: string[];
  address?: string;
  distance?: string | number;
  openTime?: string;
  tags?: string[];
  isVerified?: boolean;
  isSettled?: boolean;
  products?: MaterialShopProductDTO[];
}

interface MaterialShopProductDTO {
  id?: number;
  name?: string;
  unit?: string;
  description?: string;
  price?: number;
  images?: string[];
  coverImage?: string;
}

const normalizeStringArray = (value?: string[]) => {
  return Array.isArray(value) ? value.filter(Boolean) : [];
};

const toMaterialShopProductItem = (dto: MaterialShopProductDTO): MaterialShopProductItem => ({
  id: Number(dto.id || 0),
  name: dto.name || '门店商品',
  unit: dto.unit || '',
  description: dto.description || '',
  price: Number(dto.price || 0),
  images: normalizeStringArray(dto.images),
  coverImage: dto.coverImage || normalizeStringArray(dto.images)[0] || undefined,
});

const toMaterialShopItem = (dto: MaterialShopDTO): MaterialShopItem => ({
  id: Number(dto.id || 0),
  type: dto.type || 'showroom',
  name: dto.name || '主材门店',
  cover: dto.cover || '',
  brandLogo: dto.brandLogo || undefined,
  rating: Number(dto.rating || 0),
  reviewCount: Number(dto.reviewCount || 0),
  mainProducts: normalizeStringArray(dto.mainProducts),
  productCategories: normalizeStringArray(dto.productCategories),
  address: dto.address || '地址待补充',
  distance: String(dto.distance || '附近'),
  openTime: dto.openTime || '营业时间待补充',
  tags: normalizeStringArray(dto.tags),
  isVerified: Boolean(dto.isVerified),
  isSettled: dto.isSettled,
  products: Array.isArray(dto.products) ? dto.products.map(toMaterialShopProductItem) : [],
});

export async function listMaterialShops(query: MaterialShopQuery = {}) {
  const data = await request<PageData<MaterialShopDTO>>({
    url: '/material-shops',
    data: {
      page: query.page || 1,
      pageSize: query.pageSize || 8,
      sortBy: query.sortBy || 'recommend',
      ...(query.type ? { type: query.type } : {}),
    },
  });

  return {
    ...data,
    list: (data.list || []).map(toMaterialShopItem),
  };
}

export async function getMaterialShopDetail(id: number) {
  const data = await request<MaterialShopDTO>({
    url: `/material-shops/${id}`,
  });

  return toMaterialShopItem(data);
}
