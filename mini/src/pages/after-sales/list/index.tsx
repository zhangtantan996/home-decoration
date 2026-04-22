import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from '@tarojs/components';
import Taro from '@tarojs/taro';

import { Button } from '@/components/Button';
import { Empty } from '@/components/Empty';
import { NotificationInboxCell } from '@/components/NotificationInboxCell';
import { NotificationSurfaceShell } from '@/components/NotificationSurfaceShell';
import { PullToRefreshNotice } from '@/components/PullToRefreshNotice';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import { usePullToRefreshFeedback } from '@/hooks/usePullToRefreshFeedback';
import { listAfterSales, type AfterSalesListItem } from '@/services/afterSales';
import { useAuthStore } from '@/store/auth';
import { openAuthLoginPage } from '@/utils/authRedirect';
import { showErrorToast } from '@/utils/error';

const FILTERS = [
  { key: 'all', label: '全部' },
  { key: '0', label: '待处理' },
  { key: '1', label: '处理中' },
  { key: '2', label: '已完成' },
  { key: '3', label: '已关闭' },
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

const toolbarStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '16rpx',
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

const getStatusTone = (status: number) => {
  if (status === 2) return 'success' as const;
  if (status === 1) return 'brand' as const;
  return 'neutral' as const;
};

const AfterSalesListPage: React.FC = () => {
  const auth = useAuthStore();
  const [activeFilter, setActiveFilter] = useState<(typeof FILTERS)[number]['key']>('all');
  const [list, setList] = useState<AfterSalesListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchList = async () => {
    if (!auth.token) {
      setList([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const result = await listAfterSales();
      setList(result);
    } catch (error) {
      showErrorToast(error, '售后中心加载失败');
    } finally {
      setLoading(false);
    }
  };

  const { refreshStatus, drawerHeight, drawerProgress, bindPullToRefresh, runReload } =
    usePullToRefreshFeedback(fetchList);

  useEffect(() => {
    void runReload();
  }, [auth.token, runReload]);

  const filteredList = useMemo(() => {
    if (activeFilter === 'all') return list;
    return list.filter((item) => String(item.status) === activeFilter);
  }, [activeFilter, list]);

  const openCreate = () => {
    if (!auth.token) {
      void openAuthLoginPage('/pages/after-sales/list/index');
      return;
    }
    Taro.navigateTo({ url: '/pages/after-sales/create/index' });
  };

  const openDetail = (id: number) => {
    Taro.navigateTo({ url: `/pages/after-sales/detail/index?id=${id}` });
  };

  if (!auth.token) {
    return (
      <NotificationSurfaceShell className="page bg-gray-50 min-h-screen flex items-center justify-center" {...bindPullToRefresh}>
        <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />
        <Empty
          description="登录后查看售后记录"
          action={{ text: '去登录', onClick: () => void openAuthLoginPage('/pages/after-sales/list/index') }}
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
            <Button size="small" variant="outline" onClick={openCreate}>发起售后</Button>
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
          <View className="text-sm text-gray-400">{`共 ${filteredList.length} 条记录`}</View>
          <Button size="small" variant="outline" onClick={openCreate}>发起售后</Button>
        </View>

        <ScrollView scrollX showScrollbar={false} style={filterWrapStyle}>
          <View style={filterRowStyle}>
            {FILTERS.map((item) => {
              const active = activeFilter === item.key;
              return (
                <View
                  key={item.key}
                  onClick={() => setActiveFilter(item.key)}
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

        {filteredList.length === 0 ? (
          <Empty description={activeFilter === 'all' ? '暂无售后申请' : '当前筛选下暂无记录'} />
        ) : (
          <View style={sectionStyle}>
            {filteredList.map((item) => (
              <View key={item.id} style={cellCardStyle}>
                <NotificationInboxCell
                  title={item.reason}
                  summary={`${item.typeText} · ${item.amountText} · ${item.orderNo || `预约 #${item.bookingId}`}`}
                  timeLabel={item.createdAt || ''}
                  statusLabel={item.statusText}
                  statusTone={getStatusTone(item.status)}
                  typeBadge={
                    <View style={badgeRowStyle}>
                      <Tag variant="default">{item.typeText}</Tag>
                    </View>
                  }
                  actionText="查看详情"
                  actionSecondary
                  actionTone="neutral"
                  onClick={() => openDetail(item.id)}
                  onActionClick={(event) => {
                    event.stopPropagation?.();
                    openDetail(item.id);
                  }}
                />
              </View>
            ))}
          </View>
        )}
      </View>
    </NotificationSurfaceShell>
  );
};

export default AfterSalesListPage;
