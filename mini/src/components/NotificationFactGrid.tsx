import { Text, View } from '@tarojs/components';
import React from 'react';

import './NotificationSurface.scss';

export interface NotificationFactItem {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  full?: boolean;
  emphasis?: boolean;
}

interface NotificationFactGridProps {
  items: NotificationFactItem[];
  columns?: number;
  className?: string;
}

const renderNode = (value?: React.ReactNode, className?: string) => {
  if (value === null || value === undefined || value === false || value === '') {
    return null;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return <Text className={className}>{value}</Text>;
  }
  return value;
};

export const NotificationFactGrid: React.FC<NotificationFactGridProps> = ({
  items,
  columns = 2,
  className,
}) => {
  return (
    <View
      className={['notification-fact-grid', className].filter(Boolean).join(' ')}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {items.map((item) => (
        <View
          key={`${item.label}-${String(item.value)}`}
          className={`notification-fact-grid__item ${item.full ? 'is-full' : ''}`}
        >
          <Text className="notification-fact-grid__label">{item.label}</Text>
          {renderNode(
            item.value,
            `notification-fact-grid__value ${item.emphasis ? 'is-emphasis' : ''}`.trim(),
          )}
          {renderNode(item.hint, 'notification-fact-grid__hint')}
        </View>
      ))}
    </View>
  );
};
