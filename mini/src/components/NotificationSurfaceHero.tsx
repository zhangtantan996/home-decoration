import { Text, View } from '@tarojs/components';
import React from 'react';

import './NotificationSurface.scss';

export interface NotificationHeroMetric {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  emphasis?: boolean;
}

interface NotificationSurfaceHeroProps {
  eyebrow?: string;
  title: string;
  subtitle?: React.ReactNode;
  status?: React.ReactNode;
  summary?: React.ReactNode;
  metrics?: NotificationHeroMetric[];
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

export const NotificationSurfaceHero: React.FC<NotificationSurfaceHeroProps> = ({
  eyebrow,
  title,
  subtitle,
  status,
  summary,
  metrics = [],
}) => {
  return (
    <View className="notification-surface-hero">
      <View className="notification-surface-hero__top">
        <View>
          {eyebrow ? <Text className="notification-surface-hero__eyebrow">{eyebrow}</Text> : null}
          <Text className="notification-surface-hero__title">{title}</Text>
          {renderNode(subtitle, 'notification-surface-hero__subtitle')}
        </View>
        {status}
      </View>
      {renderNode(summary, 'notification-surface-hero__summary')}
      {metrics.length > 0 ? (
        <View className="notification-surface-hero__metrics">
          {metrics.map((item) => (
            <View
              key={`${item.label}-${String(item.value)}`}
              className={`notification-surface-hero__metric ${item.emphasis ? 'is-emphasis' : ''}`}
            >
              <Text className="notification-surface-hero__metric-label">{item.label}</Text>
              {renderNode(item.value, 'notification-surface-hero__metric-value')}
              {renderNode(item.hint, 'notification-surface-hero__metric-hint')}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
};
