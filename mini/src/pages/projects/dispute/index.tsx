import React, { useEffect, useMemo, useState } from 'react';
import { Image, Text, View } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Empty } from '@/components/Empty';
import { Input } from '@/components/Input';
import { NotificationActionBar } from '@/components/NotificationActionBar';
import { NotificationFactGrid } from '@/components/NotificationFactGrid';
import { NotificationSurfaceShell } from '@/components/NotificationSurfaceShell';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import { submitProjectDispute, getProjectDetail, type ProjectDetail } from '@/services/projects';
import { uploadFile } from '@/services/uploads';
import { useAuthStore } from '@/store/auth';
import { isUserCancelError, showErrorToast } from '@/utils/error';
import { getPageBottomSpacerStyle } from '@/utils/fixedLayout';
import { formatServerDateTime } from '@/utils/serverTime';

const ProjectDisputePage: React.FC = () => {
  const auth = useAuthStore();
  const [projectId, setProjectId] = useState(0);
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [reason, setReason] = useState('');
  const [evidence, setEvidence] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const pageBottomStyle = useMemo(() => getPageBottomSpacerStyle(), []);

  useLoad((options) => {
    if (options.id) {
      setProjectId(Number(options.id));
    }
  });

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }
    if (!auth.token) {
      setProject(null);
      setLoading(false);
      return;
    }

    const fetchDetail = async () => {
      setLoading(true);
      try {
        const detail = await getProjectDetail(projectId);
        setProject(detail);
        setEvidence(detail.riskSummary?.disputeEvidence || []);
      } catch (error) {
        showErrorToast(error, '加载失败');
      } finally {
        setLoading(false);
      }
    };

    void fetchDetail();
  }, [auth.token, projectId]);

  const disputed = Boolean(project?.riskSummary?.disputedAt);
  const canSubmit = useMemo(() => reason.trim().length >= 6 && !disputed, [disputed, reason]);

  const handleChooseEvidence = async () => {
    if (uploading || disputed) return;
    try {
      const res = await Taro.chooseImage({ count: 6, sizeType: ['compressed'], sourceType: ['album', 'camera'] });
      if (!res.tempFilePaths?.length) return;
      setUploading(true);
      const uploaded = await Promise.all(res.tempFilePaths.map((filePath) => uploadFile(filePath)));
      setEvidence((prev) => [...prev, ...uploaded.map((item) => item.path || item.url)].slice(0, 6));
      Taro.showToast({ title: '证据已上传', icon: 'success' });
    } catch (error) {
      if (isUserCancelError(error)) {
        return;
      }
      showErrorToast(error, '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!projectId || !canSubmit || submitting) return;
    setSubmitting(true);
    try {
      await submitProjectDispute(projectId, { reason: reason.trim(), evidence });
      Taro.showToast({ title: '已提交争议', icon: 'success' });
      setTimeout(() => {
        Taro.redirectTo({ url: `/pages/projects/detail/index?id=${projectId}` });
      }, 800);
    } catch (error) {
      showErrorToast(error, '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (!auth.token) {
    return (
      <NotificationSurfaceShell className="page bg-gray-50 min-h-screen p-md">
        <Empty description="登录后可发起争议" action={{ text: '去登录', onClick: () => Taro.switchTab({ url: '/pages/profile/index' }) }} />
      </NotificationSurfaceShell>
    );
  }

  if (loading) {
    return (
      <View className="page bg-gray-50 min-h-screen p-md">
        <Skeleton height={170} className="mb-md" />
        <Skeleton height={220} className="mb-md" />
        <Skeleton height={220} />
      </View>
    );
  }

  if (!project) {
    return (
      <NotificationSurfaceShell className="page bg-gray-50 min-h-screen p-md">
        <Empty description="未找到项目信息" />
      </NotificationSurfaceShell>
    );
  }

  const riskSummary = project.riskSummary;
  const statusText = disputed ? '平台处理中' : '待提交';
  const statusVariant = disputed ? 'error' : 'brand';

  return (
    <NotificationSurfaceShell className="page bg-gray-50 min-h-screen" style={pageBottomStyle}>
      <Card className="notification-surface-card" extra={<Tag variant={statusVariant}>{statusText}</Tag>}>
        <View style={{ display: 'flex', flexDirection: 'column', gap: '20rpx' }}>
          <View>
            <Text style={{ display: 'block', fontSize: '22rpx', color: '#8E8E93' }}>项目争议</Text>
            <Text style={{ display: 'block', marginTop: '12rpx', fontSize: '34rpx', lineHeight: 1.25, fontWeight: 700, color: '#0F172A' }}>
              {project.name || '争议处理'}
            </Text>
            <Text style={{ display: 'block', marginTop: '10rpx', fontSize: '24rpx', lineHeight: 1.5, color: '#64748B' }}>
              {project.address || '地址待补充'}
            </Text>
          </View>
          <NotificationFactGrid
            items={[
              { label: '争议状态', value: statusText },
              { label: '证据数量', value: `${evidence.length} 份`, emphasis: evidence.length > 0 },
              { label: '提交时间', value: formatServerDateTime(riskSummary?.disputedAt, disputed ? '已提交' : '未提交') },
              { label: '托管状态', value: riskSummary?.escrowFrozen ? '已冻结' : '未冻结' },
            ]}
          />
        </View>
      </Card>

      {disputed && riskSummary?.disputeReason ? (
        <Card className="notification-surface-card" title="争议原因">
          <Text className="notification-section-row__note is-danger" style={{ marginTop: 0 }}>
            {riskSummary.disputeReason}
          </Text>
        </Card>
      ) : null}

      {disputed ? (
        <Card className="notification-surface-card" title="处理进展">
          <View className="notification-section-list">
            <View className="notification-section-row">
              <View className="notification-section-row__head">
                <Text className="notification-section-row__title">当前处理</Text>
                <Text className="notification-section-row__value" style={{ color: '#0F172A', fontWeight: 600 }}>
                  {riskSummary?.auditStatus || '平台处理中'}
                </Text>
              </View>
            </View>
            <View className="notification-section-row">
              <View className="notification-section-row__head">
                <Text className="notification-section-row__title">处理记录</Text>
                <Text className="notification-section-row__value" style={{ color: '#0F172A', fontWeight: 600 }}>
                  {riskSummary?.auditId ? `#${riskSummary.auditId}` : '待生成'}
                </Text>
              </View>
            </View>
          </View>
        </Card>
      ) : (
        <Card className="notification-surface-card" title="争议说明">
          <Input
            label="争议原因"
            value={reason}
            onChange={setReason}
            placeholder="请填写问题经过与诉求，至少 6 个字"
          />
          <Text className="notification-section-row__note">提交后将进入平台处理流程。</Text>
        </Card>
      )}

      <Card
        className="notification-surface-card"
        title="证据材料"
        extra={<Text style={{ fontSize: '22rpx', color: '#8E8E93' }}>最多 6 份</Text>}
      >
        {!disputed ? (
          <View style={{ marginBottom: '16rpx' }}>
            <Button variant="outline" disabled={uploading || evidence.length >= 6} loading={uploading} onClick={handleChooseEvidence}>
              上传证据
            </Button>
          </View>
        ) : null}
        {evidence.length === 0 ? (
          <Text className="notification-section-row__note" style={{ marginTop: 0 }}>暂无已上传证据</Text>
        ) : (
          <View style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '14rpx' }}>
            {evidence.map((item, index) => (
              <View key={`${item}-${index}`} style={{ display: 'flex', flexDirection: 'column', gap: '8rpx' }}>
                <Image
                  src={item}
                  mode="aspectFill"
                  style={{ width: '100%', height: '220rpx', borderRadius: '22rpx', background: '#F3F4F6' }}
                  onClick={() => Taro.previewImage({ urls: evidence, current: item })}
                />
                <Text style={{ fontSize: '22rpx', color: '#8E8E93' }}>证据 {index + 1}</Text>
              </View>
            ))}
          </View>
        )}
      </Card>

      {!disputed ? (
        <NotificationActionBar single>
          <Button block disabled={!canSubmit || submitting} loading={submitting} onClick={handleSubmit}>
            提交争议
          </Button>
        </NotificationActionBar>
      ) : null}
    </NotificationSurfaceShell>
  );
};

export default ProjectDisputePage;
