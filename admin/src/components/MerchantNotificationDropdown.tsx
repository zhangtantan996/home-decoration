import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Dropdown, Badge, Button, Empty, Spin, message } from 'antd';
import { BellOutlined, CheckOutlined, DeleteOutlined } from '@ant-design/icons';
import { merchantNotificationApi } from '../services/merchantApi';
import { AutoRetryGuard, type AutoRetryPolicy, type TriggerSource } from '../utils/autoRetryGuard';

interface Notification {
    id: number;
    title: string;
    content: string;
    type: string;
    relatedId: number;
    relatedType: string;
    isRead: boolean;
    actionUrl: string;
    createdAt: string;
}

type NotificationListResponse = { data?: { list?: Notification[] } };
type UnreadCountResponse = { data?: { count?: number } };

const POLL_INTERVAL_MS = 30000;
const POLL_BUSINESS_KEY = 'merchant.notification.unread_poll';
const POLL_POLICY: AutoRetryPolicy = {
    maxAutoAttempts: Number.MAX_SAFE_INTEGER,
    pauseOnConsecutiveFailures: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
};

const getErrorStatus = (error: unknown): number | undefined => {
    if (typeof error !== 'object' || error === null || !('response' in error)) {
        return undefined;
    }

    const response = (error as { response?: { status?: number } }).response;
    return response?.status;
};

