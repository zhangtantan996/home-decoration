import Taro, { useDidHide, useDidShow } from '@tarojs/taro';
import { Text, View } from '@tarojs/components';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

import { Icon } from '@/components/Icon';
import MiniPageNav, { MINI_PAGE_NAV_EXTRA_BOTTOM } from '@/components/MiniPageNav';
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

const FilterBar = ({
  activeFilter,
  filters,
  onChange,
}: {
  activeFilter: NotificationFilterKey;
  filters: NotificationFilterViewModel[];
  onChange: (key: NotificationFilterKey) => void;
}) => (
  <View className="notifications-page__filters">
    {filters.map((filter) => {
      const active = filter.key === activeFilter;
      return (
        <View
          key={filter.key}
          className={`notifications-page__filter-tab ${active ? 'is-active' : ''}`}
          onClick={() => onChange(filter.key)}
        >
          <Text className={`notifications-page__filter-label ${active ? 'is-active' : ''}`}>{filter.label}</Text>
          <Text className={`notifications-page__filter-count ${active ? 'is-active' : ''}`}>{filter.count}</Text>
          {active ? <View className="notifications-page__filter-underline" /> : null}
        </View>
      );
    })}
  </View>
);

const NotificationsHeader = ({
  filterShellStyle,
  placeholderStyle,
  filters,
  activeFilter,
  onChange,
}: {
  filterShellStyle: CSSProperties;
  placeholderStyle: CSSProperties;
  filters: NotificationFilterViewModel[];
  activeFilter: NotificationFilterKey;
  onChange: (key: NotificationFilterKey) => void;
}) => (
  <>
    <MiniPageNav
      title="通知"
      onBack={() => undefined}
      showBack={false}
    />
    <View className="notifications-page__filters-shell" style={filterShellStyle}>
      <FilterBar activeFilter={activeFilter} filters={filters} onChange={onChange} />
    </View>
    <View className="notifications-page__header-placeholder" style={placeholderStyle} />
  </>
);

const NotificationsSkeleton = () => (
  <View className="notifications-page__content">
    {['待处理', '最近更新'].map((title) => (
      <View key={title} className="notifications-page__section">
        <View className="notifications-page__section-title-row">
          <Skeleton width="88" height={18} />
          <Skeleton width="44" height={18} />
        </View>
        <View className="notifications-page__section-sheet">
          {Array.from({ length: 2 }).map((_, index) => (
            <View key={`${title}-${index}`} className="notifications-page__cell-skeleton">
              <Skeleton width="64" height={22} />
              <Skeleton width="38" height={18} />
              <Skeleton width="68%" height={26} className="notifications-page__skeleton-gap" />
              <Skeleton row={2} height={20} className="notifications-page__skeleton-gap" />
            </View>
          ))}
        </View>
      </View>
    ))}
  </View>
);

const EmptyState = ({ activeFilterLabel }: { activeFilterLabel: string }) => (
  <View className="notifications-page__empty-state">
    <View className="notifications-page__empty-icon">
      <Icon name="notification" size={38} color="#C7C7CC" />
    </View>
    <Text className="notifications-page__empty-title">
      {activeFilterLabel === '全部' ? '还没有通知' : `暂无${activeFilterLabel}通知`}
    </Text>
    <Text className="notifications-page__empty-copy">新的业务进展会集中出现在这里。</Text>
  </View>
);

const SectionHeader = ({
  title,
  count,
  showReadAll,
  onReadAll,
}: {
  title: string;
  count: number;
  showReadAll?: boolean;
  onReadAll?: () => void;
}) => (
  <View className={`notifications-page__section-title-row ${title === '待处理' ? 'is-pending' : ''}`}>
    <View className="notifications-page__section-title-left">
      {title === '待处理' ? <View className="notifications-page__section-alert-dot" /> : null}
      <Text className="notifications-page__section-title">{title}</Text>
      <Text className="notifications-page__section-count">{count}</Text>
    </View>
    {showReadAll ? (
      <View className="notifications-page__section-action" onClick={onReadAll}>
        <Text className="notifications-page__section-action-text">全部已读</Text>
      </View>
    ) : null}
  </View>
);

const resolveCardActionText = (item: NotificationCardViewModel) => {
  if (!item.canNavigate) {
    return '';
  }
  if (item.actionStatus === 'expired') {
    return '查看';
  }
  return item.actionText || '查看详情';
};

