import { useEffect, useMemo, useState } from 'react';
import { Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Empty } from '@/components/Empty';
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

const getProgressColor = (status: number) => {
  if (status === 2) return '#10B981';
  if (status === 1) return '#2563EB';
  if (status === 3) return '#94A3B8';
  return '#F59E0B';
};

const getProgressWidth = (status: number) => {
  if (status === 2 || status === 3) return '100%';
  if (status === 1) return '62%';
  return '28%';
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
      <View className="page bg-gray-50 min-h-screen p-md flex items-center justify-center" {...bindPullToRefresh}>
        <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />
        <Empty
          description="登录后查看售后记录"
          action={{ text: '去登录', onClick: () => void openAuthLoginPage('/pages/after-sales/list/index') }}
        />
      </View>
    );
  }

  if (loading && list.length === 0) {
    return (
      <View className="page bg-gray-50 min-h-screen p-md" {...bindPullToRefresh}>
        <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />
        <View className="flex justify-end mb-md">
          <Button size="small" variant="primary" onClick={openCreate}>发起售后</Button>
        </View>
        <Skeleton height={180} className="mb-md" />
        <Skeleton height={180} className="mb-md" />
        <Skeleton height={180} />
      </View>
    );
  }

  return (
    <View className="page bg-gray-50 min-h-screen p-md" {...bindPullToRefresh}>
      <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />
      <View className="flex justify-end mb-md">
        <Button size="small" variant="primary" onClick={openCreate}>发起售后</Button>
      </View>

      <View className="flex gap-sm overflow-x-auto mb-md">
        {FILTERS.map((item) => {
          const active = activeFilter === item.key;
          return (
            <View
              key={item.key}
              className={`px-md py-xs rounded-full ${active ? 'bg-blue-50' : 'bg-white'}`}
              style={{ border: active ? '1px solid #2563EB' : '1px solid #E5E7EB', flexShrink: 0 }}
              onClick={() => setActiveFilter(item.key)}
            >
              <Text className={active ? 'text-brand text-sm' : 'text-sm text-gray-500'}>{item.label}</Text>
            </View>
          );
        })}
      </View>

      {filteredList.length === 0 ? (
        <Empty description={activeFilter === 'all' ? '暂无售后申请' : '当前筛选下暂无记录'} />
      ) : (
        filteredList.map((item) => (
          <Card key={item.id} className="mb-md" onClick={() => openDetail(item.id)}>
            <View className="flex items-start justify-between gap-sm mb-sm">
              <View className="min-w-0 flex-1">
                <Text className="block font-bold text-base">{item.reason}</Text>
                <Text className="block text-sm text-gray-500 mt-xs">关联预约 #{item.bookingId} · 单号 {item.orderNo}</Text>
              </View>
              <Tag variant={item.status === 2 ? 'success' : item.status === 1 ? 'primary' : item.status === 3 ? 'default' : 'warning'}>
                {item.statusText}
              </Tag>
            </View>
            <View className="flex justify-between items-center text-sm">
              <Text className="text-gray-400">{item.typeText}</Text>
              <Text className="font-medium">{item.amountText}</Text>
            </View>
            <View className="mt-sm h-1 bg-gray-100 rounded-full overflow-hidden">
              <View className="h-full rounded-full" style={{ width: getProgressWidth(item.status), background: getProgressColor(item.status) }} />
            </View>
            <View className="flex justify-between items-center mt-sm">
              <Text className="text-xs text-gray-400">提交于 {item.createdAt || '--'}</Text>
              <Text className="text-sm text-brand">查看详情</Text>
            </View>
          </Card>
        ))
      )}
    </View>
  );
};

export default AfterSalesListPage;
