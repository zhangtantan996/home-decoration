import React, { useEffect, useMemo, useState } from 'react';
import { View } from '@tarojs/components';
import Taro, { useReachBottom } from '@tarojs/taro';

import { Empty } from '@/components/Empty';
import { NotificationInboxCell } from '@/components/NotificationInboxCell';
import { NotificationSurfaceShell } from '@/components/NotificationSurfaceShell';
import { PullToRefreshNotice } from '@/components/PullToRefreshNotice';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import { getProposalStatus } from '@/constants/status';
import { usePullToRefreshFeedback } from '@/hooks/usePullToRefreshFeedback';
import { listProposals, type ProposalItem } from '@/services/proposals';
import { useAuthStore } from '@/store/auth';
import { showErrorToast } from '@/utils/error';
import { formatServerDate, formatServerDateTime } from '@/utils/serverTime';

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

const versionBadgeStyle = {
  minWidth: '80rpx',
  height: '80rpx',
  padding: '0 10rpx',
  borderRadius: '22rpx',
  background: 'linear-gradient(180deg, #f8fbff 0%, #eef5ff 100%)',
  border: '1rpx solid rgba(37, 99, 235, 0.12)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxSizing: 'border-box' as const,
  color: '#2563EB',
  fontSize: '22rpx',
  fontWeight: 700,
};

const formatCurrency = (value: number) => `¥${Number(value || 0).toLocaleString()}`;

const getStatusTone = (status: number) => {
  const meta = getProposalStatus(status);
  if (meta.variant === 'success') return 'success' as const;
  if (meta.variant === 'error') return 'danger' as const;
  if (meta.variant === 'warning') return 'brand' as const;
  return 'neutral' as const;
};

const getTotalFee = (item: ProposalItem) => (item.designFee || 0) + (item.constructionFee || 0) + (item.materialFee || 0);

const getSummary = (item: ProposalItem) => {
  if (item.status === 3 && item.rejectionReason) {
    return `退回原因：${item.rejectionReason}`;
  }

  const parts = [
    item.summary || '',
    `设计 ${formatCurrency(item.designFee || 0)}`,
    `施工 ${formatCurrency(item.constructionFee || 0)}`,
    `主材 ${formatCurrency(item.materialFee || 0)}`,
    item.estimatedDays > 0 ? `${item.estimatedDays} 天` : '',
  ].filter(Boolean);

  return parts.join(' · ');
};

const ProposalList: React.FC = () => {
  const auth = useAuthStore();
  const [list, setList] = useState<ProposalItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const pendingCount = useMemo(
    () => list.filter((item) => {
      const status = getProposalStatus(item.status);
      return status.label === '待确认';
    }).length,
    [list],
  );

  const fetchList = async (reset = false) => {
    if (!auth.token) {
      setList([]);
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
      const res = await listProposals(currentPage, 10);
      const newList = res.list || [];

      if (reset) {
        setList(newList);
      } else {
        setList((prev) => [...prev, ...newList]);
      }

      setHasMore(newList.length === 10);
      setPage(currentPage + 1);
    } catch (error) {
      showErrorToast(error, '加载失败');
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

  const handleDetail = (id: number) => {
    Taro.navigateTo({
      url: `/pages/proposals/detail/index?id=${id}`,
    });
  };

  return (
    <NotificationSurfaceShell className="page bg-gray-50 min-h-screen" {...bindPullToRefresh}>
      <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />
      {!auth.token ? (
        <Empty
          description="登录后查看设计方案"
          action={{ text: '去登录', onClick: () => Taro.switchTab({ url: '/pages/profile/index' }) }}
        />
      ) : loading && list.length === 0 ? (
        <View style={sectionStyle}>
          <Skeleton height={148} />
          <Skeleton height={148} />
        </View>
      ) : list.length > 0 ? (
        <View style={sectionStyle}>
          {pendingCount > 0 ? (
            <View style={cellCardStyle}>
              <NotificationInboxCell
                title="待确认方案"
                summary={`当前有 ${pendingCount} 份方案等待处理`}
                statusLabel="确认后才会继续推进后续报价流程"
                statusTone="brand"
                typeBadge={
                  <View style={badgeRowStyle}>
                    <Tag variant="warning">待处理</Tag>
                  </View>
                }
              />
            </View>
          ) : null}

          {list.map((item) => {
            const status = getProposalStatus(item.status);
            const totalFee = getTotalFee(item);

            return (
              <View key={item.id} style={cellCardStyle}>
                <NotificationInboxCell
                  title={`方案 V${item.version || 1}`}
                  summary={getSummary(item)}
                  timeLabel={item.submittedAt ? formatServerDateTime(item.submittedAt, '') : ''}
                  statusLabel={`总价 ${formatCurrency(totalFee)}`}
                  statusTone={getStatusTone(item.status)}
                  leading={<View style={versionBadgeStyle}>{`V${item.version || 1}`}</View>}
                  typeBadge={
                    <View style={badgeRowStyle}>
                      <Tag variant={status.variant}>{status.label}</Tag>
                      {item.userResponseDeadline ? (
                        <Tag variant="default" outline>{`截止 ${formatServerDate(item.userResponseDeadline, '-')}`}</Tag>
                      ) : null}
                    </View>
                  }
                  actionText={status.label === '待确认' ? '查看并处理' : '查看详情'}
                  actionSecondary={status.label !== '待确认'}
                  onClick={() => handleDetail(item.id)}
                  onActionClick={(event) => {
                    event.stopPropagation?.();
                    handleDetail(item.id);
                  }}
                />
              </View>
            );
          })}

          {loading && list.length > 0 ? (
            <View className="text-center text-gray-400 text-xs py-md">加载中...</View>
          ) : null}
        </View>
      ) : (
        <Empty description="暂无设计方案" />
      )}
    </NotificationSurfaceShell>
  );
};

export default ProposalList;
