import Taro, { useDidHide, useDidShow } from '@tarojs/taro';
import { Text, View } from '@tarojs/components';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

import { Icon } from '@/components/Icon';
import { PullToRefreshNotice } from '@/components/PullToRefreshNotice';
import { Skeleton } from '@/components/Skeleton';
import { usePullToRefreshFeedback } from '@/hooks/usePullToRefreshFeedback';
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
import { resolveMiniNotificationRoute } from '@/utils/notificationActionRoute';
import {
  clearNotificationRouteValidationCache,
  validateNotificationRoute,
} from '@/utils/notificationRouteValidation';
import { NotificationWebSocket, isNotificationRealtimeEnabled } from '@/utils/notificationWebSocket';
import {
  buildNotificationFilters,
  buildNotificationSections,
  type NotificationCardViewModel,
  type NotificationFilterKey,
  type NotificationFilterViewModel,
  type NotificationSectionViewModel,
} from './view-model';

import './index.scss';

const TAB_PAGE_PATHS = [
  '/pages/home/index',
  '/pages/inspiration/index',
  '/pages/progress/index',
  '/pages/messages/index',
  '/pages/profile/index',
];

const stripQuery = (value: string) => value.split('?')[0] || value;

const NotificationsHeader = ({
  insetStyle,
  mainStyle,
  capsuleStyle,
  placeholderStyle,
}: {
  insetStyle: CSSProperties;
  mainStyle: CSSProperties;
  capsuleStyle: CSSProperties;
  placeholderStyle: CSSProperties;
}) => (
  <>
    <View className="notifications-page__header" style={insetStyle}>
      <View className="notifications-page__header-main" style={mainStyle}>
        <View className="notifications-page__capsule-spacer" style={capsuleStyle} />
        <Text className="notifications-page__header-title">通知</Text>
        <View className="notifications-page__capsule-spacer" style={capsuleStyle} />
      </View>
    </View>
    <View className="notifications-page__header-placeholder" style={placeholderStyle} />
  </>
);

const NotificationsSkeleton = () => (
  <View className="notifications-page__content">
    <View className="notifications-page__filter-skeleton">
      {Array.from({ length: 5 }).map((_, index) => (
        <View key={`filter-${index}`} className="notifications-page__filter-skeleton-pill">
          <Skeleton width="100%" height={64} />
        </View>
      ))}
    </View>

    {Array.from({ length: 2 }).map((_, index) => (
      <View key={`section-${index}`} className="notifications-page__section-card">
        <View className="notifications-page__section-head">
          <Skeleton width="20%" height={28} />
          <Skeleton width="14%" height={22} />
        </View>
        {Array.from({ length: 2 }).map((__, cardIndex) => (
          <View key={`card-${cardIndex}`} className="notifications-page__notification-card notifications-page__notification-card--skeleton">
            <Skeleton circle width={72} height={72} />
            <View className="notifications-page__notification-main">
              <Skeleton width="58%" height={28} />
              <Skeleton row={2} height={20} className="notifications-page__skeleton-gap" />
            </View>
            <View className="notifications-page__notification-side">
              <Skeleton width={70} height={24} />
              <Skeleton width={52} height={24} className="notifications-page__skeleton-gap" />
            </View>
          </View>
        ))}
      </View>
    ))}
  </View>
);

const SectionHeader = ({ title, count }: { title: string; count: number }) => (
  <View className="notifications-page__section-head">
    <View className="notifications-page__section-badge">
      <Text className="notifications-page__section-title">{title}</Text>
    </View>
    <View className="notifications-page__section-line" />
    <Text className="notifications-page__section-count">{count} 条</Text>
  </View>
);

const SectionEmpty = ({ activeFilterLabel }: { activeFilterLabel: string }) => (
  <View className="notifications-page__empty-state">
    <View className="notifications-page__empty-icon">
      <Icon name="notification" size={38} color="#64748b" />
    </View>
    <Text className="notifications-page__empty-title">{activeFilterLabel === '全部' ? '还没有新的通知' : `暂无${activeFilterLabel}通知`}</Text>
    <Text className="notifications-page__empty-copy">
      订单进度、退款结果和系统提醒会在这里按时间归档，重要提醒会优先显示未读状态。
    </Text>
  </View>
);

