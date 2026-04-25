import { View } from '@tarojs/components';
import React, { useMemo } from 'react';

import { getFixedBottomBarStyle } from '@/utils/fixedLayout';

import './NotificationSurface.scss';

interface NotificationActionBarProps {
  children: React.ReactNode;
  className?: string;
  single?: boolean;
}

const flattenActionChildren = (children: React.ReactNode): React.ReactNode[] => {
  return React.Children.toArray(children).flatMap((child) => {
    if (React.isValidElement(child) && child.type === React.Fragment) {
      return flattenActionChildren(child.props.children);
    }
    return [child];
  });
};

export const NotificationActionBar: React.FC<NotificationActionBarProps> = ({
  children,
  className,
  single = false,
}) => {
  const style = useMemo(
    () => getFixedBottomBarStyle({ paddingX: 16, paddingY: 14, backgroundColor: 'rgba(255,255,255,0.98)' }),
    [],
  );
  const slots = useMemo(() => flattenActionChildren(children), [children]);

  return (
    <View
      className={['notification-action-bar', single ? 'notification-action-bar--single' : '', className]
        .filter(Boolean)
        .join(' ')}
      style={style}
    >
      {slots.map((child, index) => (
        <View key={index} className="notification-action-bar__slot">{child}</View>
      ))}
    </View>
  );
};
