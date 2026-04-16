import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';
import { Button } from '@nutui/nutui-react-taro';

import { Empty } from '@/components/Empty';
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

const ProjectChangeRequestPage: React.FC = () => {
  const [projectId, setProjectId] = useState(0);
  const [loading, setLoading] = useState(true);
  const [projectName, setProjectName] = useState('');
  const [items, setItems] = useState<ProjectChangeOrder[]>([]);

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
    <View className="page bg-gray-50 min-h-screen">
      <ScrollView scrollY className="h-full">
        <View className="bg-white p-md mb-md">
          <View className="text-xl font-bold mb-xs">{projectName || '项目变更单'}</View>
          <View className="text-sm text-gray-500">这里只展示已经进入项目主链的正式变更单，增项确认后会生成待支付计划，减项会进入平台人工结算。</View>
          <View className="flex" style={{ gap: '12rpx', marginTop: '20rpx', flexWrap: 'wrap' }}>
            <Tag variant="brand">{`全部 ${items.length}`}</Tag>
            <Tag variant={pendingItems.length ? 'warning' : 'default'}>{`待确认 ${pendingItems.length}`}</Tag>
          </View>
        </View>

        {!items.length ? (
          <View className="p-md">
            <Empty description="当前项目还没有正式变更单" />
          </View>
        ) : (
          <View className="p-md" style={{ display: 'flex', flexDirection: 'column', gap: '24rpx' }}>
            {items.map((item) => {
              const status = statusMeta(item.status);
              const title = item.title || `变更单 #${item.id}`;
              return (
                <View key={item.id} className="bg-white rounded-xl p-md">
                  <View className="flex items-center justify-between mb-sm" style={{ gap: '16rpx' }}>
                    <View>
                      <View className="text-base font-bold">{title}</View>
                      <Text className="text-xs text-gray-500">{formatServerDateTime(item.createdAt)}</Text>
                    </View>
                    <Tag variant={status.variant}>{status.text}</Tag>
                  </View>
                  <View className="text-sm text-gray-700 mb-xs">{`变更原因：${item.reason || '未填写'}`}</View>
                  {item.description ? <View className="text-sm text-gray-500 mb-xs">{`补充说明：${item.description}`}</View> : null}
                  {item.amountImpact ? <View className="text-sm text-gray-500 mb-xs">{`金额影响：¥${Number(item.amountImpact).toLocaleString()}`}</View> : null}
                  {item.timelineImpact ? <View className="text-sm text-gray-500 mb-xs">{`工期影响：${item.timelineImpact} 天`}</View> : null}
                  {item.userRejectReason ? <View className="text-sm text-red-500 mb-xs">{`拒绝原因：${item.userRejectReason}`}</View> : null}
                  {item.settlementReason ? <View className="text-sm text-gray-500 mb-xs">{`结算说明：${item.settlementReason}`}</View> : null}
                  {item.status === 'pending_user_confirm' ? (
                    <View className="flex" style={{ gap: '16rpx', marginTop: '20rpx' }}>
                      <View className="flex-1">
                        <Button type="primary" block onClick={() => handleConfirm(item)}>确认变更</Button>
                      </View>
                      <View className="flex-1">
                        <Button type="default" block onClick={() => handleReject(item)}>拒绝变更</Button>
                      </View>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

export default ProjectChangeRequestPage;
