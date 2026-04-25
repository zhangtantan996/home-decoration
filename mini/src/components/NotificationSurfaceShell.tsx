import { View, type ViewProps } from '@tarojs/components';
import React from 'react';

import './NotificationSurface.scss';

interface NotificationSurfaceShellProps extends ViewProps {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  style?: React.CSSProperties;
  contentStyle?: React.CSSProperties;
  flushTop?: boolean;
}

const buildClassName = (base: string, parts: Array<string | false | undefined>) => {
  return [base, ...parts.filter(Boolean)].join(' ');
};

export const NotificationSurfaceShell: React.FC<NotificationSurfaceShellProps> = ({
  children,
  className,
  contentClassName,
  style,
  contentStyle,
  flushTop = false,
  ...restProps
}) => {
  return (
    <View className={buildClassName('notification-surface-shell', [className])} style={style} {...restProps}>
      <View
        className={buildClassName('notification-surface-shell__content', [
          flushTop ? 'notification-surface-shell__content--flush' : undefined,
          contentClassName,
        ])}
        style={contentStyle}
      >
        {children}
      </View>
    </View>
  );
};
