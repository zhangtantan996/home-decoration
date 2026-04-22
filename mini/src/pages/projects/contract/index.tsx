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
import { confirmProjectContract, getProjectContract, type ProjectContractDetail } from '@/services/projects';
import { showErrorToast } from '@/utils/error';
import { getPageBottomSpacerStyle } from '@/utils/fixedLayout';
import { formatServerDateTime } from '@/utils/serverTime';

const readStatusMeta = (status?: string) => {
  switch (status) {
    case 'pending_confirm':
      return { text: '待确认', variant: 'warning' as const };
    case 'confirmed':
      return { text: '已确认', variant: 'success' as const };
    case 'active':
      return { text: '履约中', variant: 'brand' as const };
    case 'completed':
      return { text: '已完成', variant: 'default' as const };
    case 'terminated':
      return { text: '已终止', variant: 'error' as const };
    default:
      return { text: status || '待处理', variant: 'default' as const };
  }
};

const parseList = (value?: string | string[]) => {
  if (Array.isArray(value)) {
    return value.filter(Boolean) as unknown[];
  }
  if (!value) {
    return [] as unknown[];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return value
      .split(/\n|,|，/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

const formatMoney = (value: unknown) => {
  const amount = Number(value || 0);
  if (!amount) return '';
  return `¥${amount.toLocaleString()}`;
};

const readPlanDisplay = (value: unknown, index: number) => {
  if (typeof value === 'string') {
    return {
      title: `付款节点 ${index + 1}`,
      note: value,
      amount: '',
    };
  }

  if (isRecord(value)) {
    const title = [value.name, value.title, value.label].find((item) => typeof item === 'string' && item.trim()) as string | undefined;
    const due = [value.dueAt, value.deadline, value.time].find((item) => typeof item === 'string' && item.trim()) as string | undefined;
    const status = [value.statusText, value.status, value.state].find((item) => typeof item === 'string' && item.trim()) as string | undefined;
    const amount = formatMoney(value.amount);
    const note = [due ? `时间 ${due}` : '', status || ''].filter(Boolean).join(' · ');

    return {
      title: title || `付款节点 ${index + 1}`,
      note: note || '付款信息待同步',
      amount,
    };
  }

  return {
    title: `付款节点 ${index + 1}`,
    note: '付款信息待同步',
    amount: '',
  };
};

const readAttachmentLabel = (value: unknown, index: number) => {
  if (typeof value !== 'string' || !value.trim()) {
    return `附件 ${index + 1}`;
  }
  const plain = value.split('?')[0].split('#')[0];
  const last = plain.split('/').filter(Boolean).pop();
  if (!last) return `附件 ${index + 1}`;
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
};

const ProjectContractPage: React.FC = () => {
  const [projectId, setProjectId] = useState(0);
  const [detail, setDetail] = useState<ProjectContractDetail | null>(null);
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
      const result = await getProjectContract(projectId);
      setDetail(result);
    } catch (error) {
      showErrorToast(error, '加载合同失败');
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  const handleConfirm = async () => {
    if (!detail?.id || submitting) {
      return;
    }
    Taro.showModal({
      title: '确认合同',
      content: '确认后将按合同推进后续履约流程。',
      success: async (res) => {
        if (!res.confirm) {
          return;
        }
        try {
          setSubmitting(true);
          await confirmProjectContract(detail.id);
          Taro.showToast({ title: '合同已确认', icon: 'success' });
          await fetchDetail();
        } catch (error) {
          showErrorToast(error, '确认失败');
        } finally {
          setSubmitting(false);
        }
      },
    });
  };

  if (loading) {
    return (
      <View className="p-md bg-gray-50 min-h-screen">
        <Skeleton height={180} className="mb-md" />
        <Skeleton height={220} className="mb-md" />
        <Skeleton height={180} />
      </View>
    );
  }

  if (!detail) {
    return (
      <NotificationSurfaceShell className="page bg-gray-50 min-h-screen">
        <Empty description="当前项目暂无待确认合同" />
      </NotificationSurfaceShell>
    );
  }

  const paymentPlans = parseList(detail.paymentPlan);
  const attachments = parseList(detail.attachmentUrls);
  const status = readStatusMeta(detail.status);
  const canConfirm = detail.status === 'pending_confirm' || detail.status === 'draft';
  const totalAmountText = `¥${Number(detail.totalAmount || 0).toLocaleString()}`;

  return (
    <NotificationSurfaceShell className="page bg-gray-50 min-h-screen" style={pageBottomStyle}>
      <ScrollView scrollY className="h-full">
        <View className="notification-surface-shell__body">
          <NotificationSurfaceHero
            eyebrow="项目合同"
            title={totalAmountText}
            subtitle={detail.title || '装修合同'}
            status={<Tag variant={status.variant}>{status.text}</Tag>}
            summary={detail.contractNo ? `合同编号 ${detail.contractNo}` : '合同编号待生成'}
            metrics={[
              { label: '付款节点', value: `${paymentPlans.length} 项`, emphasis: true },
              { label: '合同附件', value: `${attachments.length} 份` },
            ]}
          />

          <Card className="notification-surface-card" title="关键信息">
            <NotificationFactRows
              items={[
                { label: '合同编号', value: detail.contractNo || '待生成' },
                { label: '当前状态', value: status.text },
                { label: '确认时间', value: formatServerDateTime(detail.confirmedAt, '待确认') },
              ]}
            />
          </Card>

          <Card className="notification-surface-card" title="付款计划">
            {paymentPlans.length === 0 ? (
              <View className="text-sm text-gray-500">付款计划待同步</View>
            ) : (
              <View className="notification-section-list">
                {paymentPlans.map((plan, index) => {
                  const item = readPlanDisplay(plan, index);
                  return (
                    <View key={`${item.title}-${index}`} className="notification-section-row">
                      <View className="notification-section-row__head">
                        <Text className="notification-section-row__title">{item.title}</Text>
                        {item.amount ? (
                          <Text className="notification-section-row__value">{item.amount}</Text>
                        ) : null}
                      </View>
                      <Text className="notification-section-row__note">{item.note}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </Card>

          <Card className="notification-surface-card" title="合同附件">
            {attachments.length === 0 ? (
              <View className="text-sm text-gray-500">暂无附件</View>
            ) : (
              <>
                <Text className="notification-section-row__note" style={{ marginTop: 0 }}>
                  当前端仅展示附件清单，完整文件请在支持端查看。
                </Text>
                <View className="notification-section-list">
                  {attachments.map((item, index) => (
                    <View key={`${String(item)}-${index}`} className="notification-section-row">
                      <View className="notification-section-row__head">
                        <Text className="notification-section-row__title">{readAttachmentLabel(item, index)}</Text>
                        <Text className="notification-section-row__value" style={{ color: '#0F172A', fontWeight: 600 }}>
                          附件 {index + 1}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </>
            )}
          </Card>
        </View>
      </ScrollView>

      {canConfirm ? (
        <NotificationActionBar single>
          <Button variant="primary" onClick={handleConfirm} loading={submitting} disabled={submitting} block>
            确认合同
          </Button>
        </NotificationActionBar>
      ) : null}
    </NotificationSurfaceShell>
  );
};

export default ProjectContractPage;
