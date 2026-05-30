import { Image, Text, View } from '@tarojs/components';
import React from 'react';

import { Icon } from '@/components/Icon';
import type { MaterialShopProductItem } from '@/services/materialShops';
import { colors } from '@/theme/tokens';
import {
  formatMaterialProductPrice,
  getMaterialProductCover,
  getMaterialProductSubtitle,
} from '@/utils/materialProducts';

import './MaterialProductCard.scss';

interface MaterialProductCardProps {
  product: MaterialShopProductItem;
  variant?: 'rail' | 'grid';
  onClick?: () => void;
}

const buildClassName = (variant: 'rail' | 'grid') =>
  `material-product-card material-product-card--${variant}`;

export const MaterialProductCard: React.FC<MaterialProductCardProps> = ({
  product,
  variant = 'rail',
  onClick,
}) => {
  const cover = getMaterialProductCover(product);

  return (
    <View
      className={buildClassName(variant)}
      onClick={onClick}
      hoverClass="material-product-card--pressed"
    >
      {cover ? (
        <Image className="material-product-card__image" src={cover} mode="aspectFill" lazyLoad />
      ) : (
        <View className="material-product-card__image material-product-card__image--placeholder">
          <Icon name="material-service" size={52} color={colors.white} />
        </View>
      )}
      <View className="material-product-card__body">
        <Text className="material-product-card__title" numberOfLines={2}>{product.name}</Text>
        <Text className="material-product-card__subtitle" numberOfLines={1}>
          {getMaterialProductSubtitle(product)}
        </Text>
        <Text className="material-product-card__price">{formatMaterialProductPrice(product)}</Text>
      </View>
    </View>
  );
};

export default MaterialProductCard;
