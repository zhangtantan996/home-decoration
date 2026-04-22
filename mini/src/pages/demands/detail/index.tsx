import { useEffect, useMemo, useState } from 'react';
import { Text, View } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Empty } from '@/components/Empty';
import { NotificationActionBar } from '@/components/NotificationActionBar';
import { NotificationFactGrid } from '@/components/NotificationFactGrid';
import { NotificationSurfaceShell } from '@/components/NotificationSurfaceShell';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import { getDemandDetail, submitDemand, type DemandDetail } from '@/services/demands';
import { useAuthStore } from '@/store/auth';
import { openAuthLoginPage } from '@/utils/authRedirect';
import { showErrorToast } from '@/utils/error';
import { getPageBottomSpacerStyle } from '@/utils/fixedLayout';

const getStatusMeta = (status?: string) => {
  switch (status) {
    case 'matched':
      return { label: '已匹配', variant: 'success' as const };
    case 'matching':
      return { label: '匹配中', variant: 'primary' as const };
    case 'submitted':
    case 'reviewing':
      return { label: '审核中', variant: 'warning' as const };
    case 'closed':
      return { label: '已关闭', variant: 'default' as const };
    case 'draft':
    default:
      return { label: '草稿', variant: 'default' as const };
  }
};

const getMatchStatusMeta = (detailStatus: string, matchStatus: string, hasProposal: boolean) => {
  if (hasProposal) {
    return { label: '已提交方案', variant: 'success' as const };
  }
  if (matchStatus === 'declined') {
    return { label: '已放弃', variant: 'warning' as const };
  }
  if (matchStatus === 'responded') {
    return { label: '已响应', variant: 'primary' as const };
  }
  if (detailStatus === 'matched' || detailStatus === 'matching') {
    return { label: '待响应', variant: 'brand' as const };
  }
  return { label: matchStatus || '待同步', variant: 'default' as const };
};

const formatBudget = (detail: DemandDetail) => {
  if (detail.budgetMin > 0 && detail.budgetMax > 0) {
    return `¥${detail.budgetMin.toLocaleString()} - ¥${detail.budgetMax.toLocaleString()}`;
  }
  if (detail.budgetMax > 0) {
    return `¥${detail.budgetMax.toLocaleString()}以内`;
  }
  return '预算待补充';
};

