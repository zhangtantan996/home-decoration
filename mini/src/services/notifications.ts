import { request } from '@/utils/request';
import type { PageData } from './types';
import type { NotificationDTO } from './dto';

export type NotificationItem = NotificationDTO;

export async function listNotifications(page = 1, pageSize = 20) {
  return request<PageData<NotificationItem>>({
    url: '/notifications',
    data: { page, pageSize }
  });
}

export async function getUnreadCount() {
  return request<{ count: number }>({
    url: '/notifications/unread-count'
  });
}

export async function markNotificationRead(id: number) {
  return request<{ message: string }>({
    url: `/notifications/${id}/read`,
    method: 'PUT'
  });
}

export async function markAllNotificationsRead() {
  return request<{ message: string }>({
    url: '/notifications/read-all',
    method: 'PUT'
  });
}

export async function deleteNotification(id: number) {
  return request<{ message: string }>({
    url: `/notifications/${id}`,
    method: 'DELETE'
  });
}
