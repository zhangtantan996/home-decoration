import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from '@tarojs/components';
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
  acceptProjectDesignDeliverable,
  getProjectDesignDeliverable,
  rejectProjectDesignDeliverable,
  type ProjectDesignDeliverableDetail,
} from '@/services/projects';
import { showErrorToast } from '@/utils/error';
import { getPageBottomSpacerStyle } from '@/utils/fixedLayout';
import { formatServerDateTime } from '@/utils/serverTime';

const readStatusMeta = (status?: string) => {
  switch (status) {
    case 'submitted':
      return { text: '待确认', variant: 'warning' as const };
    case 'accepted':
      return { text: '已确认', variant: 'success' as const };
    case 'rejected':
      return { text: '已退回', variant: 'error' as const };
    default:
      return { text: status || '待处理', variant: 'default' as const };
  }
};

const parseList = (value?: string | string[]) => {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }
  if (!value) {
    return [] as string[];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [] as string[];
  }
};

const shortenText = (value?: string, max = 48) => {
  const next = String(value || '').trim();
  if (!next) return '';
  if (next.length <= max) return next;
  return `${next.slice(0, max)}...`;
};

const ProjectDesignDeliverablePage: React.FC = () => {
  const [projectId, setProjectId] = useState(0);
  const [detail, setDetail] = useState<ProjectDesignDeliverableDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
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
      const result = await getProjectDesignDeliverable(projectId);
      setDetail(result);
    } catch (error) {
      showErrorToast(error, '加载设计交付失败');
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  const handleAccept = async () => {
    if (!detail?.id || submitting) {
      return;
    }
    try {
      setSubmitting(true);
      await acceptProjectDesignDeliverable(detail.id);
      Taro.showToast({ title: '已确认交付', icon: 'success' });
      await fetchDetail();
    } catch (error) {
      showErrorToast(error, '确认失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!detail?.id || submitting) {
      return;
    }
    Taro.showModal({
      title: '退回设计交付',
      content: '请补充退回原因',
      editable: true,
      placeholderText: '请输入退回原因',
      success: async (res: { confirm: boolean; content?: string }) => {
        if (!res.confirm) {
          return;
        }
        try {
          setSubmitting(true);
          await rejectProjectDesignDeliverable(detail.id, res.content || '用户要求调整设计交付');
          Taro.showToast({ title: '已退回', icon: 'success' });
          await fetchDetail();
        } catch (error) {
          showErrorToast(error, '退回失败');
        } finally {
          setSubmitting(false);
        }
      },
    } as any);
  };

  if (loading) {
    return (
      <View className="p-md bg-gray-50 min-h-screen">
        <Skeleton height={180} className="mb-md" />
        <Skeleton height={210} className="mb-md" />
        <Skeleton height={220} />
      </View>
    );
  }

  if (!detail) {
    return (
      <NotificationSurfaceShell className="page bg-gray-50 min-h-screen">
        <Empty description="当前项目暂无待确认的设计交付" />
      </NotificationSurfaceShell>
    );
  }

  const status = readStatusMeta(detail.status);
  const colorFloorPlan = parseList(detail.colorFloorPlan);
  const renderings = parseList(detail.renderings);
  const cadDrawings = parseList(detail.cadDrawings);
  const attachments = parseList(detail.attachments);
  const canReview = detail.status === 'submitted';
  const shortDescription = shortenText(detail.textDescription);
  const sections = [
    { label: '彩平图', items: colorFloorPlan },
    { label: '效果图', items: renderings },
    { label: 'CAD 图纸', items: cadDrawings },
    { label: '其他附件', items: attachments },
  ];

  return (
    <NotificationSurfaceShell className="page bg-gray-50 min-h-screen" style={pageBottomStyle}>
      <ScrollView scrollY className="h-full">
        <Card className="notification-surface-card" extra={<Tag variant={status.variant}>{status.text}</Tag>}>
          <View style={{ display: 'flex', flexDirection: 'column', gap: '20rpx' }}>
            <View>
              <Text style={{ display: 'block', fontSize: '22rpx', color: '#8E8E93' }}>项目设计交付</Text>
              <Text style={{ display: 'block', marginTop: '12rpx', fontSize: '36rpx', lineHeight: 1.2, fontWeight: 700, color: '#0F172A' }}>
                {status.text}
              </Text>
              <Text style={{ display: 'block', marginTop: '10rpx', fontSize: '24rpx', lineHeight: 1.5, color: '#64748B' }}>
                项目 #{projectId} · 文件清单与数量已同步
              </Text>
            </View>
            <NotificationFactGrid
              items={[
                { label: '彩平图', value: `${colorFloorPlan.length} 份` },
                { label: '效果图', value: `${renderings.length} 份` },
                { label: 'CAD 图纸', value: `${cadDrawings.length} 份` },
                { label: '其他附件', value: `${attachments.length} 份` },
                { label: '提交时间', value: formatServerDateTime(detail.submittedAt, '待提交'), full: true },
              ]}
            />
          </View>
        </Card>

        {detail.rejectionReason ? (
          <Card className="notification-surface-card" title="退回原因">
            <Text className="notification-section-row__note is-danger" style={{ marginTop: 0 }}>
              {detail.rejectionReason}
            </Text>
          </Card>
        ) : null}

        <Card className="notification-surface-card" title="时间记录">
          <View className="notification-section-list">
            <View className="notification-section-row">
              <View className="notification-section-row__head">
                <Text className="notification-section-row__title">提交时间</Text>
                <Text className="notification-section-row__value" style={{ color: '#0F172A', fontWeight: 600 }}>
                  {formatServerDateTime(detail.submittedAt, '待提交')}
                </Text>
              </View>
            </View>
            <View className="notification-section-row">
              <View className="notification-section-row__head">
                <Text className="notification-section-row__title">确认时间</Text>
                <Text className="notification-section-row__value" style={{ color: '#0F172A', fontWeight: 600 }}>
                  {formatServerDateTime(detail.acceptedAt, '待确认')}
                </Text>
              </View>
            </View>
            <View className="notification-section-row">
              <View className="notification-section-row__head">
                <Text className="notification-section-row__title">退回时间</Text>
                <Text className="notification-section-row__value" style={{ color: '#0F172A', fontWeight: 600 }}>
                  {formatServerDateTime(detail.rejectedAt, '无')}
                </Text>
              </View>
            </View>
            {detail.renderingLink ? (
              <View className="notification-section-row">
                <View className="notification-section-row__head">
                  <Text className="notification-section-row__title">效果图链接</Text>
                </View>
                <Text className="notification-section-row__note">已提供外部链接，完整访问请在支持端查看。</Text>
              </View>
            ) : null}
            {detail.textDescription ? (
              <View className="notification-section-row">
                <View className="notification-section-row__head">
                  <Text className="notification-section-row__title">交付说明</Text>
                </View>
                <Text className="notification-section-row__note">{shortDescription}</Text>
              </View>
            ) : null}
          </View>
        </Card>

        <Card className="notification-surface-card" title="文件清单">
          <Text className="notification-section-row__note" style={{ marginTop: 0 }}>
            当前仅展示文件数量与清单，完整文件请在支持端查看。
          </Text>
          <View className="notification-section-list">
            {sections.map((section) => (
              <View key={section.label} className="notification-section-row">
                <View className="notification-section-row__head">
                  <Text className="notification-section-row__title">{section.label}</Text>
                  <Text className="notification-section-row__value" style={{ color: '#0F172A', fontWeight: 600 }}>
                    {section.items.length} 份
                  </Text>
                </View>
                <Text className="notification-section-row__note">
                  {section.items.length > 0 ? `已提交 ${section.items.length} 份${section.label}` : `暂无${section.label}`}
                </Text>
              </View>
            ))}
          </View>
        </Card>
      </ScrollView>

      {canReview ? (
        <NotificationActionBar>
          <Button variant="secondary" onClick={handleReject} disabled={submitting}>
            退回修改
          </Button>
          <Button variant="primary" onClick={handleAccept} loading={submitting} disabled={submitting}>
            确认交付
          </Button>
        </NotificationActionBar>
      ) : null}
    </NotificationSurfaceShell>
  );
};

export default ProjectDesignDeliverablePage;
