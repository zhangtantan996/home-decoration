import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Empty } from '@/components/Empty';
import { NotificationActionBar } from '@/components/NotificationActionBar';
import { NotificationFactRows } from '@/components/NotificationFactRows';
import { NotificationSurfaceHero } from '@/components/NotificationSurfaceHero';
import { NotificationSurfaceShell } from '@/components/NotificationSurfaceShell';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import {
  acceptBookingDesignDeliverable,
  getBookingDesignDeliverable,
  rejectBookingDesignDeliverable,
  type BookingDesignDeliverableDetail,
} from '@/services/bookings';
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
    return [];
  }
};

const BookingDesignDeliverablePage: React.FC = () => {
  const [bookingId, setBookingId] = useState(0);
  const [detail, setDetail] = useState<BookingDesignDeliverableDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const pageBottomStyle = useMemo(() => getPageBottomSpacerStyle(), []);

  useLoad((options) => {
    if (options.id) {
      setBookingId(Number(options.id));
    }
  });

  const fetchDetail = useCallback(async () => {
    if (!bookingId) {
      setDetail(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await getBookingDesignDeliverable(bookingId);
      setDetail(result);
    } catch (error) {
      showErrorToast(error, '加载设计交付失败');
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  const handleAccept = async () => {
    if (!detail?.id || submitting) {
      return;
    }
    try {
      setSubmitting(true);
      await acceptBookingDesignDeliverable(detail.id);
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
          await rejectBookingDesignDeliverable(detail.id, res.content || '用户要求调整设计交付');
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
        <Skeleton height={240} className="mb-md" />
        <Skeleton height={220} className="mb-md" />
        <Skeleton height={140} />
      </View>
    );
  }

  if (!detail) {
    return (
      <NotificationSurfaceShell className="page bg-gray-50 min-h-screen">
        <View className="notification-surface-state-card">
          <Empty description="当前预约暂无待确认的设计交付" />
        </View>
      </NotificationSurfaceShell>
    );
  }

  const status = readStatusMeta(detail.status);
  const colorFloorPlan = parseList(detail.colorFloorPlan);
  const renderings = parseList(detail.renderings);
  const cadDrawings = parseList(detail.cadDrawings);
  const attachments = parseList(detail.attachments);
  const files = [
    ...colorFloorPlan.map((item) => ({ name: '彩平图', value: item })),
    ...renderings.map((item) => ({ name: '效果图', value: item })),
    ...cadDrawings.map((item) => ({ name: 'CAD 图纸', value: item })),
    ...attachments.map((item) => ({ name: '附件', value: item })),
  ];
  const canReview = detail.status === 'submitted';

  return (
    <NotificationSurfaceShell className="page bg-gray-50 min-h-screen" style={pageBottomStyle}>
      <ScrollView scrollY className="h-full">
        <View className="notification-surface-shell__body">
          <NotificationSurfaceHero
            eyebrow="设计交付"
            title={status.text}
            subtitle={`预约单 #${bookingId}`}
            status={<Tag variant={status.variant}>{status.text}</Tag>}
            summary={detail.rejectionReason || detail.textDescription || '查看本次设计交付内容'}
            metrics={[
              { label: '彩平图', value: `${colorFloorPlan.length} 项` },
              { label: '效果图', value: `${renderings.length} 项`, hint: `${attachments.length} 项附件`, emphasis: true },
            ]}
          />

          <Card className="notification-surface-card" title="交付概览">
            <NotificationFactRows
              items={[
                { label: '当前状态', value: status.text },
                { label: '提交时间', value: formatServerDateTime(detail.submittedAt, '待提交') },
                { label: '彩平图', value: `${colorFloorPlan.length} 项` },
                { label: '效果图', value: `${renderings.length} 项` },
                { label: 'CAD 图纸', value: `${cadDrawings.length} 项` },
                { label: '附件', value: `${attachments.length} 项` },
              ]}
            />
          </Card>

          {detail.rejectionReason ? (
            <Card className="notification-surface-card" title="退回原因">
              <Text className="notification-section-row__note is-danger">{detail.rejectionReason}</Text>
            </Card>
          ) : null}

          {detail.renderingLink ? (
            <Card className="notification-surface-card" title="效果图链接">
              <Text className="notification-section-row__note">{detail.renderingLink}</Text>
            </Card>
          ) : null}

          <Card className="notification-surface-card" title="交付文件清单">
            {files.length === 0 ? (
              <Text className="notification-section-row__note">暂无附件清单</Text>
            ) : (
              <View className="notification-section-list">
                {files.map((item, index) => (
                  <View key={`${item.value}-${index}`} className="notification-section-row">
                    <View className="notification-section-row__head">
                      <Text className="notification-section-row__title">{`${item.name} ${index + 1}`}</Text>
                    </View>
                    <Text className="notification-section-row__note">{item.value}</Text>
                  </View>
                ))}
              </View>
            )}
            <View className="notification-support-note">
              <Text>当前仅展示文件清单，完整文件请在支持端查看。</Text>
            </View>
          </Card>
        </View>
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

export default BookingDesignDeliverablePage;
