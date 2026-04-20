import { useEffect, useState } from 'react';
import { Text, View } from '@tarojs/components';
import Taro, { useReachBottom } from '@tarojs/taro';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Empty } from '@/components/Empty';
import { PullToRefreshNotice } from '@/components/PullToRefreshNotice';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import { usePullToRefreshFeedback } from '@/hooks/usePullToRefreshFeedback';
import { listDemands, type DemandSummary } from '@/services/demands';
import { useAuthStore } from '@/store/auth';
import { openAuthLoginPage } from '@/utils/authRedirect';
import { showErrorToast } from '@/utils/error';

const PAGE_SIZE = 10;

const getDemandStatusMeta = (status?: string) => {
  switch (status) {
    case 'matched':
      return { label: '已匹配', variant: 'success' as const, progress: 78 };
    case 'matching':
      return { label: '匹配中', variant: 'primary' as const, progress: 56 };
    case 'submitted':
    case 'reviewing':
      return { label: '审核中', variant: 'warning' as const, progress: 32 };
    case 'closed':
      return { label: '已关闭', variant: 'default' as const, progress: 100 };
    case 'draft':
    default:
      return { label: '草稿', variant: 'default' as const, progress: 12 };
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
      <View className="page bg-gray-50 min-h-screen p-md flex items-center justify-center" {...bindPullToRefresh}>
        <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />
        <Empty
          description="登录后查看我的需求"
          action={{ text: '去登录', onClick: () => void openAuthLoginPage('/pages/demands/list/index') }}
        />
      </View>
    );
  }

  if (loading && list.length === 0) {
    return (
      <View className="page bg-gray-50 min-h-screen p-md" {...bindPullToRefresh}>
        <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />
        <View className="flex justify-end mb-md">
          <Button size="small" variant="primary" onClick={openCreate}>新建需求</Button>
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
        <Button size="small" variant="primary" onClick={openCreate}>新建需求</Button>
      </View>

      {list.length === 0 ? (
        <Empty
          description="还没有提交过需求"
          action={{ text: '去创建', onClick: openCreate }}
        />
      ) : (
        <>
          {list.map((item) => {
            const statusMeta = getDemandStatusMeta(item.status);
            return (
              <Card key={item.id} className="mb-md" onClick={() => openDetail(item.id)}>
                <View className="flex items-start justify-between gap-sm mb-sm">
                  <View className="min-w-0 flex-1">
                    <Text className="font-bold text-base">{item.title || `需求 #${item.id}`}</Text>
                    <View className="text-sm text-gray-500 mt-xs">
                      {item.city || '城市待补充'}{item.district ? ` · ${item.district}` : ''}
                    </View>
                  </View>
                  <Tag variant={statusMeta.variant}>{statusMeta.label}</Tag>
                </View>

                <View className="flex flex-col gap-xs text-sm">
                  <View className="flex justify-between">
                    <Text className="text-gray-400">需求类型</Text>
                    <Text>{item.demandType || '未填写'}</Text>
                  </View>
                  <View className="flex justify-between">
                    <Text className="text-gray-400">建筑面积</Text>
                    <Text>{item.area > 0 ? `${item.area}㎡` : '待补充'}</Text>
                  </View>
                  <View className="flex justify-between items-start gap-sm">
                    <Text className="text-gray-400">预算范围</Text>
                    <Text style={{ textAlign: 'right' }}>{formatBudget(item)}</Text>
                  </View>
                  <View className="flex justify-between">
                    <Text className="text-gray-400">当前进度</Text>
                    <Text>{statusMeta.progress}%</Text>
                  </View>
                </View>

                <View className="mt-sm h-1 bg-gray-100 rounded-full overflow-hidden">
                  <View
                    className="h-full rounded-full"
                    style={{
                      width: `${statusMeta.progress}%`,
                      background: statusMeta.variant === 'success' ? '#10B981' : statusMeta.variant === 'warning' ? '#F59E0B' : statusMeta.variant === 'primary' ? '#2563EB' : '#94A3B8',
                    }}
                  />
                </View>

                <View className="flex justify-between items-center mt-sm">
                  <Text className="text-xs text-gray-400">更新于 {item.updatedAt || item.createdAt || '--'}</Text>
                  <Text className="text-sm text-brand">查看详情</Text>
                </View>
              </Card>
            );
          })}

          {loading && hasMore ? (
            <View className="text-center text-gray-400 text-xs py-md">加载中...</View>
          ) : null}
        </>
      )}
    </View>
  );
};

export default DemandListPage;
