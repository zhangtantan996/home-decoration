import Taro, { useDidShow } from '@tarojs/taro';
import { Image, ScrollView, Text, View } from '@tarojs/components';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { PullToRefreshNotice } from '@/components/PullToRefreshNotice';
import { Skeleton } from '@/components/Skeleton';
import { usePullToRefreshFeedback } from '@/hooks/usePullToRefreshFeedback';
import { listMyQuoteTasks, type QuoteTaskSummary } from '@/services/quoteTasks';
import {
  getProjectDetail,
  getProjectLogs,
  getProjectMilestones,
  getProjectPhases,
  listProjects,
  type Milestone,
  type ProjectDetail,
  type ProjectItem,
  type ProjectPhase,
} from '@/services/projects';
import { useAuthStore } from '@/store/auth';
import { openAuthLoginPage } from '@/utils/authRedirect';
import { syncCurrentTabBar } from '@/utils/customTabBar';
import { showErrorToast } from '@/utils/error';
import { getMiniNavMetrics } from '@/utils/navLayout';
import {
  buildMilestoneViewModels,
  buildPendingQuoteViewModel,
  buildProgressHeroViewModel,
  buildProgressPhaseSections,
  type MilestoneViewModel,
  type PendingQuoteViewModel,
  type ProgressHeroViewModel,
  type ProgressPhaseSectionViewModel,
  type ProjectLogViewModel,
  type ProjectWorkLogRecord,
} from './view-model';

import './index.scss';

const PROGRESS_SELECTED_PROJECT_KEY = 'progress:selected-project-id';

const ProgressHeader = ({
  title,
  insetStyle,
  mainStyle,
  capsuleStyle,
  placeholderStyle,
}: {
  title: string;
  insetStyle: CSSProperties;
  mainStyle: CSSProperties;
  capsuleStyle: CSSProperties;
  placeholderStyle: CSSProperties;
}) => (
  <>
    <View className="progress-page__header" style={insetStyle}>
      <View className="progress-page__header-main" style={mainStyle}>
        <Text className="progress-page__header-title">{title}</Text>
        <View className="progress-page__capsule-spacer" style={capsuleStyle} />
      </View>
    </View>
    <View className="progress-page__header-placeholder" style={placeholderStyle} />
  </>
);

const ProgressSkeleton = () => (
  <View className="progress-page__content">
    <View className="progress-page__hero progress-page__hero--skeleton">
      <Skeleton width="30%" height={34} className="progress-page__skeleton-pill" />
      <Skeleton width="58%" height={50} className="progress-page__skeleton-gap-lg" />
      <Skeleton width="74%" height={26} className="progress-page__skeleton-gap" />
    </View>

    <View className="progress-page__section-card progress-page__section-card--tint">
      <Skeleton width="24%" height={30} />
      <View className="progress-page__milestone-strip progress-page__milestone-strip--skeleton">
        {Array.from({ length: 4 }).map((_, index) => (
          <View key={`milestone-${index}`} className="progress-page__milestone-item progress-page__milestone-item--skeleton">
            <Skeleton circle width={92} height={92} />
            <Skeleton width="78%" height={24} className="progress-page__skeleton-gap" />
            <Skeleton width="56%" height={20} className="progress-page__skeleton-gap-sm" />
            <Skeleton width="62%" height={20} className="progress-page__skeleton-gap-sm" />
          </View>
        ))}
      </View>
    </View>

    <View className="progress-page__section-card">
      <Skeleton width="28%" height={30} />
      {Array.from({ length: 2 }).map((_, index) => (
        <View key={`phase-${index}`} className="progress-page__phase-item progress-page__phase-item--skeleton">
          <View className="progress-page__phase-axis">
            <Skeleton circle width={20} height={20} />
            <View className="progress-page__phase-line progress-page__phase-line--skeleton" />
          </View>
          <View className="progress-page__phase-card">
            <Skeleton width="34%" height={24} />
            <Skeleton width="50%" height={22} className="progress-page__skeleton-gap" />
            <Skeleton width="60%" height={22} className="progress-page__skeleton-gap" />
            <Skeleton row={2} height={22} className="progress-page__skeleton-gap" />
          </View>
        </View>
      ))}
    </View>
  </View>
);

