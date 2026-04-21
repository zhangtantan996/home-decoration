import type { NotificationItem } from '@/services/notifications';
import {
  formatServerDateTime,
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
  timeLabel: string;
  canNavigate: boolean;
  actionText: string;
  actionStatus: 'none' | 'pending' | 'processed' | 'expired';
  statusLabel: string;
  statusTone: 'neutral' | 'brand' | 'danger' | 'success';
  isActionable: boolean;
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

const readTypeLabel = (item: NotificationItem, tone: NotificationTone) => {
  const value = String(item.typeLabel || '').trim();
  if (value) {
    return value;
  }
  return FILTER_LABELS[tone];
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

  if (/(project|项目|预约|booking|量房|沟通|设计|阶段|施工|验收|进度|milestone|phase|quote|deliverable|contract|bridge|桥接|planned[_ -]?start|monitor|supervision|监理|audit|仲裁|争议|complaint|投诉|change[_ -]?order|变更)/.test(haystack)) {
    return 'project';
  }

  if (/(order|订单|payment|支付|deposit|plan|账单|expire|失效|refund|退款|withdraw|提现|settlement|结算|payout|出款)/.test(haystack)) {
    return 'payment';
  }

  return 'system';
};

const readActionText = (item: NotificationItem, canNavigate: boolean) => {
  if (item.actionStatus === 'processed') {
    return '';
  }
  if (item.actionStatus === 'expired') {
    return '';
  }
  if (item.actionRequired && item.actionLabel) {
    return item.actionLabel;
  }
  if (item.actionLabel) {
    return item.actionLabel;
  }
  return canNavigate ? '查看详情' : '';
};

const resolveStatusMeta = (item: NotificationItem) => {
  if (item.actionStatus === 'processed') {
    return {
      label: '已处理',
      tone: 'success' as const,
      actionable: false,
    };
  }

  if (item.actionStatus === 'expired') {
    return {
      label: '已过期',
      tone: 'neutral' as const,
      actionable: false,
    };
  }

  if (item.priority === 'urgent') {
    return {
      label: '紧急处理',
      tone: 'danger' as const,
      actionable: true,
    };
  }

  if (item.actionRequired || item.actionStatus === 'pending') {
    return {
      label: '待处理',
      tone: 'brand' as const,
      actionable: true,
    };
  }

  return {
    label: item.isRead ? '已读' : '新通知',
    tone: 'neutral' as const,
    actionable: false,
  };
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
  const statusMeta = resolveStatusMeta(item);
  return {
    id: item.id,
    raw: item,
    title: item.title || '未命名通知',
    content: item.content || '暂无更多说明',
    typeTone,
    typeLabel: readTypeLabel(item, typeTone),
    isRead: Boolean(item.isRead),
    timeLabel: formatServerDateTime(item.createdAt, '--'),
    canNavigate: Boolean(miniRoute),
    actionText: readActionText(item, Boolean(miniRoute)),
    actionStatus: item.actionStatus || 'none',
    statusLabel: statusMeta.label,
    statusTone: statusMeta.tone,
    isActionable: statusMeta.actionable,
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

const getPriorityWeight = (item: NotificationItem) => {
  if (item.priority === 'urgent') return 3;
  if (item.priority === 'high') return 2;
  return 1;
};

const isPendingNotification = (item: NotificationItem) => {
  if (item.actionStatus === 'processed' || item.actionStatus === 'expired') {
    return false;
  }
  return Boolean(item.actionRequired) || item.actionStatus === 'pending' || item.priority === 'urgent';
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

  const pendingItems = filtered
    .filter(isPendingNotification)
    .sort((left, right) => {
      const priorityDiff = getPriorityWeight(right) - getPriorityWeight(left);
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      return getServerTimeMs(right.createdAt) - getServerTimeMs(left.createdAt);
    });

  const regularItems = filtered.filter((item) => !isPendingNotification(item));
  const recentItems = regularItems.filter((item) => {
    const sectionMeta = buildSectionMeta(item.createdAt);
    return sectionMeta.key !== 'earlier';
  });
  const earlierItems = regularItems.filter((item) => {
    const sectionMeta = buildSectionMeta(item.createdAt);
    return sectionMeta.key === 'earlier';
  });

  const sections: NotificationSectionViewModel[] = [];

  if (pendingItems.length > 0) {
    sections.push({
      key: 'pending',
      title: '待处理',
      items: pendingItems.map(toCardViewModel),
    });
  }

  if (recentItems.length > 0) {
    sections.push({
      key: 'recent',
      title: '最近更新',
      items: recentItems.map(toCardViewModel),
    });
  }

  if (earlierItems.length > 0) {
    sections.push({
      key: 'earlier',
      title: '更早',
      items: earlierItems.map(toCardViewModel),
    });
  }

  return sections;
};
