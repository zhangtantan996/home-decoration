import type { PageEnvelope } from '../types/api';
import type { MessageListItemVM } from '../types/viewModels';
import { formatDateTime } from '../utils/format';
import { requestJson } from './http';

interface NotificationDTO {
  id: number;
  title?: string;
  content?: string;
  actionUrl?: string;
  createdAt?: string;
  isRead?: boolean;
  type?: string;
}

function toNotification(dto: NotificationDTO): MessageListItemVM {
  return {
    id: dto.id,
    title: dto.title || '系统通知',
    content: dto.content || '暂无通知内容',
    actionUrl: dto.actionUrl || '',
    createdAt: formatDateTime(dto.createdAt),
    isRead: Boolean(dto.isRead),
    type: dto.type || 'system',
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
  };
}

export async function getNotificationUnreadCount() {
  const data = await requestJson<{ count: number }>('/notifications/unread-count');
  return Number(data.count || 0);
}
