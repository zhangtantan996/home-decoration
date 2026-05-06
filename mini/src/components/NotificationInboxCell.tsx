import { Text, View } from '@tarojs/components';
import React from 'react';

import './NotificationSurface.scss';

interface NotificationInboxCellProps {
  title: string;
  summary?: string;
  timeLabel?: string;
  unread?: boolean;
  statusLabel?: string;
  statusTone?: 'neutral' | 'brand' | 'danger' | 'success';
  leading?: React.ReactNode;
  typeBadge?: React.ReactNode;
  actionText?: string;
  actionSecondary?: boolean;
  actionTone?: 'project' | 'payment' | 'system' | 'neutral';
  onClick?: () => void;
  onActionClick?: (event: any) => void;
  onLongPress?: () => void;
}

export const NotificationInboxCell: React.FC<NotificationInboxCellProps> = ({
  title,
  summary,
  timeLabel,
  unread = false,
  statusLabel,
  statusTone = 'neutral',
  leading,
  typeBadge,
  actionText,
  actionSecondary = false,
  actionTone = 'project',
  onClick,
  onActionClick,
  onLongPress,
}) => {
  return (
    <View
      className={`notification-inbox-cell ${unread ? 'is-unread' : ''}`}
      onClick={onClick}
      onLongPress={onLongPress}
      hoverClass={onClick ? 'notification-inbox-cell--pressed' : 'none'}
    >
      {leading ? <View className="notification-inbox-cell__leading">{leading}</View> : null}

      <View className="notification-inbox-cell__body">
        <View className="notification-inbox-cell__meta">
          <View className="notification-inbox-cell__badges">
            {typeBadge}
            {unread ? <View className="notification-inbox-cell__dot" /> : null}
          </View>
          {timeLabel ? <Text className="notification-inbox-cell__time">{timeLabel}</Text> : null}
        </View>

        <View className="notification-inbox-cell__title-row">
          <Text className="notification-inbox-cell__title">{title}</Text>
        </View>

        {summary ? <Text className="notification-inbox-cell__summary line-clamp-2">{summary}</Text> : null}

        {(statusLabel || actionText) ? (
          <View className="notification-inbox-cell__footer">
            {statusLabel ? (
              <Text className={`notification-inbox-cell__status ${statusTone === 'brand' ? 'is-brand' : statusTone === 'success' ? 'is-success' : statusTone === 'danger' ? 'is-danger' : ''}`}>
                {statusLabel}
              </Text>
            ) : (
              <View />
            )}
            {actionText ? (
              <View
                className={[
                  'notification-inbox-cell__action',
                  actionSecondary ? 'is-secondary' : '',
                  `is-${actionTone}`,
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={onActionClick}
                hoverClass="notification-inbox-cell__action--pressed"
              >
                <Text className="notification-inbox-cell__action-text">{actionText}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
};
