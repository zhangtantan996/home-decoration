import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from '@tarojs/components';
import Taro, { useDidShow, useReachBottom } from '@tarojs/taro';

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
import { deriveOrderEntryActions } from '@/utils/orderEntryActions';
import { consumePaymentRefreshNotice } from '@/utils/paymentRefresh';
import { buildOrderCenterDetailUrl } from '@/utils/orderRoutes';
import { formatServerDateTime } from '@/utils/serverTime';
import { openSurveyDepositDetail } from '@/utils/surveyDepositPayment';

import './OrdersListContent.scss';

const FILTERS: Array<{ key: OrderCenterStatusGroup | ''; label: string }> = [
  { key: '', label: '全部' },
  { key: 'pending_payment', label: '待支付' },
  { key: 'paid', label: '已支付' },
  { key: 'refund', label: '退款' },
  { key: 'cancelled', label: '已取消' },
];

interface OrdersListContentProps {
  fixedFilter?: OrderCenterStatusGroup;
  sourceKindFilter?: OrderCenterSourceKind;
  hideFilters?: boolean;
  pageSize?: number;
  disableLoadMore?: boolean;
  emptyDescriptions?: Partial<Record<OrderCenterStatusGroup | 'all', string>>;
}

const formatCurrency = (amount: number) => `¥${Number(amount || 0).toLocaleString()}`;

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

  return '暂无相关订单';
};

const getEntryDisplayAmount = (entry: OrderCenterEntrySummary) => {
  if (entry.statusGroup === 'pending_payment') {
    return entry.payableAmount || entry.amount || 0;
  }
  return entry.amount || 0;
};

const getEntryStatusText = (entry: OrderCenterEntrySummary) => {
  switch (entry.statusGroup) {
    case 'pending_payment':
      return '待支付';
    case 'refund':
      return '退款中';
    case 'cancelled':
      return '已取消';
    default:
      return '已支付';
  }
};

const getEntryProviderName = (entry: OrderCenterEntrySummary) => entry.provider?.name || '服务商待同步';

const getEntryAddress = (entry: OrderCenterEntrySummary) =>
  entry.project?.address || entry.booking?.address || entry.project?.name || '地址待同步';


const getEntryTimeLabel = (entry: OrderCenterEntrySummary) => {
  return entry.createdAt ? formatServerDateTime(entry.createdAt) : '';
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

  useDidShow(() => {
    if (auth.token && consumePaymentRefreshNotice()) {
      void runReload();
    }
  });

  useReachBottom(() => {
    if (disableLoadMore || !hasMore || loadingMore || loading) {
      return;
    }
    void fetchList(page);
  });

  const navigateToOrderPage = useCallback(async (url: string) => {
    try {
      await Taro.navigateTo({ url });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || '');
      if (message.includes('timeout')) {
        return;
      }
      throw error;
    }
  }, []);

  const openEntryDetail = async (entry: OrderCenterEntrySummary) => {
    if (entry.sourceKind === 'survey_deposit' && entry.booking?.id) {
      openSurveyDepositDetail(entry.booking.id, entry.referenceNo, entry.entryKey);
      return;
    }

    await navigateToOrderPage(buildOrderCenterDetailUrl(entry.entryKey));
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
    <View className="page orders-list-content bg-gray-50 min-h-screen" {...bindPullToRefresh}>
      <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />
      {filterBar}

      <View className="orders-list-content__inner">
        {!auth.token ? (
          <Empty
            description="登录后查看订单"
            action={{ text: '去登录', onClick: () => Taro.switchTab({ url: '/pages/profile/index' }) }}
          />
        ) : !initialized && loading ? (
          <View>
            <Skeleton height={150} className="mb-md" />
            <Skeleton height={150} className="mb-md" />
            <Skeleton height={150} className="mb-md" />
          </View>
        ) : list.length === 0 ? (
          <Empty description={getEmptyDescription(activeFilter, emptyDescriptions)} />
        ) : (
          <View className="orders-list-content__list">
            {list.map((entry) => {
              const entryActions = deriveOrderEntryActions({
                statusGroup: entry.statusGroup,
                canPay: entry.statusGroup === 'pending_payment',
              });
              const primaryAction = entryActions.listPrimaryAction;
              const goDetail = () => {
                void openEntryDetail(entry).catch((error) => {
                  showErrorToast(error, '跳转失败');
                });
              };

              return (
                <View key={entry.entryKey} className="orders-list-content__item" onClick={goDetail}>
                  <View className="orders-list-content__floating">
                    <View className="orders-list-content__status-wrap">
                      <Tag variant={entry.statusGroup === 'pending_payment' ? 'warning' : entry.statusGroup === 'paid' ? 'success' : entry.statusGroup === 'refund' ? 'error' : 'default'}>
                        {getEntryStatusText(entry)}
                      </Tag>
                    </View>
                    <View className={`orders-list-content__amount-wrap ${entry.statusGroup === 'pending_payment' ? 'is-pending' : ''}`}>
                      <Text className={`orders-list-content__amount ${entry.statusGroup === 'pending_payment' ? 'is-pending' : ''}`}>
                        {formatCurrency(getEntryDisplayAmount(entry))}
                      </Text>
                    </View>
                  </View>

                  <Text className="orders-list-content__title line-clamp-1">{entry.title}</Text>

                  <View className="orders-list-content__facts">
                    <View className="orders-list-content__fact-row">
                      <Text className="orders-list-content__fact-label">服务商</Text>
                      <Text className="orders-list-content__fact-value line-clamp-1">{getEntryProviderName(entry)}</Text>
                    </View>
                    <View className="orders-list-content__fact-row">
                      <Text className="orders-list-content__fact-label">地址</Text>
                      <Text className="orders-list-content__fact-value line-clamp-2">{getEntryAddress(entry)}</Text>
                    </View>
                  </View>

                  <View className="orders-list-content__footer">
                    <Text className="orders-list-content__time">{getEntryTimeLabel(entry) || '时间待同步'}</Text>
                    <View
                      className={`orders-list-content__action ${primaryAction.variant === 'primary' ? 'is-primary' : ''}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        goDetail();
                      }}
                    >
                      <Text className={`orders-list-content__action-text ${primaryAction.variant === 'primary' ? 'is-primary' : ''}`}>
                        {primaryAction.label}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}

            {loadingMore ? <View className="orders-list-content__loading">加载中</View> : null}
            {!disableLoadMore && !hasMore ? <View className="orders-list-content__loading">没有更多了</View> : null}
          </View>
        )}
      </View>
    </View>
  );
};

export default OrdersListContent;
