import { useEffect, useState } from 'react';
import { Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Empty } from '@/components/Empty';
import { PullToRefreshNotice } from '@/components/PullToRefreshNotice';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import { listComplaints, type ComplaintListItem } from '@/services/complaints';
import { usePullToRefreshFeedback } from '@/hooks/usePullToRefreshFeedback';
import { useAuthStore } from '@/store/auth';
import { openAuthLoginPage } from '@/utils/authRedirect';
import { showErrorToast } from '@/utils/error';

const getComplaintMeta = (status?: string) => {
  if (status === 'resolved') return { label: '已处理', variant: 'success' as const, progress: 100 };
  if (status === 'processing') return { label: '处理中', variant: 'primary' as const, progress: 62 };
  return { label: '已提交', variant: 'warning' as const, progress: 24 };
};

const ComplaintListPage: React.FC = () => {
  const auth = useAuthStore();
  const [list, setList] = useState<ComplaintListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchList = async () => {
    if (!auth.token) {
      setList([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const result = await listComplaints();
      setList(result);
    } catch (error) {
      showErrorToast(error, '投诉列表加载失败');
    } finally {
      setLoading(false);
    }
  };

  const { refreshStatus, drawerHeight, drawerProgress, bindPullToRefresh, runReload } =
    usePullToRefreshFeedback(fetchList);

  useEffect(() => {
    void runReload();
  }, [auth.token, runReload]);

  const openCreate = () => {
    if (!auth.token) {
      void openAuthLoginPage('/pages/complaints/list/index');
      return;
    }
    Taro.navigateTo({ url: '/pages/complaints/create/index' });
  };

  if (!auth.token) {
    return (
      <View className="page bg-gray-50 min-h-screen p-md flex items-center justify-center" {...bindPullToRefresh}>
        <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />
        <Empty
          description="登录后查看投诉记录"
          action={{ text: '去登录', onClick: () => void openAuthLoginPage('/pages/complaints/list/index') }}
        />
      </View>
    );
  }

  if (loading && list.length === 0) {
    return (
      <View className="page bg-gray-50 min-h-screen p-md" {...bindPullToRefresh}>
        <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />
        <View className="flex justify-end mb-md">
          <Button size="small" variant="primary" onClick={openCreate}>发起投诉</Button>
        </View>
        <Skeleton height={180} className="mb-md" />
        <Skeleton height={180} className="mb-md" />
      </View>
    );
  }

  return (
    <View className="page bg-gray-50 min-h-screen p-md" {...bindPullToRefresh}>
      <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />
      <View className="flex justify-end mb-md">
        <Button size="small" variant="primary" onClick={openCreate}>发起投诉</Button>
      </View>

      {list.length === 0 ? (
        <Empty description="暂无投诉记录" />
      ) : (
        list.map((item) => {
          const meta = getComplaintMeta(item.status);
          return (
            <Card key={item.id} className="mb-md">
              <View className="flex items-start justify-between gap-sm mb-sm">
                <View className="min-w-0 flex-1">
                  <Text className="block font-bold text-base">{item.title}</Text>
                  <Text className="block text-sm text-gray-500 mt-xs">项目 #{item.projectId || 0} · {item.category || '其他'}</Text>
                </View>
                <Tag variant={meta.variant}>{meta.label}</Tag>
              </View>
              <View className="text-sm text-gray-700 leading-relaxed">{item.description || '暂无补充说明。'}</View>
              {item.merchantResponse ? (
                <View className="mt-sm text-sm text-blue-600">商家回复：{item.merchantResponse}</View>
              ) : null}
              {item.resolution ? (
                <View className="mt-sm text-sm text-green-600">处理结果：{item.resolution}</View>
              ) : null}
              {item.freezePayment ? (
                <View className="mt-sm text-xs text-red-500">当前投诉已触发资金冻结。</View>
              ) : null}
              <View className="mt-sm h-1 bg-gray-100 rounded-full overflow-hidden">
                <View className="h-full rounded-full" style={{ width: `${meta.progress}%`, background: meta.variant === 'success' ? '#10B981' : meta.variant === 'primary' ? '#2563EB' : '#F59E0B' }} />
              </View>
              <View className="text-xs text-gray-400 mt-sm">提交于 {item.createdAt || '--'}</View>
            </Card>
          );
        })
      )}
    </View>
  );
};

export default ComplaintListPage;
