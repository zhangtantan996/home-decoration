import { useEffect, useState } from 'react';
import { View } from '@tarojs/components';
import Taro from '@tarojs/taro';

import { Button } from '@/components/Button';
import { Empty } from '@/components/Empty';
import { NotificationInboxCell } from '@/components/NotificationInboxCell';
import { NotificationSurfaceShell } from '@/components/NotificationSurfaceShell';
import { PullToRefreshNotice } from '@/components/PullToRefreshNotice';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import { listComplaints, type ComplaintListItem } from '@/services/complaints';
import { usePullToRefreshFeedback } from '@/hooks/usePullToRefreshFeedback';
import { useAuthStore } from '@/store/auth';
import { openAuthLoginPage } from '@/utils/authRedirect';
import { showErrorToast } from '@/utils/error';

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

const getComplaintMeta = (status?: string) => {
  if (status === 'resolved') return { label: '已处理', tone: 'success' as const };
  if (status === 'processing') return { label: '处理中', tone: 'brand' as const };
  return { label: '已提交', tone: 'neutral' as const };
};

const getComplaintSummary = (item: ComplaintListItem) => {
  if (item.resolution) {
    return `处理结果：${item.resolution}`;
  }

  if (item.merchantResponse) {
    return `商家回复：${item.merchantResponse}`;
  }

  if (item.freezePayment) {
    return '当前投诉已触发资金冻结';
  }

  return item.description || '等待平台处理';
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
      <NotificationSurfaceShell className="page bg-gray-50 min-h-screen flex items-center justify-center" {...bindPullToRefresh}>
        <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />
        <Empty
          description="登录后查看投诉记录"
          action={{ text: '去登录', onClick: () => void openAuthLoginPage('/pages/complaints/list/index') }}
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
            <Button size="small" variant="outline" onClick={openCreate}>发起投诉</Button>
          </View>
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
          <View className="text-sm text-gray-400">{`共 ${list.length} 条投诉`}</View>
          <Button size="small" variant="outline" onClick={openCreate}>发起投诉</Button>
        </View>

        {list.length === 0 ? (
          <Empty description="暂无投诉记录" />
        ) : (
          <View style={sectionStyle}>
            {list.map((item) => {
              const meta = getComplaintMeta(item.status);
              return (
                <View key={item.id} style={cellCardStyle}>
                  <NotificationInboxCell
                    title={item.title}
                    summary={getComplaintSummary(item)}
                    timeLabel={item.createdAt || ''}
                    statusLabel={meta.label}
                    statusTone={meta.tone}
                    typeBadge={
                      <View style={badgeRowStyle}>
                        <Tag variant="default">{item.category || '投诉'}</Tag>
                        {item.freezePayment ? <Tag variant="error">冻结中</Tag> : null}
                      </View>
                    }
                  />
                </View>
              );
            })}
          </View>
        )}
      </View>
    </NotificationSurfaceShell>
  );
};

export default ComplaintListPage;
