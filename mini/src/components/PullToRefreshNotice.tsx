import { Text, View } from '@tarojs/components';
import React, { useMemo } from 'react';

import type { PullToRefreshFeedbackStatus } from '@/hooks/usePullToRefreshFeedback';

import './PullToRefreshNotice.scss';

const STATUS_COPY: Record<Exclude<PullToRefreshFeedbackStatus, 'idle'>, string> = {
  refreshing: '刷新中...',
  success: '已更新',
  error: '刷新失败，请稍后重试',
};

interface PullToRefreshNoticeProps {
  status: PullToRefreshFeedbackStatus;
  height?: number;
  progress?: number;
}

export function PullToRefreshNotice({
  status,
  height,
  progress = 0,
}: PullToRefreshNoticeProps) {
  const visibleHeight = useMemo(() => {
    if (typeof height === 'number') {
      return Math.max(0, height);
    }
    if (status === 'idle') {
      return 0;
    }
    return 76;
  }, [height, status]);

  const visibleProgress = useMemo(() => {
    if (typeof progress === 'number' && progress > 0) {
      return Math.min(1, progress);
    }
    return status === 'idle' ? 0 : 1;
  }, [progress, status]);

  const tone =
    status === 'idle' ? (visibleProgress >= 1 ? 'ready' : 'pulling') : status;
  const label =
    status === 'idle'
      ? visibleProgress >= 1
        ? '松开立即刷新'
        : '下拉刷新'
      : STATUS_COPY[status];
  const collapsed = visibleHeight <= 0 && status === 'idle';

  return (
    <View
      className={`pull-to-refresh-drawer pull-to-refresh-drawer--${tone} ${
        collapsed ? 'pull-to-refresh-drawer--collapsed' : ''
      }`}
      style={{ height: `${visibleHeight}px` }}
    >
      <View
        className="pull-to-refresh-drawer__surface"
        style={{
          opacity: collapsed ? 0 : Math.min(1, 0.08 + visibleProgress * 0.92),
          transform: `translateY(${Math.max(
            0,
            (1 - visibleProgress) * -26,
          )}px) scale(${0.968 + visibleProgress * 0.032})`,
        }}
      >
        <View className="pull-to-refresh-drawer__handle" />
        <View className="pull-to-refresh-drawer__content">
          <View className="pull-to-refresh-drawer__indicator">
            <View className="pull-to-refresh-drawer__ring" />
            <View className="pull-to-refresh-drawer__ring pull-to-refresh-drawer__ring--delayed" />
          </View>
          <Text className="pull-to-refresh-drawer__text">{label}</Text>
        </View>
      </View>
    </View>
  );
}

export default PullToRefreshNotice;
