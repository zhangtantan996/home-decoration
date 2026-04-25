import React, { useEffect, useMemo, useState } from 'react';
import { Button, Empty, List, Space, Spin, Tag, message } from 'antd';
import { BellOutlined, DeleteOutlined, EyeOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

import MerchantPageHeader from '../../components/MerchantPageHeader';
import MerchantPageShell from '../../components/MerchantPageShell';
import MerchantSectionCard from '../../components/MerchantSectionCard';
import MerchantStatGrid from '../../components/MerchantStatGrid';
import {
    merchantNotificationDataApi,
    type MerchantNotificationItem,
} from '../../services/merchantApi';
import {
    getMerchantNotificationTagColor,
    MERCHANT_NOTIFICATION_TYPE_LABELS,
} from '../../constants/statuses';
import { formatServerDateTime } from '../../utils/serverTime';

const PAGE_SIZE = 10;

const formatRelativeTime = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value || '-';
    }

    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes} 分钟前`;
    if (hours < 24) return `${hours} 小时前`;
    if (days < 7) return `${days} 天前`;
    return formatServerDateTime(value);
};

const resolveNotificationTypeLabel = (item: MerchantNotificationItem) =>
    String(item.typeLabel || '').trim() || MERCHANT_NOTIFICATION_TYPE_LABELS[item.type] || '系统通知';

const resolveNotificationActionTag = (item: MerchantNotificationItem) => {
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

const resolveOpenLabel = (item: MerchantNotificationItem) => {
    if (item.actionStatus === 'processed' || item.actionStatus === 'expired') {
        return '查看详情';
    }
    return String(item.actionLabel || '').trim() || '查看详情';
};

const MerchantNotifications: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [mutating, setMutating] = useState(false);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [notifications, setNotifications] = useState<MerchantNotificationItem[]>([]);

    const unreadCount = useMemo(
        () => notifications.filter((item) => !item.isRead).length,
        [notifications],
    );
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const loadData = async (targetPage = page) => {
        setLoading(true);
        try {
            const data = await merchantNotificationDataApi.list({ page: targetPage, pageSize: PAGE_SIZE });
            setNotifications(data.list || []);
            setTotal(Number(data.total || 0));
        } catch (error) {
            console.error('Failed to load merchant notifications', error);
            message.error(error instanceof Error ? error.message : '加载通知失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadData(page);
    }, [page]);

    const withMutation = async (action: () => Promise<void>) => {
        setMutating(true);
        try {
            await action();
        } finally {
            setMutating(false);
        }
    };

    const handleMarkAsRead = async (item: MerchantNotificationItem) => {
        if (item.isRead) return;
        await withMutation(async () => {
            await merchantNotificationDataApi.markAsRead(item.id);
            setNotifications((current) =>
                current.map((entry) => (entry.id === item.id ? { ...entry, isRead: true } : entry)),
            );
            message.success('已标记为已读');
        });
    };

    const handleMarkAllAsRead = async () => {
        if (!unreadCount) return;
        await withMutation(async () => {
            await merchantNotificationDataApi.markAllAsRead();
            setNotifications((current) => current.map((entry) => ({ ...entry, isRead: true })));
            message.success('已全部标记为已读');
        });
    };

    const handleDelete = async (item: MerchantNotificationItem) => {
        await withMutation(async () => {
            await merchantNotificationDataApi.delete(item.id);
            const nextTotal = Math.max(0, total - 1);
            setTotal(nextTotal);
            setNotifications((current) => current.filter((entry) => entry.id !== item.id));
            message.success('通知已删除');

            if (notifications.length === 1 && page > 1) {
                setPage((current) => current - 1);
            }
        });
    };

    const handleOpen = async (item: MerchantNotificationItem) => {
        if (!item.isRead) {
            await handleMarkAsRead(item);
        }
        if (item.actionUrl) {
            navigate(item.actionUrl);
        }
    };

    return (
        <MerchantPageShell>
            <MerchantPageHeader
                title="通知中心"
                description="集中处理预约、方案、项目、财务和仲裁相关的站内通知。"
                meta={<Tag color="blue">P2 站内信</Tag>}
                extra={(
                    <Space>
                        <Button icon={<ReloadOutlined />} onClick={() => void loadData(page)}>
                            刷新
                        </Button>
                        <Button disabled={!unreadCount || mutating} type="primary" onClick={() => void handleMarkAllAsRead()}>
                            全部已读
                        </Button>
                    </Space>
                )}
            />

            <MerchantStatGrid
                items={[
                    {
                        label: '当前页通知',
                        value: notifications.length,
                        meta: `第 ${Math.min(page, totalPages)} / ${totalPages} 页`,
                        percent: total ? (notifications.length / Math.max(total, 1)) * 100 : 0,
                        tone: 'blue',
                    },
                    {
                        label: '未读通知',
                        value: unreadCount,
                        meta: unreadCount > 0 ? '建议优先处理未读提醒' : '当前页已全部处理',
                        percent: notifications.length ? (unreadCount / notifications.length) * 100 : 0,
                        tone: unreadCount > 0 ? 'amber' : 'green',
                    },
                    {
                        label: '通知总数',
                        value: total,
                        meta: '支持分页查看历史通知',
                        percent: 100,
                        tone: 'slate',
                    },
                ]}
            />

            <MerchantSectionCard title="通知列表" extra={<BellOutlined />}>
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
                        <Spin size="large" />
                    </div>
                ) : notifications.length === 0 ? (
                    <Empty description="当前没有新的通知提醒" />
                ) : (
                    <>
                        <List
                            itemLayout="vertical"
                            dataSource={notifications}
                            renderItem={(item) => {
                                const actionTag = resolveNotificationActionTag(item);
                                return (
                                <List.Item
                                    key={item.id}
                                    actions={[
                                        !item.isRead ? (
                                            <Button
                                                key={`read-${item.id}`}
                                                icon={<EyeOutlined />}
                                                size="small"
                                                type="link"
                                                disabled={mutating}
                                                onClick={() => void handleMarkAsRead(item)}
                                            >
                                                标记已读
                                            </Button>
                                        ) : (
                                            <span key={`read-${item.id}`} />
                                        ),
                                        item.actionUrl ? (
                                            <Button
                                                key={`open-${item.id}`}
                                                size="small"
                                                type="link"
                                                disabled={mutating}
                                                onClick={() => void handleOpen(item)}
                                            >
                                                {resolveOpenLabel(item)}
                                            </Button>
                                        ) : (
                                            <span key={`open-${item.id}`} />
                                        ),
                                        <Button
                                            key={`delete-${item.id}`}
                                            danger
                                            icon={<DeleteOutlined />}
                                            size="small"
                                            type="link"
                                            disabled={mutating}
                                            onClick={() => void handleDelete(item)}
                                        >
                                            删除
                                        </Button>,
                                    ]}
                                >
                                    <List.Item.Meta
                                        title={(
                                            <Space wrap>
                                                <span>{item.title}</span>
                                                {!item.isRead ? <Tag color="gold">未读</Tag> : <Tag>已读</Tag>}
                                                <Tag color={getMerchantNotificationTagColor(item.type)}>
                                                    {resolveNotificationTypeLabel(item)}
                                                </Tag>
                                                {actionTag ? <Tag color={actionTag.color}>{actionTag.label}</Tag> : null}
                                            </Space>
                                        )}
                                        description={formatRelativeTime(item.createdAt)}
                                    />
                                    <div style={{ color: '#475569', lineHeight: 1.7 }}>{item.content}</div>
                                </List.Item>
                                );
                            }}
                        />

                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 16 }}>
                            <span style={{ color: '#64748b' }}>
                                共 {total} 条通知
                            </span>
                            <Space>
                                <Button disabled={page <= 1 || mutating} onClick={() => setPage((current) => current - 1)}>
                                    上一页
                                </Button>
                                <Button disabled={page >= totalPages || mutating} onClick={() => setPage((current) => current + 1)}>
                                    下一页
                                </Button>
                            </Space>
                        </div>
                    </>
                )}
            </MerchantSectionCard>
        </MerchantPageShell>
    );
};

export default MerchantNotifications;
