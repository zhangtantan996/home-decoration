import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from '@tarojs/components';
import Taro, { useDidShow, useReachBottom } from '@tarojs/taro';

import { Empty } from '@/components/Empty';
import { NotificationInboxCell } from '@/components/NotificationInboxCell';
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

const SOURCE_LABEL_MAP: Record<OrderCenterSourceKind, string> = {
  design_order: '设计费',
  construction_order: '施工费',
  material_order: '主材费',
  survey_deposit: '量房费',
  refund_record: '退款',
  merchant_bond: '保证金',
};

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

const getRelativeExpiryLabel = (expireAt?: string) => {
  if (!expireAt) {
    return '';
  }

  const expireTime = new Date(expireAt).getTime();
  if (Number.isNaN(expireTime)) {
    return `截止 ${formatServerDateTime(expireAt)}`;
  }

  const diffMs = expireTime - Date.now();
  if (diffMs <= 0) {
    return '即将到期';
  }

  const diffMinutes = Math.ceil(diffMs / 60000);
  if (diffMinutes < 60) {
    return `剩 ${diffMinutes} 分钟`;
  }

  if (diffMinutes < 24 * 60) {
    return `剩 ${Math.ceil(diffMinutes / 60)} 小时`;
  }

  return `截止 ${formatServerDateTime(expireAt)}`;
};

const getEntryDisplayAmount = (entry: OrderCenterEntrySummary) => {
  if (entry.statusGroup === 'pending_payment') {
    return entry.payableAmount || entry.amount || 0;
  }
  return entry.amount || 0;
};

const getEntryStatusText = (entry: OrderCenterEntrySummary) => {
  const amount = formatCurrency(getEntryDisplayAmount(entry));
  switch (entry.statusGroup) {
    case 'pending_payment':
      return `待支付 ${amount}`;
    case 'refund':
      return `退款中 ${amount}`;
    case 'cancelled':
      return `已取消 ${amount}`;
    default:
      return `已支付 ${amount}`;
  }
};

const getEntryBadgeLabel = (entry: OrderCenterEntrySummary) => {
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

const getEntryStatusTone = (entry: OrderCenterEntrySummary) => {
  switch (entry.statusGroup) {
    case 'pending_payment':
      return 'brand' as const;
    case 'refund':
      return 'danger' as const;
    case 'paid':
      return 'success' as const;
    default:
      return 'neutral' as const;
  }
};

const getEntrySummary = (entry: OrderCenterEntrySummary) => {
  const parts = [
    entry.provider?.name,
    entry.project?.name || entry.project?.address || entry.booking?.address,
    entry.referenceNo,
  ].filter(Boolean) as string[];

  if (entry.statusGroup === 'pending_payment') {
    const expiryLabel = getRelativeExpiryLabel(entry.expireAt);
    if (expiryLabel) {
      parts.push(expiryLabel);
    }
  }

  return parts.join(' · ');
};

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

              return (
                <View key={entry.entryKey} className="orders-list-content__item">
                  <NotificationInboxCell
                    title={entry.title}
                    summary={getEntrySummary(entry)}
                    timeLabel={getEntryTimeLabel(entry)}
                    statusLabel={getEntryStatusText(entry)}
                    statusTone={getEntryStatusTone(entry)}
                    leading={(
                      <View className="orders-list-content__amount-card">
                        <View className="orders-list-content__amount-value">{formatCurrency(getEntryDisplayAmount(entry))}</View>
                        <View className="orders-list-content__amount-caption">
                          {entry.statusGroup === 'pending_payment' ? '待支付' : '订单金额'}
                        </View>
                      </View>
                    )}
                    typeBadge={(
                      <View className="orders-list-content__badge-row">
                        <Tag variant="default">{SOURCE_LABEL_MAP[entry.sourceKind] || '订单'}</Tag>
                        <Tag variant={entry.statusGroup === 'pending_payment' ? 'warning' : entry.statusGroup === 'paid' ? 'success' : entry.statusGroup === 'refund' ? 'error' : 'default'}>
                          {getEntryBadgeLabel(entry)}
                        </Tag>
                      </View>
                    )}
                    actionText={primaryAction.label}
                    actionSecondary={primaryAction.variant !== 'primary'}
                    actionTone={primaryAction.variant === 'primary' ? 'payment' : 'neutral'}
                    onClick={() => {
                      void openEntryDetail(entry).catch((error) => {
                        showErrorToast(error, '跳转失败');
                      });
                    }}
                    onActionClick={(event) => {
                      event.stopPropagation();
                      void openEntryDetail(entry).catch((error) => {
                        showErrorToast(error, '跳转失败');
                      });
                    }}
                  />
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
