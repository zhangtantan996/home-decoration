import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';
import { Tabs, Button } from '@nutui/nutui-react-taro';
import { Success } from '@nutui/icons-react-taro';
import { Empty } from '@/components/Empty';
import { PullToRefreshNotice } from '@/components/PullToRefreshNotice';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import { getBusinessStageStatus } from '@/constants/status';
import { usePullToRefreshFeedback } from '@/hooks/usePullToRefreshFeedback';
import { acceptMilestone, getProjectDetail, getProjectMilestones, getProjectPhases, rejectMilestone, resumeProject, type Milestone, type ProjectDetail as ProjectDetailType, type ProjectPhase } from '@/services/projects';
import { useAuthStore } from '@/store/auth';
import { showErrorToast } from '@/utils/error';
import { formatServerDate } from '@/utils/serverTime';

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

  if (!auth.token) {
    return (
      <View className="project-detail-page project-detail-page--state" {...bindPullToRefresh}>
        <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />
        <Empty
          description="登录后查看项目详情"
          action={{ text: '去登录', onClick: () => Taro.switchTab({ url: '/pages/profile/index' }) }}
        />
      </View>
    );
  }

  if (ownerScopeDisabled) {
    return (
      <View className="project-detail-page project-detail-page--state" {...bindPullToRefresh}>
        <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />
        <Empty description="当前身份无权查看业主项目详情，请切换回业主身份后重试" />
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
        <Empty description="未找到项目" />
      </View>
    );
  }

  const getPhaseStatusText = (status: string) => {
    switch(status) {
      case 'completed': return '已完成';
      case 'in_progress': return '进行中';
      default: return '未开始';
    }
  };

  const getMilestoneStatusText = (status: string) => {
    switch(status) {
      case 'completed': return '已验收';
      case 'paid': return '已放款';
      case 'in_progress': return '施工中';
      case 'rejected': return '已拒绝';
      default: return '待验收';
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

  return (
    <View className="page bg-gray-50 min-h-screen pb-md" {...bindPullToRefresh}>
      <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />
      <ScrollView scrollY className="h-full">
        <View className="bg-white p-md mb-md">
          <View className="text-xl font-bold mb-xs">{detail.name}</View>
          <View className="text-gray-500 text-sm mb-md">{detail.address}</View>
          {detail.flowSummary ? <View className="text-sm text-gray-500 mb-md">{detail.flowSummary}</View> : null}

          <View className="flex" style={{ gap: '12rpx', flexWrap: 'wrap', marginBottom: '24rpx' }}>
            {detail.businessStage ? <Tag variant={businessStageStatus.variant}>{businessStageStatus.label}</Tag> : null}
            {paused ? <Tag variant="warning">项目已暂停</Tag> : null}
            {disputed ? <Tag variant="error">争议处理中</Tag> : null}
            {riskSummary?.escrowFrozen ? <Tag variant="brand">托管已冻结</Tag> : null}
          </View>

          <View className="flex justify-between border-t border-gray-100 pt-md">
             <View>
               <View className="text-xs text-gray-400">面积</View>
               <View className="font-medium">{detail.area || '-'} m²</View>
             </View>
             <View>
               <View className="text-xs text-gray-400">预算</View>
               <View className="font-medium">¥{detail.budget ? detail.budget.toLocaleString() : '-'}</View>
             </View>
             <View>
               <View className="text-xs text-gray-400">开工时间</View>
               <View className="font-medium">{formatServerDate(detail.createdAt)}</View>
             </View>
          </View>
        </View>

        {(paused || disputed || riskSummary?.escrowFrozen) ? (
          <View className="bg-white p-md mb-md">
            <View className="text-base font-bold mb-sm">异常闭环</View>
            {paused ? (
              <View className="mb-sm">
                <Text className="text-sm text-gray-900">暂停原因：{riskSummary?.pauseReason || '未填写'}</Text>
              </View>
            ) : null}
            {disputed ? (
              <View className="mb-sm">
                <Text className="text-sm text-gray-900">争议原因：{riskSummary?.disputeReason || '未填写'}</Text>
              </View>
            ) : null}
            {riskSummary?.auditStatus ? (
              <View className="mb-sm">
                <Text className="text-sm text-gray-500">审计状态：{riskSummary.auditStatus}</Text>
              </View>
            ) : null}
            {riskSummary?.escrowFrozen ? (
              <View className="mb-md">
                <Text className="text-sm text-gray-500">
                  托管资金已冻结
                  {riskSummary.frozenAmount ? `，冻结金额 ¥${riskSummary.frozenAmount.toLocaleString()}` : ''}
                </Text>
              </View>
            ) : null}

            <View className="flex" style={{ gap: '16rpx' }}>
              {paused ? (
                <View className="flex-1">
                  <Button type="primary" block onClick={handleResumeProject}>
                    恢复项目
                  </Button>
                </View>
              ) : (
                <View className="flex-1">
                  <Button type="default" block onClick={() => Taro.navigateTo({ url: `/pages/projects/pause/index?id=${id}` })}>
                    申请暂停
                  </Button>
                </View>
              )}
              <View className="flex-1">
                <Button
                  type={disputed ? 'default' : 'primary'}
                  block
                  onClick={() => Taro.navigateTo({ url: `/pages/projects/dispute/index?id=${id}` })}
                >
                  {disputed ? '查看争议' : '发起争议'}
                </Button>
              </View>
            </View>
          </View>
        ) : (
          <View className="bg-white p-md mb-md">
            <View className="text-base font-bold mb-sm">项目操作</View>
            <View className="text-sm text-gray-500 mb-md">当前项目推进正常，如遇现场停工或施工纠纷，可直接在此发起处理。</View>
            <View className="flex" style={{ gap: '16rpx' }}>
              {detail.selectedQuoteTaskId ? (
                <View className="flex-1">
                  <Button type="default" block onClick={() => Taro.navigateTo({ url: `/pages/quote-tasks/detail/index?id=${detail.selectedQuoteTaskId}` })}>
                    查看施工报价
                  </Button>
                </View>
              ) : null}
              <View className="flex-1">
                <Button type="default" block onClick={() => Taro.navigateTo({ url: `/pages/projects/pause/index?id=${id}` })}>
                  申请暂停
                </Button>
              </View>
              <View className="flex-1">
                <Button type="primary" block onClick={() => Taro.navigateTo({ url: `/pages/projects/dispute/index?id=${id}` })}>
                  发起争议
                </Button>
              </View>
            </View>
          </View>
        )}

        <View className="bg-white p-md mb-md">
          <View className="text-base font-bold mb-sm">支付与变更</View>
          {detail.nextPayablePlan ? (
            <View className="bg-blue-50 rounded-xl p-md mb-md">
              <View className="text-sm font-medium text-brand mb-xs">当前待支付</View>
              <View className="text-base font-bold mb-xs">
                {detail.nextPayablePlan.name || `第 ${detail.nextPayablePlan.seq || '-'} 期`}
              </View>
              <View className="text-sm text-gray-600 mb-xs">金额：¥{Number(detail.nextPayablePlan.amount || 0).toLocaleString()}</View>
              <View className="text-xs text-gray-500">
                {detail.nextPayablePlan.dueAt ? `到期：${formatServerDate(detail.nextPayablePlan.dueAt)}` : '已生成待支付计划'}
              </View>
              <View style={{ marginTop: '16rpx' }}>
                <Button type="primary" size="small" onClick={() => Taro.navigateTo({ url: `/pages/orders/detail/index?id=${detail.nextPayablePlan?.orderId}` })}>
                  去查看支付
                </Button>
              </View>
            </View>
          ) : null}

          <View className="text-sm font-medium mb-sm">支付计划</View>
          {!paymentPlans.length ? (
            <View className="text-sm text-gray-400 mb-md">暂无支付计划</View>
          ) : (
            <View className="space-y-sm mb-md">
              {paymentPlans.map((plan) => (
                <View key={plan.id} className="border border-gray-100 rounded-xl p-sm">
                  <View className="flex justify-between items-center mb-xs">
                    <Text className="font-medium">{plan.name || `${plan.planType || '分期'} #${plan.seq || '-'}`}</Text>
                    <Tag variant={plan.payable ? 'brand' : plan.status === 2 ? 'error' : plan.status === 1 ? 'brand' : 'default'}>
                      {getPaymentPlanStatusText(plan)}
                    </Tag>
                  </View>
                  <View className="text-sm text-gray-600 mb-xs">{`金额：¥${Number(plan.amount || 0).toLocaleString()}`}</View>
                  <View className="text-xs text-gray-500">
                    {plan.dueAt ? `到期：${formatServerDate(plan.dueAt)}` : plan.payableReason || '待后续激活'}
                  </View>
                </View>
              ))}
            </View>
          )}

          <View className="flex justify-between items-center mb-sm">
            <View className="text-sm font-medium">项目变更单</View>
            <Button size="small" type="default" onClick={() => Taro.navigateTo({ url: `/pages/projects/change-request/index?id=${id}` })}>
              查看变更单
            </Button>
          </View>
          {!changeOrders.length ? (
            <View className="text-sm text-gray-400">当前还没有正式变更单</View>
          ) : (
            <View className="space-y-sm">
              {changeOrders.slice(0, 2).map((item) => (
                <View key={item.id} className="border border-gray-100 rounded-xl p-sm">
                  <View className="flex justify-between items-center mb-xs">
                    <Text className="font-medium">{item.title || `变更单 #${item.id}`}</Text>
                    <Tag variant={item.status === 'pending_user_confirm' ? 'warning' : item.status === 'user_rejected' ? 'error' : 'default'}>
                      {getChangeOrderStatusText(item.status)}
                    </Tag>
                  </View>
                  <View className="text-sm text-gray-600 mb-xs">{item.reason || '未填写变更原因'}</View>
                  {item.amountImpact ? <View className="text-xs text-gray-500">{`金额影响：¥${Number(item.amountImpact).toLocaleString()}`}</View> : null}
                </View>
              ))}
            </View>
          )}
        </View>

        {completionPending ? (
          <View className="bg-white p-md mb-md">
            <View className="text-base font-bold mb-sm">完工审批</View>
            <View className="text-sm text-gray-500 mb-md">
              商家提交完工材料后，你需要在整体验收页执行通过或驳回。
            </View>
            <Button type="primary" block onClick={() => Taro.navigateTo({ url: `/pages/projects/completion/index?id=${id}` })}>
              处理完工审批
            </Button>
          </View>
        ) : null}

        <View className="bg-white">
          <Tabs value={activeTab} onChange={(value) => setActiveTab(String(value))}>
            <Tabs.TabPane title="施工进度" value="0">
              <View className="px-md py-md">
                <View className="pl-md relative">
                  {phases.map((phase, index) => {
                    const isActive = phase.status === 'in_progress';
                    const isCompleted = phase.status === 'completed';

                    return (
                      <View key={phase.id} className="mb-lg relative z-10">
                        {index < phases.length - 1 && (
                          <View
                            className="absolute left-0 top-md bottom-0 w-px -ml-px h-full bg-gray-200 z-0"
                            style={{ top: '20rpx', height: 'calc(100% + 40rpx)' }}
                          />
                        )}

                        <View className="flex items-start">
                          <View
                            className={`w-3 h-3 rounded-full border-2 bg-white flex-shrink-0 z-10 ${
                              isCompleted ? 'border-success bg-success' :
                              isActive ? 'border-brand bg-brand' : 'border-gray-300'
                            }`}
                            style={{ width: '24rpx', height: '24rpx', transform: 'translateX(-50%)' }}
                          />

                          <View className="ml-md flex-1 bg-white p-md rounded shadow-sm border border-gray-100">
                            <View className="flex justify-between items-center mb-sm">
                              <Text className={`font-bold ${isActive ? 'text-brand' : ''}`}>{phase.name}</Text>
                              <Text className={`text-xs px-xs py-xxs rounded ${
                                isCompleted ? 'bg-green-50 text-success' :
                                isActive ? 'bg-yellow-50 text-brand' : 'bg-gray-100 text-gray-500'
                              }`}>
                                {getPhaseStatusText(phase.status)}
                              </Text>
                            </View>

                            {phase.tasks && phase.tasks.length > 0 && (
                              <View className="space-y-xs">
                                {phase.tasks.map(task => (
                                  <View key={task.id} className="flex items-center text-sm">
                                    <Text className={`mr-xs ${task.isCompleted ? 'text-success' : 'text-gray-300'}`}>
                                      {task.isCompleted ? '✓' : '○'}
                                    </Text>
                                    <Text className={task.isCompleted ? 'text-gray-500 line-through' : 'text-gray-700'}>
                                      {task.name}
                                    </Text>
                                  </View>
                                ))}
                              </View>
                            )}
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            </Tabs.TabPane>

            <Tabs.TabPane title="验收节点" value="1">
              <View className="px-md py-md">
                {actionBlocked ? (
                  <View className="mb-md text-sm text-warning">
                    当前项目处于{paused ? '暂停' : '争议'}状态，暂不可提交节点验收。
                  </View>
                ) : null}
                {milestones.length === 0 ? (
                  <View className="text-center text-gray-400 py-lg">暂无验收节点</View>
                ) : (
                  <View className="space-y-md">
                    {milestones.map((milestone) => {
                      const isCompleted = milestone.status === 'completed' || milestone.status === 'paid';
                      const isRejected = milestone.status === 'rejected';
                      const isPending = milestone.status === 'pending';

                      return (
                        <View key={milestone.id} className="bg-white p-md rounded shadow-sm border border-gray-100">
                          <View className="flex justify-between items-start mb-sm">
                            <View className="flex-1">
                              <View className="flex items-center mb-xs">
                                <Text className="text-xs text-gray-400 mr-xs">节点 {milestone.seq}</Text>
                                <Text className="font-bold">{milestone.name}</Text>
                              </View>
                              {milestone.description && (
                                <Text className="text-sm text-gray-500">{milestone.description}</Text>
                              )}
                            </View>
                            <Text className={`text-xs px-xs py-xxs rounded ml-xs ${
                              isCompleted ? 'bg-green-50 text-success' :
                              isRejected ? 'bg-red-50 text-danger' :
                              milestone.status === 'in_progress' ? 'bg-blue-50 text-brand' :
                              'bg-yellow-50 text-warning'
                            }`}>
                              {getMilestoneStatusText(milestone.status)}
                            </Text>
                          </View>

                          <View className="flex justify-between items-center pt-sm border-t border-gray-100">
                            <View className="flex items-center">
                              <Text className="text-sm text-gray-400 mr-xs">金额:</Text>
                              <Text className="text-base font-bold text-brand">¥{milestone.amount.toLocaleString()}</Text>
                            </View>

                            {isPending && (
                              <View className="flex" style={{ gap: '12rpx' }}>
                                <Button
                                  type="default"
                                  size="small"
                                  disabled={actionBlocked}
                                  onClick={() => handleRejectMilestone(milestone.id)}
                                >
                                  <Text>驳回</Text>
                                </Button>
                                <Button
                                  type="primary"
                                  size="small"
                                  disabled={actionBlocked}
                                  onClick={() => handleAcceptMilestone(milestone.id)}
                                >
                                  <View className="flex items-center">
                                    <Success size={14} className="mr-xs" />
                                    <Text>确认验收</Text>
                                  </View>
                                </Button>
                              </View>
                            )}

                            {isRejected && milestone.acceptedAt && (
                              <Text className="text-xs text-gray-400">
                                处理时间: {formatServerDate(milestone.acceptedAt)}
                              </Text>
                            )}

                            {isCompleted && milestone.acceptedAt && (
                              <Text className="text-xs text-gray-400">
                                验收时间: {formatServerDate(milestone.acceptedAt)}
                              </Text>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            </Tabs.TabPane>
          </Tabs>
        </View>
      </ScrollView>
    </View>
  );
};

export default ProjectDetailPage;
