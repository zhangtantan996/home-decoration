import Taro from '@tarojs/taro';
import { View } from '@tarojs/components';
import React, { useEffect, useState } from 'react';
import { Card } from '@/components/Card';
import { ListItem } from '@/components/ListItem';
import { Empty } from '@/components/Empty';
import { Skeleton } from '@/components/Skeleton';
import {
  deleteNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem
} from '@/services/notifications';
import { useAuthStore } from '@/store/auth';
import { showErrorToast } from '@/utils/error';

const TAB_PAGE_PATHS = [
  '/pages/home/index',
  '/pages/inspiration/index',
  '/pages/progress/index',
  '/pages/messages/index',
  '/pages/profile/index'
];

const normalizePagePath = (actionUrl: string) => {
  if (actionUrl.startsWith('/pages/')) {
    return actionUrl;
  }

  if (actionUrl.startsWith('pages/')) {
    return `/${actionUrl}`;
  }

  return '';
};

export default function Messages() {
  const auth = useAuthStore();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.token) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    const fetchNotifications = async () => {
      try {
        const data = await listNotifications(1, 20);
        setNotifications(data.list || []);
      } catch (err) {
        showErrorToast(err, '加载失败');
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, [auth.token]);

  const handleReadAll = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
      Taro.showToast({ title: '已全部标记已读', icon: 'none' });
    } catch (err) {
      showErrorToast(err, '操作失败');
    }
  };

  const handleOpenSettings = () => {
    Taro.navigateTo({ url: '/pages/settings/index' });
  };

  const handleOpenNotification = async (item: NotificationItem) => {
    try {
      if (!item.isRead) {
        await markNotificationRead(item.id);
        setNotifications((prev) => prev.map((entry) => (
          entry.id === item.id ? { ...entry, isRead: true } : entry
        )));
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
    } catch (err) {
      showErrorToast(err, '打开消息失败');
    }
  };

  const handleClearMessages = async () => {
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
      content: '确认清空当前列表中的通知吗？'
    });

    if (!confirm) {
      return;
    }

    try {
      const results = await Promise.allSettled(notifications.map((item) => deleteNotification(item.id)));
      const successCount = results.filter((result) => result.status === 'fulfilled').length;
      const failedCount = notifications.length - successCount;

      if (successCount > 0) {
        setNotifications((prev) => prev.filter((item, index) => results[index].status !== 'fulfilled'));
      }

      if (failedCount > 0) {
        Taro.showToast({ title: `已清理${successCount}条，${failedCount}条失败`, icon: 'none' });
        return;
      }

      Taro.showToast({ title: '通知已清空', icon: 'none' });
    } catch (err) {
      showErrorToast(err, '清理失败');
    }
  };

  return (
    <View className="page">
      <View className="m-md">
        <View className="text-primary font-bold" style={{ fontSize: '40rpx', marginBottom: '24rpx' }}>
          消息中心
        </View>

        <Card title="通知" extra={auth.token ? <View className="text-brand" onClick={handleReadAll}>全部已读</View> : undefined}>
          {!auth.token ? (
            <Empty description="登录后查看通知" action={{ text: '去登录', onClick: () => Taro.switchTab({ url: '/pages/profile/index' }) }} />
          ) : loading ? (
            <View className="p-sm">
              <View className="mb-sm"><Skeleton width="80%" /></View>
              <View className="mb-sm"><Skeleton width="60%" /></View>
              <View><Skeleton width="70%" /></View>
            </View>
          ) : notifications.length > 0 ? (
            notifications.map((item) => (
              <ListItem
                key={item.id}
                title={item.title}
                description={item.content}
                extra={<View className="text-secondary" style={{ fontSize: '24rpx' }}>{item.isRead ? '已读' : '未读'}</View>}
                arrow
                onClick={() => handleOpenNotification(item)}
              />
            ))
          ) : (
            <Empty description="暂无新消息" />
          )}
        </Card>

        <View className="mt-lg">
          <ListItem title="消息设置" arrow className="mb-sm" onClick={handleOpenSettings} />
          <ListItem
            title="清空通知"
            className="mb-sm"
            onClick={handleClearMessages}
          />
        </View>
      </View>
    </View>
  );
}