const MerchantNotificationDropdown: React.FC = () => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const [notificationAvailable, setNotificationAvailable] = useState(true);
    const [pollingPaused, setPollingPaused] = useState(false);
    const authErrorNotifiedRef = useRef(false);
    const pollPauseNotifiedRef = useRef(false);
    const unreadPollGuardRef = useRef(new AutoRetryGuard(POLL_POLICY));

    const handleAuthError = useCallback(() => {
        if (!authErrorNotifiedRef.current) {
            message.warning('通知权限不可用，已暂停刷新');
            authErrorNotifiedRef.current = true;
        }

        setNotificationAvailable(false);
        setNotifications([]);
        setUnreadCount(0);
        setOpen(false);
    }, []);

    // 加载通知列表（最近5条）
    const loadNotifications = useCallback(async () => {
        if (!notificationAvailable) return;

        try {
            setLoading(true);
            const res = await merchantNotificationApi.list({ page: 1, pageSize: 5 }) as NotificationListResponse;
            setNotifications(res.data?.list || []);
        } catch (error: unknown) {
            const status = getErrorStatus(error);
            if (status === 401 || status === 403) {
                handleAuthError();
                return;
            }
            console.error('Failed to load notifications', error);
        } finally {
            setLoading(false);
        }
    }, [handleAuthError, notificationAvailable]);

    // 加载未读数量
    const loadUnreadCount = useCallback(async (trigger: TriggerSource = 'auto') => {
        if (!notificationAvailable) return;

        if (trigger === 'manual') {
            unreadPollGuardRef.current.resetByManual();
            setPollingPaused(false);
            pollPauseNotifiedRef.current = false;
        } else {
            if (!unreadPollGuardRef.current.shouldAttempt('auto')) {
                setPollingPaused(true);
                if (!pollPauseNotifiedRef.current) {
                    pollPauseNotifiedRef.current = true;
                    message.warning('通知自动刷新已暂停，请手动刷新恢复');
                }
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
            const res = await merchantNotificationApi.getUnreadCount() as UnreadCountResponse;
            setUnreadCount(res.data?.count || 0);

            unreadPollGuardRef.current.recordSuccess();
            if (pollingPaused) {
                setPollingPaused(false);
                pollPauseNotifiedRef.current = false;
                console.info('[AutoRetry]', {
                    businessKey: POLL_BUSINESS_KEY,
                    trigger,
                    event: 'resume_after_success',
                });
            }
        } catch (error: unknown) {
            const status = getErrorStatus(error);
            if (status === 401 || status === 403) {
                handleAuthError();
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
                if (!pollPauseNotifiedRef.current) {
                    pollPauseNotifiedRef.current = true;
                    message.warning('通知自动刷新已暂停，请点击“重试刷新”恢复');
                }
            }

            console.error('Failed to load unread count', error);
        }
    }, [handleAuthError, notificationAvailable, pollingPaused]);

    const handleManualRefresh = useCallback(async () => {
        if (!notificationAvailable) return;

        unreadPollGuardRef.current.resetByManual();
        setPollingPaused(false);
        pollPauseNotifiedRef.current = false;

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
        if (!notificationAvailable || pollingPaused) return;

        void loadUnreadCount('auto');
        // 每30秒刷新一次未读数量
        const interval = setInterval(() => {
            void loadUnreadCount('auto');
        }, POLL_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [loadUnreadCount, notificationAvailable, pollingPaused]);

    // 打开下拉框时加载通知
    useEffect(() => {
        if (open && notificationAvailable) {
            void loadNotifications();
        }
    }, [loadNotifications, notificationAvailable, open]);

    // 标记为已读
    const handleMarkAsRead = async (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await merchantNotificationApi.markAsRead(id);
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
            await merchantNotificationApi.markAllAsRead();
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
            await merchantNotificationApi.delete(id);
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
        return date.toLocaleDateString('zh-CN');
    };

    // 点击通知项
    const handleNotificationClick = async (item: Notification) => {
        try {
            // 标记为已读
            if (!item.isRead) {
                await merchantNotificationApi.markAsRead(item.id);
                setNotifications(prev =>
                    prev.map(n => (n.id === item.id ? { ...n, isRead: true } : n))
                );
                setUnreadCount(prev => Math.max(0, prev - 1));
            }

            // 根据通知类型跳转
            if (item.relatedType === 'booking' && item.relatedId) {
                window.location.href = '/merchant/bookings';
            } else if (item.relatedType === 'proposal' && item.relatedId) {
                window.location.href = '/merchant/proposals';
            } else if (item.relatedType === 'order' && item.relatedId) {
                window.location.href = '/merchant/orders';
            }
        } catch (error: unknown) {
            const status = getErrorStatus(error);
            if (status === 401 || status === 403) {
                handleAuthError();
                return;
            }

            message.error('操作失败');
        } finally {
            setOpen(false);
        }
    };

    // 渲染下拉菜单内容
    const dropdownContent = (
        <div style={{ width: 380, maxHeight: 500, overflow: 'auto', backgroundColor: '#fff', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
            {/* Header */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 16, fontWeight: 600, color: '#262626' }}>通知</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {pollingPaused && (
                        <span style={{ fontSize: 12, color: '#fa8c16' }}>自动刷新已暂停</span>
                    )}
                    {pollingPaused && (
                        <Button
                            type="link"
                            size="small"
                            onClick={() => void handleManualRefresh()}
                            style={{ fontSize: 12 }}
                        >
                            重试刷新
                        </Button>
                    )}
                    {unreadCount > 0 && (
                        <Button
                            type="link"
                            size="small"
                            icon={<CheckOutlined />}
                            onClick={handleMarkAllAsRead}
                            style={{ fontSize: 12 }}
                        >
                            全部已读
                        </Button>
                    )}
                </div>
            </div>

            {/* Notification List */}
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                {loading ? (
                    <div style={{ padding: 40, textAlign: 'center' }}>
                        <Spin />
                    </div>
                ) : notifications.length === 0 ? (
                    <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="暂无通知"
                        style={{ padding: 40 }}
                    />
                ) : (
                    notifications.map(item => (
                        <div
                            key={item.id}
                            onClick={() => handleNotificationClick(item)}
                            style={{
                                padding: '12px 16px',
                                borderBottom: '1px solid #f0f0f0',
                                cursor: 'pointer',
                                backgroundColor: item.isRead ? '#fff' : '#f6f9ff',
                                transition: 'background-color 0.3s',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fafafa')}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = item.isRead ? '#fff' : '#f6f9ff')}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ flex: 1, marginRight: 8 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                                        <span style={{
                                            fontSize: 14,
                                            fontWeight: item.isRead ? 400 : 600,
                                            color: item.isRead ? '#595959' : '#262626',
                                        }}>
                                            {item.title}
                                        </span>
                                        {!item.isRead && (
                                            <span style={{
                                                display: 'inline-block',
                                                width: 6,
                                                height: 6,
                                                borderRadius: '50%',
                                                backgroundColor: '#1890ff',
                                                marginLeft: 8,
                                            }} />
                                        )}
                                    </div>
                                    <div style={{
                                        fontSize: 13,
                                        color: '#8c8c8c',
                                        marginBottom: 4,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        display: '-webkit-box',
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: 'vertical',
                                    }}>
                                        {item.content}
                                    </div>
                                    <div style={{ fontSize: 12, color: '#bfbfbf' }}>
                                        {formatTime(item.createdAt)}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 4 }}>
                                    {!item.isRead && (
                                        <Button
                                            type="text"
                                            size="small"
                                            icon={<CheckOutlined />}
                                            onClick={(e) => handleMarkAsRead(item.id, e)}
                                            style={{ padding: '4px 8px' }}
                                        />
                                    )}
                                    <Button
                                        type="text"
                                        size="small"
                                        danger
                                        icon={<DeleteOutlined />}
                                        onClick={(e) => handleDelete(item.id, e)}
                                        style={{ padding: '4px 8px' }}
                                    />
                                </div>
                            </div>
                        </div>
                    ))
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
        >
            <Badge count={unreadCount} offset={[-2, 2]} size="small">
                <Button
                    type="text"
                    icon={<BellOutlined />}
                    style={{ fontSize: 20, border: 'none', boxShadow: 'none' }}
                />
            </Badge>
        </Dropdown>
    );
};

export default MerchantNotificationDropdown;
