import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from '@tarojs/components';
import Taro, { useReachBottom } from '@tarojs/taro';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Empty } from '@/components/Empty';
import { PullToRefreshNotice } from '@/components/PullToRefreshNotice';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import { usePullToRefreshFeedback } from '@/hooks/usePullToRefreshFeedback';
import {
  listOrderCenterEntries,
  type OrderCenterEntrySummary,
  type OrderCenterSourceKind,
  type OrderCenterStatusGroup,
} from '@/services/orderCenter';
import { useAuthStore } from '@/store/auth';
import { showErrorToast } from '@/utils/error';
import { formatServerDateTime } from '@/utils/serverTime';

import './OrdersListContent.scss';

const FILTERS: Array<{ key: OrderCenterStatusGroup | ''; label: string }> = [
  { key: '', label: '全部' },
  { key: 'pending_payment', label: '待支付' },
  { key: 'paid', label: '已支付' },
  { key: 'refund', label: '退款' },
  { key: 'cancelled', label: '已取消' },
];

const STATUS_META: Record<OrderCenterStatusGroup, { label: string; variant: 'warning' | 'success' | 'brand' | 'default' }> = {
  pending_payment: { label: '待支付', variant: 'warning' },
  paid: { label: '已支付', variant: 'success' },
  refund: { label: '退款中', variant: 'brand' },
  cancelled: { label: '已取消', variant: 'default' },
};

interface OrdersListContentProps {
  fixedFilter?: OrderCenterStatusGroup;
  sourceKindFilter?: OrderCenterSourceKind;
  hideFilters?: boolean;
  pageSize?: number;
  disableLoadMore?: boolean;
  emptyDescriptions?: Partial<Record<OrderCenterStatusGroup | 'all', string>>;
}

const getEmptyDescription = (
  filter: OrderCenterStatusGroup | '',
  emptyDescriptions?: OrdersListContentProps['emptyDescriptions'],
) => {
  if (!filter) {
    return emptyDescriptions?.all || '暂无订单';
  }

  if (emptyDescriptions?.[filter]) {
    return emptyDescriptions[filter] as string;
  }

  switch (filter) {
    case 'pending_payment':
      return '暂无待支付订单';
    case 'paid':
      return '暂无已支付订单';
    case 'refund':
      return '暂无退款记录';
    case 'cancelled':
      return '暂无已取消订单';
    default:
      return '暂无订单';
  }
};

const getOrderStatusMeta = (entry: OrderCenterEntrySummary) => {
  return STATUS_META[entry.statusGroup] || { label: entry.statusText || '处理中', variant: 'default' as const };
};

const getEntryAmountLabel = (entry: OrderCenterEntrySummary) => {
  if (entry.statusGroup === 'pending_payment') {
    return '待支付';
  }
  if (entry.statusGroup === 'refund') {
    return '订单金额';
  }
  return '实付金额';
};

const getEntryDisplayAmount = (entry: OrderCenterEntrySummary) => {
  if (entry.statusGroup === 'pending_payment') {
    return entry.payableAmount || entry.amount || 0;
  }
  return entry.amount || 0;
};

