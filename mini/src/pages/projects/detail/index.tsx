import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';
import { Tabs, Button as NutButton } from '@nutui/nutui-react-taro';
import { Success } from '@nutui/icons-react-taro';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Empty } from '@/components/Empty';
import { NotificationFactRows } from '@/components/NotificationFactRows';
import { NotificationSurfaceHero } from '@/components/NotificationSurfaceHero';
import { NotificationSurfaceShell } from '@/components/NotificationSurfaceShell';
import { PullToRefreshNotice } from '@/components/PullToRefreshNotice';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import { getBusinessStageStatus } from '@/constants/status';
import { usePullToRefreshFeedback } from '@/hooks/usePullToRefreshFeedback';
import {
  acceptMilestone,
  getProjectDetail,
  getProjectMilestones,
  getProjectPhases,
  rejectMilestone,
  resumeProject,
  type Milestone,
  type ProjectDetail as ProjectDetailType,
  type ProjectPhase,
} from '@/services/projects';
import { useAuthStore } from '@/store/auth';
import { showErrorToast } from '@/utils/error';
import { formatServerDate } from '@/utils/serverTime';

const formatCurrency = (value?: number) => `¥${Number(value || 0).toLocaleString()}`;

const ProjectDetailPage: React.FC = () => {
  const auth = useAuthStore();
  const [detail, setDetail] = useState<ProjectDetailType | null>(null);
  const [phases, setPhases] = useState<ProjectPhase[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [id, setId] = useState<number>(0);
  const [activeTab, setActiveTab] = useState('0');

  useLoad((options) => {
    if (options.id) {
      setId(Number(options.id));
    }
  });

  const fetchProjectData = useCallback(async () => {
    if (!id) return;

    setLoading(true);
    try {
      const [detailRes, phasesRes, milestonesRes] = await Promise.all([
        getProjectDetail(id),
        getProjectPhases(id),
        getProjectMilestones(id),
      ]);
      setDetail(detailRes);
      setPhases(phasesRes?.phases || []);
      setMilestones(milestonesRes?.milestones || []);
    } catch (error) {
      showErrorToast(error, '加载失败');
    } finally {
      setLoading(false);
    }
  }, [id]);
  const { refreshStatus, drawerHeight, drawerProgress, bindPullToRefresh, runReload } =
    usePullToRefreshFeedback(fetchProjectData);

  useEffect(() => {
    if (!id) return;
    if (!auth.token) {
      setDetail(null);
      setPhases([]);
      setMilestones([]);
      setLoading(false);
      return;
    }

    void runReload();
  }, [auth.token, id, runReload]);

  const ownerScopeDisabled = Boolean(auth.user?.activeRole) && !['owner', 'homeowner'].includes(auth.user?.activeRole || '');

  const getPhaseStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return '已完成';
      case 'in_progress':
        return '进行中';
      default:
        return '未开始';
    }
  };

  const getMilestoneStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return '已验收';
      case 'paid':
        return '已放款';
      case 'in_progress':
        return '施工中';
      case 'rejected':
        return '已拒绝';
      default:
        return '待验收';
    }
  };

  const getPaymentPlanStatusText = (plan: NonNullable<ProjectDetailType['paymentPlans']>[number]) => {
    if (plan.payable) return '可支付';
    if (plan.status === 1) return '已支付';
    if (plan.status === 2) return '已失效';
    if (plan.activatedAt) return '待支付';
    return '待激活';
  };

  const getChangeOrderStatusText = (status?: string) => {
    switch (status) {
      case 'pending_user_confirm':
        return '待确认';
      case 'user_confirmed':
        return '已确认';
      case 'user_rejected':
        return '已拒绝';
      case 'admin_settlement_required':
        return '待平台结算';
      case 'settled':
        return '已结算';
      case 'cancelled':
        return '已取消';
      default:
        return status || '待处理';
    }
  };

  const handleAcceptMilestone = async (milestoneId: number) => {
    Taro.showModal({
      title: '确认验收',
      content: '确认该节点已完成并验收通过？',
      success: async (result) => {
        if (!result.confirm) {
          return;
        }
        try {
          await acceptMilestone(id, milestoneId);
          Taro.showToast({ title: '验收成功', icon: 'success' });
          const milestonesRes = await getProjectMilestones(id);
          if (milestonesRes && milestonesRes.milestones) {
            setMilestones(milestonesRes.milestones);
          }
          const detailRes = await getProjectDetail(id);
          setDetail(detailRes);
        } catch (error) {
          showErrorToast(error, '验收失败');
        }
      },
    });
  };

  const handleRejectMilestone = async (milestoneId: number) => {
    Taro.showModal({
      title: '驳回验收',
      content: '请补充驳回原因',
      editable: true,
      placeholderText: '请输入驳回原因',
      success: async (result: { confirm: boolean; content?: string }) => {
        if (!result.confirm) {
          return;
        }
        const reason = String(result.content || '').trim();
        if (!reason) {
          Taro.showToast({ title: '请填写驳回原因', icon: 'none' });
          return;
        }
        try {
          await rejectMilestone(id, milestoneId, reason);
          Taro.showToast({ title: '已驳回', icon: 'success' });
          const milestonesRes = await getProjectMilestones(id);
          if (milestonesRes && milestonesRes.milestones) {
            setMilestones(milestonesRes.milestones);
          }
          const detailRes = await getProjectDetail(id);
          setDetail(detailRes);
        } catch (error) {
          showErrorToast(error, '驳回失败');
        }
      },
    } as any);
  };

  const handleResumeProject = async () => {
    Taro.showModal({
      title: '恢复项目',
      content: '确认恢复当前项目推进吗？恢复后可继续节点验收与施工流转。',
      success: async (result) => {
        if (!result.confirm) {
          return;
        }
        try {
          await resumeProject(id);
          Taro.showToast({ title: '项目已恢复', icon: 'success' });
          await fetchProjectData();
        } catch (error) {
          showErrorToast(error, '恢复失败');
        }
      },
    });
  };

  if (!auth.token) {
    return (
      <View className="project-detail-page project-detail-page--state" {...bindPullToRefresh}>
        <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />
        <NotificationSurfaceShell>
          <View className="notification-surface-state-card">
            <Empty
              description="登录后查看项目详情"
              action={{ text: '去登录', onClick: () => Taro.switchTab({ url: '/pages/profile/index' }) }}
            />
          </View>
        </NotificationSurfaceShell>
      </View>
    );
  }

  if (ownerScopeDisabled) {
    return (
      <View className="project-detail-page project-detail-page--state" {...bindPullToRefresh}>
        <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />
        <NotificationSurfaceShell>
          <View className="notification-surface-state-card">
            <Empty description="当前身份无权查看业主项目详情，请切换回业主身份后重试" />
          </View>
        </NotificationSurfaceShell>
      </View>
    );
  }

  if (loading) {
    return (
      <View className="project-detail-page" {...bindPullToRefresh}>
        <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />
        <View className="p-md bg-gray-50 min-h-screen">
          <Skeleton height={200} className="mb-md" />
          <Skeleton height={400} />
        </View>
      </View>
    );
  }

  if (!detail) {
    return (
      <View className="project-detail-page project-detail-page--state" {...bindPullToRefresh}>
        <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />
        <NotificationSurfaceShell>
          <View className="notification-surface-state-card">
            <Empty description="未找到项目" />
          </View>
        </NotificationSurfaceShell>
      </View>
    );
  }

  const riskSummary = detail.riskSummary;
  const paused = Boolean(riskSummary?.pausedAt);
  const disputed = Boolean(riskSummary?.disputedAt);
  const actionBlocked = paused || disputed;
  const businessStageStatus = getBusinessStageStatus(detail.businessStage);
  const paymentPlans = detail.paymentPlans || [];
  const changeOrders = detail.changeOrders || [];
  const completionPending = Boolean(
    detail.availableActions?.includes('approve_completion')
      || detail.availableActions?.includes('reject_completion')
      || detail.businessStage === 'completed',
  );
  const summaryLines = [
    paused ? `项目暂停：${riskSummary?.pauseReason || '待恢复'}` : '',
    disputed ? `争议处理中：${riskSummary?.disputeReason || '平台处理中'}` : '',
    riskSummary?.escrowFrozen
      ? `托管已冻结${riskSummary.frozenAmount ? `，金额 ${formatCurrency(riskSummary.frozenAmount)}` : ''}`
      : '',
    !paused && !disputed && !riskSummary?.escrowFrozen ? detail.flowSummary || '施工履约进行中' : '',
  ].filter(Boolean);

  return (
    <View className="page bg-gray-50 min-h-screen" {...bindPullToRefresh}>
      <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />
      <NotificationSurfaceShell>
        <ScrollView scrollY className="h-full">
          <View className="notification-surface-shell__body">
            <NotificationSurfaceHero
              eyebrow="项目详情"
              title={detail.name}
              subtitle={detail.address || '地址待补充'}
              status={<Tag variant={businessStageStatus.variant}>{businessStageStatus.label}</Tag>}
              summary={summaryLines.join(' · ')}
              metrics={[
                { label: '面积', value: detail.area ? `${detail.area}㎡` : '待补充' },
                {
                  label: '预算',
                  value: detail.budget ? formatCurrency(detail.budget) : '待补充',
                  emphasis: true,
                },
              ]}
            />

            <Card className="notification-surface-card" title="项目概览">
              <NotificationFactRows
                items={[
                  { label: '项目阶段', value: businessStageStatus.label },
                  { label: '项目地址', value: detail.address || '待补充', multiline: true },
                  { label: '开工时间', value: formatServerDate(detail.createdAt) },
                  { label: '待验收节点', value: `${milestones.filter((item) => item.status === 'pending').length} 个` },
                  {
                    label: '待支付节点',
                    value: detail.nextPayablePlan ? detail.nextPayablePlan.name || `第 ${detail.nextPayablePlan.seq || '-'} 期` : '暂无',
                    multiline: true,
                  },
                ]}
              />
            </Card>

            {(detail.quoteTruthSummary || detail.commercialExplanation || detail.changeOrderSummary || detail.settlementSummary || detail.payoutSummary) ? (
              <Card className="notification-surface-card" title="统一报价与资金摘要">
                <NotificationFactRows
                  items={[
                    { label: '成交报价', value: detail.quoteTruthSummary?.totalCent ? formatCurrency(Math.round(detail.quoteTruthSummary.totalCent / 100)) : '待同步' },
                    { label: '预计工期', value: detail.quoteTruthSummary?.estimatedDays ? `${detail.quoteTruthSummary.estimatedDays} 天` : '待同步' },
                    { label: '施工范围内', value: detail.commercialExplanation?.scopeIncluded?.join('、') || '待同步', multiline: true },
                    { label: '施工范围外', value: detail.commercialExplanation?.scopeExcluded?.join('、') || '待同步', multiline: true },
                    { label: '结算状态', value: detail.settlementSummary?.status || detail.closureSummary?.settlementStatus || '待同步' },
                    { label: '出款状态', value: detail.payoutSummary?.status || detail.closureSummary?.payoutStatus || '待同步' },
                    { label: '下一步', value: detail.nextPendingAction || detail.closureSummary?.nextPendingAction || '待同步', multiline: true },
                  ]}
                />
              </Card>
            ) : null}

            {(paused || disputed || riskSummary?.escrowFrozen) ? (
              <Card className="notification-surface-card" title="异常状态">
                <NotificationFactRows
                  items={[
                    paused ? { label: '暂停原因', value: riskSummary?.pauseReason || '未填写', multiline: true, danger: true } : null,
                    disputed ? { label: '争议原因', value: riskSummary?.disputeReason || '未填写', multiline: true, danger: true } : null,
                    riskSummary?.auditStatus ? { label: '审计状态', value: riskSummary.auditStatus } : null,
                    riskSummary?.escrowFrozen
                      ? {
                          label: '托管状态',
                          value: riskSummary.frozenAmount ? `已冻结 ${formatCurrency(riskSummary.frozenAmount)}` : '已冻结',
                          danger: true,
                        }
                      : null,
                  ].filter(Boolean) as any}
                />
                <View className="flex" style={{ gap: '16rpx', marginTop: '20rpx' }}>
                  {paused ? (
                    <View className="flex-1">
                      <Button block variant="primary" onClick={handleResumeProject}>
                        恢复项目
                      </Button>
                    </View>
                  ) : (
                    <View className="flex-1">
                      <Button block variant="outline" onClick={() => Taro.navigateTo({ url: `/pages/projects/pause/index?id=${id}` })}>
                        申请暂停
                      </Button>
                    </View>
                  )}
                  <View className="flex-1">
                    <Button
                      block
                      variant={disputed ? 'outline' : 'primary'}
                      onClick={() => Taro.navigateTo({ url: `/pages/projects/dispute/index?id=${id}` })}
                    >
                      {disputed ? '查看争议' : '发起争议'}
                    </Button>
                  </View>
                </View>
              </Card>
            ) : null}

            <Card className="notification-surface-card" title="支付与变更">
              <NotificationFactRows
                items={[
                  detail.nextPayablePlan
                    ? {
                        label: '当前待支付',
                        value: `${detail.nextPayablePlan.name || `第 ${detail.nextPayablePlan.seq || '-'} 期`} · ${formatCurrency(detail.nextPayablePlan.amount)}`,
                        multiline: true,
                      }
                    : { label: '当前待支付', value: '暂无待支付节点' },
                  { label: '付款计划', value: `${paymentPlans.length} 条` },
                  { label: '变更单', value: `${changeOrders.length} 张` },
                  { label: '完工验收', value: completionPending ? '待处理' : '未触发' },
                ]}
              />
              <View className="flex" style={{ gap: '16rpx', marginTop: '20rpx', flexWrap: 'wrap' }}>
                {detail.nextPayablePlan?.orderId ? (
                  <View style={{ flex: '1 1 48%' }}>
                    <Button block variant="primary" onClick={() => Taro.navigateTo({ url: `/pages/orders/detail/index?id=${detail.nextPayablePlan?.orderId}` })}>
                      去支付
                    </Button>
                  </View>
                ) : null}
                <View style={{ flex: '1 1 48%' }}>
                  <Button block variant="outline" onClick={() => Taro.navigateTo({ url: `/pages/projects/change-request/index?id=${id}` })}>
                    查看变更单
                  </Button>
                </View>
                {detail.selectedQuoteTaskId ? (
                  <View style={{ flex: '1 1 48%' }}>
                    <Button block variant="outline" onClick={() => Taro.navigateTo({ url: `/pages/quote-tasks/detail/index?id=${detail.selectedQuoteTaskId}` })}>
                      施工报价
                    </Button>
                  </View>
                ) : null}
                <View style={{ flex: '1 1 48%' }}>
                  <Button block variant="outline" onClick={() => Taro.navigateTo({ url: `/pages/complaints/create/index?projectId=${id}` })}>
                    发起投诉
                  </Button>
                </View>
              </View>
            </Card>

            <Card className="notification-surface-card" title="履约记录">
              <Tabs value={activeTab} onChange={(value) => setActiveTab(String(value))}>
                <Tabs.TabPane title="施工进展" value="0">
                  <View className="py-md">
                    {phases.length === 0 ? (
                      <Text className="notification-section-row__note">暂无施工进展</Text>
                    ) : (
                      <View className="notification-section-list">
                        {phases.map((phase) => {
                          const isActive = phase.status === 'in_progress';
                          const isCompleted = phase.status === 'completed';
                          return (
                            <View key={phase.id} className="notification-section-row">
                              <View className="notification-section-row__head">
                                <Text className="notification-section-row__title">{phase.name}</Text>
                                <Tag variant={isCompleted ? 'success' : isActive ? 'warning' : 'default'}>
                                  {getPhaseStatusText(phase.status)}
                                </Tag>
                              </View>
                              {phase.tasks && phase.tasks.length > 0 ? (
                                <View className="notification-section-row__meta">
                                  {phase.tasks.map((task) => (
                                    <Text key={task.id} className="notification-section-row__chip">
                                      {task.isCompleted ? '已完成' : '待完成'} · {task.name}
                                    </Text>
                                  ))}
                                </View>
                              ) : (
                                <Text className="notification-section-row__note">当前阶段暂无任务清单</Text>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                </Tabs.TabPane>

                <Tabs.TabPane title="验收节点" value="1">
                  <View className="py-md">
                    {actionBlocked ? (
                      <Text className="notification-section-row__note is-danger">
                        当前项目处于{paused ? '暂停' : '争议'}状态，暂不可提交节点验收。
                      </Text>
                    ) : null}
                    {milestones.length === 0 ? (
                      <Text className="notification-section-row__note">暂无验收节点</Text>
                    ) : (
                      <View className="notification-section-list">
                        {milestones.map((milestone) => {
                          const isCompleted = milestone.status === 'completed' || milestone.status === 'paid';
                          const isRejected = milestone.status === 'rejected';
                          const isPending = milestone.status === 'pending';

                          return (
                            <View key={milestone.id} className="notification-section-row">
                              <View className="notification-section-row__head">
                                <Text className="notification-section-row__title">节点 {milestone.seq} · {milestone.name}</Text>
                                <Tag
                                  variant={
                                    isCompleted ? 'success' : isRejected ? 'error' : milestone.status === 'in_progress' ? 'brand' : 'warning'
                                  }
                                >
                                  {getMilestoneStatusText(milestone.status)}
                                </Tag>
                              </View>
                              {milestone.description ? (
                                <Text className="notification-section-row__note">{milestone.description}</Text>
                              ) : null}
                              <Text className="notification-section-row__note">金额：{formatCurrency(milestone.amount)}</Text>
                              {isRejected && milestone.acceptedAt ? (
                                <Text className="notification-section-row__note">处理时间：{formatServerDate(milestone.acceptedAt)}</Text>
                              ) : null}
                              {isCompleted && milestone.acceptedAt ? (
                                <Text className="notification-section-row__note">验收时间：{formatServerDate(milestone.acceptedAt)}</Text>
                              ) : null}
                              {isPending ? (
                                <View className="flex" style={{ gap: '12rpx', marginTop: '16rpx' }}>
                                  <NutButton
                                    type="default"
                                    size="small"
                                    disabled={actionBlocked}
                                    onClick={() => handleRejectMilestone(milestone.id)}
                                  >
                                    驳回
                                  </NutButton>
                                  <NutButton
                                    type="primary"
                                    size="small"
                                    disabled={actionBlocked}
                                    onClick={() => handleAcceptMilestone(milestone.id)}
                                  >
                                    <View className="flex items-center">
                                      <Success size={14} className="mr-xs" />
                                      <Text>确认验收</Text>
                                    </View>
                                  </NutButton>
                                </View>
                              ) : null}
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                </Tabs.TabPane>
              </Tabs>
            </Card>
          </View>
        </ScrollView>
      </NotificationSurfaceShell>
    </View>
  );
};

export default ProjectDetailPage;