const formatAttachmentSize = (size: number) => {
  if (size <= 0) return '已上传';
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const DemandDetailPage: React.FC = () => {
  const auth = useAuthStore();
  const [id, setId] = useState(0);
  const [detail, setDetail] = useState<DemandDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const pageBottomStyle = useMemo(() => getPageBottomSpacerStyle(), []);

  useLoad((options) => {
    setId(Number(options.id || 0));
  });

  const fetchDetail = async () => {
    if (!id) {
      setLoading(false);
      return;
    }

    if (!auth.token) {
      setDetail(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const result = await getDemandDetail(id);
      setDetail(result);
    } catch (error) {
      showErrorToast(error, '需求详情加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchDetail();
  }, [auth.token, id]); // eslint-disable-line react-hooks/exhaustive-deps

  const proposalCount = useMemo(
    () => (detail?.matches || []).filter((item) => Boolean(item.proposal)).length,
    [detail],
  );

  const handleEdit = () => {
    if (!detail) return;
    Taro.navigateTo({ url: `/pages/demands/create/index?id=${detail.id}` });
  };

  const handleCompare = () => {
    if (!detail) return;
    Taro.navigateTo({ url: `/pages/demands/compare/index?id=${detail.id}` });
  };

  const handleSubmit = async () => {
    if (!detail || submitting) return;
    try {
      setSubmitting(true);
      await submitDemand(detail.id);
      Taro.showToast({ title: '需求已提交', icon: 'success' });
      await fetchDetail();
    } catch (error) {
      showErrorToast(error, '提交需求失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (!auth.token) {
    return (
      <NotificationSurfaceShell className="page bg-gray-50 min-h-screen">
        <Empty
          description="登录后查看需求详情"
          action={{ text: '去登录', onClick: () => void openAuthLoginPage('/pages/demands/list/index') }}
        />
      </NotificationSurfaceShell>
    );
  }

  if (loading) {
    return (
      <View className="page bg-gray-50 min-h-screen p-md">
        <Skeleton height={170} className="mb-md" />
        <Skeleton height={190} className="mb-md" />
        <Skeleton height={240} />
      </View>
    );
  }

  if (!detail) {
    return (
      <NotificationSurfaceShell className="page bg-gray-50 min-h-screen">
        <Empty description="未找到需求详情" />
      </NotificationSurfaceShell>
    );
  }

  const statusMeta = getStatusMeta(detail.status);
  const compactReason = detail.status === 'closed' ? detail.closedReason : detail.reviewNote;

  return (
    <NotificationSurfaceShell className="page bg-gray-50 min-h-screen" style={pageBottomStyle}>
      <Card className="notification-surface-card" extra={<Tag variant={statusMeta.variant}>{statusMeta.label}</Tag>}>
        <View style={{ display: 'flex', flexDirection: 'column', gap: '20rpx' }}>
          <View>
            <Text style={{ display: 'block', fontSize: '22rpx', color: '#8E8E93' }}>需求详情</Text>
            <Text style={{ display: 'block', marginTop: '12rpx', fontSize: '34rpx', lineHeight: 1.25, fontWeight: 700, color: '#0F172A' }}>
              {detail.title || `需求 #${detail.id}`}
            </Text>
            <Text style={{ display: 'block', marginTop: '10rpx', fontSize: '24rpx', lineHeight: 1.5, color: '#64748B' }}>
              {formatBudget(detail)} · {detail.city || '城市待补充'}{detail.district ? ` · ${detail.district}` : ''}
            </Text>
          </View>
          <NotificationFactGrid
            items={[
              { label: '建筑面积', value: detail.area > 0 ? `${detail.area}㎡` : '待补充' },
              { label: '计划启动', value: detail.timeline || '未填写' },
              { label: '已收方案', value: `${proposalCount} 份`, emphasis: proposalCount > 0 },
              {
                label: '匹配进度',
                value: `${detail.matchedCount}/${detail.maxMatch || 0}`,
                hint: detail.createdAt || '待同步',
              },
            ]}
          />
        </View>
      </Card>

      {compactReason ? (
        <Card className="notification-surface-card" title={detail.status === 'closed' ? '关闭原因' : '审核说明'}>
          <Text className="notification-section-row__note" style={{ marginTop: 0, color: '#0F172A' }}>
            {compactReason}
          </Text>
        </Card>
      ) : null}

      <Card className="notification-surface-card" title="房屋与需求">
        <View className="notification-section-list">
          <View className="notification-section-row">
            <View className="notification-section-row__head">
              <Text className="notification-section-row__title">需求类型</Text>
              <Text className="notification-section-row__value" style={{ color: '#0F172A', fontWeight: 600 }}>
                {detail.demandType || '未填写'}
              </Text>
            </View>
          </View>
          <View className="notification-section-row">
            <View className="notification-section-row__head">
              <Text className="notification-section-row__title">风格偏好</Text>
              <Text className="notification-section-row__value" style={{ color: '#0F172A', fontWeight: 600 }}>
                {detail.stylePref || '未填写'}
              </Text>
            </View>
          </View>
          <View className="notification-section-row">
            <View className="notification-section-row__head">
              <Text className="notification-section-row__title">详细地址</Text>
            </View>
            <Text className="notification-section-row__note" style={{ marginTop: '8rpx', color: '#0F172A' }}>
              {detail.address || '未填写'}
            </Text>
          </View>
          {detail.description ? (
            <View className="notification-section-row">
              <View className="notification-section-row__head">
                <Text className="notification-section-row__title">需求概述</Text>
              </View>
              <Text className="notification-section-row__note" style={{ marginTop: '8rpx', color: '#475569' }}>
                {detail.description}
              </Text>
            </View>
          ) : null}
        </View>
      </Card>

      <Card
        className="notification-surface-card"
        title="匹配结果"
        extra={<Text style={{ fontSize: '22rpx', color: '#8E8E93' }}>{detail.matches.length} 位服务方</Text>}
      >
        {detail.matches.length === 0 ? (
          <View className="text-sm text-gray-500">当前还没有服务商响应</View>
        ) : (
          <View className="notification-section-list">
            {detail.matches.map((item) => {
              const matchStatus = getMatchStatusMeta(detail.status, item.status, Boolean(item.proposal));
              return (
                <View key={item.id} className="notification-section-row">
                  <View className="notification-section-row__head">
                    <Text className="notification-section-row__title">{item.provider.name}</Text>
                    <Tag variant={matchStatus.variant}>{matchStatus.label}</Tag>
                  </View>
                  <Text className="notification-section-row__note">{item.provider.specialty || '平台认证服务商'}</Text>
                  <Text className="notification-section-row__note">
                    {item.respondedAt ? `最近响应：${item.respondedAt}` : `响应截止：${item.responseDeadline || '待同步'}`}
                  </Text>
                  {item.declineReason ? <Text className="notification-section-row__note is-danger">放弃原因：{item.declineReason}</Text> : null}
                </View>
              );
            })}
          </View>
        )}
      </Card>

      {detail.attachments.length > 0 ? (
        <Card
          className="notification-surface-card"
          title="需求附件"
          extra={<Text style={{ fontSize: '22rpx', color: '#8E8E93' }}>{detail.attachments.length} 份</Text>}
        >
          <Text className="notification-section-row__note" style={{ marginTop: 0 }}>
            当前端仅展示附件清单，完整查看请在支持端打开。
          </Text>
          <View className="notification-section-list">
            {detail.attachments.map((item, index) => (
              <View key={`${item.url}-${index}`} className="notification-section-row">
                <View className="notification-section-row__head">
                  <Text className="notification-section-row__title">{item.name || `附件 ${index + 1}`}</Text>
                  <Text className="notification-section-row__value" style={{ color: '#0F172A', fontWeight: 600 }}>
                    {formatAttachmentSize(item.size)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      {detail.status === 'draft' ? (
        <NotificationActionBar>
          <Button variant="outline" onClick={handleEdit}>继续编辑</Button>
          <Button variant="primary" loading={submitting} onClick={() => void handleSubmit()}>提交需求</Button>
        </NotificationActionBar>
      ) : proposalCount > 0 ? (
        <NotificationActionBar single>
          <Button variant="primary" onClick={handleCompare}>去对比方案</Button>
        </NotificationActionBar>
      ) : null}
    </NotificationSurfaceShell>
  );
};

export default DemandDetailPage;
