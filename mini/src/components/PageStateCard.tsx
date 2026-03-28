import { Text, View } from '@tarojs/components';
import React from 'react';

import { Button } from './Button';
import './PageStateCard.scss';

type PageStateCardVariant = 'loading' | 'error';

interface PageStateCardProps {
  variant?: PageStateCardVariant;
  title: string;
  description: string;
  className?: string;
  action?: {
    text: string;
    onClick: () => void;
  };
}

const buildClassName = (base: string, parts: Array<string | false | undefined>) => {
  return [base, ...parts.filter(Boolean)].join(' ');
};

export const PageStateCard: React.FC<PageStateCardProps> = ({
  variant = 'loading',
  title,
  description,
  className,
  action,
}) => {
  const classes = buildClassName('page-state-card', [
    `page-state-card--${variant}`,
    className,
  ]);

  return (
    <View className={classes}>
      <View className="page-state-card__head">
        {variant === 'loading' ? (
          <View className="page-state-card__pulse" aria-hidden>
            <View className="page-state-card__pulse-dot" />
            <View className="page-state-card__pulse-dot" />
            <View className="page-state-card__pulse-dot" />
          </View>
        ) : (
          <View className="page-state-card__indicator" aria-hidden />
        )}
        <Text className="page-state-card__title">{title}</Text>
      </View>
      <Text className="page-state-card__description">{description}</Text>
      {action ? (
        <View className="page-state-card__action">
          <Button size="sm" variant={variant === 'error' ? 'primary' : 'outline'} onClick={action.onClick}>
            {action.text}
          </Button>
        </View>
      ) : null}
    </View>
  );
};

export default PageStateCard;