export const OrdersListContent: React.FC<OrdersListContentProps> = ({
  fixedFilter,
  sourceKindFilter,
  hideFilters = false,
  pageSize = 10,
  disableLoadMore = false,
  emptyDescriptions,
}) => {
  const auth = useAuthStore();
  const [selectedFilter, setSelectedFilter] = useState<OrderCenterStatusGroup | ''>(fixedFilter || '');
  const [list, setList] = useState<OrderCenterEntrySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [initialized, setInitialized] = useState(false);

  const activeFilter = fixedFilter || selectedFilter;

  useEffect(() => {
    if (fixedFilter) {
      setSelectedFilter(fixedFilter);
    }
  }, [fixedFilter]);

  const fetchList = useCallback(async (pageNum: number, reset = false) => {
    if (!auth.token) {
      setList([]);
      setHasMore(false);
      setLoading(false);
      setLoadingMore(false);
      setInitialized(true);
      return;
    }

    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const response = await listOrderCenterEntries({
        statusGroup: activeFilter || undefined,
        sourceKind: sourceKindFilter,
        page: pageNum,
        pageSize,
      });
      const nextList = response.list || [];
      setList((prev) => (reset ? nextList : [...prev, ...nextList]));
      setPage(pageNum + 1);
      setHasMore(nextList.length === pageSize);
    } catch (error) {
      showErrorToast(error, '加载失败');
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setInitialized(true);
    }
  }, [activeFilter, auth.token, pageSize, sourceKindFilter]);

  const { refreshStatus, drawerHeight, drawerProgress, bindPullToRefresh, runReload } =
    usePullToRefreshFeedback(() => fetchList(1, true));

  useEffect(() => {
    setPage(1);
    setHasMore(true);
    void runReload();
  }, [activeFilter, auth.token, runReload, sourceKindFilter]);

  useReachBottom(() => {
    if (disableLoadMore || !hasMore || loadingMore || loading) {
      return;
    }
    void fetchList(page);
  });

  const openEntryDetail = (entry: OrderCenterEntrySummary) => {
    Taro.navigateTo({ url: `/pages/orders/detail/index?entryKey=${encodeURIComponent(entry.entryKey)}` });
  };

  const handlePrimaryAction = (event: { stopPropagation: () => void }, entry: OrderCenterEntrySummary) => {
    event.stopPropagation();

    if (entry.sourceKind === 'survey_deposit' && entry.booking?.id) {
      Taro.navigateTo({ url: `/pages/booking/detail/index?id=${entry.booking.id}` });
      return;
    }

    openEntryDetail(entry);
  };

  const filterBar = useMemo(() => {
    if (hideFilters || fixedFilter) {
      return null;
    }

    return (
      <ScrollView scrollX className="orders-list-content__filters-scroll" showScrollbar={false}>
        <View className="orders-list-content__filters">
          {FILTERS.map((item) => {
            const active = activeFilter === item.key;
            return (
              <View
                key={item.key || 'all'}
                className={`orders-list-content__filter${active ? ' orders-list-content__filter--active' : ''}`}
                onClick={() => {
                  setSelectedFilter(item.key);
                  setPage(1);
                  setHasMore(true);
                }}
              >
                {item.label}
              </View>
            );
          })}
        </View>
      </ScrollView>
    );
  }, [activeFilter, fixedFilter, hideFilters]);

  return (
    <View className="page orders-list-content bg-gray-50 min-h-screen p-md" {...bindPullToRefresh}>
      <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />
      {filterBar}

      {!auth.token ? (
        <Empty
          description="登录后查看订单"
          action={{ text: '去登录', onClick: () => Taro.switchTab({ url: '/pages/profile/index' }) }}
        />
      ) : !initialized && loading ? (
        <View>
          <Skeleton height={188} className="mb-md" />
          <Skeleton height={188} className="mb-md" />
          <Skeleton height={188} className="mb-md" />
        </View>
      ) : list.length === 0 ? (
        <Empty description={getEmptyDescription(activeFilter, emptyDescriptions)} />
      ) : (
        <View>
          {list.map((entry) => {
            const statusMeta = getOrderStatusMeta(entry);
            const amount = getEntryDisplayAmount(entry);

            return (
              <Card
                key={entry.entryKey}
                className="orders-list-content__card"
                title={entry.title}
                extra={<Tag variant={statusMeta.variant}>{entry.statusText || statusMeta.label}</Tag>}
                onClick={() => openEntryDetail(entry)}
              >
                <View className="orders-list-content__body">
                  {entry.subtitle ? <Text className="orders-list-content__subtitle">{entry.subtitle}</Text> : null}
                  {entry.provider?.name ? (
                    <View className="orders-list-content__row">
                      <Text className="orders-list-content__label">服务方</Text>
                      <Text className="orders-list-content__value">{entry.provider.name}</Text>
                    </View>
                  ) : null}
                  {entry.project?.name ? (
                    <View className="orders-list-content__row">
                      <Text className="orders-list-content__label">关联项目</Text>
                      <Text className="orders-list-content__value">{entry.project.name}</Text>
                    </View>
                  ) : entry.booking?.address ? (
                    <View className="orders-list-content__row">
                      <Text className="orders-list-content__label">项目地址</Text>
                      <Text className="orders-list-content__value orders-list-content__value--multiline">{entry.booking.address}</Text>
                    </View>
                  ) : null}
                  {entry.referenceNo ? (
                    <View className="orders-list-content__row">
                      <Text className="orders-list-content__label">订单编号</Text>
                      <Text className="orders-list-content__value">{entry.referenceNo}</Text>
                    </View>
                  ) : null}
                  {entry.createdAt ? (
                    <View className="orders-list-content__row">
                      <Text className="orders-list-content__label">下单时间</Text>
                      <Text className="orders-list-content__value">{formatServerDateTime(entry.createdAt)}</Text>
                    </View>
                  ) : null}
                  {entry.expireAt && entry.statusGroup === 'pending_payment' ? (
                    <View className="orders-list-content__row">
                      <Text className="orders-list-content__label">过期时间</Text>
                      <Text className="orders-list-content__value orders-list-content__value--warning">
                        {formatServerDateTime(entry.expireAt)}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <View className="orders-list-content__footer">
                  <View>
                    <Text className="orders-list-content__amount-label">{getEntryAmountLabel(entry)}</Text>
                    <Text className="orders-list-content__amount-value">¥{amount.toLocaleString()}</Text>
                  </View>
                  {entry.statusGroup === 'pending_payment' ? (
                    <Button size="sm" variant="primary" onClick={(event) => handlePrimaryAction(event, entry)}>
                      去支付
                    </Button>
                  ) : null}
                </View>
              </Card>
            );
          })}

          {loadingMore ? <View className="orders-list-content__loading">加载中...</View> : null}
          {!disableLoadMore && !hasMore ? <View className="orders-list-content__loading">没有更多了</View> : null}
        </View>
      )}
    </View>
  );
};

export default OrdersListContent;
