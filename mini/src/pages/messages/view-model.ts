import type { IconName } from '@/components/Icon';
import type { NotificationItem } from '@/services/notifications';
import { formatServerRelativeTime, getServerTimeMs } from '@/utils/serverTime';
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
  iconName: IconName;
  visualTone: 'orange' | 'green' | 'blue' | 'gray';
  isRead: boolean;
  timeLabel: string;
  canNavigate: boolean;
  actionText: string;
  actionTone: 'project' | 'payment' | 'system' | 'neutral';
  actionStatus: 'none' | 'pending' | 'processed' | 'expired';
  statusLabel: string;
  statusTone: 'neutral' | 'brand' | 'danger' | 'success';
  isActionable: boolean;
  priority: 'normal' | 'high' | 'urgent';
}

export interface NotificationSectionViewModel {
  key: string;
  title: '待处理' | '最近更新' | '更早';
  items: NotificationCardViewModel[];
}

const FILTER_LABELS: Record<NotificationFilterKey, string> = {
  all: '全部',
  project: '项目',
  payment: '支付',
  system: '系统',
};

const resolveNotificationTone = (item: NotificationItem): NotificationTone => {
  if (item.category === 'project' || item.category === 'payment' || item.category === 'system') {
    return item.category;
  }

  const haystack = [item.type, item.title, item.content, item.actionUrl]
    .map((value) => String(value || '').toLowerCase())
    .join(' ');

  if (/(project|项目|预约|booking|量房|设计|施工|验收|进度|milestone|phase|quote|deliverable|contract|bridge|桥接|monitor|supervision|投诉|change|变更|proposal|方案)/.test(haystack)) {
    return 'project';
  }

  if (/(order|订单|payment|支付|deposit|账单|expire|失效|refund|退款|withdraw|settlement|结算|payout|出款)/.test(haystack)) {
    return 'payment';
  }

  return 'system';
};

const readTypeLabel = (item: NotificationItem, tone: NotificationTone) => {
  const value = String(item.typeLabel || '').trim();
  return value || FILTER_LABELS[tone];
};

const resolveNotificationIcon = (item: NotificationItem, tone: NotificationTone): IconName => {
  const haystack = [item.type, item.title, item.content, item.actionUrl, item.typeLabel]
    .map((value) => String(value || '').toLowerCase())
    .join(' ');

  if (/(合同|contract|方案|proposal|交付|deliverable|设计)/.test(haystack)) {
    return 'identity';
  }
  if (/(退款|payment|支付|订单|deposit|settlement|结算)/.test(haystack)) {
    return 'orders';
  }
  if (/(进度|施工|验收|量房|project|booking|site)/.test(haystack)) {
    return 'progress';
  }
  if (tone === 'payment') {
    return 'orders';
  }
  if (tone === 'project') {
    return 'progress';
  }
  return 'notification';
};

const resolveNotificationVisualTone = (item: NotificationItem): 'orange' | 'green' | 'blue' | 'gray' => {
  const haystack = [item.type, item.title, item.content, item.actionUrl, item.typeLabel]
    .map((value) => String(value || '').toLowerCase())
    .join(' ');

  if (/(报价|quote|待确认|待处理|变更|change|即将过期|过期)/.test(haystack)) {
    return 'orange';
  }
  if (/(已完成|accepted|paid|已支付|交付|deliverable|方案)/.test(haystack)) {
    return 'green';
  }
  if (/(支付|payment|订单|退款|预约|项目|施工|量房|project|booking)/.test(haystack)) {
    return 'blue';
  }
  return 'gray';
};

const resolveStatusMeta = (item: NotificationItem) => {
  if (item.actionStatus === 'processed') {
    return { label: '已处理', tone: 'success' as const, actionable: false };
  }
  if (item.actionStatus === 'expired') {
    return { label: '已过期', tone: 'danger' as const, actionable: false };
  }
  if (item.actionRequired || item.actionStatus === 'pending') {
    return { label: '待处理', tone: 'brand' as const, actionable: true };
  }
  if (item.kind === 'risk') {
    return { label: '需关注', tone: 'danger' as const, actionable: Boolean(item.actionLabel) };
  }
  if (item.kind === 'result') {
    return { label: '有结果', tone: 'success' as const, actionable: Boolean(item.actionLabel) };
  }
  return { label: '已更新', tone: 'neutral' as const, actionable: Boolean(item.actionLabel) };
};

const readActionText = (item: NotificationItem, canNavigate: boolean) => {
  if (item.actionStatus === 'processed' || item.actionStatus === 'expired') {
    return '';
  }
  const actionLabel = String(item.actionLabel || '').trim();
  if (actionLabel) {
    return actionLabel;
  }
  if (item.actionRequired) {
    return canNavigate ? '立即处理' : '';
  }
  return canNavigate ? '查看' : '';
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

const isRecentNotification = (item: NotificationItem) => {
  const createdAt = getServerTimeMs(item.createdAt);
  if (createdAt <= 0) {
    return false;
  }
  const diff = Date.now() - createdAt;
  return diff <= 7 * 24 * 60 * 60 * 1000;
};

const toCardViewModel = (item: NotificationItem): NotificationCardViewModel => {
  const typeTone = resolveNotificationTone(item);
  const canNavigate = Boolean(resolveMiniNotificationRoute(item.actionUrl));
  const statusMeta = resolveStatusMeta(item);
  const actionTone =
    item.actionStatus === 'processed' || item.actionStatus === 'expired'
      ? 'neutral'
      : typeTone === 'payment'
        ? 'payment'
        : typeTone === 'project'
          ? 'project'
          : 'system';

  return {
    id: item.id,
    raw: item,
    title: item.title || '未命名通知',
    content: item.content || '暂无更多说明',
    typeTone,
    typeLabel: readTypeLabel(item, typeTone),
    iconName: resolveNotificationIcon(item, typeTone),
    visualTone: resolveNotificationVisualTone(item),
    isRead: Boolean(item.isRead),
    timeLabel: formatServerRelativeTime(item.createdAt, '--'),
    canNavigate,
    actionText: readActionText(item, canNavigate),
    actionTone,
    actionStatus: item.actionStatus || 'none',
    statusLabel: statusMeta.label,
    statusTone: statusMeta.tone,
    isActionable: statusMeta.actionable,
    priority: item.priority || 'normal',
  };
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

  const pending = filtered
    .filter(isPendingNotification)
    .sort((left, right) => {
      const priorityDiff = getPriorityWeight(right) - getPriorityWeight(left);
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      return getServerTimeMs(right.createdAt) - getServerTimeMs(left.createdAt);
    })
    .map(toCardViewModel);

  const regular = filtered.filter((item) => !isPendingNotification(item));
  const recent = regular.filter(isRecentNotification).map(toCardViewModel);
  const earlier = regular.filter((item) => !isRecentNotification(item)).map(toCardViewModel);

  return [
    pending.length > 0 ? { key: 'pending', title: '待处理' as const, items: pending } : null,
    recent.length > 0 ? { key: 'recent', title: '最近更新' as const, items: recent } : null,
    earlier.length > 0 ? { key: 'earlier', title: '更早' as const, items: earlier } : null,
  ].filter(Boolean) as NotificationSectionViewModel[];
};
