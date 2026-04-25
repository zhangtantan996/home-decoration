import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Dropdown, Badge, Button, Empty, Spin, Tag, message } from 'antd';
import { BellOutlined, CheckOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getHandledAdminStatus, notificationApi } from '../services/api';
import { AutoRetryGuard, type AutoRetryPolicy, type TriggerSource } from '../utils/autoRetryGuard';
import {
    buildNotificationRealtimeUrl,
    isNotificationRealtimeEnabled,
    NotificationWebSocket,
} from '../utils/notificationWebSocket';
import { formatServerDate } from '../utils/serverTime';
import { resolveAdminNotificationNavigation } from '../utils/adminNotificationNavigation';
import { toSafeNotificationContent } from '../utils/userFacingText';
import styles from './NotificationDropdown.module.css';

interface Notification {
    id: number;
    title: string;
    content: string;
    type: string;
    typeLabel?: string;
    relatedId: number;
    relatedType: string;
    isRead: boolean;
    actionUrl: string;
    createdAt: string;
    actionRequired?: boolean;
    actionStatus?: 'none' | 'pending' | 'processed' | 'expired';
    actionLabel?: string;
}

type NotificationListResponse = { data?: { list?: Notification[] } };
type UnreadCountResponse = { data?: { count?: number } };

const POLL_INTERVAL_MS = 15000;
const POLL_BUSINESS_KEY = 'admin.notification.unread_poll';
const POLL_POLICY: AutoRetryPolicy = {
    maxAutoAttempts: Number.MAX_SAFE_INTEGER,
    pauseOnConsecutiveFailures: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
};