const SectionTitle = ({ title }: { title: string }) => (
  <View className="progress-page__section-head">
    <Text className="progress-page__section-title">{title}</Text>
  </View>
);

const toneClassMap: Record<string, string> = {
  default: 'is-default',
  active: 'is-active',
  success: 'is-success',
  danger: 'is-danger',
};

const getMilestoneIconColor = (item: MilestoneViewModel) => {
  if (item.isActive) return '#FFFFFF';
  if (item.tone === 'success') return '#16A34A';
  if (item.tone === 'danger') return '#DC2626';
  return '#3B82F6';
};

const ProgressHero = ({ hero }: { hero: ProgressHeroViewModel }) => (
  <View className={`progress-page__hero ${hero.coverImage ? '' : 'is-placeholder'}`}>
    {hero.coverImage ? <Image className="progress-page__hero-image" src={hero.coverImage} mode="aspectFill" lazyLoad /> : null}
    <View className="progress-page__hero-overlay" />
    <View className="progress-page__hero-content">
      <View className="progress-page__hero-pill">
        <Text className="progress-page__hero-pill-text">开工 {hero.daysText}</Text>
      </View>
      <Text className="progress-page__hero-title">{hero.title}</Text>
      <View className="progress-page__hero-address-row">
        <Icon name="location-pin" size={24} color="rgba(255,255,255,0.84)" />
        <Text className="progress-page__hero-address">{hero.address}</Text>
      </View>
    </View>
  </View>
);

const MAX_PROJECT_NAME_LENGTH = 5;

const buildProjectTabLabel = (project: ProjectItem, index: number) => {
  const raw = String(project.name || project.address || `项目${index + 1}`).trim();
  if (raw.length <= MAX_PROJECT_NAME_LENGTH) {
    return raw;
  }
  return `${raw.slice(0, MAX_PROJECT_NAME_LENGTH)}…`;
};

const ProjectSwitchBar = ({
  projects,
  currentProjectId,
  onChange,
}: {
  projects: ProjectItem[];
  currentProjectId: number;
  onChange: (projectId: number) => void;
}) => (
  <ScrollView scrollX className="progress-page__project-switch-scroll" enhanced showScrollbar={false}>
    <View className="progress-page__project-switch-track">
      {projects.map((item, index) => {
        const active = item.id === currentProjectId;
        return (
          <View
            key={item.id}
            className={`progress-page__project-switch-item ${active ? 'is-active' : ''}`}
            onClick={() => {
              if (!active) onChange(item.id);
            }}
          >
            <Text className={`progress-page__project-switch-label ${active ? 'is-active' : ''}`}>
              {buildProjectTabLabel(item, index)}
            </Text>
            <View className={`progress-page__project-switch-indicator ${active ? 'is-active' : ''}`} />
          </View>
        );
      })}
    </View>
  </ScrollView>
);

const MilestoneStrip = ({ items }: { items: MilestoneViewModel[] }) => (
  <ScrollView scrollX className="progress-page__milestone-scroll" enhanced showScrollbar={false}>
    <View className="progress-page__milestone-strip">
      {items.map((item) => (
        <View
          key={item.id}
          className={`progress-page__milestone-item ${item.isActive ? 'is-active' : ''} ${item.isDone ? 'is-done' : ''}`}
        >
          <View className={`progress-page__milestone-icon ${toneClassMap[item.tone] || ''}`}>
            <Icon name={item.iconName} size={34} color={getMilestoneIconColor(item)} />
          </View>
          <Text className="progress-page__milestone-name">{item.name}</Text>
          <Text className="progress-page__milestone-status">{item.statusLabel}</Text>
          <Text className="progress-page__milestone-date">{item.dateText}</Text>
        </View>
      ))}
    </View>
  </ScrollView>
);

