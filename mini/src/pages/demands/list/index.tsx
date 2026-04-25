import { useEffect, useState } from 'react';
import { View } from '@tarojs/components';
import Taro, { useReachBottom } from '@tarojs/taro';

import { Button } from '@/components/Button';
import { Empty } from '@/components/Empty';
import { NotificationInboxCell } from '@/components/NotificationInboxCell';
import { NotificationSurfaceShell } from '@/components/NotificationSurfaceShell';
import { PullToRefreshNotice } from '@/components/PullToRefreshNotice';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import { usePullToRefreshFeedback } from '@/hooks/usePullToRefreshFeedback';
import { listDemands, type DemandSummary } from '@/services/demands';
import { useAuthStore } from '@/store/auth';
import { openAuthLoginPage } from '@/utils/authRedirect';
import { showErrorToast } from '@/utils/error';

const PAGE_SIZE = 10;

const sectionStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '16rpx',
};

const cellCardStyle = {
  overflow: 'hidden',
  borderRadius: '28rpx',
  background: 'rgba(255, 255, 255, 0.98)',
  border: '1rpx solid rgba(226, 232, 240, 0.96)',
  boxShadow: '0 10rpx 24rpx rgba(15, 23, 42, 0.04)',
};

const badgeRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '8rpx',
  flexWrap: 'wrap' as const,
};

const toolbarStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '16rpx',
};

const getDemandStatusMeta = (status?: string) => {
  switch (status) {
    case 'matched':
      return { label: '已匹配', variant: 'success' as const, tone: 'success' as const };
    case 'matching':
      return { label: '匹配中', variant: 'primary' as const, tone: 'brand' as const };
    case 'submitted':
    case 'reviewing':
      return { label: '审核中', variant: 'warning' as const, tone: 'brand' as const };
    case 'closed':
      return { label: '已关闭', variant: 'default' as const, tone: 'neutral' as const };
    case 'draft':
    default:
      return { label: '草稿', variant: 'default' as const, tone: 'neutral' as const };
  }
};

const getDemandTypeLabel = (type?: string) => {
  switch (type) {
    case 'renovation':
      return '整装需求';
    case 'design':
      return '设计需求';
    case 'construction':
      return '施工需求';
    default:
      return type || '需求';
  }
};

const formatBudget = (item: DemandSummary) => {
  if (item.budgetMin > 0 && item.budgetMax > 0) {
    return `¥${item.budgetMin.toLocaleString()} - ¥${item.budgetMax.toLocaleString()}`;
  }
  if (item.budgetMax > 0) {
    return `¥${item.budgetMax.toLocaleString()}以内`;
  }
  return '预算待补充';
};

const getDemandSummary = (item: DemandSummary) => {
  if (item.status === 'closed' && item.closedReason) {
    return `关闭原因：${item.closedReason}`;
  }

  if (item.reviewNote) {
    return item.reviewNote;
  }

  const parts = [
    [item.city, item.district].filter(Boolean).join(' · '),
    item.area > 0 ? `${item.area}㎡` : '',
    formatBudget(item),
  ].filter(Boolean);

  return parts.join(' · ');
};

