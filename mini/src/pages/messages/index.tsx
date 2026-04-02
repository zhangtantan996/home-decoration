import Taro, { useDidHide, useDidShow } from '@tarojs/taro';
import { Text, View } from '@tarojs/components';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Card } from '@/components/Card';
import { Empty } from '@/components/Empty';
import { Icon } from '@/components/Icon';
import { ListItem } from '@/components/ListItem';
import { Skeleton } from '@/components/Skeleton';
import { formatServerDateTime } from '@/utils/serverTime';
import {
  deleteNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from '@/services/notifications';
import { useAuthStore } from '@/store/auth';
import { openAuthLoginPage } from '@/utils/authRedirect';
import { syncCurrentTabBar } from '@/utils/customTabBar';
import { showErrorToast } from '@/utils/error';
import { getMiniNavMetrics } from '@/utils/navLayout';
import {
  NotificationWebSocket,
  isNotificationRealtimeEnabled,
} from '@/utils/notificationWebSocket';

import './index.scss';

const TAB_PAGE_PATHS = [
  '/pages/home/index',
  '/pages/inspiration/index',
  '/pages/progress/index',
  '/pages/messages/index',
  '/pages/profile/index',
];

const normalizePagePath = (actionUrl: string) => {
  if (actionUrl.startsWith('/pages/chat/index')) {
    return '/pages/messages/index';
  }

  if (actionUrl.startsWith('/pages/')) {
    return actionUrl;
  }

  if (actionUrl.startsWith('pages/chat/index')) {
    return '/pages/messages/index';
  }

  if (actionUrl.startsWith('pages/')) {
    return `/${actionUrl}`;
  }

  return '';
};

export default function NotificationsPage() {
  const auth = useAuthStore();
  const redirectingRef = useRef(false);
  const navMetrics = useMemo(() => getMiniNavMetrics(), []);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const realtimeRef = useRef<NotificationWebSocket | null>(null);
  const headerInsetStyle = useMemo(
    () => ({
      paddingTop: `${navMetrics.menuTop}px`,
      paddingRight: `${navMetrics.menuRightInset}px`,
    }),
    [navMetrics.menuRightInset, navMetrics.menuTop],
  );
  const headerMainStyle = useMemo(
    () => ({ height: `${navMetrics.menuHeight}px` }),
    [navMetrics.menuHeight],
  );
  const headerPlaceholderStyle = useMemo(
    () => ({ height: `${navMetrics.menuBottom}px` }),
    [navMetrics.menuBottom],
  );
  const capsuleSpacerStyle = useMemo(
    () => ({
      width: `${navMetrics.menuWidth}px`,
      height: `${navMetrics.menuHeight}px`,
    }),
    [navMetrics.menuHeight, navMetrics.menuWidth],
  );

  const unreadCount = notifications.filter((item) => !item.isRead).length;

  const fetchNotifications = useCallback(async () => {
    if (!auth.token) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    try {
      const data = await listNotifications(1, 20);
      setNotifications(data.list || []);
    } catch (error) {
      showErrorToast(error, '加载失败');
    } finally {
      setLoading(false);
    }
  }, [auth.token]);

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  useDidShow(() => {
    syncCurrentTabBar('/pages/messages/index');

    if (!useAuthStore.getState().token && !redirectingRef.current) {
      redirectingRef.current = true;
      void openAuthLoginPage('/pages/messages/index').finally(() => {
        setTimeout(() => {
          redirectingRef.current = false;
        }, 240);
      });
      return;
    }

    if (!auth.token || !isNotificationRealtimeEnabled()) {
      return;
    }

    realtimeRef.current?.disconnect();
    const websocket = new NotificationWebSocket({
      token: auth.token,
      onNewNotification: () => {
        void fetchNotifications();
      },
      onUnreadCountUpdate: () => {
        void fetchNotifications();
      },
    });
    realtimeRef.current = websocket;
    websocket.connect();
  });

  useDidHide(() => {
    realtimeRef.current?.disconnect();
    realtimeRef.current = null;
  });

  const handleReadAll = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
      Taro.showToast({ title: '已全部标记已读', icon: 'none' });
    } catch (error) {
      showErrorToast(error, '操作失败');
    }
  };

  const handleOpenSettings = () => {
    Taro.navigateTo({ url: '/pages/settings/index' });
  };

  const handleOpenNotification = async (item: NotificationItem) => {
    try {
      if (!item.isRead) {
        await markNotificationRead(item.id);
        setNotifications((prev) =>
          prev.map((entry) =>
            entry.id === item.id ? { ...entry, isRead: true } : entry,
          ),
        );
      }

      if (!item.actionUrl) {
        return;
      }

      const pagePath = normalizePagePath(item.actionUrl);
      if (!pagePath) {
        return;
      }

      if (TAB_PAGE_PATHS.includes(pagePath)) {
        await Taro.switchTab({ url: pagePath });
      } else {
        await Taro.navigateTo({ url: pagePath });
      }
    } catch (error) {
      showErrorToast(error, '打开通知失败');
    }
  };

  const handleClearNotifications = async () => {
    if (!auth.token) {
      Taro.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    if (notifications.length === 0) {
      Taro.showToast({ title: '当前没有可清理的通知', icon: 'none' });
      return;
    }

    const { confirm } = await Taro.showModal({
      title: '清空通知',
      content: '确认清空当前列表中的通知吗？',
    });

    if (!confirm) {
      return;
    }

    try {
      const results = await Promise.allSettled(
        notifications.map((item) => deleteNotification(item.id)),
      );
      const successCount = results.filter(
        (result) => result.status === 'fulfilled',
      ).length;
      const failedCount = notifications.length - successCount;

      if (successCount > 0) {
        setNotifications((prev) =>
          prev.filter((_, index) => results[index].status !== 'fulfilled'),
        );
      }

      Taro.showToast({
        title:
          failedCount > 0
            ? `已清理${successCount}条，${failedCount}条失败`
            : '通知已清空',
        icon: 'none',
      });
    } catch (error) {
      showErrorToast(error, '清理失败');
    }
  };

  const pageHeader = (
    <>
      <View className="notifications-page__header" style={headerInsetStyle}>
        <View className="notifications-page__header-main" style={headerMainStyle}>
          <Text className="notifications-page__header-title">通知</Text>
          <View className="notifications-page__capsule-spacer" style={capsuleSpacerStyle} />
        </View>
      </View>
      <View className="notifications-page__header-placeholder" style={headerPlaceholderStyle} />
    </>
  );

  if (!auth.token) {
    return <View className="notifications-page" />;
  }

  return (
    <View className="notifications-page page-with-tabbar">
      {pageHeader}
      <View className="notifications-page__content">
        <View className="notifications-page__summary">
          <Text className="notifications-page__summary-title">通知中心</Text>
          <Text className="notifications-page__summary-subtitle">系统流程和处理结果会在这里同步。</Text>
          <View className="notifications-page__summary-count">
            <Text className="notifications-page__summary-count-text">当前未读 {unreadCount} 条</Text>
          </View>
        </View>

        <Card
          className="notifications-page__card"
          title="通知列表"
          extra={
            <View className="notifications-page__card-link" onClick={handleReadAll}>
              全部已读
            </View>
          }
        >
          {loading ? (
            <View className="p-sm">
              <View className="mb-sm">
                <Skeleton width="80%" />
              </View>
              <View className="mb-sm">
                <Skeleton width="60%" />
              </View>
              <View>
                <Skeleton width="70%" />
              </View>
            </View>
          ) : notifications.length > 0 ? (
            notifications.map((item) => (
              <ListItem
                key={item.id}
                title={item.title}
                description={item.content}
                icon={
                  <Icon
                    name="notification"
                    size={36}
                    color={item.isRead ? '#A1A1AA' : '#D4AF37'}
                  />
                }
                extra={
                  <View
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      gap: '8rpx',
                    }}
                  >
                    <Text className="text-secondary" style={{ fontSize: '22rpx' }}>
                      {item.createdAt ? formatServerDateTime(item.createdAt) : '--'}
                    </Text>
                    <Text className="text-secondary" style={{ fontSize: '24rpx' }}>
                      {item.isRead ? '已读' : '未读'}
                    </Text>
                  </View>
                }
                arrow
                onClick={() => handleOpenNotification(item)}
              />
            ))
          ) : (
            <Empty description="暂无通知" />
          )}
        </Card>

        <Card className="notifications-page__card" title="更多操作">
          <ListItem
            title="通知设置"
            arrow
            onClick={handleOpenSettings}
          />
          <ListItem
            title="清空通知"
            onClick={handleClearNotifications}
          />
        </Card>
      </View>
    </View>
  );
}
