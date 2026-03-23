import { useSessionStore } from '../modules/session/sessionStore';
import type { SessionUser } from '../types/api';
import type { ProfileFeedItemVM, ProfileHomeVM, ProfileShortcutVM } from '../types/viewModels';
import { formatDateTime } from '../utils/format';
import { listDemands } from './demands';
import { requestJson } from './http';
import { listBookings } from './bookings';
import { listNotifications } from './notifications';
import { listOrders } from './orders';
import { listProjects } from './projects';
import { listProposals } from './proposals';
import { getUserSettings } from './settings';

interface RawProfile {
  id: number;
  publicId?: string;
  phone?: string;
  nickname?: string;
  avatar?: string;
  birthday?: string;
  bio?: string;
  userType?: number;
}

function toMessageFeed(item: Awaited<ReturnType<typeof listNotifications>>['list'][number]): ProfileFeedItemVM {
  return {
    id: item.id,
    title: item.title,
    subtitle: item.isRead ? '已读通知' : '未读通知',
    meta: item.createdAt,
    href: item.actionUrl || undefined,
  };
}

function toOrderFeed(item: Awaited<ReturnType<typeof listOrders>>['list'][number]): ProfileFeedItemVM {
  return {
    id: item.id,
    title: item.orderNo,
    subtitle: item.statusText,
    meta: `${item.amountText} · ${item.providerName}`,
    href: item.projectId ? `/projects/${item.projectId}` : item.proposalId ? `/proposals/${item.proposalId}` : undefined,
  };
}

function makeSettingsSummary(settings: Awaited<ReturnType<typeof getUserSettings>> | null) {
  if (!settings) {
    return ['项目提醒默认开启', '支付提醒默认开启', '当前语言 中文'];
  }

  return [
    settings.notifyProject ? '项目提醒已开启' : '项目提醒已关闭',
    settings.notifyPayment ? '支付提醒已开启' : '支付提醒已关闭',
    settings.language === 'en' ? '当前语言 English' : '当前语言 中文',
    `字体偏好 ${settings.fontSize || 'medium'}`,
  ];
}

function buildShortcuts(input: {
  bookings: Awaited<ReturnType<typeof listBookings>>;
  demands: Awaited<ReturnType<typeof listDemands>>['list'];
  proposals: Awaited<ReturnType<typeof listProposals>>;
  projects: Awaited<ReturnType<typeof listProjects>>['list'];
  orders: Awaited<ReturnType<typeof listOrders>>['list'];
  messages: Awaited<ReturnType<typeof listNotifications>>['list'];
  settingsSummary: string[];
}): ProfileShortcutVM[] {
  return [
    {
      key: 'overview',
      title: '概览',
      description: '回到首页查看最近进展',
      countText: '首页',
      href: '/me',
    },
    {
      key: 'bookings',
      title: '我的预约',
      description: '查看最近预约与当前状态',
      countText: `${input.bookings.length} 条`,
      href: '/me/bookings',
    },
    {
      key: 'demands',
      title: '我的需求',
      description: '查看审核进度与匹配商家情况',
      countText: `${input.demands.length} 条`,
      href: '/me/demands',
      highlight: input.demands.some((item) => item.status === 'matching' || item.status === 'matched'),
    },
    {
      key: 'proposals',
      title: '我的报价',
      description: '关注是否待确认或已生成订单',
      countText: `${input.proposals.length} 条`,
      href: '/me/proposals',
      highlight: input.proposals.some((item) => item.statusText.includes('待')),
    },
    {
      key: 'projects',
      title: '我的项目',
      description: '直接进入进度看板和里程碑动作',
      countText: `${input.projects.length} 个`,
      href: '/me/projects',
      highlight: input.projects.some((item) => item.statusText.includes('进行中')),
    },
    {
      key: 'orders',
      title: '我的订单',
      description: '查看待支付与历史订单',
      countText: `${input.orders.length} 笔`,
      href: '/me/orders',
      highlight: input.orders.some((item) => item.status === 0),
    },
    {
      key: 'messages',
      title: '我的通知',
      description: '查看最近通知和提醒',
      countText: `${input.messages.filter((item) => !item.isRead).length} 条未读`,
      href: '/me/messages',
      highlight: input.messages.some((item) => !item.isRead),
    },
    {
      key: 'settings',
      title: '账户设置',
      description: input.settingsSummary[0] || '通知与偏好设置',
      countText: '可编辑',
      href: '/me/settings',
    },
  ];
}