const FilterBar = ({
  activeFilter,
  filters,
  unreadCount,
  onReadAll,
  onChange,
}: {
  activeFilter: NotificationFilterKey;
  filters: NotificationFilterViewModel[];
  unreadCount: number;
  onReadAll: () => void;
  onChange: (key: NotificationFilterKey) => void;
}) => (
  <View className="notifications-page__toolbar">
    <View className="notifications-page__filter-bar">
      {filters.map((item) => {
        const isActive = item.key === activeFilter;
        return (
          <View
            key={item.key}
            className={`notifications-page__filter-pill ${isActive ? 'is-active' : ''}`}
            onClick={() => onChange(item.key)}
          >
            <Text className={`notifications-page__filter-pill-text ${isActive ? 'is-active' : ''}`}>{item.label}</Text>
            <Text className={`notifications-page__filter-pill-count ${isActive ? 'is-active' : ''}`}>{item.count}</Text>
          </View>
        );
      })}
    </View>

    <View className="notifications-page__toolbar-actions">
      <View className="notifications-page__toolbar-action" onClick={onReadAll}>
        <Text className={`notifications-page__toolbar-action-text ${unreadCount > 0 ? 'is-active' : ''}`}>全部已读</Text>
      </View>
    </View>
  </View>
);

const NotificationCard = ({
  item,
  onOpen,
  onManage,
}: {
  item: NotificationCardViewModel;
  onOpen: (item: NotificationItem) => void;
  onManage: (item: NotificationCardViewModel) => void;
}) => (
  <View
    className={`notifications-page__notification-card ${item.isRead ? '' : 'is-unread'} ${item.isActionable ? 'is-actionable' : ''}`}
    onClick={() => onOpen(item.raw)}
    onLongPress={() => onManage(item)}
  >
    <View className="notifications-page__notification-main">
      <View className="notifications-page__notification-head">
        <View className="notifications-page__notification-pill-row">
          <Text className={`notifications-page__notification-type notifications-page__notification-type--${item.typeTone}`}>
            {item.typeLabel}
          </Text>
          <Text className={`notifications-page__notification-status notifications-page__notification-status--${item.statusTone}`}>
            {item.statusLabel}
          </Text>
        </View>
        <Text className="notifications-page__notification-time">{item.timeLabel}</Text>
      </View>

      <View className="notifications-page__notification-title-row">
        <Text className="notifications-page__notification-title">{item.title}</Text>
        {!item.isRead ? <View className="notifications-page__notification-dot" /> : null}
      </View>

      <Text className="notifications-page__notification-content line-clamp-2">{item.content}</Text>

      <View className="notifications-page__notification-footer">
        <Text className="notifications-page__notification-hint">长按可删除</Text>
        {item.canNavigate && item.actionText ? (
          <View
            className={`notifications-page__notification-action ${item.isActionable ? 'is-primary' : ''}`}
            onClick={(event) => {
              event.stopPropagation();
              onOpen(item.raw);
            }}
          >
            <Text className={`notifications-page__notification-action-text ${item.isActionable ? 'is-primary' : ''}`}>
              {item.actionText}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  </View>
);

export default function NotificationsPage() {
  const auth = useAuthStore();
  const redirectingRef = useRef(false);
  const redirectResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchRequestIdRef = useRef(0);
  const hiddenInvalidNotificationIdsRef = useRef<Set<number>>(new Set());
  const mountedRef = useRef(true);
  const pageVisibleRef = useRef(false);
  const realtimeRef = useRef<NotificationWebSocket | null>(null);
  const [pageVisible, setPageVisible] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<NotificationFilterKey>('all');
  const [loading, setLoading] = useState(true);
  const navMetrics = useMemo(() => getMiniNavMetrics(), []);

  const headerInsetStyle = useMemo(
    () => ({
      paddingTop: `${navMetrics.menuTop}px`,
      paddingRight: `${navMetrics.menuRightInset}px`,
      paddingBottom: `${navMetrics.contentTop - navMetrics.menuBottom}px`,
    }),
    [navMetrics.contentTop, navMetrics.menuBottom, navMetrics.menuRightInset, navMetrics.menuTop],
  );
  const headerMainStyle = useMemo(() => ({ height: `${navMetrics.menuHeight}px` }), [navMetrics.menuHeight]);
  const headerPlaceholderStyle = useMemo(() => ({ height: `${navMetrics.contentTop}px` }), [navMetrics.contentTop]);
  const capsuleSpacerStyle = useMemo(
    () => ({
      width: `${navMetrics.menuWidth}px`,
      height: `${navMetrics.menuHeight}px`,
    }),
    [navMetrics.menuHeight, navMetrics.menuWidth],
  );

  const unreadCount = useMemo(() => notifications.filter((item) => !item.isRead).length, [notifications]);
  const filters = useMemo(() => buildNotificationFilters(notifications), [notifications]);
  const sections = useMemo(
    () => buildNotificationSections(notifications, activeFilter),
    [activeFilter, notifications],
  );
  const activeFilterLabel = useMemo(
    () => filters.find((item) => item.key === activeFilter)?.label || '全部',
    [activeFilter, filters],
  );

  const hideInvalidNotificationLocally = useCallback((id: number) => {
    hiddenInvalidNotificationIdsRef.current.add(id);
    setNotifications((prev) => prev.filter((entry) => entry.id !== id));
  }, []);

  useEffect(() => {
    if (activeFilter !== 'all' && !filters.some((item) => item.key === activeFilter)) {
      setActiveFilter('all');
    }
  }, [activeFilter, filters]);

  const fetchNotifications = useCallback(async () => {
    const requestId = ++fetchRequestIdRef.current;
    if (!auth.token) {
      if (requestId === fetchRequestIdRef.current && mountedRef.current) {
        setNotifications([]);
        setLoading(false);
      }
      return;
    }

    try {
      const data = await listNotifications(1, 30);
      if (requestId !== fetchRequestIdRef.current || !mountedRef.current || !pageVisibleRef.current) {
        return;
      }
      const rawList = (data.list || []).filter(
        (item) => !hiddenInvalidNotificationIdsRef.current.has(item.id),
      );
      const validation = await Promise.all(rawList.map(async (item) => {
        const pagePath = resolveMiniNotificationRoute(item.actionUrl);
        if (!pagePath) {
          return { item, valid: true };
        }

        const result = await validateNotificationRoute(pagePath);
        if (result === 'invalid') {
          hiddenInvalidNotificationIdsRef.current.add(item.id);
          await deleteNotification(item.id).catch(() => undefined);
          return { item, valid: false };
        }

        return { item, valid: true };
      }));

      if (requestId !== fetchRequestIdRef.current || !mountedRef.current || !pageVisibleRef.current) {
        return;
      }

      const invalidCount = validation.filter((entry) => !entry.valid).length;
      setNotifications(validation.filter((entry) => entry.valid).map((entry) => entry.item));
      if (invalidCount >= 2) {
        Taro.showToast({
          title: `已清理${invalidCount}条失效通知`,
          icon: 'none',
        });
      }
    } catch (error) {
      if (requestId === fetchRequestIdRef.current && mountedRef.current) {
        showErrorToast(error, '加载通知失败');
      }
    } finally {
      if (requestId === fetchRequestIdRef.current && mountedRef.current) {
        setLoading(false);
      }
    }
  }, [auth.token]);
  const { refreshStatus, drawerHeight, drawerProgress, bindPullToRefresh, runReload } = usePullToRefreshFeedback(fetchNotifications);

  useEffect(() => {
    pageVisibleRef.current = pageVisible;
  }, [pageVisible]);

  useEffect(() => {
    mountedRef.current = true;
    const hiddenInvalidIds = hiddenInvalidNotificationIdsRef.current;

    return () => {
      mountedRef.current = false;
      fetchRequestIdRef.current += 1;
      hiddenInvalidIds.clear();
      clearNotificationRouteValidationCache();
      if (redirectResetTimerRef.current) {
        clearTimeout(redirectResetTimerRef.current);
        redirectResetTimerRef.current = null;
      }
      realtimeRef.current?.disconnect();
      realtimeRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!pageVisible || !auth.token) {
      return;
    }
    void runReload();
  }, [auth.token, pageVisible, runReload]);

  useDidShow(() => {
    syncCurrentTabBar('/pages/messages/index');
    setPageVisible(true);

    if (!useAuthStore.getState().token && !redirectingRef.current) {
      redirectingRef.current = true;
      void openAuthLoginPage('/pages/messages/index').finally(() => {
        if (redirectResetTimerRef.current) {
          clearTimeout(redirectResetTimerRef.current);
        }
        redirectResetTimerRef.current = setTimeout(() => {
          redirectingRef.current = false;
          redirectResetTimerRef.current = null;
        }, 240);
      });
    }
  });

  useDidHide(() => {
    setPageVisible(false);
    fetchRequestIdRef.current += 1;
    if (redirectResetTimerRef.current) {
      clearTimeout(redirectResetTimerRef.current);
      redirectResetTimerRef.current = null;
    }
  });

  useEffect(() => {
    if (!pageVisible || !auth.token || !isNotificationRealtimeEnabled()) {
      realtimeRef.current?.disconnect();
      realtimeRef.current = null;
      return;
    }

    realtimeRef.current?.disconnect();
    const websocket = new NotificationWebSocket({
      token: auth.token,
      onNewNotification: () => {
        void runReload();
      },
      onUnreadCountUpdate: () => {
        void runReload();
      },
    });
    realtimeRef.current = websocket;
    websocket.connect();

    return () => {
      websocket.disconnect();
      if (realtimeRef.current === websocket) {
        realtimeRef.current = null;
      }
    };
  }, [auth.token, pageVisible, runReload]);

  const handleReadAll = useCallback(async () => {
    if (unreadCount === 0) {
      Taro.showToast({ title: '当前已全部已读', icon: 'none' });
      return;
    }

    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
      Taro.showToast({ title: '已全部标记已读', icon: 'none' });
    } catch (error) {
      showErrorToast(error, '操作失败');
    }
  }, [unreadCount]);

  const handleOpenNotification = useCallback(async (item: NotificationItem) => {
    try {
      if (!item.isRead) {
        await markNotificationRead(item.id);
        setNotifications((prev) =>
          prev.map((entry) => (entry.id === item.id ? { ...entry, isRead: true } : entry)),
        );
      }

      if (!item.actionUrl) {
        return;
      }

      const pagePath = resolveMiniNotificationRoute(item.actionUrl);
      if (!pagePath) {
        Taro.showToast({ title: '当前通知暂不支持小程序内查看', icon: 'none' });
        return;
      }

      const validationResult = await validateNotificationRoute(pagePath);
      if (validationResult === 'invalid') {
        await deleteNotification(item.id).catch(() => undefined);
        hideInvalidNotificationLocally(item.id);
        return;
      }

      const plainPath = stripQuery(pagePath);
      if (TAB_PAGE_PATHS.includes(plainPath)) {
        await Taro.switchTab({ url: plainPath });
      } else {
        await Taro.navigateTo({ url: pagePath });
      }
    } catch (error) {
      showErrorToast(error, '打开通知失败');
    }
  }, [hideInvalidNotificationLocally]);

  const handleDeleteNotification = useCallback(async (id: number) => {
    try {
      await deleteNotification(id);
      setNotifications((prev) => prev.filter((item) => item.id !== id));
      Taro.showToast({ title: '已删除', icon: 'none' });
    } catch (error) {
      showErrorToast(error, '删除失败');
    }
  }, []);

  const handleManageNotification = useCallback(async (item: NotificationCardViewModel) => {
    try {
      const result = await Taro.showActionSheet({
        itemList: ['删除通知'],
        itemColor: '#ef4444',
      });

      if (result.tapIndex === 0) {
        await handleDeleteNotification(item.id);
      }
    } catch {
      return;
    }
  }, [handleDeleteNotification]);

  const handleClearNotifications = useCallback(async () => {
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
      const results = await Promise.allSettled(notifications.map((item) => deleteNotification(item.id)));
      const successCount = results.filter((result) => result.status === 'fulfilled').length;
      const failedCount = notifications.length - successCount;

      if (successCount > 0) {
        setNotifications((prev) => prev.filter((_, index) => results[index].status !== 'fulfilled'));
      }

      Taro.showToast({
        title: failedCount > 0 ? `已清理${successCount}条，${failedCount}条失败` : '通知已清空',
        icon: 'none',
      });
    } catch (error) {
      showErrorToast(error, '清理失败');
    }
  }, [auth.token, notifications]);

  if (!auth.token) {
    return <View className="notifications-page" />;
  }

  return (
    <View className="notifications-page page-with-tabbar" {...bindPullToRefresh}>
      <NotificationsHeader
        insetStyle={headerInsetStyle}
        mainStyle={headerMainStyle}
        capsuleStyle={capsuleSpacerStyle}
        placeholderStyle={headerPlaceholderStyle}
      />
      <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />

      {loading ? <NotificationsSkeleton /> : null}

      {!loading ? (
        <View className="notifications-page__content">
          <FilterBar
            activeFilter={activeFilter}
            filters={filters}
            unreadCount={unreadCount}
            onReadAll={handleReadAll}
            onChange={setActiveFilter}
          />

          {sections.length > 0 ? (
            <>
              {sections.map((section: NotificationSectionViewModel) => (
                <View key={section.key} className="notifications-page__section">
                  <SectionHeader title={section.title} count={section.items.length} />
                  <View className="notifications-page__section-list">
                    {section.items.map((item) => (
                      <NotificationCard
                        key={item.id}
                        item={item}
                        onOpen={handleOpenNotification}
                        onManage={handleManageNotification}
                      />
                    ))}
                  </View>
                </View>
              ))}

              <View className="notifications-page__footer-utility" onClick={handleClearNotifications}>
                <Text className="notifications-page__footer-utility-text">清空当前通知列表</Text>
              </View>
            </>
          ) : (
            <View className="notifications-page__section-card">
              <SectionEmpty activeFilterLabel={activeFilterLabel} />
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}
