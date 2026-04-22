import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { NotificationActionBar } from '@/components/NotificationActionBar';
import { NotificationFactRows } from '@/components/NotificationFactRows';
import { NotificationSurfaceHero } from '@/components/NotificationSurfaceHero';
import { NotificationSurfaceShell } from '@/components/NotificationSurfaceShell';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import {
  confirmQuoteTaskSubmission,
  getQuoteTaskDetail,
  rejectQuoteTaskSubmission,
  type QuoteTaskDetail,
} from '@/services/quoteTasks';
import { useAuthStore } from '@/store/auth';
import { showErrorToast } from '@/utils/error';
import { getPageBottomSpacerStyle } from '@/utils/fixedLayout';

import './index.scss';

const formatCurrency = (value?: number) => `¥${Number(value || 0).toLocaleString()}`;

const QuoteTaskDetailPage: React.FC = () => {
  const auth = useAuthStore();
  const [id, setId] = useState(0);
  const [detail, setDetail] = useState<QuoteTaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const pageBottomStyle = useMemo(() => getPageBottomSpacerStyle(), []);

  useLoad((options) => {
    if (options.id) {
      setId(Number(options.id));
    }
  });

  const fetchDetail = async () => {
    if (!id) return;
    if (!auth.token) {
      setDetail(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await getQuoteTaskDetail(id);
      setDetail(res);
    } catch (error) {
      showErrorToast(error, '加载施工报价失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchDetail();
  }, [id, auth.token]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConfirm = async () => {
    if (!detail || submitting) return;
    try {
      setSubmitting(true);
      const result = await confirmQuoteTaskSubmission(detail.submissionId);
      Taro.showToast({ title: result.message || '已确认施工报价', icon: 'success' });
      Taro.switchTab({ url: '/pages/progress/index' });
    } catch (error) {
      showErrorToast(error, '确认失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!detail || submitting) return;

    Taro.showModal({
      title: '驳回施工报价',
      content: '如需重新报价，请补充原因。',
      editable: true,
      placeholderText: '请输入驳回原因',
      success: async (res: { confirm: boolean; content?: string }) => {
        if (!res.confirm) return;
        try {
          setSubmitting(true);
          await rejectQuoteTaskSubmission(detail.submissionId, res.content || '用户要求重新报价');
          Taro.showToast({ title: '已退回重报', icon: 'success' });
          await fetchDetail();
        } catch (error) {
          showErrorToast(error, '驳回失败');
        } finally {
          setSubmitting(false);
        }
      },
    } as any);
  };

  if (!auth.token) {
    return (
      <NotificationSurfaceShell>
        <View className="notification-surface-state-card">登录后查看施工报价</View>
      </NotificationSurfaceShell>
    );
  }

  if (loading) {
    return (
      <View className="p-md bg-gray-50 min-h-screen">
        <Skeleton height={220} className="mb-md" />
        <Skeleton height={220} className="mb-md" />
        <Skeleton height={120} />
      </View>
    );
  }

  if (!detail) {
    return (
      <NotificationSurfaceShell>
        <View className="notification-surface-state-card">未找到施工报价任务</View>
      </NotificationSurfaceShell>
    );
  }

  return (
    <NotificationSurfaceShell className="quote-task-detail-page" style={pageBottomStyle}>
      <ScrollView scrollY className="h-full">
        <View className="notification-surface-shell__body">
          <NotificationSurfaceHero
            eyebrow="施工报价"
            title={formatCurrency(detail.totalAmount)}
            subtitle={detail.title}
            status={<Tag variant="warning">{detail.status}</Tag>}
            summary={detail.taskSummary.notes || '查看施工报价与清单'}
            metrics={[
              {
                label: '首笔支付',
                value: detail.paymentPlanSummary[0]
                  ? formatCurrency(detail.paymentPlanSummary[0].amount)
                  : '待生成',
              },
              {
                label: '预计工期',
                value: detail.estimatedDays > 0 ? `${detail.estimatedDays} 天` : '待补充',
                hint: detail.taskSummary.area ? `${detail.taskSummary.area}㎡` : detail.taskSummary.layout || undefined,
                emphasis: true,
              },
            ]}
          />

          <Card className="notification-surface-card" title="房屋与范围">
            <NotificationFactRows
              items={[
                { label: '房屋面积', value: detail.taskSummary.area ? `${detail.taskSummary.area}㎡` : '待补充' },
                { label: '户型', value: detail.taskSummary.layout || '待补充' },
                { label: '装修类型', value: detail.taskSummary.renovationType || '待补充' },
                { label: '施工范围', value: detail.taskSummary.constructionScope || '待补充', multiline: true },
              ]}
            />
          </Card>

          <Card className="notification-surface-card" title="施工清单">
            {detail.items.length === 0 ? (
              <Text className="notification-section-row__note">暂无施工清单</Text>
            ) : (
              <View className="notification-section-list">
                {detail.items.map((item) => (
                  <View key={item.id} className="notification-section-row">
                    <View className="notification-section-row__head">
                      <Text className="notification-section-row__title">
                        {item.itemName || `清单项 #${item.quoteListItemId}`}
                      </Text>
                      <Text className="notification-section-row__value">{formatCurrency(item.amount)}</Text>
                    </View>
                    <View className="notification-section-row__meta">
                      <Text className="notification-section-row__chip">
                        基准量 {item.baselineQuantity ?? '-'}{item.unit || ''}
                      </Text>
                      <Text className="notification-section-row__chip">
                        报价量 {item.quotedQuantity ?? item.baselineQuantity ?? '-'}{item.unit || ''}
                      </Text>
                      <Text className="notification-section-row__chip">单价 {formatCurrency(item.unitPrice)}</Text>
                    </View>
                    {item.quantityChangeReason ? (
                      <Text className="notification-section-row__note">数量变更：{item.quantityChangeReason}</Text>
                    ) : null}
                    {item.remark ? <Text className="notification-section-row__note">备注：{item.remark}</Text> : null}
                  </View>
                ))}
              </View>
            )}
          </Card>
        </View>
      </ScrollView>

      <NotificationActionBar>
        <Button variant="secondary" onClick={handleReject} disabled={submitting}>
          驳回重报
        </Button>
        <Button variant="primary" onClick={handleConfirm} disabled={submitting} loading={submitting}>
          确认报价
        </Button>
      </NotificationActionBar>
    </NotificationSurfaceShell>
  );
};

export default QuoteTaskDetailPage;
