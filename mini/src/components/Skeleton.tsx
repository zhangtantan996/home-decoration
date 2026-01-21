import { View } from '@tarojs/components';
import React from 'react';
import './Skeleton.scss';

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  circle?: boolean;
  className?: string;
  style?: React.CSSProperties;
  row?: number;
}

const buildClassName = (base: string, parts: Array<string | false | undefined>) => {
  return [base, ...parts.filter(Boolean)].join(' ');
};

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 32,
  circle = false,
  className,
  style,
  row
}) => {
  const styles = {
    width: typeof width === 'number' ? `${width}rpx` : width,
    height: typeof height === 'number' ? `${height}rpx` : height,
    ...style
  };

  const classes = buildClassName('skeleton', [
    circle ? 'skeleton--circle' : undefined,
    className
  ]);

  if (row && row > 1) {
    return (
      <View>
        {Array.from({ length: row }).map((_, index) => (
          <View
            key={`skeleton-row-${index}`}
            className={classes}
            style={{ ...styles, marginBottom: index === row - 1 ? 0 : '12rpx' }}
          />
        ))}
      </View>
    );
  }

  return (
    <View 
      className={classes}
      style={styles}
    />
  );
};