export async function getProfileHomeData(): Promise<ProfileHomeVM> {
  const sessionUser = useSessionStore.getState().user;

  const [profile, bookings, demands, proposals, projects, orders, messages, settings] = await Promise.all([
    requestJson<RawProfile>('/user/profile').catch(() => null),
    listBookings().catch(() => []),
    listDemands({ page: 1, pageSize: 6 }).catch(() => ({ list: [], total: 0, page: 1, pageSize: 6 })),
    listProposals().catch(() => []),
    listProjects({ page: 1, pageSize: 6 }).catch(() => ({ list: [], total: 0, page: 1, pageSize: 6 })),
    listOrders({ page: 1, pageSize: 6 }).catch(() => ({ list: [], total: 0, page: 1, pageSize: 6 })),
    listNotifications({ page: 1, pageSize: 6 }).catch(() => ({ list: [], total: 0, page: 1, pageSize: 6 })),
    getUserSettings().catch(() => null),
  ]);

  const effectiveProfile = profile || (sessionUser as SessionUser | null);
  const settingsSummary = makeSettingsSummary(settings);
  const unreadCount = messages.list.filter((item) => !item.isRead).length;
  const pendingPaymentsCount = orders.list.filter((item) => item.status === 0).length;

  return {
    displayName: effectiveProfile?.nickname || '已登录用户',
    avatar: effectiveProfile?.avatar || '',
    unreadCount,
    pendingPaymentsCount,
    summaryCards: [
      { title: '进行中需求', value: `${demands.list.filter((item) => item.status === 'matching' || item.status === 'matched').length}`, description: '审核或匹配中的真实需求', href: '/me/demands' },
      { title: '待确认报价', value: `${proposals.filter((item) => item.statusText.includes('待')).length}`, description: '需要你尽快决定的方案', href: '/me/proposals' },
      { title: '进行中项目', value: `${projects.list.filter((item) => item.statusText.includes('进行中')).length}`, description: '正在推进的施工项目', href: '/me/projects' },
      { title: '待支付订单', value: `${pendingPaymentsCount}`, description: '与报价或阶段付款相关', href: '/me/orders' },
    ],
    todos: [
      { title: '需求进度', value: `${demands.list.filter((item) => item.status === 'submitted' || item.status === 'matching').length}`, description: '查看平台审核和商家响应进度', href: '/me/demands' },
      { title: '待确认报价', value: `${proposals.filter((item) => item.statusText.includes('待')).length}`, description: '优先处理新的报价方案', href: '/me/proposals' },
      { title: '待处理预约', value: `${bookings.filter((item) => item.statusText.includes('待')).length}`, description: '跟进待沟通或待确认预约', href: '/me/bookings' },
      { title: '待支付订单', value: `${pendingPaymentsCount}`, description: '避免设计费或阶段款逾期', href: '/me/orders' },
      { title: '最新通知', value: `${unreadCount}`, description: '查看系统提醒与业务变化', href: '/me/messages' },
    ],
    shortcuts: buildShortcuts({
      bookings,
      demands: demands.list,
      proposals,
      projects: projects.list,
      orders: orders.list,
      messages: messages.list,
      settingsSummary,
    }),
    recentBookings: bookings.slice(0, 3).map((item) => ({
      id: item.id,
      title: item.title,
      subtitle: item.statusText,
      meta: `${item.preferredDate} · ${item.budgetRange}`,
      href: item.href,
    })),
    recentProposals: proposals.slice(0, 3).map((item) => ({
      id: item.id,
      title: item.summary,
      subtitle: item.statusText,
      meta: `${item.designFeeText} · ${item.submittedAt}`,
      href: item.href,
    })),
    activeProjects: projects.list.slice(0, 3).map((item) => ({
      id: item.id,
      title: item.name,
      subtitle: item.currentPhase,
      meta: `${item.statusText} · ${item.budgetText}`,
      href: item.href,
    })),
    pendingPayments: orders.list.slice(0, 3).map(toOrderFeed),
    latestMessages: messages.list.slice(0, 3).map(toMessageFeed),
    settingsSummary,
  };
}

export function formatRecordUpdatedAt(value: string | null | undefined) {
  return formatDateTime(value);
}

export async function updateProfile(data: { nickname?: string; avatar?: string; birthday?: string; bio?: string }) {
  return requestJson<null>('/user/profile', {
    method: 'PUT',
    body: data,
  });
}
