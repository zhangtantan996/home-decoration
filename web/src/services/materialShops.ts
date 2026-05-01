import type { PageEnvelope } from '../types/api';
import type { MaterialShopDetailVM, MaterialShopListItemVM, MaterialShopProductVM } from '../types/viewModels';
import { requestJson } from './http';
import { readThroughCache } from './runtimeCache';

const MATERIAL_SHOP_LIST_TTL_MS = 20 * 1000;

interface MaterialShopDTO {
  id: number;
  type?: string;
  name?: string;
  cover?: string;
  brandLogo?: string;
  description?: string;
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
  products?: MaterialShopProductDTO[];
}

interface MaterialShopProductDTO {
  id: number;
  name?: string;
  unit?: string;
  description?: string;
  price?: number;
  images?: string[];
  coverImage?: string;
}

function toMaterialShop(dto: MaterialShopDTO): MaterialShopListItemVM {
  return {
    id: dto.id,
    type: dto.type || 'showroom',
    name: dto.name || '主材门店',
    cover: dto.cover || '',
    brandLogo: dto.brandLogo || undefined,
    description: dto.description || '',
    rating: Number(dto.rating || 0),
    reviewCount: Number(dto.reviewCount || 0),
    mainProducts: dto.mainProducts || [],
    productCategories: dto.productCategories || [],
    address: dto.address || '地址待补充',
    distance: dto.distance || '附近',
    openTime: dto.openTime || '营业时间待补充',
    tags: dto.tags || [],
    isVerified: dto.isSettled === true && Boolean(dto.isVerified),
    isSettled: dto.isSettled,
  };
}

function toMaterialShopProduct(dto: MaterialShopProductDTO): MaterialShopProductVM {
  return {
    id: Number(dto.id || 0),
    name: dto.name || '未命名商品',
    unit: dto.unit || '',
    description: dto.description || '',
    price: Number(dto.price || 0),
    images: dto.images || [],
    coverImage: dto.coverImage || dto.images?.[0] || '',
  };
}

function toMaterialShopDetail(dto: MaterialShopDTO): MaterialShopDetailVM {
  return {
    ...toMaterialShop(dto),
    products: (dto.products || []).map(toMaterialShopProduct),
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
  const query = {
    page: params.page || 1,
    pageSize: params.pageSize || 8,
    sortBy: params.sortBy || 'recommend',
    type: params.type,
    keyword: params.keyword,
    city: params.city,
    ratingMin: params.ratingMin,
  };

  return readThroughCache(
    `material-shops:list:${JSON.stringify(query)}`,
    MATERIAL_SHOP_LIST_TTL_MS,
    async () => {
      const data = await requestJson<PageEnvelope<MaterialShopDTO>>('/material-shops', { query });
      return {
        list: data.list.map(toMaterialShop),
        total: data.total,
        page: data.page,
        pageSize: data.pageSize,
      };
    },
    'public',
  );
}

export async function getMaterialShopDetail(id: number) {
  const data = await requestJson<MaterialShopDTO>(`/material-shops/${id}`);
  return toMaterialShopDetail(data);
}
