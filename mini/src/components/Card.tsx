import { View } from '@tarojs/components';
import React from 'react';
import './Card.scss';

interface CardProps {
  children: React.ReactNode;
  title?: string;
  extra?: React.ReactNode;
  className?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
}

const buildClassName = (base: string, parts: Array<string | false | undefined>) => {
  return [base, ...parts.filter(Boolean)].join(' ');
};

export const Card: React.FC<CardProps> = ({
  children,
  title,
  extra,
  className,
  onClick,
  style
}) => {
  const classes = buildClassName('card', [
    onClick ? 'card--hover' : undefined,
    className
  ]);

  return (
    <View 
      className={classes}
      onClick={onClick}
      hoverClass={onClick ? 'card--pressed' : 'none'}
      style={style}
    >
      {(title || extra) && (
        <View className="card__header">
          {title && <View className="card__title">{title}</View>}
          {extra && <View className="card__extra">{extra}</View>}
        </View>
      )}
      <View className="card__content">
        {children}
      </View>
    </View>
  );
};