const NotificationCard = ({
  item,
  onOpen,
  onManage,
}: {
  item: NotificationCardViewModel;
  onOpen: () => void;
  onManage: () => void;
}) => {
  const actionText = resolveCardActionText(item);
  const unsupportedText = !item.canNavigate && item.raw.actionUrl ? '当前通知暂不支持小程序内查看' : '';

  return (
    <View
      className={`notifications-page__card ${!item.isRead ? 'is-unread' : ''}`}
      onClick={onOpen}
      onLongPress={onManage}
    >
      <View className="notifications-page__card-head">
        <Text className="notifications-page__card-title line-clamp-1">{item.title}</Text>
        <Text className={`notifications-page__card-status is-${item.statusTone}`}>{item.statusLabel}</Text>
      </View>

      <View className="notifications-page__card-body">
        <View className="notifications-page__card-main">
          <Text className={`notifications-page__card-type is-${item.visualTone}`}>{item.typeLabel}</Text>
          <Text className="notifications-page__card-summary line-clamp-2">
            {unsupportedText ? `${item.content} · ${unsupportedText}` : item.content}
          </Text>
        </View>
      </View>

      <View className="notifications-page__card-foot">
        <Text className="notifications-page__card-time">{item.timeLabel}</Text>
        {actionText ? (
          <View
            className="notifications-page__card-action"
            onClick={(event) => {
              event.stopPropagation?.();
              onOpen();
            }}
          >
            <Text className="notifications-page__card-action-text">{actionText}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
};

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
  const filterRowHeight = useMemo(() => {
    const { windowWidth = 375 } = Taro.getSystemInfoSync();
    return Math.round((windowWidth * 84) / 750);
  }, []);

  const filterTop = useMemo(
    () => navMetrics.menuBottom + MINI_PAGE_NAV_EXTRA_BOTTOM,
    [navMetrics.menuBottom],
  );
  const filterShellStyle = useMemo(
    () => ({ top: `${filterTop}px` }),
    [filterTop],
  );
  const headerPlaceholderStyle = useMemo(
    () => ({ height: `${filterTop + filterRowHeight}px` }),
    [filterRowHeight, filterTop],
  );

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

    setLoading(true);
    try {
      const data = await listNotifications(1, 30);
      if (requestId !== fetchRequestIdRef.current || !mountedRef.current || !pageVisibleRef.current) {
        return;
      }
      setNotifications(
        (data.list || []).filter((item) => !hiddenInvalidNotificationIdsRef.current.has(item.id)),
      );
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
  const { refreshStatus, drawerHeight, drawerProgress, bindPullToRefresh, runReload } =
    usePullToRefreshFeedback(fetchNotifications);

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

  const handleOpenNotification = useCallback(async (item: NotificationItem) => {
    try {
      if (!item.isRead) {
        await markNotificationRead(item.id);
        setNotifications((prev) => prev.map((entry) => (entry.id === item.id ? { ...entry, isRead: true } : entry)));
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

  const handleMarkAllRead = useCallback(async () => {
    const unreadItems = notifications.filter((item) => !item.isRead);
    if (unreadItems.length === 0) {
      return;
    }
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
      Taro.showToast({ title: '已全部标记已读', icon: 'none' });
    } catch (error) {
      showErrorToast(error, '操作失败');
    }
  }, [notifications]);

  if (!auth.token) {
    return <View className="notifications-page" />;
  }

  return (
    <View className="notifications-page page-with-tabbar" {...bindPullToRefresh}>
      <NotificationsHeader
        filterShellStyle={filterShellStyle}
        placeholderStyle={headerPlaceholderStyle}
        filters={filters}
        activeFilter={activeFilter}
        onChange={setActiveFilter}
      />
      <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />

      {loading ? <NotificationsSkeleton /> : null}

      {!loading ? (
        <View className="notifications-page__content">
          {sections.length > 0 ? (
            sections.map((section: NotificationSectionViewModel) => (
              <View key={section.key} className="notifications-page__section">
                <SectionHeader
                  title={section.title}
                  count={section.items.length}
                  showReadAll={section.title === '待处理' && notifications.some((item) => !item.isRead)}
                  onReadAll={handleMarkAllRead}
                />
                <View className="notifications-page__section-sheet">
                  {section.items.map((item) => (
                    <View
                      key={item.id}
                      className="notifications-page__cell-wrap"
                    >
                      <NotificationCard
                        item={item}
                        onOpen={() => void handleOpenNotification(item.raw)}
                        onManage={() => void handleManageNotification(item)}
                      />
                    </View>
                  ))}
                </View>
              </View>
            ))
          ) : (
            <View className="notifications-page__empty-card">
              <EmptyState activeFilterLabel={activeFilterLabel} />
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}
