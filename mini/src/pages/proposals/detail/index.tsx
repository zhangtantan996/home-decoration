import { useEffect, useMemo, useState } from 'react';
import { Text, View } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { NotificationActionBar } from '@/components/NotificationActionBar';
import { NotificationFactRows } from '@/components/NotificationFactRows';
import { NotificationSurfaceHero } from '@/components/NotificationSurfaceHero';
import { NotificationSurfaceShell } from '@/components/NotificationSurfaceShell';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import { getProposalStatus } from '@/constants/status';
import { confirmProposal, getProposalDetail, rejectProposal, type ProposalDetailItem } from '@/services/proposals';
import { useAuthStore } from '@/store/auth';
import { showErrorToast } from '@/utils/error';
import { getPageBottomSpacerStyle } from '@/utils/fixedLayout';
import { formatServerDateTime } from '@/utils/serverTime';

import './index.scss';

const isPendingProposal = (status: number) => status === 0 || status === 1;

const formatCurrency = (value?: number) => `¥${Number(value || 0).toLocaleString()}`;

const parseAttachments = (value?: string) => {
  if (!value) {
    return [] as string[];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return String(value)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
};

const ProposalDetail: React.FC = () => {
  const auth = useAuthStore();
  const [detail, setDetail] = useState<ProposalDetailItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [id, setId] = useState<number>(0);
  const pageBottomStyle = useMemo(() => getPageBottomSpacerStyle(), []);

  useLoad((options) => {
    if (options.id) {
      setId(Number(options.id));
    }
  });

  const fetchDetail = async () => {
    if (!id) {
      return;
    }

    if (!auth.token) {
      setDetail(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await getProposalDetail(id);
      setDetail(res);
    } catch (error) {
      showErrorToast(error, '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchDetail();
  }, [id, auth.token]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConfirm = async () => {
    if (!id || submitting) {
      return;
    }

    if (!auth.token) {
      Taro.showToast({ title: '请先登录', icon: 'none' });
      Taro.switchTab({ url: '/pages/profile/index' });
      return;
    }

    Taro.showModal({
      title: '确认方案',
      content: '确认接受该设计方案吗？确认后会生成待支付订单。',
      success: async (res) => {
        if (!res.confirm) {
          return;
        }

        try {
          setSubmitting(true);
          const result = await confirmProposal(id);
          Taro.showToast({ title: result.message || '已确认方案，请继续支付设计费', icon: 'success' });

          const bookingId = detail?.bookingId;
          if (bookingId) {
            Taro.showModal({
              title: '下一步',
              content: '设计方案已确认。接下来需要选择施工方（装修公司或独立工长）。',
              confirmText: '去选择',
              cancelText: '稍后',
              success: (modalRes) => {
                if (modalRes.confirm) {
                  Taro.navigateTo({ url: `/pages/booking/construction-subject-select/index?bookingId=${bookingId}` });
                } else {
                  Taro.navigateTo({ url: '/pages/orders/pending/index?type=design_fee' });
                }
              },
            });
          } else {
            Taro.navigateTo({ url: '/pages/orders/pending/index?type=design_fee' });
          }
        } catch (error) {
          showErrorToast(error, '操作失败');
        } finally {
          setSubmitting(false);
        }
      },
    });
  };

  const handleReject = async () => {
    if (!id || submitting) {
      return;
    }

    Taro.showModal({
      title: '拒绝方案',
      content: '是否拒绝该方案？',
      editable: true,
      placeholderText: '请输入拒绝理由',
      success: async (res: { confirm: boolean; content?: string }) => {
        if (!res.confirm) {
          return;
        }

        try {
          setSubmitting(true);
          await rejectProposal(id, res.content || '用户未填写理由');
          Taro.showToast({ title: '已拒绝', icon: 'success' });
          await fetchDetail();
        } catch (error) {
          showErrorToast(error, '操作失败');
        } finally {
          setSubmitting(false);
        }
      },
    } as any);
  };

  if (!auth.token) {
    return (
      <NotificationSurfaceShell>
        <View className="notification-surface-state-card">登录后查看方案详情</View>
      </NotificationSurfaceShell>
    );
  }

  if (loading) {
    return (
      <View className="proposal-detail-page">
        <Skeleton height={300} className="proposal-detail-page__section" />
        <Skeleton height={200} className="proposal-detail-page__section" />
        <Skeleton height={100} className="proposal-detail-page__section" />
      </View>
    );
  }

  if (!detail) {
    return (
      <NotificationSurfaceShell>
        <View className="notification-surface-state-card">未找到方案</View>
      </NotificationSurfaceShell>
    );
  }

  const total = (detail.designFee || 0) + (detail.constructionFee || 0) + (detail.materialFee || 0);
  const statusConfig = getProposalStatus(detail.status);
  const orderStatusText = detail.hasOrder
    ? detail.order?.status === 1
      ? '待支付'
      : detail.order?.status === 2
        ? '已支付'
        : '已生成'
    : '未生成';
  const attachments = parseAttachments(detail.attachments);

  return (
    <NotificationSurfaceShell className="proposal-detail-page" style={pageBottomStyle}>
      <View className="notification-surface-shell__body">
        <NotificationSurfaceHero
          eyebrow="方案详情"
          title={formatCurrency(total)}
          subtitle={`方案 #${detail.id} · v${detail.version}`}
          status={<Tag variant={statusConfig.variant}>{statusConfig.label}</Tag>}
          summary={detail.rejectionReason || detail.summary || detail.flowSummary || '查看本次方案关键费用与时长'}
          metrics={[
            {
              label: '响应截止',
              value: formatServerDateTime(detail.userResponseDeadline, '未设置'),
            },
            {
              label: '预估工期',
              value: detail.estimatedDays > 0 ? `${detail.estimatedDays} 天` : '待补充',
              emphasis: true,
            },
          ]}
        />

        <Card className="notification-surface-card" title="关键结果">
          <NotificationFactRows
            items={[
              { label: '当前状态', value: statusConfig.label },
              { label: '设计费', value: formatCurrency(detail.designFee) },
              { label: '施工费', value: formatCurrency(detail.constructionFee) },
              { label: '主材费', value: formatCurrency(detail.materialFee) },
              { label: '设计费订单', value: orderStatusText },
              { label: '提交时间', value: formatServerDateTime(detail.submittedAt, '待同步') },
            ]}
          />
        </Card>

        {detail.rejectionReason ? (
          <Card className="notification-surface-card" title="最近一次退回原因">
            <Text className="notification-section-row__note is-danger">{detail.rejectionReason}</Text>
          </Card>
        ) : null}

        <Card className="notification-surface-card" title="附件状态">
          <NotificationFactRows
            items={[
              { label: '附件数量', value: `${attachments.length} 个` },
              {
                label: '查看能力',
                value: attachments.length > 0 ? '需在支持端查看' : '暂无附件',
                multiline: true,
              },
            ]}
          />
        </Card>
      </View>

      {isPendingProposal(detail.status) ? (
        <NotificationActionBar>
          <Button variant="secondary" onClick={handleReject} disabled={submitting}>
            拒绝方案
          </Button>
          <Button variant="primary" onClick={handleConfirm} disabled={submitting} loading={submitting}>
            确认方案
          </Button>
        </NotificationActionBar>
      ) : null}
    </NotificationSurfaceShell>
  );
};

export default ProposalDetail;
