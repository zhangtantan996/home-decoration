import { Text, View } from '@tarojs/components';
import React from 'react';

import './NotificationSurface.scss';

export interface NotificationFactRowItem {
  label: string;
  value?: React.ReactNode;
  hint?: React.ReactNode;
  emphasis?: boolean;
  danger?: boolean;
  multiline?: boolean;
  extra?: React.ReactNode;
}

interface NotificationFactRowsProps {
  items: NotificationFactRowItem[];
  className?: string;
  compact?: boolean;
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

export const NotificationFactRows: React.FC<NotificationFactRowsProps> = ({
  items,
  className,
  compact = false,
}) => {
  return (
    <View
      className={[
        'notification-fact-rows',
        compact ? 'notification-fact-rows--compact' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {items.map((item, index) => (
        <View
          key={`${item.label}-${index}`}
          className={[
            'notification-fact-rows__item',
            item.multiline ? 'is-multiline' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <View className="notification-fact-rows__main">
            <Text className="notification-fact-rows__label">{item.label}</Text>
            <View className="notification-fact-rows__value-wrap">
              {renderNode(
                item.value,
                [
                  'notification-fact-rows__value',
                  item.emphasis ? 'is-emphasis' : '',
                  item.danger ? 'is-danger' : '',
                ]
                  .filter(Boolean)
                  .join(' '),
              )}
              {item.extra ? <View className="notification-fact-rows__extra">{item.extra}</View> : null}
            </View>
          </View>
          {renderNode(
            item.hint,
            [
              'notification-fact-rows__hint',
              item.danger ? 'is-danger' : '',
            ]
              .filter(Boolean)
              .join(' '),
          )}
        </View>
      ))}
    </View>
  );
};
