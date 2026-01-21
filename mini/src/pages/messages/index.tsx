import Taro from '@tarojs/taro';
import { View } from '@tarojs/components';
import React, { useEffect, useState } from 'react';
import { Card } from '@/components/Card';
import { ListItem } from '@/components/ListItem';
import { Empty } from '@/components/Empty';
import { Skeleton } from '@/components/Skeleton';
import { listNotifications, markAllNotificationsRead, type NotificationItem } from '@/services/notifications';
import { useAuthStore } from '@/store/auth';

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
        Taro.showToast({ title: err instanceof Error ? err.message : '加载失败', icon: 'none' });
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
    } catch (err) {
      Taro.showToast({ title: err instanceof Error ? err.message : '操作失败', icon: 'none' });
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
            <Empty description="登录后查看通知" />
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
              />
            ))
          ) : (
            <Empty description="暂无新消息" />
          )}
        </Card>

        <View className="mt-lg">
          <ListItem title="消息设置" arrow className="mb-sm" />
          <ListItem
            title="清空消息"
            className="mb-sm"
            onClick={auth.token ? handleReadAll : undefined}
          />
        </View>
      </View>
    </View>
  );
}
