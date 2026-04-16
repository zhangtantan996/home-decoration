import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { EmptyBlock, ErrorBlock, LoadingBlock } from './AsyncState';
import {
  deleteNotification,
  listNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '../services/notifications';
import { notificationRealtimeClient } from '../services/notificationRealtime';
import type { MessageListItemVM } from '../types/viewModels';

import styles from './NotificationCenter.module.scss';

const filters = [
  { key: 'all', label: '全部' },
  { key: 'project', label: '项目提醒' },
  { key: 'payment', label: '支付提醒' },
  { key: 'system', label: '系统通知' },
] as const;

type FilterKey = (typeof filters)[number]['key'];

type NotificationCenterProps = {
  title: string;
  pageSize?: number;
  topPage?: boolean;
  showHeader?: boolean;
};

function mapType(type: string) {
  if (type.startsWith('order') || type.startsWith('refund') || type.startsWith('payment.')) return 'payment';
  if (type.startsWith('booking') || type.startsWith('proposal') || type.startsWith('quote') || type.startsWith('project') || type.startsWith('audit') || type.startsWith('complaint') || type.startsWith('change_order')) return 'project';
  return 'system';
}

function mapCategory(item: MessageListItemVM) {
  if (item.category) {
    if (item.category === 'payment') return 'payment';
    if (item.category === 'project') return 'project';
    return 'system';
  }
  return mapType(item.type);
}

function readActionBadge(item: MessageListItemVM) {
  if (item.actionStatus === 'processed') {
    return { label: '已处理', tone: 'muted' as const };
  }
  if (item.actionStatus === 'expired') {
    return { label: '已过期', tone: 'warn' as const };
  }
  if (item.actionRequired && item.actionLabel) {
    return {
      label: item.priority === 'urgent' ? `${item.actionLabel} · 紧急` : item.actionLabel,
      tone: item.priority === 'urgent' ? ('warn' as const) : ('primary' as const),
    };
  }
  if (item.kind === 'result') {
    return { label: '结果通知', tone: 'muted' as const };
  }
  if (item.kind === 'risk') {
    return { label: '风险提醒', tone: 'warn' as const };
  }
  return null;
}

function MessageIcon({ type }: { type: string }) {
  if (type.startsWith('proposal') || type.startsWith('quote')) {
    return (
      <div className={styles.icon}>
        <svg fill="currentColor" height="24" viewBox="0 0 24 24" width="24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM18 20H6V4h5v6h6v10z"/></svg>
      </div>
    );
  }
  if (type.startsWith('booking')) {
    return (
      <div className={styles.icon}>
        <svg fill="currentColor" height="24" viewBox="0 0 24 24" width="24"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM9 14H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2zm-8 4H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2z"/></svg>
      </div>
    );
  }
  if (type.startsWith('order') || type.startsWith('refund') || type.startsWith('payment.')) {
    return (
      <div className={styles.icon}>
        <svg fill="currentColor" height="24" viewBox="0 0 24 24" width="24"><path d="M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>
      </div>
    );
  }
  if (type.startsWith('project') || type.startsWith('audit') || type.startsWith('change_order')) {
    return (
      <div className={styles.icon}>
        <svg fill="currentColor" height="24" viewBox="0 0 24 24" width="24"><path d="M10 4H4c-1.11 0-2 .9-2 2v12c0 1.1.89 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
      </div>
    );
  }
  return (
    <div className={styles.icon}>
      <svg fill="currentColor" height="24" viewBox="0 0 24 24" width="24"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>
    </div>
  );
}

export function NotificationCenter({ title, pageSize = 12, topPage = false, showHeader = true }: NotificationCenterProps) {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [items, setItems] = useState<MessageListItemVM[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const pageRef = useRef(page);

  const unreadCount = useMemo(() => items.filter((item) => !item.isRead).length, [items]);
  const filtered = useMemo(() => {
    if (activeFilter === 'all') return items;
    return items.filter((item) => mapCategory(item) === activeFilter);
  }, [activeFilter, items]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  const loadData = useCallback(async (targetPage: number) => {
    setLoading(true);
    setError('');
    try {
      const data = await listNotifications({ page: targetPage, pageSize });
      setItems(data.list);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : '通知中心加载失败');
    } finally {
      setLoading(false);
    }
  }, [pageSize]);

  useEffect(() => {
    void loadData(page);
  }, [loadData, page]);

  useEffect(() => {
    return notificationRealtimeClient.subscribe((event) => {
      if (event.type === 'notification.new') {
        if (pageRef.current !== 1) {
          setPage(1);
          return;
        }

        void loadData(1);
        return;
      }

      if (
        event.type === 'notification.read'
        || event.type === 'notification.delete'
        || event.type === 'notification.all_read'
      ) {
        void loadData(pageRef.current);
        return;
      }
    });
  }, [loadData]);

  const withMutation = async (action: () => Promise<void>) => {
    setMutating(true);
    try {
      await action();
    } finally {
      setMutating(false);
    }
  };

  const handleMarkAsRead = async (item: MessageListItemVM) => {
    if (item.isRead) return;
    await withMutation(async () => {
      await markNotificationAsRead(item.id);
      setItems((current) =>
        current.map((entry) => (entry.id === item.id ? { ...entry, isRead: true } : entry)),
      );
    });
  };

  const handleMarkAllAsRead = async () => {
    if (!unreadCount) return;
    await withMutation(async () => {
      await markAllNotificationsAsRead();
      setItems((current) => current.map((entry) => ({ ...entry, isRead: true })));
    });
  };

  const handleDelete = async (item: MessageListItemVM) => {
    await withMutation(async () => {
      await deleteNotification(item.id);
      const nextTotal = Math.max(0, total - 1);
      setTotal(nextTotal);
      setItems((current) => current.filter((entry) => entry.id !== item.id));

      if (items.length === 1 && page > 1) {
        setPage((current) => current - 1);
        return;
      }

      if (nextTotal === 0) {
        setItems([]);
      }
    });
  };

  const handleOpen = async (item: MessageListItemVM) => {
    if (!item.isRead) {
      await handleMarkAsRead(item);
    }
    if (item.actionUrl && item.supportsWeb) {
      navigate(item.actionUrl);
    }
  };

  const wrapperClassName = topPage ? 'top-page' : styles.wrapper;

  if (loading) {
    return (
      <div className={wrapperClassName}>
        <LoadingBlock title="加载通知列表" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={wrapperClassName}>
        <ErrorBlock description={error} onRetry={() => void loadData(page)} />
      </div>
    );
  }

  return (
    <div className={wrapperClassName}>
      {showHeader ? (
        <div className={styles.sectionHead}>
          <h2>{title}</h2>
          {unreadCount > 0 ? (
            <div className={styles.unreadCount}>
              {unreadCount} 条未读
            </div>
          ) : null}
        </div>
      ) : null}

      <div className={styles.filters}>
        {filters.map((item) => (
          <button
            className={`${styles.filterBtn} ${activeFilter === item.key ? styles.active : ''}`}
            key={item.key}
            onClick={() => setActiveFilter(item.key)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className={styles.actions}>
        <button
          className={`${styles.actionBtn} ${unreadCount > 0 ? styles.primary : ''}`}
          disabled={mutating || unreadCount === 0}
          onClick={() => void handleMarkAllAsRead()}
          type="button"
        >
          全部已读
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyBlock title="暂无通知" description="当前筛选条件下没有系统或业务通知。" />
      ) : (
        <div className={styles.msgList}>
          {filtered.map((item) => {
            const actionBadge = readActionBadge(item);
            return (
            <article className={styles.msgItem} key={item.id}>
              {actionBadge ? (
                <div className={`${styles.actionBadge} ${styles[`actionBadge--${actionBadge.tone}`]}`}>
                  {actionBadge.label}
                </div>
              ) : null}
              <div className={styles.contentWrapper}>
                <button
                  className={styles.buttonArea}
                  onClick={() => void handleOpen(item)}
                  type="button"
                >
                  <MessageIcon type={item.type} />
                  <div className={styles.body}>
                    <strong>{item.title}</strong>
                    <p>{item.content}</p>
                  </div>
                </button>
                <div className={styles.meta}>
                  <div className={styles.time}>{item.createdAt}</div>
                  {!item.isRead ? <div className={styles.unreadBadge} /> : null}
                </div>
              </div>
              <div className={styles.itemActions}>
                <button
                  className={styles.actionBtn}
                  disabled={mutating}
                  onClick={() => void handleDelete(item)}
                  type="button"
                >
                  删除
                </button>
              </div>
            </article>
            );
          })}
        </div>
      )}

      {totalPages > 1 ? (
        <div className={styles.pagination}>
          <button
            className={styles.actionBtn}
            disabled={page <= 1 || mutating}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            type="button"
          >
            上一页
          </button>
          <span className={styles.pageInfo}>
            {page} / {totalPages}
          </span>
          <button
            className={styles.actionBtn}
            disabled={page >= totalPages || mutating}
            onClick={() => setPage((current) => current + 1)}
            type="button"
          >
            下一页
          </button>
        </div>
      ) : null}
    </div>
  );
}