const PhaseLogEntry = ({
  item,
  isLast,
  onPreview,
}: {
  item: ProjectLogViewModel;
  isLast: boolean;
  onPreview: (current: string, urls: string[]) => void;
}) => {
  const useScrollableGallery = item.images.length > 3;
  const isSingleImage = item.images.length === 1;

  return (
    <View className="progress-page__phase-log-item">
      <View className="progress-page__phase-log-axis">
        <View className="progress-page__phase-log-dot" />
        {!isLast ? <View className="progress-page__phase-log-line" /> : null}
      </View>

      <View className="progress-page__phase-log-main">
        <Text className="progress-page__phase-log-time">{item.timeLabel}</Text>
        <Text className="progress-page__phase-log-title">{item.title}</Text>
        {item.subtitle ? <Text className="progress-page__phase-log-subtitle">{item.subtitle}</Text> : null}
        {item.description ? <Text className="progress-page__phase-log-description">{item.description}</Text> : null}

        {item.images.length > 0 ? (
          useScrollableGallery ? (
            <ScrollView scrollX className="progress-page__phase-log-gallery-scroll" enhanced showScrollbar={false}>
              <View className="progress-page__phase-log-gallery-track">
                {item.images.map((image, index) => (
                  <View
                    key={`${item.id}-${image}-${index}`}
                    className="progress-page__phase-log-image-shell progress-page__phase-log-image-shell--scroll"
                    onClick={() => onPreview(image, item.images)}
                  >
                    <Image className="progress-page__phase-log-image" src={image} mode="aspectFill" lazyLoad />
                  </View>
                ))}
              </View>
            </ScrollView>
          ) : (
            <View className={`progress-page__phase-log-gallery-grid ${isSingleImage ? 'progress-page__phase-log-gallery-grid--single' : ''}`}>
              {item.images.map((image, index) => (
                <View
                  key={`${item.id}-${image}-${index}`}
                  className={`progress-page__phase-log-image-shell ${isSingleImage ? 'progress-page__phase-log-image-shell--single' : ''}`}
                  onClick={() => onPreview(image, item.images)}
                >
                  <Image className="progress-page__phase-log-image" src={image} mode="aspectFill" lazyLoad />
                </View>
              ))}
            </View>
          )
        ) : null}
      </View>
    </View>
  );
};

