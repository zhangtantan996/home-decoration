import Taro from '@tarojs/taro';
import { Image, View } from '@tarojs/components';
import React, { useEffect, useMemo, useState } from 'react';
import { Tabs } from '@nutui/nutui-react-taro';

import { Card } from '@/components/Card';
import { ListItem } from '@/components/ListItem';
import { Empty } from '@/components/Empty';
import { Skeleton } from '@/components/Skeleton';
import { Icon } from '@/components/Icon';
import TinodeService from '@/services/TinodeService';
import {
  deleteNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem
} from '@/services/notifications';
import { refreshTinodeToken } from '@/services/tinode';
import { useAuthStore } from '@/store/auth';
import { useChatStore, type ConversationPreview } from '@/store/chat';
import { getErrorMessage, showErrorToast } from '@/utils/error';

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
  const conversations = useChatStore((state) => state.conversations);
  const chatLoading = useChatStore((state) => state.loading);
  const chatError = useChatStore((state) => state.error);
  const setConversations = useChatStore((state) => state.setConversations);
  const setChatLoading = useChatStore((state) => state.setLoading);
  const setChatInitialized = useChatStore((state) => state.setInitialized);
  const setChatError = useChatStore((state) => state.setError);
  const clearChat = useChatStore((state) => state.clear);
  const [activeTab, setActiveTab] = useState<'chat' | 'notifications'>('chat');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const formatTimestamp = (timestamp: number) => {
    if (!timestamp) return '';

    const date = new Date(timestamp);
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, '0');

    if (date.toDateString() === now.toDateString()) {
      return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const toConversationPreview = useMemo(() => {
    return (topic: any): ConversationPreview => {
      const peerDesc = typeof topic?.p2pPeerDesc === 'function' ? topic.p2pPeerDesc() : null;
      const name =
        peerDesc?.public?.fn ||
        peerDesc?.public?.name ||
        topic?.public?.fn ||
        topic?.name ||
        '会话';

      const avatar = peerDesc?.public?.photo || topic?.public?.photo || '';

      const lastMsg = typeof topic?.latestMessage === 'function' ? topic.latestMessage() : null;
      const rawContent = lastMsg?.content;
      const lastMessage =
        typeof rawContent === 'string'
          ? rawContent
          : typeof rawContent?.txt === 'string'
            ? rawContent.txt
            : '';

      const touchedAt = topic?.touched ? new Date(topic.touched).getTime() : 0;
      const unread = typeof topic?.unread === 'number' ? topic.unread : 0;

      return {
        topic: topic?.name || '',
        name: String(name || '会话'),
        avatar: avatar ? String(avatar) : undefined,
        lastMessage: lastMessage.trim() ? lastMessage.trim() : '暂无消息',
        touchedAt,
        unread: Math.max(0, unread),
      };
    };
  }, []);

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

  useEffect(() => {
    if (activeTab !== 'chat') {
      return;
    }

    if (!auth.token) {
      clearChat();
      return;
    }

    if (!auth.tinodeToken) {
      setChatInitialized(false);
      setConversations([]);
      setChatLoading(false);
      setChatError(auth.tinodeError ? `聊天暂不可用：${auth.tinodeError}` : null);
      return;
    }

    let cancelled = false;

    const fetchConversations = async () => {
      setChatLoading(true);
      setChatError(null);

      try {
        const ok = await TinodeService.init(auth.tinodeToken);
        if (!ok) {
          throw new Error('聊天服务初始化失败');
        }

        const topics = await TinodeService.getConversationList();
        if (cancelled) return;

        setConversations(topics.map(toConversationPreview));
        setChatInitialized(true);
      } catch (error) {
        if (cancelled) return;
        setChatError(getErrorMessage(error, '加载失败'));
      } finally {
        if (!cancelled) {
          setChatLoading(false);
        }
      }
    };

    fetchConversations();

    const handleContactsChanged = () => {
      if (!auth.token || !auth.tinodeToken) return;
      TinodeService.getConversationList()
        .then((topics) => {
          setConversations(topics.map(toConversationPreview));
        })
        .catch(() => {
          // best-effort only
        });
    };

    TinodeService.on('contact-update', handleContactsChanged);
    TinodeService.on('subs-updated', handleContactsChanged);

    return () => {
      cancelled = true;
      TinodeService.removeListener('contact-update', handleContactsChanged);
      TinodeService.removeListener('subs-updated', handleContactsChanged);
    };
  }, [
    activeTab,
    auth.token,
    auth.tinodeToken,
    auth.tinodeError,
    clearChat,
    setConversations,
    setChatError,
    setChatInitialized,
    setChatLoading,
    toConversationPreview,
  ]);

  const handleRetryTinodeToken = async () => {
    if (!auth.token) {
      Taro.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    try {
      const res = await refreshTinodeToken();
      useAuthStore.getState().updateTinodeAuth(res);
      if (res.tinodeToken) {
        Taro.showToast({ title: '聊天已启用', icon: 'none' });
      } else {
        Taro.showToast({ title: res.tinodeError || '聊天暂不可用', icon: 'none' });
      }
    } catch (error) {
      showErrorToast(error, '操作失败');
    }
  };

  const handleOpenChat = (conversation: ConversationPreview) => {
    if (!conversation.topic) return;

    const parts = [`topic=${encodeURIComponent(conversation.topic)}`];
    if (conversation.name) parts.push(`name=${encodeURIComponent(conversation.name)}`);
    if (conversation.avatar) parts.push(`avatar=${encodeURIComponent(conversation.avatar)}`);

    Taro.navigateTo({ url: `/pages/chat/index?${parts.join('&')}` });
  };

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

        <Tabs value={activeTab} onChange={(value) => setActiveTab(value as any)}>
          <Tabs.TabPane title="聊天" value="chat">
            <Card title="聊天">
              {!auth.token ? (
                <Empty
                  description="登录后查看聊天"
                  action={{ text: '去登录', onClick: () => Taro.switchTab({ url: '/pages/profile/index' }) }}
                />
              ) : !auth.tinodeToken ? (
                <Empty
                  description={auth.tinodeError ? `聊天暂不可用：${auth.tinodeError}` : '聊天服务暂不可用'}
                  action={{ text: '重试', onClick: handleRetryTinodeToken }}
                />
              ) : chatLoading ? (
                <View className="p-sm">
                  <View className="mb-sm"><Skeleton width="80%" /></View>
                  <View className="mb-sm"><Skeleton width="60%" /></View>
                  <View><Skeleton width="70%" /></View>
                </View>
              ) : conversations.length > 0 ? (
                conversations.map((item) => (
                  <ListItem
                    key={item.topic}
                    title={item.name}
                    description={item.lastMessage}
                    icon={
                      item.avatar ? (
                        <Image
                          src={item.avatar}
                          style={{ width: '48rpx', height: '48rpx', borderRadius: '999rpx', backgroundColor: '#E5E7EB' }}
                          mode="aspectFill"
                        />
                      ) : (
                        <Icon name="profile" size={36} color="#A1A1AA" />
                      )
                    }
                    extra={
                      <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <View className="text-secondary" style={{ fontSize: '24rpx' }}>
                          {formatTimestamp(item.touchedAt)}
                        </View>
                        {item.unread > 0 ? (
                          <View
                            style={{
                              marginTop: '6rpx',
                              backgroundColor: '#EF4444',
                              color: '#FFFFFF',
                              borderRadius: '999rpx',
                              padding: '2rpx 10rpx',
                              fontSize: '20rpx',
                              lineHeight: '28rpx',
                            }}
                          >
                            {item.unread > 99 ? '99+' : String(item.unread)}
                          </View>
                        ) : null}
                      </View>
                    }
                    arrow
                    onClick={() => handleOpenChat(item)}
                  />
                ))
              ) : (
                <Empty description={chatError ? chatError : '暂无会话'} />
              )}
            </Card>
          </Tabs.TabPane>

          <Tabs.TabPane title="通知" value="notifications">
            <Card
              title="通知"
              extra={auth.token ? <View className="text-brand" onClick={handleReadAll}>全部已读</View> : undefined}
            >
              {!auth.token ? (
                <Empty
                  description="登录后查看通知"
                  action={{ text: '去登录', onClick: () => Taro.switchTab({ url: '/pages/profile/index' }) }}
                />
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
          </Tabs.TabPane>
        </Tabs>
      </View>
    </View>
  );
}
