import { View, Image } from '@tarojs/components';
import React from 'react';
import './ListItem.scss';

interface ListItemProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  extra?: React.ReactNode;
  arrow?: boolean;
  onClick?: () => void;
  className?: string;
}

const buildClassName = (base: string, parts: Array<string | false | undefined>) => {
  return [base, ...parts.filter(Boolean)].join(' ');
};

export const ListItem: React.FC<ListItemProps> = ({
  title,
  description,
  icon,
  extra,
  arrow = false,
  onClick,
  className
}) => {
  const classes = buildClassName('list-item', [
    onClick ? 'list-item--hover' : undefined,
    className
  ]);

  return (
    <View 
      className={classes}
      onClick={onClick}
    >
      <View className="list-item__left">
        {icon && <View className="list-item__icon">{icon}</View>}
        <View className="list-item__content">
          <View className="list-item__title">{title}</View>
          {description && <View className="list-item__desc">{description}</View>}
        </View>
      </View>
      
      {(extra || arrow) && (
        <View className="list-item__right">
          {extra}
          {arrow && <View className="list-item__arrow">›</View>}
        </View>
      )}
    </View>
  );
};
