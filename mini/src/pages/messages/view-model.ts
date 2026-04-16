import type { NotificationItem } from '@/services/notifications';
import {
  formatServerDateTime,
  formatServerRelativeTime,
  getServerDateParts,
  getServerTimeMs,
} from '@/utils/serverTime';
import { resolveMiniNotificationRoute } from '@/utils/notificationActionRoute';

export type NotificationFilterKey = 'all' | 'project' | 'payment' | 'system';
export type NotificationTone = Exclude<NotificationFilterKey, 'all'>;

export interface NotificationFilterViewModel {
  key: NotificationFilterKey;
  label: string;
  count: number;
}

export interface NotificationCardViewModel {
  id: number;
  raw: NotificationItem;
  title: string;
  content: string;
  typeTone: NotificationTone;
  typeLabel: string;
  isRead: boolean;
  relativeTime: string;
  absoluteTime: string;
  canNavigate: boolean;
  actionText: string;
  actionStatus: 'none' | 'pending' | 'processed' | 'expired';
  priority: 'normal' | 'high' | 'urgent';
}

export interface NotificationSectionViewModel {
  key: string;
  title: string;
  items: NotificationCardViewModel[];
}

const FILTER_LABELS: Record<NotificationFilterKey, string> = {
  all: '全部',
  project: '项目',
  payment: '支付',
  system: '系统',
};

const resolveNotificationTone = (item: NotificationItem): NotificationTone => {
  if (item.category === 'project') {
    return 'project';
  }
  if (item.category === 'payment') {
    return 'payment';
  }
  if (item.category === 'system') {
    return 'system';
  }

  const haystack = [item.type, item.title, item.content, item.actionUrl]
    .map((value) => String(value || '').toLowerCase())
    .join(' ');

  if (/(project|项目|阶段|施工|验收|进度|milestone|phase|quote|audit|仲裁|争议|complaint|投诉|change[_ -]?order|变更)/.test(haystack)) {
    return 'project';
  }

  if (/(order|订单|booking|预约|payment|支付|deposit|plan|账单|expire|失效)/.test(haystack)) {
    return 'payment';
  }

  return 'system';
};

const readActionText = (item: NotificationItem, canNavigate: boolean) => {
  if (item.actionStatus === 'processed') {
    return '已处理';
  }
  if (item.actionStatus === 'expired') {
    return '已过期';
  }
  if (item.actionRequired && item.actionLabel) {
    return item.priority === 'urgent' ? `${item.actionLabel} · 紧急` : item.actionLabel;
  }
  if (item.actionLabel) {
    return item.actionLabel;
  }
  return canNavigate ? '查看详情' : '仅通知';
};

const buildSectionKey = (value?: string) => {
  const parts = getServerDateParts(value);
  if (!parts) {
    return 'earlier';
  }
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const buildSectionMeta = (value?: string) => {
  const nowParts = getServerDateParts(Date.now());
  const targetParts = getServerDateParts(value);

  if (!nowParts || !targetParts) {
    return { key: 'earlier', title: '更早' };
  }

  const now = new Date(nowParts.year, nowParts.month - 1, nowParts.day).getTime();
  const target = new Date(targetParts.year, targetParts.month - 1, targetParts.day).getTime();
  const diffDays = Math.floor((now - target) / (24 * 60 * 60 * 1000));

  if (diffDays <= 0) {
    return { key: buildSectionKey(value), title: '今天' };
  }
  if (diffDays === 1) {
    return { key: buildSectionKey(value), title: '昨天' };
  }
  if (diffDays <= 7) {
    return { key: 'recent', title: '最近 7 天' };
  }
  return { key: 'earlier', title: '更早' };
};

const toCardViewModel = (item: NotificationItem): NotificationCardViewModel => {
  const typeTone = resolveNotificationTone(item);
  const miniRoute = resolveMiniNotificationRoute(item.actionUrl);
  return {
    id: item.id,
    raw: item,
    title: item.title || '未命名通知',
    content: item.content || '暂无更多说明',
    typeTone,
    typeLabel: FILTER_LABELS[typeTone],
    isRead: Boolean(item.isRead),
    relativeTime: formatServerRelativeTime(item.createdAt, '--'),
    absoluteTime: formatServerDateTime(item.createdAt, '--'),
    canNavigate: Boolean(miniRoute),
    actionText: readActionText(item, Boolean(miniRoute)),
    actionStatus: item.actionStatus || 'none',
    priority: item.priority || 'normal',
  };
};

const sortNotifications = (items: NotificationItem[]) => {
  return [...items].sort((left, right) => {
    const timeDiff = getServerTimeMs(right.createdAt) - getServerTimeMs(left.createdAt);
    if (timeDiff !== 0) {
      return timeDiff;
    }
    return right.id - left.id;
  });
};

export const buildNotificationFilters = (
  notifications: NotificationItem[],
): NotificationFilterViewModel[] => {
  const counters: Record<NotificationTone, number> = {
    project: 0,
    payment: 0,
    system: 0,
  };

  notifications.forEach((item) => {
    counters[resolveNotificationTone(item)] += 1;
  });

  return [
    { key: 'all', label: FILTER_LABELS.all, count: notifications.length },
    { key: 'project', label: FILTER_LABELS.project, count: counters.project },
    { key: 'payment', label: FILTER_LABELS.payment, count: counters.payment },
    { key: 'system', label: FILTER_LABELS.system, count: counters.system },
  ];
};

export const buildNotificationSections = (
  notifications: NotificationItem[],
  activeFilter: NotificationFilterKey,
): NotificationSectionViewModel[] => {
  const sorted = sortNotifications(notifications);
  const filtered =
    activeFilter === 'all'
      ? sorted
      : sorted.filter((item) => resolveNotificationTone(item) === activeFilter);

  const sectionMap = new Map<string, NotificationSectionViewModel>();

  filtered.forEach((item) => {
    const sectionMeta = buildSectionMeta(item.createdAt);
    const existing = sectionMap.get(sectionMeta.key);
    if (!existing) {
      sectionMap.set(sectionMeta.key, {
        key: sectionMeta.key,
        title: sectionMeta.title,
        items: [toCardViewModel(item)],
      });
      return;
    }
    existing.items.push(toCardViewModel(item));
  });

  return Array.from(sectionMap.values());
};
