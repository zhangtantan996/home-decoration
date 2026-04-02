import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from '@tarojs/components';
import Taro, { useDidShow, useReachBottom, useLoad } from '@tarojs/taro';

import { Card } from '@/components/Card';
import { Empty } from '@/components/Empty';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import { getRefundStatus } from '@/constants/status';
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

  useEffect(() => {
    void fetchList(1, true);
  }, [fetchList]);

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
      <View className="page bg-gray-50 min-h-screen p-md">
        <Empty description="登录后查看退款记录" action={{ text: '去登录', onClick: () => Taro.switchTab({ url: '/pages/profile/index' }) }} />
      </View>
    );
  }

  return (
    <View className="page bg-gray-50 min-h-screen p-md">
      <View className="flex" style={{ gap: '12rpx', flexWrap: 'wrap', marginBottom: '24rpx' }}>
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
                padding: '12rpx 24rpx',
                borderRadius: '999rpx',
                background: active ? '#2C3E50' : '#FFFFFF',
                color: active ? '#FFFFFF' : '#52525B',
                border: active ? '2rpx solid #2C3E50' : '2rpx solid #E4E4E7',
                fontSize: '24rpx',
              }}
            >
              {item.label}
            </View>
          );
        })}
      </View>

      {loading ? (
        <View>
          <Skeleton height={180} className="mb-md" />
          <Skeleton height={180} className="mb-md" />
        </View>
      ) : list.length === 0 ? (
        <Empty description="暂无退款记录" />
      ) : (
        <View>
          {list.map((item) => {
            const statusMeta = getRefundStatus(item.status);
            return (
              <Card key={item.id} className="mb-md" title={`退款申请 #${item.id}`} extra={<Tag variant={statusMeta.variant}>{statusMeta.label}</Tag>}>
                <View className="flex flex-col gap-sm text-sm text-gray-600">
                  <View className="flex justify-between">
                    <Text>退款类型</Text>
                    <Text>{item.refundType}</Text>
                  </View>
                  <View className="flex justify-between">
                    <Text>申请金额</Text>
                    <Text>¥{item.requestedAmount.toLocaleString()}</Text>
                  </View>
                  <View className="flex justify-between">
                    <Text>预约地址</Text>
                    <Text>{item.booking?.address || '-'}</Text>
                  </View>
                  <View className="flex justify-between">
                    <Text>提交时间</Text>
                    <Text>{formatServerDateTime(item.createdAt)}</Text>
                  </View>
                  {item.adminNotes ? (
                    <View className="text-sm text-gray-500">审核备注：{item.adminNotes}</View>
                  ) : null}
                </View>
              </Card>
            );
          })}
          {loadingMore ? <View className="p-md text-center text-gray-400 text-sm">加载中...</View> : null}
          {!hasMore ? <View className="p-md text-center text-gray-400 text-sm">没有更多了</View> : null}
        </View>
      )}
    </View>
  );
};

export default RefundListPage;