const ProgressPhaseStream = ({
  items,
  onPreview,
}: {
  items: ProgressPhaseSectionViewModel[];
  onPreview: (current: string, urls: string[]) => void;
}) => {
  if (items.length === 0) {
    return <SectionEmpty title="施工进展将在开工后出现" description="开工后会按阶段同步时间、节点任务和施工日志。" />;
  }

  return (
    <View className="progress-page__phase-stream">
      {items.map((item, index) => (
        <View key={item.id} className="progress-page__phase-item">
          <View className="progress-page__phase-axis">
            <View className={`progress-page__phase-node ${toneClassMap[item.tone] || ''}`} />
            {index < items.length - 1 ? <View className="progress-page__phase-line" /> : null}
          </View>

          <View className={`progress-page__phase-card ${toneClassMap[item.tone] || ''}`}>
            <View className="progress-page__phase-card-head">
              <View className="progress-page__phase-copy">
                <Text className="progress-page__phase-name">{item.name}</Text>
                <Text className="progress-page__phase-date">{item.dateText}</Text>
              </View>
              <View className={`progress-page__phase-status ${toneClassMap[item.tone] || ''}`}>
                <Text className={`progress-page__phase-status-text ${toneClassMap[item.tone] || ''}`}>{item.statusLabel}</Text>
              </View>
            </View>

            <Text className="progress-page__phase-task-summary">{item.taskSummary}</Text>

            {item.tasks.length > 0 ? (
              <View className="progress-page__phase-task-list">
                {item.tasks.map((task) => (
                  <View key={task.id} className={`progress-page__phase-task-pill ${task.isCompleted ? 'is-done' : ''}`}>
                    <Text className={`progress-page__phase-task-pill-text ${task.isCompleted ? 'is-done' : ''}`}>{task.name}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {item.logs.length > 0 ? (
              <View className="progress-page__phase-log-list">
                {item.logs.map((log, logIndex) => (
                  <PhaseLogEntry
                    key={log.id}
                    item={log}
                    isLast={logIndex === item.logs.length - 1}
                    onPreview={onPreview}
                  />
                ))}
              </View>
            ) : (
              <View className="progress-page__phase-empty">
                <Text className="progress-page__phase-empty-text">{item.emptyText}</Text>
              </View>
            )}
          </View>
        </View>
      ))}
    </View>
  );
};

const SectionEmpty = ({ title, description }: { title: string; description: string }) => (
  <View className="progress-page__section-empty">
    <View className="progress-page__section-empty-icon">
      <Icon name="progress" size={36} color="#64748b" />
    </View>
    <Text className="progress-page__section-empty-title">{title}</Text>
    <Text className="progress-page__section-empty-description">{description}</Text>
  </View>
);

const RiskSection = ({
  riskSummary,
  onOpenDetail,
}: {
  riskSummary: NonNullable<ProjectDetail['riskSummary']>;
  onOpenDetail: () => void;
}) => (
  <View className="progress-page__section-card progress-page__section-card--tint">
    <SectionTitle title="异常提醒" />

    <View className="progress-page__risk-list">
      {riskSummary.pausedAt ? (
        <View className="progress-page__risk-item">
          <View className="progress-page__risk-copy-group">
            <Text className="progress-page__risk-title">项目已暂停</Text>
            <Text className="progress-page__risk-copy">{riskSummary.pauseReason || '等待恢复后继续推进。'}</Text>
          </View>
          <Text className="progress-page__risk-tag">暂停中</Text>
        </View>
      ) : null}

      {riskSummary.disputedAt ? (
        <View className="progress-page__risk-item">
          <View className="progress-page__risk-copy-group">
            <Text className="progress-page__risk-title">争议处理中</Text>
            <Text className="progress-page__risk-copy">{riskSummary.disputeReason || '平台正在介入处理，请留意后续通知。'}</Text>
          </View>
          <Text className="progress-page__risk-tag progress-page__risk-tag--danger">{riskSummary.auditStatus || '处理中'}</Text>
        </View>
      ) : null}

      {riskSummary.escrowFrozen ? (
        <View className="progress-page__risk-note">
          托管账户已冻结
          {riskSummary.frozenAmount ? `，冻结金额 ¥${riskSummary.frozenAmount.toLocaleString()}` : ''}
        </View>
      ) : null}
    </View>

    <Button variant="outline" className="progress-page__ghost-button" onClick={onOpenDetail}>
      查看异常详情
    </Button>
  </View>
);

const PendingQuoteState = ({
  quote,
  onOpen,
}: {
  quote: PendingQuoteViewModel;
  onOpen: () => void;
}) => (
  <View className="progress-page__content">
    <View className="progress-page__quote-state">
      <View className="progress-page__quote-badge">
        <Text className="progress-page__quote-badge-text">待确认施工报价</Text>
      </View>
      <Text className="progress-page__quote-title">{quote.title}</Text>
      <Text className="progress-page__quote-description">{quote.subtitle}</Text>
      <Text className="progress-page__quote-status">当前状态：{quote.statusLabel}</Text>
      <Button className="progress-page__primary-button" onClick={onOpen}>
        去确认施工报价
      </Button>
    </View>
  </View>
);

const EmptyProjectState = () => (
  <View className="progress-page__content">
    <View className="progress-page__empty-state">
      <View className="progress-page__empty-state-icon">
        <Icon name="home" size={42} color="#64748b" />
      </View>
      <Text className="progress-page__empty-state-title">还没有正在推进的项目</Text>
      <Text className="progress-page__empty-state-copy">确认施工报价后，工程节点、施工进展和异常提醒都会在这里持续同步。</Text>
      <Button className="progress-page__primary-button" onClick={() => Taro.switchTab({ url: '/pages/home/index' })}>
        去首页找服务
      </Button>
    </View>
  </View>
);

export default function Progress() {
  const redirectingRef = useRef(false);
  const redirectResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedProjectIdRef = useRef<number | null>(null);
  const auth = useAuthStore();
  const navMetrics = useMemo(() => getMiniNavMetrics(), []);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [phases, setPhases] = useState<ProjectPhase[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [logs, setLogs] = useState<ProjectWorkLogRecord[]>([]);
  const [pendingQuoteTask, setPendingQuoteTask] = useState<QuoteTaskSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const headerInsetStyle = useMemo(
    () => ({
      paddingTop: `${navMetrics.menuTop}px`,
      paddingRight: `${navMetrics.menuRightInset}px`,
      paddingBottom: `${navMetrics.contentTop - navMetrics.menuBottom}px`,
    }),
    [navMetrics.contentTop, navMetrics.menuBottom, navMetrics.menuRightInset, navMetrics.menuTop],
  );
  const headerMainStyle = useMemo(() => ({ height: `${navMetrics.menuHeight}px` }), [navMetrics.menuHeight]);
  const headerPlaceholderStyle = useMemo(() => ({ height: `${navMetrics.contentTop}px` }), [navMetrics.contentTop]);
  const capsuleSpacerStyle = useMemo(
    () => ({
      width: `${navMetrics.menuWidth}px`,
      height: `${navMetrics.menuHeight}px`,
    }),
    [navMetrics.menuHeight, navMetrics.menuWidth],
  );

  useEffect(() => {
    selectedProjectIdRef.current = selectedProjectId;
  }, [selectedProjectId]);

  useEffect(() => {
    return () => {
      if (redirectResetTimerRef.current) {
        clearTimeout(redirectResetTimerRef.current);
        redirectResetTimerRef.current = null;
      }
    };
  }, []);

  useDidShow(() => {
    syncCurrentTabBar('/pages/progress/index');

    const preferredProjectId = Number(Taro.getStorageSync(PROGRESS_SELECTED_PROJECT_KEY) || 0);
    if (Number.isFinite(preferredProjectId) && preferredProjectId > 0) {
      selectedProjectIdRef.current = preferredProjectId;
      setSelectedProjectId(preferredProjectId);
      Taro.removeStorageSync(PROGRESS_SELECTED_PROJECT_KEY);
    }

    if (!useAuthStore.getState().token && !redirectingRef.current) {
      redirectingRef.current = true;
      void openAuthLoginPage('/pages/progress/index').finally(() => {
        if (redirectResetTimerRef.current) {
          clearTimeout(redirectResetTimerRef.current);
        }
        redirectResetTimerRef.current = setTimeout(() => {
          redirectingRef.current = false;
          redirectResetTimerRef.current = null;
        }, 240);
      });
    }

    if (useAuthStore.getState().token) {
      void runReload();
    }
  });

  const fetchProject = useCallback(async (preferredProjectId?: number) => {
    if (!auth.token) {
      setProjects([]);
      setSelectedProjectId(null);
      setProject(null);
      setPhases([]);
      setMilestones([]);
      setLogs([]);
      setPendingQuoteTask(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [projectPage, quoteTasks] = await Promise.all([
        listProjects(1, 20),
        listMyQuoteTasks().catch(() => [] as QuoteTaskSummary[]),
      ]);
      const pendingQuote = quoteTasks.find((item) => item.userConfirmationStatus === 'pending') || null;
      setPendingQuoteTask(pendingQuote);
      const projectList = projectPage.list || [];
      setProjects(projectList);

      const current =
        projectList.find((item) => item.id === preferredProjectId)
        || projectList.find((item) => item.id === selectedProjectIdRef.current)
        || projectList[0];
      if (!current) {
        setSelectedProjectId(null);
        setProject(null);
        setPhases([]);
        setMilestones([]);
        setLogs([]);
        return;
      }
      setSelectedProjectId(current.id);

      const [projectDetail, phaseData, milestoneData, logData] = await Promise.all([
        getProjectDetail(current.id).catch(() => current as ProjectDetail),
        getProjectPhases(current.id).catch(() => ({ phases: [] as ProjectPhase[] })),
        getProjectMilestones(current.id).catch(() => ({ milestones: [] as Milestone[] })),
        getProjectLogs(current.id).catch(() => ({ list: [] as ProjectWorkLogRecord[], total: 0, page: 1, pageSize: 20 })),
      ]);

      setProject(projectDetail);
      setPhases(phaseData.phases || []);
      setMilestones(milestoneData.milestones || []);
      setLogs(Array.isArray(logData.list) ? (logData.list as ProjectWorkLogRecord[]) : []);
    } catch (err) {
      showErrorToast(err, '同步进度失败');
    } finally {
      setLoading(false);
    }
  }, [auth.token]);
  const { refreshStatus, drawerHeight, drawerProgress, bindPullToRefresh, runReload } = usePullToRefreshFeedback(() =>
    fetchProject(selectedProjectIdRef.current || undefined),
  );

  const handleProjectChange = useCallback((value: string | number) => {
    const nextProjectId = Number(value);
    if (!Number.isFinite(nextProjectId) || nextProjectId <= 0 || nextProjectId === selectedProjectIdRef.current) {
      return;
    }
    setSelectedProjectId(nextProjectId);
    void fetchProject(nextProjectId);
  }, [fetchProject]);

  const ownerScopeDisabled = Boolean(auth.user?.activeRole) && !['owner', 'homeowner'].includes(auth.user?.activeRole || '');
  const hero = useMemo(
    () => (project ? buildProgressHeroViewModel({ project, logs }) : null),
    [logs, project],
  );
  const milestoneItems = useMemo(() => buildMilestoneViewModels(milestones, phases), [milestones, phases]);
  const phaseSections = useMemo(() => buildProgressPhaseSections(phases, logs), [phases, logs]);
  const pendingQuote = useMemo(
    () => (pendingQuoteTask ? buildPendingQuoteViewModel(pendingQuoteTask) : null),
    [pendingQuoteTask],
  );
  const riskSummary = project?.riskSummary;
  const hasRisk = Boolean(riskSummary?.pausedAt || riskSummary?.disputedAt || riskSummary?.escrowFrozen);

  const pageHeader = (
    <ProgressHeader
      title="项目进度"
      insetStyle={headerInsetStyle}
      mainStyle={headerMainStyle}
      capsuleStyle={capsuleSpacerStyle}
      placeholderStyle={headerPlaceholderStyle}
    />
  );

  const handlePreview = useCallback((current: string, urls: string[]) => {
    if (!current || urls.length === 0) return;
    void Taro.previewImage({ current, urls });
  }, []);

  if (!auth.token) {
    return <View className="progress-page" />;
  }

  if (ownerScopeDisabled) {
    return (
      <View className="progress-page page-with-tabbar">
        {pageHeader}
        <View className="progress-page__content">
          <View className="progress-page__empty-state">
            <View className="progress-page__empty-state-icon">
              <Icon name="profile" size={42} color="#64748b" />
            </View>
            <Text className="progress-page__empty-state-title">当前身份暂不能查看业主项目</Text>
            <Text className="progress-page__empty-state-copy">请切换回业主身份后，再查看施工阶段、验收节点和施工日志。</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="progress-page page-with-tabbar" {...bindPullToRefresh}>
      {pageHeader}
      <PullToRefreshNotice status={refreshStatus} height={drawerHeight} progress={drawerProgress} />

      {loading ? <ProgressSkeleton /> : null}

      {!loading && !project && pendingQuote ? (
        <PendingQuoteState
          quote={pendingQuote}
          onOpen={() => Taro.navigateTo({ url: `/pages/quote-tasks/detail/index?id=${pendingQuoteTask?.id}` })}
        />
      ) : null}

      {!loading && !project && !pendingQuote ? <EmptyProjectState /> : null}

      {!loading && project && hero ? (
        <View className="progress-page__content">
          {projects.length > 1 ? (
            <View className="progress-page__project-switch">
              <ProjectSwitchBar
                projects={projects}
                currentProjectId={selectedProjectId ?? project.id}
                onChange={(projectId) => handleProjectChange(projectId)}
              />
            </View>
          ) : null}

          <ProgressHero hero={hero} />

          <View className="progress-page__section-card progress-page__section-card--tint">
            <SectionTitle title="阶段总览" />
            {milestoneItems.length > 0 ? (
              <MilestoneStrip items={milestoneItems} />
            ) : (
              <SectionEmpty title="节点尚未同步" description="施工节点创建后，会在这里展示状态、日期和关键进度。" />
            )}
          </View>

          <View className="progress-page__section-card">
            <SectionTitle title="施工进展" />
            <ProgressPhaseStream items={phaseSections} onPreview={handlePreview} />
          </View>

          {hasRisk && riskSummary ? (
            <RiskSection
              riskSummary={riskSummary}
              onOpenDetail={() => Taro.navigateTo({ url: `/pages/projects/detail/index?id=${project.id}` })}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
