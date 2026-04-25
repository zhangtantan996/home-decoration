import type { PageEnvelope } from '../types/api';
import type { MessageListItemVM } from '../types/viewModels';
import { formatDateTime } from '../utils/format';
import { requestJson } from './http';

const UNREAD_COUNT_CACHE_TTL_MS = 8000;

let unreadCountCache: { value: number; expiresAt: number } | null = null;
let unreadCountInFlight: Promise<number> | null = null;

interface NotificationDTO {
  id: number;
  title?: string;
  content?: string;
  actionUrl?: string;
  createdAt?: string;
  isRead?: boolean;
  type?: string;
  typeLabel?: string;
  category?: 'system' | 'project' | 'payment';
  kind?: 'info' | 'todo' | 'risk' | 'result' | 'governance';
  priority?: 'normal' | 'high' | 'urgent';
  actionRequired?: boolean;
  actionStatus?: 'none' | 'pending' | 'processed' | 'expired';
  actionLabel?: string;
  supportsWeb?: boolean;
  supportsMini?: boolean;
}

export interface NotificationListResult {
  list: MessageListItemVM[];
  total: number;
  page: number;
  pageSize: number;
}

function inferNotificationCategory(type: string): 'system' | 'project' | 'payment' {
  if (type.startsWith('order') || type.startsWith('refund') || type.startsWith('payment.')) {
    return 'payment';
  }
  if (
    type.startsWith('booking')
    || type.startsWith('proposal')
    || type.startsWith('quote')
    || type.startsWith('project')
    || type.startsWith('audit')
    || type.startsWith('complaint')
    || type.startsWith('change_order')
  ) {
    return 'project';
  }
  return 'system';
}

function toNotification(dto: NotificationDTO): MessageListItemVM {
  const type = dto.type || 'system';
  return {
    id: dto.id,
    title: dto.title || '系统通知',
    content: dto.content || '暂无通知内容',
    actionUrl: dto.actionUrl || '',
    createdAt: formatDateTime(dto.createdAt),
    isRead: Boolean(dto.isRead),
    type,
    typeLabel: String(dto.typeLabel || '').trim(),
    category: dto.category || inferNotificationCategory(type),
    kind: dto.kind || 'info',
    priority: dto.priority || 'normal',
    actionRequired: Boolean(dto.actionRequired),
    actionStatus: dto.actionStatus || 'none',
    actionLabel: dto.actionLabel || '',
    supportsWeb: dto.supportsWeb !== false,
    supportsMini: Boolean(dto.supportsMini),
  };
}

export async function listNotifications(params: { page?: number; pageSize?: number } = {}) {
  const data = await requestJson<PageEnvelope<NotificationDTO>>('/notifications', {
    query: {
      page: params.page || 1,
      pageSize: params.pageSize || 10,
    },
  });

  return {
    list: data.list.map(toNotification),
    total: data.total,
    page: data.page,
    pageSize: data.pageSize,
  } satisfies NotificationListResult;
}

export async function getNotificationUnreadCount() {
  const now = Date.now();
  if (unreadCountCache && unreadCountCache.expiresAt > now) {
    return unreadCountCache.value;
  }

  if (unreadCountInFlight) {
    return unreadCountInFlight;
  }

  unreadCountInFlight = requestJson<{ count: number }>('/notifications/unread-count')
    .then((data) => {
      const count = Number(data.count || 0);
      unreadCountCache = {
        value: count,
        expiresAt: Date.now() + UNREAD_COUNT_CACHE_TTL_MS,
      };
      return count;
    })
    .finally(() => {
      unreadCountInFlight = null;
    });

  return unreadCountInFlight;
}

export function syncNotificationUnreadCountCache(count: number) {
  unreadCountCache = {
    value: Math.max(0, Number(count) || 0),
    expiresAt: Date.now() + UNREAD_COUNT_CACHE_TTL_MS,
  };
}

export function invalidateNotificationUnreadCountCache() {
  unreadCountCache = null;
}

export async function markNotificationAsRead(id: number) {
  await requestJson<{ message?: string }>(`/notifications/${id}/read`, {
    method: 'PUT',
  });
  invalidateNotificationUnreadCountCache();
}

export async function markAllNotificationsAsRead() {
  await requestJson<{ message?: string }>('/notifications/read-all', {
    method: 'PUT',
  });
  invalidateNotificationUnreadCountCache();
}

export async function deleteNotification(id: number) {
  await requestJson<{ message?: string }>(`/notifications/${id}`, {
    method: 'DELETE',
  });
  invalidateNotificationUnreadCountCache();
}