const ADMIN_NOTIFICATION_TYPE_LABELS: Record<string, string> = {
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
    'complaint.created': '投诉处理',
    'complaint.resolved': '投诉处理',
    'booking.created': '预约提醒',
    'booking.confirmed': '预约提醒',
    'booking.cancelled': '预约提醒',
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

const resolveAdminNotificationLabel = (type: string) => ADMIN_NOTIFICATION_TYPE_LABELS[type] || '系统通知';

const resolveAdminNotificationTypeLabel = (item: Notification) =>
    String(item.typeLabel || '').trim() || resolveAdminNotificationLabel(item.type);

const resolveAdminNotificationActionTag = (item: Notification) => {
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

const resolveAdminNotificationTagColor = (type: string) => {
    if (type.startsWith('payment.') || type.startsWith('refund.') || type.startsWith('withdraw.')) {
        return 'gold';
    }
    if (type.startsWith('change_order.') || type.startsWith('project.') || type.startsWith('complaint.')) {
        return 'blue';
    }
    if (type.startsWith('quote.') || type.startsWith('proposal.')) {
        return 'cyan';
    }
    if (type.startsWith('booking.')) {
        return 'purple';
    }
    if (type.startsWith('merchant.application.') || type.startsWith('case_audit.')) {
        return 'geekblue';
    }
    return 'default';
};

const NotificationDropdown: React.FC = () => {
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const [notificationAvailable, setNotificationAvailable] = useState(true);
    const [pollingPaused, setPollingPaused] = useState(false);
    const authErrorNotifiedRef = useRef(false);
    const unreadPollGuardRef = useRef(new AutoRetryGuard(POLL_POLICY));
    const websocketRef = useRef<NotificationWebSocket | null>(null);
    const openRef = useRef(false);
    const [fallbackToPolling, setFallbackToPolling] = useState(!isNotificationRealtimeEnabled());

    useEffect(() => {
        openRef.current = open;
    }, [open]);

    const handleHandledAuthError = useCallback((status: 401 | 403) => {
        if (status === 401) {
            if (!authErrorNotifiedRef.current) {
                authErrorNotifiedRef.current = true;
            }

            setNotificationAvailable(false);
            setNotifications([]);
            setUnreadCount(0);
            setOpen(false);
        }
    }, []);

    // 加载通知列表（最近5条）
    const loadNotifications = useCallback(async () => {
        if (!notificationAvailable) return;

        try {
            setLoading(true);
            const res = await notificationApi.list({ page: 1, pageSize: 5 }) as NotificationListResponse;
            setNotifications(res.data?.list || []);
        } catch (error: unknown) {
            const handledStatus = getHandledAdminStatus(error);
            if (handledStatus) {
                handleHandledAuthError(handledStatus);
                return;
            }
            console.error('Failed to load notifications', error);
        } finally {
            setLoading(false);
        }
    }, [handleHandledAuthError, notificationAvailable]);

    // 加载未读数量
    const loadUnreadCount = useCallback(async (trigger: TriggerSource = 'auto') => {
        if (!notificationAvailable) return;

        if (trigger === 'manual') {
            unreadPollGuardRef.current.resetByManual();
            setPollingPaused(false);
        } else {
            if (!unreadPollGuardRef.current.shouldAttempt('auto')) {
                setPollingPaused(true);
                const state = unreadPollGuardRef.current.getState();
                console.warn('[AutoRetry]', {
                    businessKey: POLL_BUSINESS_KEY,
                    trigger,
                    pausedReason: 'guard_blocked',
                    attempt: state.autoAttempts,
                });
                return;
            }

            unreadPollGuardRef.current.recordAttempt('auto');
            const state = unreadPollGuardRef.current.getState();
            console.info('[AutoRetry]', {
                businessKey: POLL_BUSINESS_KEY,
                trigger,
                event: 'attempt',
                attempt: state.autoAttempts,
            });
        }

        try {
            const res = await notificationApi.getUnreadCount() as UnreadCountResponse;
            setUnreadCount(res.data?.count || 0);
            unreadPollGuardRef.current.recordSuccess();
            if (pollingPaused) {
                setPollingPaused(false);
                console.info('[AutoRetry]', {
                    businessKey: POLL_BUSINESS_KEY,
                    trigger,
                    event: 'resume_after_success',
                });
            }
        } catch (error: unknown) {
            const handledStatus = getHandledAdminStatus(error);
            if (handledStatus) {
                handleHandledAuthError(handledStatus);
                return;
            }

            unreadPollGuardRef.current.recordFailure(error);
            const state = unreadPollGuardRef.current.getState();
            console.warn('[AutoRetry]', {
                businessKey: POLL_BUSINESS_KEY,
                trigger,
                event: 'failure',
                attempt: state.autoAttempts,
                consecutiveFailures: state.consecutiveFailures,
                paused: state.paused,
                pausedReason: state.paused ? 'consecutive_failures_threshold' : undefined,
            });

            if (state.paused) {
                setPollingPaused(true);
            }

            console.error('Failed to load unread count', error);
        }
    }, [handleHandledAuthError, notificationAvailable, pollingPaused]);

    const handleManualRefresh = useCallback(async () => {
        if (!notificationAvailable) return;

        unreadPollGuardRef.current.resetByManual();
        setPollingPaused(false);

        console.info('[AutoRetry]', {
            businessKey: POLL_BUSINESS_KEY,
            trigger: 'manual',
            event: 'manual_refresh',
        });

        await Promise.allSettled([
            loadUnreadCount('manual'),
            loadNotifications(),
        ]);
    }, [loadNotifications, loadUnreadCount, notificationAvailable]);

    useEffect(() => {
        if (!notificationAvailable || pollingPaused || !fallbackToPolling) return;

        void loadUnreadCount('auto');
        // 每15秒刷新一次未读数量
        const interval = setInterval(() => {
            void loadUnreadCount('auto');
        }, POLL_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [fallbackToPolling, loadUnreadCount, notificationAvailable, pollingPaused]);

    useEffect(() => {
        if (!notificationAvailable) {
            websocketRef.current?.disconnect();
            websocketRef.current = null;
            setFallbackToPolling(true);
            return;
        }

        if (!isNotificationRealtimeEnabled()) {
            setFallbackToPolling(true);
            return;
        }

        const token = localStorage.getItem('admin_token');
        if (!token) {
            setFallbackToPolling(true);
            return;
        }

        const websocket = new NotificationWebSocket({
            url: buildNotificationRealtimeUrl(token),
            onConnected: () => {
                setFallbackToPolling(false);
            },
            onDisconnected: () => {
                setFallbackToPolling(true);
            },
            onNewNotification: () => {
                if (!openRef.current) {
                    setUnreadCount(prev => prev + 1);
                    return;
                }

                void loadNotifications();
            },
            onUnreadCountUpdate: (count) => {
                setUnreadCount(count);
                if (openRef.current) {
                    void loadNotifications();
                }
            },
        });

        websocketRef.current = websocket;
        websocket.connect();

        return () => {
            websocket.disconnect();
            if (websocketRef.current === websocket) {
                websocketRef.current = null;
            }
        };
    }, [loadNotifications, notificationAvailable]);

    // 打开下拉框时加载通知
    useEffect(() => {
        if (open && notificationAvailable) {
            loadNotifications();
        }
    }, [loadNotifications, notificationAvailable, open]);

    // 标记为已读
    const handleMarkAsRead = async (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await notificationApi.markAsRead(id);
            setNotifications(prev =>
                prev.map(item => (item.id === id ? { ...item, isRead: true } : item))
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
            message.success('已标记为已读');
        } catch {
            message.error('操作失败');
        }
    };

    // 标记全部已读
    const handleMarkAllAsRead = async () => {
        try {
            await notificationApi.markAllAsRead();
            setNotifications(prev => prev.map(item => ({ ...item, isRead: true })));
            setUnreadCount(0);
            message.success('已全部标记为已读');
        } catch {
            message.error('操作失败');
        }
    };

    // 删除通知
    const handleDelete = async (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await notificationApi.delete(id);
            setNotifications(prev => prev.filter(item => item.id !== id));
            void loadUnreadCount('manual');
            message.success('删除成功');
        } catch {
            message.error('删除失败');
        }
    };

    // 格式化时间
    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return '刚刚';
        if (minutes < 60) return `${minutes}分钟前`;
        if (hours < 24) return `${hours}小时前`;
        if (days < 7) return `${days}天前`;
        return formatServerDate(dateString);
    };

    // 点击通知项
    const handleNotificationClick = async (item: Notification) => {
        try {
            // 标记为已读
            if (!item.isRead) {
                await notificationApi.markAsRead(item.id);
                setNotifications(prev =>
                    prev.map(n => (n.id === item.id ? { ...n, isRead: true } : n))
                );
                setUnreadCount(prev => Math.max(0, prev - 1));
            }

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
        } catch (error: unknown) {
            const handledStatus = getHandledAdminStatus(error);
            if (handledStatus) {
                handleHandledAuthError(handledStatus);
                return;
            }
            message.error('操作失败');
        } finally {
            setOpen(false);
        }
    };

    const dropdownContent = (
        <div className={styles.panel}>
            <div className={styles.header}>
                <div>
                    <div className={styles.title}>通知</div>
                    <div className={styles.subtitle}>
                        {unreadCount > 0 ? `${unreadCount} 条未读消息` : '暂无未读消息'}
                    </div>
                </div>
                <div className={styles.headerActions}>
                    <Button
                        type="text"
                        size="small"
                        icon={<ReloadOutlined />}
                        loading={loading}
                        onClick={() => void handleManualRefresh()}
                        title="刷新通知"
                        aria-label="刷新通知"
                        className={styles.iconButton}
                    />
                    {unreadCount > 0 && (
                        <Button
                            type="link"
                            size="small"
                            icon={<CheckOutlined />}
                            onClick={handleMarkAllAsRead}
                            className={styles.linkButton}
                        >
                            全部已读
                        </Button>
                    )}
                    <Button
                        type="link"
                        size="small"
                        onClick={() => {
                            setOpen(false);
                            navigate('/notifications');
                        }}
                        className={styles.linkButton}
                    >
                        查看全部
                    </Button>
                </div>
            </div>

            <div className={styles.list}>
                {loading ? (
                    <div className={styles.loading}>
                        <Spin />
                    </div>
                ) : notifications.length === 0 ? (
                    <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="暂无通知"
                        className={styles.empty}
                    />
                ) : (
                    notifications.map(item => {
                        const actionTag = resolveAdminNotificationActionTag(item);
                        const typeLabel = resolveAdminNotificationTypeLabel(item);
                        return (
                            <div
                                key={item.id}
                                onClick={() => handleNotificationClick(item)}
                                className={`${styles.item} ${item.isRead ? styles.readItem : styles.unreadItem}`}
                            >
                                <div className={styles.itemRail} />
                                <div className={styles.itemMain}>
                                    <div className={styles.itemHeader}>
                                        <div className={styles.itemTitle}>{item.title || typeLabel}</div>
                                        {!item.isRead ? <span className={styles.unreadDot} aria-label="未读" /> : null}
                                    </div>
                                    <div className={styles.tagLine}>
                                        <Tag
                                            color={resolveAdminNotificationTagColor(item.type)}
                                            className={styles.tag}
                                        >
                                            {typeLabel}
                                        </Tag>
                                        {actionTag ? (
                                            <Tag color={actionTag.color} className={styles.tag}>
                                                {actionTag.label}
                                            </Tag>
                                        ) : null}
                                    </div>
                                    <div className={styles.itemContent}>
                                        {toSafeNotificationContent(item.content, item.type)}
                                    </div>
                                    <div className={styles.itemTime}>{formatTime(item.createdAt)}</div>
                                </div>
                                <div className={styles.itemActions}>
                                    {!item.isRead && (
                                        <Button
                                            type="text"
                                            size="small"
                                            icon={<CheckOutlined />}
                                            onClick={(e) => handleMarkAsRead(item.id, e)}
                                            className={styles.itemButton}
                                            title="标记已读"
                                            aria-label="标记已读"
                                        />
                                    )}
                                    <Button
                                        type="text"
                                        size="small"
                                        danger
                                        icon={<DeleteOutlined />}
                                        onClick={(e) => handleDelete(item.id, e)}
                                        className={styles.itemButton}
                                        title="删除通知"
                                        aria-label="删除通知"
                                    />
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );

    return (
        <Dropdown
            menu={{ items: [] }}
            popupRender={() => dropdownContent}
            trigger={['click']}
            open={open}
            onOpenChange={setOpen}
            placement="bottomRight"
            disabled={!notificationAvailable}
        >
            <Badge count={notificationAvailable ? unreadCount : 0} offset={[-8, 8]} size="small" className="hz-notification-badge">
                <Button
                    type="text"
                    icon={<BellOutlined style={{ fontSize: 18 }} />}
                    className="hz-notification-trigger"
                    style={{ border: 'none', boxShadow: 'none' }}
                    disabled={!notificationAvailable}
                />
            </Badge>
        </Dropdown>
    );
};

export default NotificationDropdown;
