import type { MaterialShopItem, MaterialShopProductItem } from '@/services/materialShops';

import { resolveMaterialCoverUrl } from './providerMedia';

export const getMaterialProductImages = (product: MaterialShopProductItem) => {
  const urls = [product.coverImage, ...product.images].filter((item): item is string => Boolean(item));
  return Array.from(new Set(urls));
};

export const getMaterialProductCover = (product: MaterialShopProductItem) =>
  resolveMaterialCoverUrl({
    cover: product.coverImage,
    productImages: product.images,
    fallback: '',
  });

export const formatMaterialProductPrice = (product: MaterialShopProductItem) => {
  if (product.price > 0) {
    return `¥${product.price.toLocaleString()}${product.unit ? `/${product.unit}` : ''}`;
  }
  return '到店咨询';
};

export const getMaterialProductSubtitle = (product: MaterialShopProductItem) => {
  const desc = product.description.trim();
  if (desc) return desc;
  return product.unit ? `按${product.unit}咨询` : '门店商品';
};

export const getMaterialProductById = (shop: MaterialShopItem | null, productId: number) =>
  (shop?.products || []).find((product) => product.id === productId) || null;

export const getMaterialProductSpecRows = (product: MaterialShopProductItem) => {
  const rows = [
    { label: '商品名称', value: product.name },
    { label: '计价单位', value: product.unit },
    { label: '参考价格', value: formatMaterialProductPrice(product) },
    { label: '商品说明', value: product.description },
  ];
  return rows.filter((item) => item.value && item.value.trim());
};
