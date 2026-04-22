import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from '@tarojs/components';
import Taro, { useDidShow, useLoad, useReachBottom } from '@tarojs/taro';

import { Empty } from '@/components/Empty';
import { NotificationInboxCell } from '@/components/NotificationInboxCell';
import { NotificationSurfaceShell } from '@/components/NotificationSurfaceShell';
import { PullToRefreshNotice } from '@/components/PullToRefreshNotice';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import { getRefundStatus } from '@/constants/status';
import { usePullToRefreshFeedback } from '@/hooks/usePullToRefreshFeedback';
import { listMyRefundApplications, type RefundApplicationItem } from '@/services/refunds';
import { useAuthStore } from '@/store/auth';
import { syncCurrentTabBar } from '@/utils/customTabBar';
import { showErrorToast } from '@/utils/error';
import { formatServerDateTime } from '@/utils/serverTime';

const FILTERS = [
  { key: '', label: '全部' },
  { key: 'pending', label: '待审核' },
  { key: 'approved', label: '已通过' },
  { key: 'completed', label: '已完成' },
  { key: 'rejected', label: '已驳回' },
] as const;

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

const filterWrapStyle = {
  marginBottom: '8rpx',
  whiteSpace: 'nowrap' as const,
};

const filterRowStyle = {
  display: 'inline-flex',
  gap: '12rpx',
  paddingRight: '12rpx',
};

const formatCurrency = (value: number) => `¥${Number(value || 0).toLocaleString()}`;

const getRefundTypeLabel = (type?: RefundApplicationItem['refundType']) => {
  switch (type) {
    case 'intent_fee':
      return '量房费退款';
    case 'design_fee':
      return '设计费退款';
    case 'construction_fee':
      return '施工费退款';
    case 'full':
      return '整单退款';
    default:
      return '退款申请';
  }
};

const getRefundSummary = (item: RefundApplicationItem) => {
  const note = item.status === 'rejected' ? item.adminNotes : '';
  const parts = [
    item.order?.orderNo || '',
    item.project?.name || item.booking?.address || '',
    note ? `原因：${note}` : '',
  ].filter(Boolean);

  return parts.join(' · ');
};

const getRefundStatusTone = (status?: RefundApplicationItem['status']) => {
  if (status === 'completed') return 'success' as const;
  if (status === 'rejected') return 'danger' as const;
  if (status === 'approved') return 'brand' as const;
  return 'neutral' as const;
};

const getAmountLabel = (item: RefundApplicationItem) => {
  if (item.status === 'completed' || item.status === 'approved') {
    const amount = item.approvedAmount || item.requestedAmount;
    return `退款金额 ${formatCurrency(amount)}`;
  }

  return `申请金额 ${formatCurrency(item.requestedAmount)}`;
};

const RefundListPage: React.FC = () => {
  const auth = useAuthStore();
  const [bookingId, setBookingId] = useState<number | undefined>(undefined);
  const [status, setStatus] = useState<(typeof FILTERS)[number]['key']>('');
  const [list, setList] = useState<RefundApplicationItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useLoad((options) => {
    if (options.bookingId) {
      setBookingId(Number(options.bookingId));
    }
  });

  const fetchList = useCallback(async (pageNum: number, reset = false) => {
    if (!auth.token) {
      setList([]);
      setLoading(false);
      setHasMore(false);
      return;
    }

    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const res = await listMyRefundApplications({ bookingId, status, page: pageNum, pageSize: 10 });
      const next = res.list || [];
      setList((prev) => (reset ? next : [...prev, ...next]));
      setPage(pageNum + 1);
      setHasMore(next.length === 10);
    } catch (error) {
      showErrorToast(error, '加载失败');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [auth.token, bookingId, status]);

  const { refreshStatus, drawerHeight, drawerProgress, bindPullToRefresh, runReload } =
    usePullToRefreshFeedback(() => fetchList(1, true));

  useEffect(() => {
    void runReload();
  }, [fetchList, runReload]);

  useReachBottom(() => {
    if (hasMore && !loadingMore && !loading) {
      void fetchList(page);
    }
  });

  useDidShow(() => {
    syncCurrentTabBar();
  });

  if (!auth.token) {
    return (
      <NotificationSurfaceShell className="page bg-gray-50 min-h-screen" {...bindPullToRefresh}>
        <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />
        <Empty description="登录后查看退款记录" action={{ text: '去登录', onClick: () => Taro.switchTab({ url: '/pages/profile/index' }) }} />
      </NotificationSurfaceShell>
    );
  }

  return (
    <NotificationSurfaceShell className="page bg-gray-50 min-h-screen" {...bindPullToRefresh}>
      <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />

      <ScrollView scrollX showScrollbar={false} style={filterWrapStyle}>
        <View style={filterRowStyle}>
          {FILTERS.map((item) => {
            const active = status === item.key;
            return (
              <View
                key={item.key || 'all'}
                onClick={() => {
                  setStatus(item.key);
                  setHasMore(true);
                  setPage(1);
                }}
                style={{
                  minHeight: '60rpx',
                  padding: '0 24rpx',
                  borderRadius: '999rpx',
                  background: active ? '#FFFFFF' : 'rgba(255,255,255,0.92)',
                  color: active ? '#2563EB' : '#64748B',
                  border: active ? '1rpx solid rgba(37, 99, 235, 0.18)' : '1rpx solid rgba(226, 232, 240, 0.96)',
                  boxShadow: active ? '0 10rpx 22rpx rgba(37, 99, 235, 0.08)' : 'none',
                  fontSize: '24rpx',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {item.label}
              </View>
            );
          })}
        </View>
      </ScrollView>

      {loading ? (
        <View style={sectionStyle}>
          <Skeleton height={148} />
          <Skeleton height={148} />
        </View>
      ) : list.length === 0 ? (
        <Empty description="暂无退款记录" />
      ) : (
        <View style={sectionStyle}>
          {list.map((item) => {
            const statusMeta = getRefundStatus(item.status);
            return (
              <View key={item.id} style={cellCardStyle}>
                <NotificationInboxCell
                  title={item.project?.name || item.booking?.address || `退款申请 #${item.id}`}
                  summary={getRefundSummary(item)}
                  timeLabel={formatServerDateTime(item.createdAt)}
                  statusLabel={getAmountLabel(item)}
                  statusTone={getRefundStatusTone(item.status)}
                  typeBadge={
                    <View style={badgeRowStyle}>
                      <Tag variant={statusMeta.variant}>{statusMeta.label}</Tag>
                      <Tag variant="default">{getRefundTypeLabel(item.refundType)}</Tag>
                    </View>
                  }
                />
              </View>
            );
          })}
          {loadingMore ? <View className="p-md text-center text-gray-400 text-sm">加载中...</View> : null}
          {!hasMore ? <View className="p-md text-center text-gray-400 text-sm">没有更多了</View> : null}
        </View>
      )}
    </NotificationSurfaceShell>
  );
};

export default RefundListPage;
