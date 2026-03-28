import Taro, { useDidShow } from '@tarojs/taro';
import { Text, View } from '@tarojs/components';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Empty } from '@/components/Empty';
import { Icon } from '@/components/Icon';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import { getProjectPhaseStatus, getProjectStatus } from '@/constants/status';
import { listMyQuoteTasks, type QuoteTaskSummary } from '@/services/quoteTasks';
import { getProjectDetail, getProjectPhases, listProjects, type ProjectDetail, type ProjectPhase } from '@/services/projects';
import { useAuthStore } from '@/store/auth';
import { openAuthLoginPage } from '@/utils/authRedirect';
import { syncCurrentTabBar } from '@/utils/customTabBar';
import { showErrorToast } from '@/utils/error';
import { getMiniNavMetrics } from '@/utils/navLayout';
import { getServerTimeMs } from '@/utils/serverTime';

import './index.scss';

export default function Progress() {
  const redirectingRef = useRef(false);

  useDidShow(() => {
    syncCurrentTabBar('/pages/progress/index');

    if (!useAuthStore.getState().token && !redirectingRef.current) {
      redirectingRef.current = true;
      void openAuthLoginPage('/pages/progress/index').finally(() => {
        setTimeout(() => {
          redirectingRef.current = false;
        }, 240);
      });
    }
  });

  const auth = useAuthStore();
  const navMetrics = useMemo(() => getMiniNavMetrics(), []);
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [phases, setPhases] = useState<ProjectPhase[]>([]);
  const [pendingQuoteTask, setPendingQuoteTask] = useState<QuoteTaskSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const headerInsetStyle = useMemo(
    () => ({
      paddingTop: `${navMetrics.menuTop}px`,
      paddingRight: `${navMetrics.menuRightInset}px`,
    }),
    [navMetrics.menuRightInset, navMetrics.menuTop],
  );
  const headerMainStyle = useMemo(
    () => ({ height: `${navMetrics.menuHeight}px` }),
    [navMetrics.menuHeight],
  );
  const headerPlaceholderStyle = useMemo(
    () => ({ height: `${navMetrics.menuBottom}px` }),
    [navMetrics.menuBottom],
  );
  const capsuleSpacerStyle = useMemo(
    () => ({
      width: `${navMetrics.menuWidth}px`,
      height: `${navMetrics.menuHeight}px`,
    }),
    [navMetrics.menuHeight, navMetrics.menuWidth],
  );

  useEffect(() => {
    if (!auth.token) {
      setProject(null);
      setPhases([]);
      setPendingQuoteTask(null);
      setLoading(false);
      return;
    }

    const fetchProject = async () => {
      setLoading(true);
      try {
        const [data, quoteTasks] = await Promise.all([
          listProjects(1, 1),
          listMyQuoteTasks().catch(() => [] as QuoteTaskSummary[]),
        ]);
        const nextPendingQuoteTask = quoteTasks.find((item) => item.userConfirmationStatus === 'pending') || null;
        setPendingQuoteTask(nextPendingQuoteTask);
        const current = data.list?.[0];
        if (!current) {
          setProject(null);
          setPhases([]);
          return;
        }

        const [projectDetail, phaseData] = await Promise.all([
          getProjectDetail(current.id).catch(() => current as ProjectDetail),
          getProjectPhases(current.id),
        ]);

        setProject(projectDetail);
        setPhases(phaseData.phases || []);
      } catch (err) {
        showErrorToast(err, '加载失败');
      } finally {
        setLoading(false);
      }
    };

    void fetchProject();
  }, [auth.token]);

  const ownerScopeDisabled = Boolean(auth.user?.activeRole) && !['owner', 'homeowner'].includes(auth.user?.activeRole || '');

  const getProjectDays = (createdAt?: string) => {
    if (!createdAt) return 0;
    const start = getServerTimeMs(createdAt);
    if (!start) return 0;
    return Math.max(1, Math.ceil((Date.now() - start) / (1000 * 60 * 60 * 24)));
  };

  const projectStatus = getProjectStatus(project?.status);
  const activePhase = phases.find((item) => item.status === 'in_progress');
  const pendingTasks = phases
    .flatMap((phase) =>
      (phase.tasks || [])
        .filter((task) => !task.isCompleted)
        .map((task) => ({
          id: `${phase.id}-${task.id}`,
          title: task.name,
          phaseName: phase.name,
        })),
    )
    .slice(0, 3);
  const completedPhaseCount = phases.filter((item) => item.status === 'completed').length;
  const projectDays = getProjectDays(project?.createdAt);
  const riskSummary = project?.riskSummary;
  const hasRisk = Boolean(riskSummary?.pausedAt || riskSummary?.disputedAt || riskSummary?.escrowFrozen);
  const projectStageText = project?.businessStage || activePhase?.name || '待排期';
  const pageHeader = (
    <>
      <View className="progress-page__header" style={headerInsetStyle}>
        <View className="progress-page__header-main" style={headerMainStyle}>
          <Text className="progress-page__header-title">项目进度</Text>
          <View className="progress-page__capsule-spacer" style={capsuleSpacerStyle} />
        </View>
      </View>
      <View className="progress-page__header-placeholder" style={headerPlaceholderStyle} />
    </>
  );

  if (!auth.token) {
    return <View className="progress-page" />;
  }

  if (ownerScopeDisabled) {
    return (
      <View className="progress-page page-with-tabbar">
        {pageHeader}
        <View className="progress-page__hero progress-page__hero--empty">
          <Text className="progress-page__hero-title">项目进度</Text>
          <Text className="progress-page__hero-subtitle">当前身份无权查看业主项目进度，请切换回业主身份后重试。</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="progress-page page-with-tabbar">
      {pageHeader}
      <View className="progress-page__hero">
        {project ? (
          <>
            <Text className="progress-page__hero-label">当前项目</Text>
            <Text className="progress-page__hero-title">{project.name}</Text>
            <Text className="progress-page__hero-subtitle">{project.flowSummary || project.address || '项目地址待补充'}</Text>
            <View className="progress-page__hero-stats">
              <View className="progress-page__hero-stat">
                <Text className="progress-page__hero-stat-value">{projectDays}</Text>
                <Text className="progress-page__hero-stat-label">开工天数</Text>
              </View>
              <View className="progress-page__hero-stat">
                <Text className="progress-page__hero-stat-value">{completedPhaseCount}</Text>
                <Text className="progress-page__hero-stat-label">完成阶段</Text>
              </View>
              <View className="progress-page__hero-stat">
                <Text className="progress-page__hero-stat-value">{pendingTasks.length}</Text>
                <Text className="progress-page__hero-stat-label">待办事项</Text>
              </View>
            </View>
            <View className="progress-page__hero-chip">
              <Tag variant={projectStatus.variant}>{projectStatus.label}</Tag>
            </View>
          </>
        ) : pendingQuoteTask ? (
          <>
            <Text className="progress-page__hero-label">待确认施工报价</Text>
            <Text className="progress-page__hero-title">{pendingQuoteTask.title}</Text>
            <Text className="progress-page__hero-subtitle">
              {pendingQuoteTask.flowSummary || '设计确认后不会直接建项目，请先确认施工报价。'}
            </Text>
            <View className="progress-page__hero-chip">
              <Tag variant="warning">{pendingQuoteTask.status}</Tag>
            </View>
          </>
        ) : (
          <>
            <Text className="progress-page__hero-title">项目进度</Text>
            <Text className="progress-page__hero-subtitle">登录后可在此查看施工阶段、验收节点与项目明细。</Text>
          </>
        )}
      </View>

      <View className="progress-page__content">
        <Card className="progress-page__card" title="当前进展">
          {loading ? (
            <View>
              <Skeleton height={120} />
              <Skeleton height={120} className="progress-page__loading-gap" />
            </View>
          ) : !project ? (
            pendingQuoteTask ? (
              <Empty
                description="施工报价已提交，确认后才会创建项目。"
                action={{
                  text: '去确认施工报价',
                  onClick: () => Taro.navigateTo({ url: `/pages/quote-tasks/detail/index?id=${pendingQuoteTask.id}` }),
                }}
              />
            ) : (
              <Empty
                description="还没有可展示的项目"
                action={{ text: '去首页找服务', onClick: () => Taro.switchTab({ url: '/pages/home/index' }) }}
              />
            )
          ) : (
            <View className="progress-page__summary">
              <View className="progress-page__summary-item">
                <Text className="progress-page__summary-label">当前阶段</Text>
                <Text className="progress-page__summary-value">{projectStageText}</Text>
              </View>
              <View className="progress-page__summary-item">
                <Text className="progress-page__summary-label">项目预算</Text>
                <Text className="progress-page__summary-value">
                  {project.budget ? `¥${project.budget.toLocaleString()}` : '待补充'}
                </Text>
              </View>
              <View className="progress-page__summary-item">
                <Text className="progress-page__summary-label">项目面积</Text>
                <Text className="progress-page__summary-value">
                  {project.area ? `${project.area}㎡` : '待补充'}
                </Text>
              </View>
            </View>
          )}
        </Card>

        {project && hasRisk ? (
          <Card className="progress-page__card" title="异常提醒">
            <View className="flex flex-col gap-sm">
              {riskSummary?.pausedAt ? (
                <View className="flex items-start justify-between gap-sm">
                  <View>
                    <Text className="text-sm font-medium text-gray-900">项目已暂停</Text>
                    <Text className="text-sm text-gray-500">{riskSummary.pauseReason || '等待恢复后继续推进'}</Text>
                  </View>
                  <Tag variant="warning">暂停中</Tag>
                </View>
              ) : null}
              {riskSummary?.disputedAt ? (
                <View className="flex items-start justify-between gap-sm">
                  <View>
                    <Text className="text-sm font-medium text-gray-900">争议处理中</Text>
                    <Text className="text-sm text-gray-500">{riskSummary.disputeReason || '平台正在介入仲裁'}</Text>
                  </View>
                  <Tag variant="error">{riskSummary.auditStatus || '处理中'}</Tag>
                </View>
              ) : null}
              {riskSummary?.escrowFrozen ? (
                <View className="text-sm text-gray-500">
                  托管账户已冻结
                  {riskSummary.frozenAmount ? `，冻结金额 ¥${riskSummary.frozenAmount.toLocaleString()}` : ''}
                </View>
              ) : null}
              <Button onClick={() => Taro.navigateTo({ url: `/pages/projects/detail/index?id=${project.id}` })}>
                查看项目异常详情
              </Button>
            </View>
          </Card>
        ) : null}

        <Card className="progress-page__card" title="施工时间线">
          {loading ? (
            <Skeleton height={180} />
          ) : phases.length === 0 ? (
            <Empty description="项目进度将在开工后显示" />
          ) : (
            <View className="progress-page__timeline">
              {phases.map((phase, index) => {
                const status = getProjectPhaseStatus(phase.status);
                const isDone = phase.status === 'completed';
                const isActive = phase.status === 'in_progress';
                return (
                  <View key={phase.id} className="progress-page__timeline-item">
                    {index < phases.length - 1 ? <View className="progress-page__timeline-line" /> : null}
                    <View className={`progress-page__timeline-dot ${isDone ? 'progress-page__timeline-dot--done' : isActive ? 'progress-page__timeline-dot--active' : ''}`}>
                      {isDone ? <Icon name="success" size={14} color="#ffffff" /> : null}
                    </View>
                    <View className="progress-page__timeline-content">
                      <View className="progress-page__timeline-head">
                        <Text className="progress-page__timeline-title">{phase.name}</Text>
                        <Tag variant={status.variant}>{status.label}</Tag>
                      </View>
                      <Text className="progress-page__timeline-date">
                        {phase.startDate || phase.endDate || '时间待更新'}
                      </Text>
                      {(phase.tasks || []).length > 0 ? (
                        <View className="progress-page__timeline-tasks">
                          {(phase.tasks || []).slice(0, 3).map((task) => (
                            <View key={task.id} className="progress-page__timeline-task">
                              <Text className={`progress-page__timeline-task-mark ${task.isCompleted ? 'progress-page__timeline-task-mark--done' : ''}`}>
                                {task.isCompleted ? '✓' : '○'}
                              </Text>
                              <Text className={`progress-page__timeline-task-text ${task.isCompleted ? 'progress-page__timeline-task-text--done' : ''}`}>
                                {task.name}
                              </Text>
                            </View>
                          ))}
                        </View>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </Card>

        <Card className="progress-page__card" title="当前待办">
          {pendingQuoteTask ? (
            <View className="progress-page__todo-item">
              <Text className="progress-page__todo-title">{pendingQuoteTask.title}</Text>
              <Text className="progress-page__todo-subtitle">施工报价待你确认，确认后项目才会创建。</Text>
            </View>
          ) : pendingTasks.length > 0 ? (
            pendingTasks.map((task) => (
              <View key={task.id} className="progress-page__todo-item">
                <Text className="progress-page__todo-title">{task.title}</Text>
                <Text className="progress-page__todo-subtitle">所属阶段：{task.phaseName}</Text>
              </View>
            ))
          ) : (
            <Empty description="当前暂无待办事项" />
          )}
        </Card>

        {project ? (
          <View className="progress-page__footer-actions">
            <Button
              variant="outline"
              className="progress-page__footer-button"
              onClick={() => Taro.navigateTo({ url: '/pages/orders/list/index' })}
            >
              查看订单
            </Button>
            <Button
              className="progress-page__footer-button"
              onClick={() => Taro.navigateTo({ url: `/pages/projects/detail/index?id=${project.id}` })}
            >
              查看项目详情
            </Button>
          </View>
        ) : null}
        {!project && pendingQuoteTask ? (
          <View className="progress-page__footer-actions">
            <Button
              className="progress-page__footer-button"
              onClick={() => Taro.navigateTo({ url: `/pages/quote-tasks/detail/index?id=${pendingQuoteTask.id}` })}
            >
              去确认施工报价
            </Button>
          </View>
        ) : null}
      </View>
    </View>
  );
}
