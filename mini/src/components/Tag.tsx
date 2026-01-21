import { View } from '@tarojs/components';
import React from 'react';
import './Tag.scss';

interface TagProps {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'secondary' | 'brand' | 'success' | 'warning' | 'error';
  outline?: boolean;
  className?: string;
}

const buildClassName = (base: string, parts: Array<string | false | undefined>) => {
  return [base, ...parts.filter(Boolean)].join(' ');
};

export const Tag: React.FC<TagProps> = ({
  children,
  variant = 'default',
  outline = false,
  className
}) => {
  const classes = buildClassName('tag', [
    `tag--${variant}`,
    outline ? 'tag--outline' : undefined,
    className
  ]);

  return (
    <View className={classes}>
      {children}
    </View>
  );
};
