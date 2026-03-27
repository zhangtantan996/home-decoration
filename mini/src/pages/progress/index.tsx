import Taro, { useDidShow } from '@tarojs/taro';
import { Text, View } from '@tarojs/components';
import React, { useEffect, useState } from 'react';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Empty } from '@/components/Empty';
import { Icon } from '@/components/Icon';
import { LoginGateCard } from '@/components/LoginGateCard';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import { getProjectPhaseStatus, getProjectStatus } from '@/constants/status';
import { listMyQuoteTasks, type QuoteTaskSummary } from '@/services/quoteTasks';
import { getProjectPhases, listProjects, type ProjectItem, type ProjectPhase } from '@/services/projects';
import { useAuthStore } from '@/store/auth';
import { syncCurrentTabBar } from '@/utils/customTabBar';
import { showErrorToast } from '@/utils/error';
import { getServerTimeMs } from '@/utils/serverTime';

import './index.scss';

export default function Progress() {
  useDidShow(() => {
    syncCurrentTabBar('/pages/progress/index');
  });

  const auth = useAuthStore();
  const [project, setProject] = useState<ProjectItem | null>(null);
  const [phases, setPhases] = useState<ProjectPhase[]>([]);
  const [pendingQuoteTask, setPendingQuoteTask] = useState<QuoteTaskSummary | null>(null);
  const [loading, setLoading] = useState(true);

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
          listMyQuoteTasks().catch(() => []),
        ]);
        const nextPendingQuoteTask = quoteTasks.find((item) => item.userConfirmationStatus === 'pending') || null;
        setPendingQuoteTask(nextPendingQuoteTask);
        const current = data.list?.[0];
        if (!current) {
          setProject(null);
          setPhases([]);
          return;
        }

        setProject(current);
        const phaseData = await getProjectPhases(current.id);
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

  if (!auth.token) {
    return (
      <View className="progress-page">
        <View className="progress-page__hero progress-page__hero--empty">
          <Text className="progress-page__hero-title">项目进度</Text>
          <Text className="progress-page__hero-subtitle">登录后查看施工阶段、节点验收与当前待办。</Text>
        </View>
        <View className="progress-page__content">
          <LoginGateCard
            iconName="progress"
            title="登录后查看项目进度"
            description="施工阶段、关键节点和当前待办都会在这里统一展示，登录后才能获取你的项目数据。"
            returnUrl="/pages/progress/index"
          />
        </View>
      </View>
    );
  }

  if (ownerScopeDisabled) {
    return (
      <View className="progress-page">
        <View className="progress-page__hero progress-page__hero--empty">
          <Text className="progress-page__hero-title">项目进度</Text>
          <Text className="progress-page__hero-subtitle">当前身份无权查看业主项目进度，请切换回业主身份后重试。</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="progress-page">
      <View className="progress-page__hero">
        {project ? (
          <>
            <Text className="progress-page__hero-label">当前项目</Text>
            <Text className="progress-page__hero-title">{project.name}</Text>
            <Text className="progress-page__hero-subtitle">{project.address || '项目地址待补充'}</Text>
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
                <Text className="progress-page__summary-value">{activePhase?.name || '待排期'}</Text>
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
