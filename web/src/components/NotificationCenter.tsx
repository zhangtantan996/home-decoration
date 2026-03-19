import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { EmptyBlock, ErrorBlock, LoadingBlock } from './AsyncState';
import {
  deleteNotification,
  listNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '../services/notifications';
import type { MessageListItemVM } from '../types/viewModels';

const filters = [
  { key: 'all', label: '全部' },
  { key: 'booking', label: '预约提醒' },
  { key: 'proposal', label: '报价提醒' },
  { key: 'order', label: '支付提醒' },
  { key: 'project', label: '项目提醒' },
  { key: 'system', label: '系统通知' },
] as const;

type FilterKey = (typeof filters)[number]['key'];

type NotificationCenterProps = {
  title: string;
  pageSize?: number;
  topPage?: boolean;
};

function mapType(type: string) {
  if (type.startsWith('booking')) return 'booking';
  if (type.startsWith('proposal') || type.startsWith('quote')) return 'proposal';
  if (type.startsWith('order') || type.startsWith('refund')) return 'order';
  if (type.startsWith('project') || type.startsWith('audit')) return 'project';
  return 'system';
}

function MessageIcon({ type }: { type: string }) {
  if (type.startsWith('proposal') || type.startsWith('quote')) {
    return (
      <div className="msg-icon mi-green">
        <svg fill="currentColor" height="24" viewBox="0 0 24 24" width="24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM18 20H6V4h5v6h6v10z"/></svg>
      </div>
    );
  }
  if (type.startsWith('booking')) {
    return (
      <div className="msg-icon mi-blue">
        <svg fill="currentColor" height="24" viewBox="0 0 24 24" width="24"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM9 14H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2zm-8 4H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2z"/></svg>
      </div>
    );
  }
  if (type.startsWith('order') || type.startsWith('refund')) {
    return (
      <div className="msg-icon mi-amber">
        <svg fill="currentColor" height="24" viewBox="0 0 24 24" width="24"><path d="M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>
      </div>
    );
  }
  if (type.startsWith('project') || type.startsWith('audit')) {
    return (
      <div className="msg-icon mi-blue">
        <svg fill="currentColor" height="24" viewBox="0 0 24 24" width="24"><path d="M10 4H4c-1.11 0-2 .9-2 2v12c0 1.1.89 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
      </div>
    );
  }
  return (
    <div className="msg-icon mi-purple">
      <svg fill="currentColor" height="24" viewBox="0 0 24 24" width="24"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>
    </div>
  );
}

function actionButtonStyle(primary = false) {
  return {
    border: primary ? 'none' : '1px solid rgba(15, 23, 42, 0.1)',
    borderRadius: '8px',
    background: primary ? 'linear-gradient(135deg, var(--color-brand), var(--color-brand-strong))' : '#fff',
    color: primary ? '#fff' : 'var(--color-brand)',
    cursor: 'pointer',
    fontSize: '0.82rem',
    fontWeight: 600,
    padding: '8px 16px',
    transition: 'all 0.15s ease',
    boxShadow: primary ? 'var(--shadow-soft)' : 'none',
  } as const;
}

export function NotificationCenter({ title, pageSize = 12, topPage = false }: NotificationCenterProps) {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [items, setItems] = useState<MessageListItemVM[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');

  const unreadCount = useMemo(() => items.filter((item) => !item.isRead).length, [items]);
  const filtered = useMemo(() => {
    if (activeFilter === 'all') return items;
    return items.filter((item) => mapType(item.type) === activeFilter);
  }, [activeFilter, items]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const loadData = async (targetPage = page) => {
    setLoading(true);
    setError('');
    try {
      const data = await listNotifications({ page: targetPage, pageSize });
      setItems(data.list);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : '消息中心加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData(page);
  }, [page]);

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
    if (item.actionUrl) {
      navigate(item.actionUrl);
    }
  };

  const wrapperClassName = topPage ? 'top-page' : undefined;

  if (loading) {
    return (
      <div className={wrapperClassName}>
        <LoadingBlock title="加载消息列表" />
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
      <div className="section-head" style={{ marginBottom: 20 }}>
        <h2>{title}</h2>
        <div style={{ color: '#64748b', fontSize: 14 }}>
          当前页 {items.length} 条，未读 {unreadCount} 条
        </div>
      </div>

      <div className="ptabs" style={{ marginBottom: 16 }}>
        {filters.map((item) => (
          <button
            className={`ptab ${activeFilter === item.key ? 'active' : ''}`}
            key={item.key}
            onClick={() => setActiveFilter(item.key)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <button disabled={mutating} onClick={() => void loadData(page)} style={actionButtonStyle()} type="button">
          刷新
        </button>
        <button
          disabled={mutating || unreadCount === 0}
          onClick={() => void handleMarkAllAsRead()}
          style={actionButtonStyle(Boolean(unreadCount))}
          type="button"
        >
          全部已读
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyBlock title="暂无消息" description="当前筛选条件下没有系统或业务通知。" />
      ) : (
        <div className="msg-list">
          {filtered.map((item) => (
            <article className="msg-item" key={item.id}>
              <button
                onClick={() => void handleOpen(item)}
                style={{ all: 'unset', cursor: item.actionUrl ? 'pointer' : 'default', display: 'contents' }}
                type="button"
              >
                <MessageIcon type={item.type} />
                <div className="msg-body">
                  <strong>{item.title}</strong>
                  <p>{item.content}</p>
                </div>
                <div className="msg-time">{item.createdAt}</div>
                {!item.isRead ? <div className="msg-unread" /> : null}
              </button>
              <div style={{ display: 'flex', gap: 8, marginTop: 12, marginLeft: 48, flexWrap: 'wrap' }}>
                {!item.isRead ? (
                  <button
                    disabled={mutating}
                    onClick={() => void handleMarkAsRead(item)}
                    style={actionButtonStyle()}
                    type="button"
                  >
                    标记已读
                  </button>
                ) : null}
                {item.actionUrl ? (
                  <button
                    disabled={mutating}
                    onClick={() => void handleOpen(item)}
                    style={actionButtonStyle(true)}
                    type="button"
                  >
                    查看详情
                  </button>
                ) : null}
                <button
                  disabled={mutating}
                  onClick={() => void handleDelete(item)}
                  style={actionButtonStyle()}
                  type="button"
                >
                  删除
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 20 }}>
        <div style={{ color: '#64748b', fontSize: 14 }}>
          第 {Math.min(page, totalPages)} / {totalPages} 页，共 {total} 条
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            disabled={page <= 1 || mutating}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            style={actionButtonStyle()}
            type="button"
          >
            上一页
          </button>
          <button
            disabled={page >= totalPages || mutating}
            onClick={() => setPage((current) => current + 1)}
            style={actionButtonStyle()}
            type="button"
          >
            下一页
          </button>
        </div>
      </div>
    </div>
  );
}