const DemandListPage: React.FC = () => {
  const auth = useAuthStore();
  const [list, setList] = useState<DemandSummary[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);

  const fetchList = async (reset = false) => {
    if (!auth.token) {
      setList([]);
      setPage(1);
      setHasMore(false);
      setLoading(false);
      return;
    }

    if (loading && !reset) {
      return;
    }

    setLoading(true);
    const currentPage = reset ? 1 : page;

    try {
      const result = await listDemands({ page: currentPage, pageSize: PAGE_SIZE });
      const nextList = result.list || [];
      setList((prev) => (reset ? nextList : [...prev, ...nextList]));
      setHasMore(currentPage * PAGE_SIZE < Number(result.total || 0));
      setPage(currentPage + 1);
    } catch (error) {
      showErrorToast(error, '需求列表加载失败');
    } finally {
      setLoading(false);
    }
  };

  const { refreshStatus, drawerHeight, drawerProgress, bindPullToRefresh, runReload } =
    usePullToRefreshFeedback(() => fetchList(true));

  useEffect(() => {
    void runReload();
  }, [auth.token, runReload]);

  useReachBottom(() => {
    if (hasMore && !loading) {
      void fetchList();
    }
  });

  const openCreate = () => {
    if (!auth.token) {
      void openAuthLoginPage('/pages/demands/create/index');
      return;
    }
    Taro.navigateTo({ url: '/pages/demands/create/index' });
  };

  const openDetail = (id: number) => {
    Taro.navigateTo({ url: `/pages/demands/detail/index?id=${id}` });
  };

  if (!auth.token) {
    return (
      <NotificationSurfaceShell className="page bg-gray-50 min-h-screen flex items-center justify-center" {...bindPullToRefresh}>
        <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />
        <Empty
          description="登录后查看我的需求"
          action={{ text: '去登录', onClick: () => void openAuthLoginPage('/pages/demands/list/index') }}
        />
      </NotificationSurfaceShell>
    );
  }

  if (loading && list.length === 0) {
    return (
      <NotificationSurfaceShell className="page bg-gray-50 min-h-screen" {...bindPullToRefresh}>
        <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />
        <View style={sectionStyle}>
          <View style={toolbarStyle}>
            <View className="text-sm text-gray-400">最近更新</View>
            <Button size="small" variant="outline" onClick={openCreate}>新建需求</Button>
          </View>
          <Skeleton height={148} />
          <Skeleton height={148} />
          <Skeleton height={148} />
        </View>
      </NotificationSurfaceShell>
    );
  }

  return (
    <NotificationSurfaceShell className="page bg-gray-50 min-h-screen" {...bindPullToRefresh}>
      <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />

      <View style={sectionStyle}>
        <View style={toolbarStyle}>
          <View className="text-sm text-gray-400">{`共 ${list.length} 条需求`}</View>
          <Button size="small" variant="outline" onClick={openCreate}>新建需求</Button>
        </View>

        {list.length === 0 ? (
          <Empty
            description="还没有提交过需求"
            action={{ text: '去创建', onClick: openCreate }}
          />
        ) : (
          <View style={sectionStyle}>
            {list.map((item) => {
              const statusMeta = getDemandStatusMeta(item.status);
              const matchLabel = item.maxMatch > 0 ? `匹配 ${item.matchedCount}/${item.maxMatch}` : statusMeta.label;
              return (
                <View key={item.id} style={cellCardStyle}>
                  <NotificationInboxCell
                    title={item.title || `需求 #${item.id}`}
                    summary={getDemandSummary(item)}
                    timeLabel={item.updatedAt || item.createdAt || ''}
                    statusLabel={matchLabel}
                    statusTone={statusMeta.tone}
                    typeBadge={
                      <View style={badgeRowStyle}>
                        <Tag variant={statusMeta.variant}>{statusMeta.label}</Tag>
                        <Tag variant="default">{getDemandTypeLabel(item.demandType)}</Tag>
                      </View>
                    }
                    actionText={item.matchedCount > 0 ? '查看匹配' : '查看详情'}
                    actionSecondary={item.matchedCount === 0}
                    actionTone={item.matchedCount > 0 ? 'project' : 'neutral'}
                    onClick={() => openDetail(item.id)}
                    onActionClick={(event) => {
                      event.stopPropagation?.();
                      openDetail(item.id);
                    }}
                  />
                </View>
              );
            })}

            {loading && hasMore ? (
              <View className="text-center text-gray-400 text-xs py-md">加载中...</View>
            ) : null}
          </View>
        )}
      </View>
    </NotificationSurfaceShell>
  );
};

export default DemandListPage;
