import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';

import { Empty } from '@/components/Empty';
import { NotificationSurfaceShell } from '@/components/NotificationSurfaceShell';
import { PullToRefreshNotice } from '@/components/PullToRefreshNotice';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import { usePullToRefreshFeedback } from '@/hooks/usePullToRefreshFeedback';
import { listAfterSales, type AfterSalesListItem } from '@/services/afterSales';
import { useAuthStore } from '@/store/auth';
import { openAuthLoginPage } from '@/utils/authRedirect';
import { showErrorToast } from '@/utils/error';

import './index.scss';

const FILTERS = [
  { key: 'all', label: '全部' },
  { key: '0', label: '待处理' },
  { key: '1', label: '处理中' },
  { key: '2', label: '已完成' },
  { key: '3', label: '已关闭' },
] as const;

const getStatusTone = (status: number) => {
  if (status === 2) return 'success' as const;
  if (status === 1) return 'brand' as const;
  if (status === 0) return 'warning' as const;
  return 'default' as const;
};

const getRelatedLabel = (item: AfterSalesListItem) => (item.bookingId > 0 ? '预约服务' : '待同步');

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

  const openDetail = (id: number) => {
    Taro.navigateTo({ url: `/pages/after-sales/detail/index?id=${id}` });
  };

  if (!auth.token) {
    return (
      <NotificationSurfaceShell className="after-sales-list-page" contentClassName="after-sales-list-page__content after-sales-list-page__content--center" {...bindPullToRefresh}>
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
      <NotificationSurfaceShell className="after-sales-list-page" contentClassName="after-sales-list-page__content" {...bindPullToRefresh}>
        <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />
        <View className="after-sales-list-page__section">
          <View className="after-sales-list-page__summary">
            <Text className="after-sales-list-page__summary-title">售后记录</Text>
            <Text className="after-sales-list-page__summary-count">最近更新</Text>
          </View>
          <Skeleton height={148} />
          <Skeleton height={148} />
          <Skeleton height={148} />
        </View>
      </NotificationSurfaceShell>
    );
  }

  return (
    <NotificationSurfaceShell className="after-sales-list-page" contentClassName="after-sales-list-page__content" {...bindPullToRefresh}>
      <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />

      <View className="after-sales-list-page__section">
        <View className="after-sales-list-page__summary">
          <Text className="after-sales-list-page__summary-title">售后记录</Text>
          <Text className="after-sales-list-page__summary-count">{`共 ${filteredList.length} 条`}</Text>
        </View>

        <View className="after-sales-list-page__filter-card">
          <ScrollView scrollX showScrollbar={false} className="after-sales-list-page__filters-scroll">
            <View className="after-sales-list-page__filters">
              {FILTERS.map((item) => {
                const active = activeFilter === item.key;
                return (
                  <View
                    key={item.key}
                    onClick={() => setActiveFilter(item.key)}
                    className={`after-sales-list-page__filter${active ? ' after-sales-list-page__filter--active' : ''}`}
                  >
                    {item.label}
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>

        {filteredList.length === 0 ? (
          <View className="after-sales-list-page__empty-card">
            <Empty description={activeFilter === 'all' ? '暂无售后记录' : '当前状态暂无记录'} />
          </View>
        ) : (
          <View className="after-sales-list-page__section">
            {filteredList.map((item) => (
              <View
                key={item.id}
                className="after-sales-list-page__card"
                onClick={() => openDetail(item.id)}
                hoverClass="after-sales-list-page__card--pressed"
              >
                <View className="after-sales-list-page__card-head">
                  <Text className="after-sales-list-page__title">{item.reason}</Text>
                  <Tag variant={getStatusTone(item.status)}>{item.statusText}</Tag>
                </View>
                <View className="after-sales-list-page__facts">
                  <View className="after-sales-list-page__fact">
                    <Text className="after-sales-list-page__fact-label">关联对象</Text>
                    <Text className="after-sales-list-page__fact-value">{getRelatedLabel(item)}</Text>
                  </View>
                  <View className="after-sales-list-page__fact">
                    <Text className="after-sales-list-page__fact-label">涉及金额</Text>
                    <Text className="after-sales-list-page__fact-value is-amount">{item.amountText}</Text>
                  </View>
                  <View className="after-sales-list-page__fact">
                    <Text className="after-sales-list-page__fact-label">提交时间</Text>
                    <Text className="after-sales-list-page__fact-value">{item.createdAt || '待同步'}</Text>
                  </View>
                </View>
                <View className="after-sales-list-page__card-foot">
                  <Text className="after-sales-list-page__link">查看详情</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </NotificationSurfaceShell>
  );
};

export default AfterSalesListPage;
