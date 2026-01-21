import { View, Image } from '@tarojs/components';
import React from 'react';
import { Button } from './Button';
import './Empty.scss';

interface EmptyProps {
  description?: string;
  image?: string;
  action?: {
    text: string;
    onClick: () => void;
  };
  className?: string;
}

const buildClassName = (base: string, parts: Array<string | false | undefined>) => {
  return [base, ...parts.filter(Boolean)].join(' ');
};

export const Empty: React.FC<EmptyProps> = ({
  description = '暂无数据',
  image,
  action,
  className
}) => {
  const classes = buildClassName('empty', [className]);

  return (
    <View className={classes}>
      {image && <Image src={image} className="empty__image" mode="aspectFit" />}
      <View className="empty__description">{description}</View>
      {action && (
        <Button size="sm" variant="outline" onClick={action.onClick}>
          {action.text}
        </Button>
      )}
    </View>
  );
};
