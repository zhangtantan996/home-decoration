import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Empty } from '@/components/Empty';
import { NotificationActionBar } from '@/components/NotificationActionBar';
import { NotificationFactRows } from '@/components/NotificationFactRows';
import { NotificationSurfaceHero } from '@/components/NotificationSurfaceHero';
import { NotificationSurfaceShell } from '@/components/NotificationSurfaceShell';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import {
  confirmProjectChangeOrder,
  getProjectDetail,
  listProjectChangeOrders,
  rejectProjectChangeOrder,
  type ProjectChangeOrder,
} from '@/services/projects';
import { showErrorToast } from '@/utils/error';
import { getPageBottomSpacerStyle } from '@/utils/fixedLayout';
import { formatServerDateTime } from '@/utils/serverTime';

const statusMeta = (status?: string) => {
  switch (status) {
    case 'pending_user_confirm':
      return { text: '待确认', variant: 'warning' as const };
    case 'user_confirmed':
      return { text: '已确认', variant: 'brand' as const };
    case 'user_rejected':
      return { text: '已拒绝', variant: 'error' as const };
    case 'admin_settlement_required':
      return { text: '待平台结算', variant: 'brand' as const };
    case 'settled':
      return { text: '已结算', variant: 'brand' as const };
    case 'cancelled':
      return { text: '已取消', variant: 'default' as const };
    default:
      return { text: status || '待处理', variant: 'default' as const };
  }
};

const formatCurrency = (value?: number | string) => {
  const amount = Number(value || 0);
  if (!amount) {
    return '无';
  }
  return `¥${amount.toLocaleString()}`;
};

const ProjectChangeRequestPage: React.FC = () => {
  const [projectId, setProjectId] = useState(0);
  const [loading, setLoading] = useState(true);
  const [projectName, setProjectName] = useState('');
  const [items, setItems] = useState<ProjectChangeOrder[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const pageBottomStyle = useMemo(() => getPageBottomSpacerStyle(), []);

  const loadData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [project, changeOrders] = await Promise.all([
        getProjectDetail(projectId),
        listProjectChangeOrders(projectId),
      ]);
      setProjectName(project.name || `项目 #${projectId}`);
      setItems(changeOrders || []);
      setSelectedId((prev) => prev || changeOrders?.[0]?.id || null);
    } catch (error) {
      showErrorToast(error, '加载变更单失败');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useLoad((options) => {
    const id = Number(options.id || 0);
    if (id > 0) {
      setProjectId(id);
    }
  });

  useEffect(() => {
    if (!projectId) return;
    void loadData();
  }, [loadData, projectId]);

  const pendingItems = useMemo(
    () => items.filter((item) => item.status === 'pending_user_confirm'),
    [items],
  );
  const selected = items.find((item) => item.id === selectedId) || items[0] || null;
  const selectedStatus = statusMeta(selected?.status);

  const handleConfirm = (item: ProjectChangeOrder) => {
    Taro.showModal({
      title: '确认变更',
      content: `确认接受“${item.title || `变更单 #${item.id}`}”吗？如涉及增项，系统会生成对应待支付计划。`,
      success: async (result) => {
        if (!result.confirm) return;
        try {
          await confirmProjectChangeOrder(item.id);
          Taro.showToast({ title: '已确认变更', icon: 'success' });
          await loadData();
        } catch (error) {
          showErrorToast(error, '确认失败');
        }
      },
    });
  };

  const handleReject = (item: ProjectChangeOrder) => {
    Taro.showModal({
      title: '拒绝变更',
      content: `确认拒绝“${item.title || `变更单 #${item.id}`}”吗？`,
      success: async (result) => {
        if (!result.confirm) return;
        try {
          await rejectProjectChangeOrder(item.id, { reason: '业主暂不接受当前变更方案' });
          Taro.showToast({ title: '已拒绝变更', icon: 'success' });
          await loadData();
        } catch (error) {
          showErrorToast(error, '拒绝失败');
        }
      },
    });
  };

  if (loading) {
    return (
      <View className="page bg-gray-50 min-h-screen p-md">
        <Skeleton height={120} className="mb-md" />
        <Skeleton height={220} />
      </View>
    );
  }

  return (
    <NotificationSurfaceShell className="page bg-gray-50 min-h-screen" style={pageBottomStyle}>
      <ScrollView scrollY className="h-full">
        <View className="notification-surface-shell__body">
          <NotificationSurfaceHero
            eyebrow="项目变更"
            title={projectName || '项目变更单'}
            subtitle={selected ? selected.title || `变更单 #${selected.id}` : `项目 #${projectId}`}
            status={selected ? <Tag variant={selectedStatus.variant}>{selectedStatus.text}</Tag> : undefined}
            summary={selected?.description || selected?.reason || '先选择当前变更单，再查看变更影响'}
            metrics={[
              { label: '全部变更', value: `${items.length}` },
              { label: '待确认', value: `${pendingItems.length}`, emphasis: true },
            ]}
          />

          {!items.length ? (
            <Card className="notification-surface-card" title="当前状态">
              <Empty description="当前项目还没有正式变更单" />
            </Card>
          ) : (
            <>
              <Card className="notification-surface-card" title="变更列表">
                <ScrollView scrollX className="notification-object-selector">
                  {items.map((item) => {
                    const itemStatus = statusMeta(item.status);
                    const active = item.id === selected?.id;
                    return (
                      <View
                        key={item.id}
                        className={`notification-object-selector__item ${active ? 'is-active' : ''}`}
                        onClick={() => setSelectedId(item.id)}
                      >
                        <Text className="notification-object-selector__title">{item.title || `变更单 #${item.id}`}</Text>
                        <Text className="notification-object-selector__meta">{itemStatus.text}</Text>
                      </View>
                    );
                  })}
                </ScrollView>
              </Card>

              {selected ? (
                <Card className="notification-surface-card" title="当前变更影响">
                  <NotificationFactRows
                    items={[
                      { label: '当前状态', value: selectedStatus.text },
                      { label: '金额影响', value: formatCurrency(selected.amountImpact) },
                      {
                        label: '工期影响',
                        value: selected.timelineImpact ? `${selected.timelineImpact} 天` : '无',
                      },
                      { label: '创建时间', value: formatServerDateTime(selected.createdAt, '--') },
                      {
                        label: '变更原因',
                        value: selected.reason || '未填写变更原因',
                        multiline: true,
                      },
                      {
                        label: '变更说明',
                        value: selected.description || '暂无补充说明',
                        multiline: true,
                      },
                    ]}
                  />
                </Card>
              ) : null}

              {selected?.userRejectReason ? (
                <Card className="notification-surface-card" title="最近一次拒绝原因">
                  <Text className="notification-section-row__note is-danger">{selected.userRejectReason}</Text>
                </Card>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>

      {selected?.status === 'pending_user_confirm' ? (
        <NotificationActionBar>
          <Button variant="secondary" onClick={() => handleReject(selected)}>
            拒绝变更
          </Button>
          <Button variant="primary" onClick={() => handleConfirm(selected)}>
            确认变更
          </Button>
        </NotificationActionBar>
      ) : null}
    </NotificationSurfaceShell>
  );
};

export default ProjectChangeRequestPage;
