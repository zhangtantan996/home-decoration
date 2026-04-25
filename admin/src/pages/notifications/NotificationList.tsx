import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Empty, Segmented, Spin, Tag, Typography, message } from 'antd';
import { BellOutlined, CheckOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

import { notificationApi } from '../../services/api';
import { resolveAdminNotificationNavigation } from '../../utils/adminNotificationNavigation';
import { formatServerDateTime } from '../../utils/serverTime';
import { toSafeNotificationContent } from '../../utils/userFacingText';
import styles from './NotificationList.module.css';

interface NotificationItem {
  id: number;
  title: string;
  content: string;
  type: string;
  typeLabel?: string;
  relatedId?: number;
  relatedType?: string;
  isRead: boolean;
  actionUrl?: string;
  createdAt: string;
  actionRequired?: boolean;
  actionStatus?: 'none' | 'pending' | 'processed' | 'expired';
  actionLabel?: string;
}

const NOTIFICATION_LABELS: Record<string, string> = {
  'merchant.application.submitted': '入驻审核',
  'merchant.application.approved': '入驻审核',
  'merchant.application.rejected': '入驻审核',
  'case_audit.approved': '案例审核',
  'case_audit.rejected': '案例审核',
  'refund.application.created': '退款审核',
  'refund.application.approved': '退款处理',
  'refund.application.rejected': '退款处理',
  'refund.succeeded': '退款结果',
  'withdraw.created': '提现审核',
  'project.dispute.created': '争议仲裁',
  'project.audit.completed': '仲裁结果',
  'complaint.created': '投诉处理',
  'complaint.resolved': '投诉处理',
  'booking.created': '预约提醒',
  'booking.confirmed': '预约提醒',
  'booking.cancelled': '预约提醒',
  'booking.intent_paid': '支付提醒',
  'proposal.submitted': '方案提醒',
  'proposal.confirmed': '方案提醒',
  'proposal.rejected': '方案提醒',
  'quote.submitted': '施工报价',
  'quote.confirmed': '施工报价',
  'quote.rejected': '施工报价',
  'quote.awarded': '施工报价',
  'project.milestone.submitted': '阶段验收',
  'project.milestone.approved': '阶段验收',
  'project.milestone.rejected': '阶段验收',
  'project.completion.submitted': '完工验收',
  'project.completion.approved': '完工验收',
  'project.completion.rejected': '完工验收',
  'project.construction_bridge_pending': '施工桥接',
  'project.planned_start_updated': '待开工',
  'project.supervision_risk_escalated': '监理风险',
  'project.settlement.scheduled': '结算提醒',
  'project.payout.processing': '出款提醒',
  'project.payout.paid': '出款提醒',
  'project.payout.failed': '出款提醒',
  'case_audit.created': '案例审核',
  'order.created': '待支付',
  'order.expiring': '待支付',
  'order.expired': '支付失效',
  'payment.construction.pending': '施工付款',
  'payment.construction.stage_pending': '施工付款',
  'payment.construction.final_pending': '施工付款',
  'payment.construction.expiring': '施工付款',
  'payment.construction.expired': '施工付款',
  'change_order.created': '项目变更',
  'change_order.confirmed': '项目变更',
  'change_order.rejected': '项目变更',
  'change_order.payment_pending': '项目变更',
  'change_order.settlement_required': '项目变更',
  'change_order.settled': '项目变更',
};

const resolveTypeLabel = (type: string) => NOTIFICATION_LABELS[type] || '系统通知';

const readTypeLabel = (item: NotificationItem) => String(item.typeLabel || '').trim() || resolveTypeLabel(item.type);

const readActionTag = (item: NotificationItem) => {
  if (item.actionStatus === 'processed') {
    return { label: '已处理', color: 'default' as const };
  }
  if (item.actionStatus === 'expired') {
    return { label: '已过期', color: 'orange' as const };
  }
  if (item.actionRequired && item.actionLabel) {
    return { label: item.actionLabel, color: 'blue' as const };
  }
  if (item.actionLabel) {
    return { label: item.actionLabel, color: 'default' as const };
  }
  return null;
};

const readOpenLabel = (item: NotificationItem) => {
  if (item.actionStatus === 'processed' || item.actionStatus === 'expired') {
    return '查看详情';
  }
  return String(item.actionLabel || '').trim() || '查看详情';
};

type FilterKey = 'all' | 'unread' | 'action' | 'read';

const resolveToneClass = (type: string) => {
  if (type.startsWith('payment.') || type.startsWith('refund.') || type.startsWith('withdraw.') || type.startsWith('order.')) {
    return styles.tonePayment;
  }
  if (type.startsWith('quote.') || type.startsWith('proposal.')) {
    return styles.toneQuote;
  }
  if (type.startsWith('project.') || type.startsWith('change_order.') || type.startsWith('complaint.')) {
    return styles.toneProject;
  }
  if (type.startsWith('merchant.application.') || type.startsWith('case_audit.')) {
    return styles.toneAudit;
  }
  return styles.toneSystem;
};

const isPendingAction = (item: NotificationItem) =>
  Boolean(item.actionRequired && item.actionStatus !== 'processed' && item.actionStatus !== 'expired');

export default function NotificationListPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [globalUnreadCount, setGlobalUnreadCount] = useState(0);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const pageSize = 12;

  const unreadCount = useMemo(() => items.filter((item) => !item.isRead).length, [items]);
  const pendingActionCount = useMemo(() => items.filter(isPendingAction).length, [items]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const filteredItems = useMemo(() => {
    if (activeFilter === 'unread') {
      return items.filter((item) => !item.isRead);
    }
    if (activeFilter === 'read') {
      return items.filter((item) => item.isRead);
    }
    if (activeFilter === 'action') {
      return items.filter(isPendingAction);
    }
    return items;
  }, [activeFilter, items]);

  const loadData = useCallback(async (targetPage = page) => {
    setLoading(true);
    try {
      const [result, unreadResult] = await Promise.all([
        notificationApi.list({ page: targetPage, pageSize }) as Promise<{ data?: { list?: NotificationItem[]; total?: number } }>,
        notificationApi.getUnreadCount() as Promise<{ data?: { count?: number } }>,
      ]);
      setItems(result.data?.list || []);
      setTotal(Number(result.data?.total || 0));
      setGlobalUnreadCount(Number(unreadResult.data?.count || 0));
    } catch (error) {
      console.error('Failed to load admin notifications', error);
      message.error('加载通知失败');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void loadData(page);
  }, [loadData, page]);

  const withMutation = async (action: () => Promise<void>) => {
    setMutating(true);
    try {
      await action();
    } finally {
      setMutating(false);
    }
  };

  const handleOpen = async (item: NotificationItem) => {
    await withMutation(async () => {
      if (!item.isRead) {
        await notificationApi.markAsRead(item.id);
        setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, isRead: true } : entry)));
        setGlobalUnreadCount((current) => Math.max(0, current - 1));
      }
    });
    if (item.actionUrl) {
      const target = resolveAdminNotificationNavigation(item.actionUrl);
      if (!target) {
        message.warning('该通知暂无可跳转页面');
        return;
      }
      if (target.type === 'internal') {
        navigate(target.path);
      } else {
        window.location.assign(target.href);
      }
    }
  };

  const handleMarkAsRead = async (item: NotificationItem) => {
    if (item.isRead) return;
    await withMutation(async () => {
      await notificationApi.markAsRead(item.id);
      setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, isRead: true } : entry)));
      setGlobalUnreadCount((current) => Math.max(0, current - 1));
    });
  };

  const handleMarkAllAsRead = async () => {
    if (!globalUnreadCount) return;
    await withMutation(async () => {
      await notificationApi.markAllAsRead();
      setItems((current) => current.map((entry) => ({ ...entry, isRead: true })));
      setGlobalUnreadCount(0);
    });
  };

  const handleDelete = async (item: NotificationItem) => {
    await withMutation(async () => {
      await notificationApi.delete(item.id);
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      if (!item.isRead) {
        setGlobalUnreadCount((current) => Math.max(0, current - 1));
      }
      setTotal((current) => Math.max(0, current - 1));
      if (items.length === 1 && page > 1) {
        setPage((current) => current - 1);
      }
    });
  };

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <span className={styles.eyebrow}>消息工作台</span>
          <Typography.Title level={2} className={styles.title}>通知中心</Typography.Title>
          <Typography.Text className={styles.subtitle}>
            汇总审核、退款、提现、投诉、仲裁与项目提醒，优先处理未读和待办事项。
          </Typography.Text>
          <div className={styles.heroSummary}>
            <span><strong>{globalUnreadCount}</strong> 未读</span>
            <span><strong>{pendingActionCount}</strong> 本页待处理</span>
            <span><strong>{total}</strong> 全部通知</span>
          </div>
        </div>
        <div className={styles.heroActions}>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void loadData(page)}>刷新</Button>
          <Button
            type="primary"
            icon={<CheckOutlined />}
            disabled={!globalUnreadCount || mutating}
            onClick={() => void handleMarkAllAsRead()}
          >
            全部已读
          </Button>
        </div>
      </section>

      <section className={styles.listPanel}>
        <div className={styles.listToolbar}>
          <div>
            <Typography.Title level={4} className={styles.listTitle}>全部通知</Typography.Title>
            <Typography.Text className={styles.listHint}>按状态筛选后，可直接进入对应业务页面处理。</Typography.Text>
          </div>
          <Segmented
            value={activeFilter}
            onChange={(value) => setActiveFilter(value as FilterKey)}
            options={[
              { label: `全部 ${items.length}`, value: 'all' },
              { label: `未读 ${unreadCount}`, value: 'unread' },
              { label: `待处理 ${pendingActionCount}`, value: 'action' },
              { label: `已读 ${Math.max(0, items.length - unreadCount)}`, value: 'read' },
            ]}
          />
        </div>

        {loading ? (
          <div className={styles.loadingState}><Spin /></div>
        ) : items.length === 0 ? (
          <Empty className={styles.emptyState} description="暂无通知" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : filteredItems.length === 0 ? (
          <Empty className={styles.emptyState} description="当前筛选暂无通知" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <>
            <div className={styles.notificationList}>
              {filteredItems.map((item) => {
                const actionTag = readActionTag(item);
                const typeLabel = readTypeLabel(item);
                const safeContent = toSafeNotificationContent(item.content, item.type);
                return (
                <article
                  className={`${styles.notificationItem} ${item.isRead ? styles.readItem : styles.unreadItem}`}
                  key={item.id}
                >
                  <span className={styles.itemRail} />
                  <div className={`${styles.typeIcon} ${resolveToneClass(item.type)}`}>
                    <BellOutlined />
                  </div>
                  <div className={styles.itemMain}>
                    <div className={styles.itemHeader}>
                      <button
                        className={styles.itemTitle}
                        disabled={!item.actionUrl || mutating}
                        onClick={() => void handleOpen(item)}
                        type="button"
                      >
                        {item.title || typeLabel}
                      </button>
                    </div>
                    <time className={styles.itemTime}>{formatServerDateTime(item.createdAt)}</time>
                    <p className={styles.itemContent}>{safeContent}</p>
                  </div>
                  <div className={styles.itemSide}>
                    <div className={styles.sideMetaRow}>
                      <div className={styles.tagRow}>
                        {!item.isRead ? <Tag color="gold">未读</Tag> : <Tag>已读</Tag>}
                        <Tag color="blue">{typeLabel}</Tag>
                        {actionTag ? <Tag color={actionTag.color}>{actionTag.label}</Tag> : null}
                      </div>
                      {!item.isRead ? (
                        <Button
                          className={styles.readAction}
                          disabled={mutating}
                          size="small"
                          type="default"
                          onClick={() => void handleMarkAsRead(item)}
                        >
                          标记已读
                        </Button>
                      ) : null}
                    </div>
                    <div className={styles.itemActions}>
                      {item.actionUrl ? (
                        <Button disabled={mutating} size="small" type={item.isRead ? 'default' : 'primary'} onClick={() => void handleOpen(item)}>
                          {readOpenLabel(item)}
                        </Button>
                      ) : null}
                      <Button
                        danger
                        icon={<DeleteOutlined />}
                        disabled={mutating}
                        size="small"
                        type="text"
                        onClick={() => void handleDelete(item)}
                      >
                        删除
                      </Button>
                    </div>
                  </div>
                </article>
                );
              })}
            </div>
            <div className={styles.paginationBar}>
              <Typography.Text className={styles.paginationText}>
                第 {Math.min(page, totalPages)} / {totalPages} 页，共 {total} 条
              </Typography.Text>
              <div className={styles.paginationActions}>
                <Button disabled={page <= 1 || mutating} onClick={() => setPage((current) => current - 1)}>上一页</Button>
                <Button disabled={page >= totalPages || mutating} onClick={() => setPage((current) => current + 1)}>下一页</Button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
