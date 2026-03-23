import Taro, { useDidHide, useDidShow } from "@tarojs/taro";
import { Text, View } from "@tarojs/components";
import { useCallback, useEffect, useRef, useState } from "react";

import { Card } from "@/components/Card";
import { ListItem } from "@/components/ListItem";
import { Empty } from "@/components/Empty";
import { LoginGateCard } from "@/components/LoginGateCard";
import { Skeleton } from "@/components/Skeleton";
import { Icon } from "@/components/Icon";
import {
  deleteNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from "@/services/notifications";
import { useAuthStore } from "@/store/auth";
import { showErrorToast } from "@/utils/error";
import {
  NotificationWebSocket,
  isNotificationRealtimeEnabled,
} from "@/utils/notificationWebSocket";

const TAB_PAGE_PATHS = [
  "/pages/home/index",
  "/pages/inspiration/index",
  "/pages/progress/index",
  "/pages/messages/index",
  "/pages/profile/index",
];

const normalizePagePath = (actionUrl: string) => {
  if (actionUrl.startsWith("/pages/")) {
    return actionUrl;
  }

  if (actionUrl.startsWith("pages/")) {
    return `/${actionUrl}`;
  }

  return "";
};

export default function Messages() {
  const auth = useAuthStore();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const realtimeRef = useRef<NotificationWebSocket | null>(null);

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
    } catch (err) {
      showErrorToast(err, "加载失败");
    } finally {
      setLoading(false);
    }
  }, [auth.token]);

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  useDidShow(() => {
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
      setNotifications((prev) =>
        prev.map((item) => ({ ...item, isRead: true })),
      );
      Taro.showToast({ title: "已全部标记已读", icon: "none" });
    } catch (err) {
      showErrorToast(err, "操作失败");
    }
  };

  const handleOpenSettings = () => {
    Taro.navigateTo({ url: "/pages/settings/index" });
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
    } catch (err) {
      showErrorToast(err, "打开通知失败");
    }
  };

  const handleClearMessages = async () => {
    if (!auth.token) {
      Taro.showToast({ title: "请先登录", icon: "none" });
      return;
    }

    if (notifications.length === 0) {
      Taro.showToast({ title: "当前没有可清理的通知", icon: "none" });
      return;
    }

    const { confirm } = await Taro.showModal({
      title: "清空通知",
      content: "确认清空当前列表中的通知吗？",
    });

    if (!confirm) {
      return;
    }

    try {
      const results = await Promise.allSettled(
        notifications.map((item) => deleteNotification(item.id)),
      );
      const successCount = results.filter(
        (result) => result.status === "fulfilled",
      ).length;
      const failedCount = notifications.length - successCount;

      if (successCount > 0) {
        setNotifications((prev) =>
          prev.filter((_, index) => results[index].status !== "fulfilled"),
        );
      }

      if (failedCount > 0) {
        Taro.showToast({
          title: `已清理${successCount}条，${failedCount}条失败`,
          icon: "none",
        });
        return;
      }

      Taro.showToast({ title: "通知已清空", icon: "none" });
    } catch (err) {
      showErrorToast(err, "清理失败");
    }
  };

  if (!auth.token) {
    return (
      <View className="page">
        <View className="m-md">
          <View
            className="text-primary font-bold"
            style={{ fontSize: "40rpx", marginBottom: "24rpx" }}
          >
            通知中心
          </View>
          <LoginGateCard
            iconName="notification"
            title="登录后查看通知"
            description="系统通知、预约进度、项目提醒都会统一收纳在这里，建议先完成登录。"
            returnUrl="/pages/messages/index"
          />
        </View>
      </View>
    );
  }

  return (
    <View className="page">
      <View className="m-md">
        <View
          className="text-primary font-bold"
          style={{ fontSize: "40rpx", marginBottom: "12rpx" }}
        >
          通知中心
        </View>
        <View
          className="text-secondary"
          style={{ fontSize: "26rpx", marginBottom: "24rpx" }}
        >
          当前未读 {unreadCount} 条
        </View>

        <Card
          title="通知列表"
          extra={
            <View className="text-brand" onClick={handleReadAll}>
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
                    color={item.isRead ? "#A1A1AA" : "#D4AF37"}
                  />
                }
                extra={
                  <Text
                    className="text-secondary"
                    style={{ fontSize: "24rpx" }}
                  >
                    {item.isRead ? "已读" : "未读"}
                  </Text>
                }
                arrow
                onClick={() => handleOpenNotification(item)}
              />
            ))
          ) : (
            <Empty description="暂无通知" />
          )}
        </Card>

        <View className="mt-lg">
          <ListItem
            title="通知设置"
            arrow
            className="mb-sm"
            onClick={handleOpenSettings}
          />
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
