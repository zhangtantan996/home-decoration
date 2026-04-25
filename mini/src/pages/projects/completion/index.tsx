import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, Text, View } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Empty } from '@/components/Empty';
import { NotificationActionBar } from '@/components/NotificationActionBar';
import { NotificationFactGrid } from '@/components/NotificationFactGrid';
import { NotificationSurfaceShell } from '@/components/NotificationSurfaceShell';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import {
  approveProjectCompletion,
  getProjectCompletion,
  rejectProjectCompletion,
  type ProjectCompletionDetail,
} from '@/services/projects';
import { showErrorToast } from '@/utils/error';
import { getPageBottomSpacerStyle } from '@/utils/fixedLayout';
import { formatServerDateTime } from '@/utils/serverTime';

const readStageText = (stage?: string) => {
  switch (stage) {
    case 'completed':
      return '完工待验收';
    case 'archived':
      return '已归档';
    default:
      return stage || '处理中';
  }
};

const ProjectCompletionPage: React.FC = () => {
  const [projectId, setProjectId] = useState(0);
  const [detail, setDetail] = useState<ProjectCompletionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const pageBottomStyle = useMemo(() => getPageBottomSpacerStyle(), []);

  useLoad((options) => {
    if (options.id) {
      setProjectId(Number(options.id));
    }
  });

  const fetchDetail = useCallback(async () => {
    if (!projectId) {
      setDetail(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await getProjectCompletion(projectId);
      setDetail(result.completion);
    } catch (error) {
      showErrorToast(error, '加载完工审批失败');
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  const handleReject = () => {
    if (!detail || submitting) {
      return;
    }
    Taro.showModal({
      title: '驳回完工材料',
      content: '请补充驳回原因',
      editable: true,
      placeholderText: '请输入驳回原因',
      success: async (res: { confirm: boolean; content?: string }) => {
        if (!res.confirm) {
          return;
        }
        const reason = String(res.content || '').trim();
        if (!reason) {
          Taro.showToast({ title: '请填写驳回原因', icon: 'none' });
          return;
        }
        try {
          setSubmitting(true);
          setMessage('');
          await rejectProjectCompletion(projectId, reason);
          Taro.showToast({ title: '已驳回', icon: 'success' });
          await fetchDetail();
        } catch (error) {
          showErrorToast(error, '驳回失败');
        } finally {
          setSubmitting(false);
        }
      },
    } as any);
  };

  const handleApprove = async () => {
    if (!detail || submitting) {
      return;
    }
    try {
      setSubmitting(true);
      setMessage('');
      const result = await approveProjectCompletion(projectId);
      const tip = result.auditId ? `已生成案例草稿 #${result.auditId}` : '验收通过';
      Taro.showToast({ title: '验收通过', icon: 'success' });
      setMessage(tip);
      await fetchDetail();
    } catch (error) {
      showErrorToast(error, '验收失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View className="p-md bg-gray-50 min-h-screen">
        <Skeleton height={180} className="mb-md" />
        <Skeleton height={180} className="mb-md" />
        <Skeleton height={220} />
      </View>
    );
  }

  if (!detail) {
    return (
      <NotificationSurfaceShell className="page bg-gray-50 min-h-screen" style={pageBottomStyle}>
        <Empty
          description="当前项目暂无完工审批记录"
          action={{
            text: '返回项目详情',
            onClick: () => Taro.redirectTo({ url: `/pages/projects/detail/index?id=${projectId}` }),
          }}
        />
      </NotificationSurfaceShell>
    );
  }

  const canApprove = Boolean(detail.availableActions?.includes('approve_completion'));
  const canReject = Boolean(detail.availableActions?.includes('reject_completion'));
  const canReview = canApprove || canReject;
  const stageText = readStageText(detail.businessStage);
  const closure = detail.closureSummary;
  const photos = detail.completedPhotos || [];

  return (
    <NotificationSurfaceShell className="page bg-gray-50 min-h-screen" style={pageBottomStyle}>
      <ScrollView scrollY className="h-full">
        <Card className="notification-surface-card" extra={<Tag variant={canReview ? 'warning' : 'default'}>{canReview ? '待验收' : '已归档'}</Tag>}>
          <View style={{ display: 'flex', flexDirection: 'column', gap: '20rpx' }}>
            <View>
              <Text style={{ display: 'block', fontSize: '22rpx', color: '#8E8E93' }}>完工验收</Text>
              <Text style={{ display: 'block', marginTop: '12rpx', fontSize: '36rpx', lineHeight: 1.22, fontWeight: 700, color: '#0F172A' }}>
                {canReview ? '待验收' : '已归档'}
              </Text>
              <Text style={{ display: 'block', marginTop: '10rpx', fontSize: '24rpx', lineHeight: 1.5, color: '#64748B' }}>
                {stageText} · 项目 #{projectId}
              </Text>
            </View>
            <NotificationFactGrid
              items={[
                { label: '提交时间', value: formatServerDateTime(detail.completionSubmittedAt, '待提交') },
                { label: '照片数量', value: `${photos.length} 张`, emphasis: photos.length > 0 },
                { label: '归档状态', value: closure?.archiveStatus || '待同步' },
                { label: '结算状态', value: closure?.settlementStatus || '待同步' },
                { label: '案例草稿', value: detail.inspirationCaseDraftId ? `#${detail.inspirationCaseDraftId}` : '待生成', full: true },
              ]}
            />
          </View>
        </Card>

        {message ? (
          <Card className="notification-surface-card" title="处理结果">
            <Text className="notification-section-row__note" style={{ marginTop: 0, color: '#0F172A' }}>
              {message}
            </Text>
          </Card>
        ) : null}

        {detail.completionRejectionReason ? (
          <Card className="notification-surface-card" title="最近一次驳回原因">
            <Text className="notification-section-row__note is-danger" style={{ marginTop: 0 }}>
              {detail.completionRejectionReason}
            </Text>
          </Card>
        ) : null}

        <Card className="notification-surface-card" title="验收记录">
          <View className="notification-section-list">
            <View className="notification-section-row">
              <View className="notification-section-row__head">
                <Text className="notification-section-row__title">提交时间</Text>
                <Text className="notification-section-row__value" style={{ color: '#0F172A', fontWeight: 600 }}>
                  {formatServerDateTime(detail.completionSubmittedAt, '待提交')}
                </Text>
              </View>
            </View>
            <View className="notification-section-row">
              <View className="notification-section-row__head">
                <Text className="notification-section-row__title">驳回时间</Text>
                <Text className="notification-section-row__value" style={{ color: '#0F172A', fontWeight: 600 }}>
                  {formatServerDateTime(detail.completionRejectedAt, '无')}
                </Text>
              </View>
            </View>
            <View className="notification-section-row">
              <View className="notification-section-row__head">
                <Text className="notification-section-row__title">归档状态</Text>
                <Text className="notification-section-row__value" style={{ color: '#0F172A', fontWeight: 600 }}>
                  {closure?.archiveStatus || '待同步'}
                </Text>
              </View>
            </View>
            <View className="notification-section-row">
              <View className="notification-section-row__head">
                <Text className="notification-section-row__title">后续动作</Text>
              </View>
              <Text className="notification-section-row__note">{closure?.nextPendingAction || '暂无额外待处理事项'}</Text>
            </View>
          </View>
        </Card>

        {(detail.quoteTruthSummary || detail.changeOrderSummary || detail.settlementSummary || detail.payoutSummary) ? (
          <Card className="notification-surface-card" title="成交报价与后链摘要">
            <View className="notification-section-list">
              <View className="notification-section-row">
                <View className="notification-section-row__head">
                  <Text className="notification-section-row__title">成交报价</Text>
                  <Text className="notification-section-row__value" style={{ color: '#0F172A', fontWeight: 600 }}>
                    {detail.quoteTruthSummary?.totalCent ? `¥${Math.round(detail.quoteTruthSummary.totalCent / 100).toLocaleString()}` : '待同步'}
                  </Text>
                </View>
              </View>
              <View className="notification-section-row">
                <View className="notification-section-row__head">
                  <Text className="notification-section-row__title">预计工期</Text>
                  <Text className="notification-section-row__value" style={{ color: '#0F172A', fontWeight: 600 }}>
                    {detail.quoteTruthSummary?.estimatedDays ? `${detail.quoteTruthSummary.estimatedDays} 天` : '待同步'}
                  </Text>
                </View>
              </View>
              <View className="notification-section-row">
                <View className="notification-section-row__head">
                  <Text className="notification-section-row__title">变更待结算</Text>
                  <Text className="notification-section-row__value" style={{ color: '#0F172A', fontWeight: 600 }}>
                    {detail.changeOrderSummary?.pendingSettlementCount || 0}
                  </Text>
                </View>
              </View>
              <View className="notification-section-row">
                <View className="notification-section-row__head">
                  <Text className="notification-section-row__title">结算 / 出款</Text>
                </View>
                <Text className="notification-section-row__note">
                  {detail.settlementSummary?.status || closure?.settlementStatus || '待同步'} / {detail.payoutSummary?.status || closure?.payoutStatus || '待同步'}
                </Text>
              </View>
            </View>
          </Card>
        ) : null}

        <Card
          className="notification-surface-card"
          title="完工照片"
          extra={<Text style={{ fontSize: '22rpx', color: '#8E8E93' }}>{photos.length} 张</Text>}
        >
          {photos.length === 0 ? (
            <View className="text-sm text-gray-500">暂未上传完工照片</View>
          ) : (
            <View style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '14rpx' }}>
              {photos.map((photo, index) => (
                <View key={`${photo}-${index}`} style={{ display: 'flex', flexDirection: 'column', gap: '8rpx' }}>
                  <Image
                    src={photo}
                    mode="aspectFill"
                    style={{ width: '100%', height: '220rpx', borderRadius: '22rpx', background: '#F3F4F6' }}
                    onClick={() => {
                      Taro.previewImage({ current: photo, urls: photos });
                    }}
                  />
                  <Text style={{ fontSize: '22rpx', color: '#8E8E93' }}>完工照片 {index + 1}</Text>
                </View>
              ))}
            </View>
          )}
        </Card>
      </ScrollView>

      {canReview ? (
        <NotificationActionBar>
          <Button variant="secondary" disabled={submitting || !canReject} onClick={handleReject}>
            驳回整改
          </Button>
          <Button variant="primary" disabled={submitting || !canApprove} loading={submitting} onClick={handleApprove}>
            验收通过
          </Button>
        </NotificationActionBar>
      ) : (
        <NotificationActionBar single>
          <Button variant="outline" onClick={() => Taro.redirectTo({ url: `/pages/projects/detail/index?id=${projectId}` })}>
            返回项目详情
          </Button>
        </NotificationActionBar>
      )}
    </NotificationSurfaceShell>
  );
};

export default ProjectCompletionPage;
