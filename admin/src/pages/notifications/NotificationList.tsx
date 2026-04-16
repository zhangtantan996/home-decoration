import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, Empty, List, Space, Spin, Tag, Typography, message } from 'antd';
import { BellOutlined, CheckOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

import { notificationApi } from '../../services/api';
import { formatServerDateTime } from '../../utils/serverTime';

interface NotificationItem {
  id: number;
  title: string;
  content: string;
  type: string;
  relatedId?: number;
  relatedType?: string;
  isRead: boolean;
  actionUrl?: string;
  createdAt: string;
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

export default function NotificationListPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const pageSize = 12;

  const unreadCount = useMemo(() => items.filter((item) => !item.isRead).length, [items]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const loadData = useCallback(async (targetPage = page) => {
    setLoading(true);
    try {
      const result = await notificationApi.list({ page: targetPage, pageSize }) as { data?: { list?: NotificationItem[]; total?: number } };
      setItems(result.data?.list || []);
      setTotal(Number(result.data?.total || 0));
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
      }
    });
    if (item.actionUrl) {
      navigate(item.actionUrl);
    }
  };

  const handleMarkAsRead = async (item: NotificationItem) => {
    if (item.isRead) return;
    await withMutation(async () => {
      await notificationApi.markAsRead(item.id);
      setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, isRead: true } : entry)));
    });
  };

  const handleMarkAllAsRead = async () => {
    if (!unreadCount) return;
    await withMutation(async () => {
      await notificationApi.markAllAsRead();
      setItems((current) => current.map((entry) => ({ ...entry, isRead: true })));
    });
  };

  const handleDelete = async (item: NotificationItem) => {
    await withMutation(async () => {
      await notificationApi.delete(item.id);
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      setTotal((current) => Math.max(0, current - 1));
      if (items.length === 1 && page > 1) {
        setPage((current) => current - 1);
      }
    });
  };

  return (
    <div>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <Typography.Title level={3} style={{ marginBottom: 4 }}>通知中心</Typography.Title>
          <Typography.Text type="secondary">集中处理审核、退款、提现、投诉、仲裁与业务流提醒。</Typography.Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => void loadData(page)}>刷新</Button>
          <Button type="primary" icon={<CheckOutlined />} disabled={!unreadCount || mutating} onClick={() => void handleMarkAllAsRead()}>
            全部已读
          </Button>
        </Space>
      </Space>

      <Space style={{ width: '100%', marginBottom: 16 }} size={16}>
        <Card size="small" style={{ minWidth: 180 }}>
          <Space align="center">
            <BellOutlined />
            <div>
              <div>当前页通知</div>
              <Typography.Title level={4} style={{ margin: 0 }}>{items.length}</Typography.Title>
            </div>
          </Space>
        </Card>
        <Card size="small" style={{ minWidth: 180 }}>
          <Space align="center">
            <Badge count={unreadCount} />
            <div>
              <div>未读通知</div>
              <Typography.Title level={4} style={{ margin: 0 }}>{unreadCount}</Typography.Title>
            </div>
          </Space>
        </Card>
        <Card size="small" style={{ minWidth: 180 }}>
          <div>总页数</div>
          <Typography.Title level={4} style={{ margin: 0 }}>{Math.min(page, totalPages)} / {totalPages}</Typography.Title>
        </Card>
      </Space>

      <Card title="通知列表">
        {loading ? (
          <div style={{ padding: '48px 0', textAlign: 'center' }}><Spin /></div>
        ) : items.length === 0 ? (
          <Empty description="暂无通知" />
        ) : (
          <>
            <List
              itemLayout="vertical"
              dataSource={items}
              renderItem={(item) => (
                <List.Item
                  key={item.id}
                  actions={[
                    item.actionUrl ? <Button key={`open-${item.id}`} type="link" onClick={() => void handleOpen(item)}>查看详情</Button> : <span key={`empty-open-${item.id}`} />,
                    !item.isRead ? <Button key={`read-${item.id}`} type="link" onClick={() => void handleMarkAsRead(item)}>标记已读</Button> : <span key={`readed-${item.id}`} />,
                    <Button key={`delete-${item.id}`} danger type="link" icon={<DeleteOutlined />} onClick={() => void handleDelete(item)}>删除</Button>,
                  ]}
                >
                  <List.Item.Meta
                    title={(
                      <Space wrap>
                        <span>{item.title}</span>
                        {!item.isRead ? <Tag color="gold">未读</Tag> : <Tag>已读</Tag>}
                        <Tag color="blue">{resolveTypeLabel(item.type)}</Tag>
                      </Space>
                    )}
                    description={formatServerDateTime(item.createdAt)}
                  />
                  <Typography.Paragraph style={{ marginBottom: 0 }}>{item.content}</Typography.Paragraph>
                </List.Item>
              )}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
              <Typography.Text type="secondary">共 {total} 条通知</Typography.Text>
              <Space>
                <Button disabled={page <= 1 || mutating} onClick={() => setPage((current) => current - 1)}>上一页</Button>
                <Button disabled={page >= totalPages || mutating} onClick={() => setPage((current) => current + 1)}>下一页</Button>
              </Space>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
