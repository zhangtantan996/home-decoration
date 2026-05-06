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
  getProjectPhases,
  listProjects,
  type ProjectDetail,
  type ProjectItem,
  type ProjectPhase,
} from '@/services/projects';
import { useAuthStore } from '@/store/auth';
import { openAuthLoginPage } from '@/utils/authRedirect';
import { setCustomTabBarHidden, syncCurrentTabBar } from '@/utils/customTabBar';
import { showErrorToast } from '@/utils/error';
import { getMiniNavMetrics } from '@/utils/navLayout';
import { getServerDateParts } from '@/utils/serverTime';
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

const toneClassMap: Record<string, string> = {
  default: 'is-default',
  active: 'is-active',
  success: 'is-success',
  danger: 'is-danger',
};

const formatCompactDateTime = (value?: string) => {
  const parts = getServerDateParts(value);
  if (!parts) {
    return value || '--';
  }
  return `${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')} ${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
};

const ProgressHeader = ({
  insetStyle,
  mainStyle,
  placeholderStyle,
  onOpenProjectSelector,
  switchFeedbackActive,
}: {
  insetStyle: CSSProperties;
  mainStyle: CSSProperties;
  placeholderStyle: CSSProperties;
  onOpenProjectSelector: () => void;
  switchFeedbackActive: boolean;
}) => (
  <>
    <View className="progress-page__header" style={insetStyle}>
      <View className="progress-page__header-main" style={mainStyle}>
        <View
          className={`progress-page__header-side progress-page__header-side--switch ${switchFeedbackActive ? 'is-feedback' : ''}`}
          onClick={onOpenProjectSelector}
        >
          <Text className="progress-page__header-side-text">切换项目</Text>
          <View className={`progress-page__header-side-arrow ${switchFeedbackActive ? 'is-feedback' : ''}`}>
            <Icon name="arrow-down" size={18} color="#111827" />
          </View>
        </View>
        <Text className="progress-page__header-title">项目进度</Text>
        <View className="progress-page__header-side" />
      </View>
    </View>
    <View className="progress-page__header-placeholder" style={placeholderStyle} />
  </>
);

const ProgressSkeleton = () => (
  <View className="progress-page__content">
    <View className="progress-page__hero-card progress-page__hero-card--skeleton">
      <Skeleton width="100%" height={240} />
      <View className="progress-page__hero-copy progress-page__hero-copy--skeleton">
        <Skeleton width="64%" height={30} />
        <Skeleton width="48%" height={20} className="progress-page__skeleton-gap" />
      </View>
    </View>

    <View className="progress-page__risk-card progress-page__risk-card--skeleton">
      <Skeleton width="38%" height={24} />
      <Skeleton row={2} height={20} className="progress-page__skeleton-gap" />
    </View>

    <View className="progress-page__section-card">
      <Skeleton width="28%" height={24} />
      <View className="progress-page__milestone-track progress-page__milestone-track--skeleton">
        {Array.from({ length: 5 }).map((_, index) => (
          <View key={`milestone-${index}`} className="progress-page__milestone-item progress-page__milestone-item--skeleton">
            <Skeleton circle width={54} height={54} />
            <Skeleton width="88%" height={18} className="progress-page__skeleton-gap" />
            <Skeleton width="58%" height={16} className="progress-page__skeleton-gap-sm" />
          </View>
        ))}
      </View>
    </View>

    {Array.from({ length: 2 }).map((_, index) => (
      <View key={`phase-${index}`} className="progress-page__phase-card progress-page__phase-card--skeleton">
        <View className="progress-page__phase-head">
          <View className="progress-page__phase-copy">
            <Skeleton width="54%" height={28} />
            <Skeleton width="40%" height={18} className="progress-page__skeleton-gap" />
          </View>
          <Skeleton width={76} height={34} />
        </View>
        <View className="progress-page__task-panel">
          <Skeleton row={3} height={18} className="progress-page__skeleton-gap" />
        </View>
        <View className="progress-page__phase-log-block">
          <Skeleton row={2} height={18} className="progress-page__skeleton-gap" />
        </View>
      </View>
    ))}
  </View>
);

const SectionTitle = ({ title }: { title: string }) => (
  <View className="progress-page__section-head">
    <View className="progress-page__section-accent" />
    <Text className="progress-page__section-title">{title}</Text>
  </View>
);

const ProgressHeroCard = ({ hero }: { hero: ProgressHeroViewModel }) => (
  <View className="progress-page__hero-card">
    <View className="progress-page__hero-media">
      {hero.coverImage ? (
        <Image className="progress-page__hero-image" src={hero.coverImage} mode="aspectFill" lazyLoad />
      ) : (
        <View className="progress-page__hero-placeholder">
          <View className="progress-page__hero-placeholder-mark">
            <Icon name="home" size={40} color="#FFFFFF" />
          </View>
          <Text className="progress-page__hero-placeholder-text">项目封面待上传</Text>
        </View>
      )}
      <View className="progress-page__hero-day-badge">
        <Text className="progress-page__hero-day-badge-text">{hero.daysText}</Text>
      </View>
    </View>

    <View className="progress-page__hero-copy">
      <Text className="progress-page__hero-title">{hero.title}</Text>
      <View className="progress-page__hero-address-row">
        <Icon name="location-pin" size={18} color="#C4C7CC" />
        <Text className="progress-page__hero-address">{hero.address}</Text>
      </View>
    </View>
  </View>
);

const RiskCard = ({ riskSummary }: { riskSummary: NonNullable<ProjectDetail['riskSummary']> }) => {
  const items: string[] = [];
  if (riskSummary.pauseReason) {
    items.push(`暂停：${riskSummary.pauseReason}`);
  }
  if (riskSummary.escrowFrozen) {
    items.push(
      `资金：托管账户已冻结${riskSummary.frozenAmount ? ` ¥${Number(riskSummary.frozenAmount).toLocaleString()}` : ''}`,
    );
  }
  if (riskSummary.disputeReason) {
    items.push(`争议：${riskSummary.disputeReason}`);
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <View className="progress-page__risk-card">
      <View className="progress-page__risk-head">
        <View className="progress-page__risk-icon">!</View>
        <Text className="progress-page__risk-title">项目存在异常风险</Text>
      </View>
      <View className="progress-page__risk-list">
        {items.map((item) => (
          <Text key={item} className="progress-page__risk-item">• {item}</Text>
        ))}
      </View>
    </View>
  );
};

const MilestoneStrip = ({
  items,
  activeId,
  onSelect,
}: {
  items: MilestoneViewModel[];
  activeId?: string;
  onSelect: (phaseId: string) => void;
}) => (
  <ScrollView scrollX className="progress-page__milestone-scroll" showScrollbar={false}>
    <View className="progress-page__milestone-track">
      {items.map((item, index) => {
        const selected = item.id === activeId;
        const circleClass = [
          'progress-page__milestone-circle',
          item.isDone ? 'is-done' : '',
          item.isActive ? 'is-active' : '',
          selected ? 'is-selected' : '',
        ]
          .filter(Boolean)
          .join(' ');
        const dateText = item.dateText === '待定' ? '-' : item.dateText.replace('.', '-');
        return (
          <View
            key={item.id}
            className={`progress-page__milestone-item ${selected ? 'is-selected' : ''}`}
            onClick={() => onSelect(item.id)}
          >
            <View className={circleClass}>
              {item.isDone ? (
                <Icon name="success" size={18} color="#FFFFFF" />
              ) : (
                <Text className={`progress-page__milestone-circle-text ${item.isActive || selected ? 'is-active' : ''}`}>{index + 1}</Text>
              )}
            </View>
            <Text className="progress-page__milestone-name">{item.name}</Text>
            <Text className="progress-page__milestone-date">{dateText}</Text>
          </View>
        );
      })}
      <View className="progress-page__milestone-tail" />
    </View>
  </ScrollView>
);

const PhaseLog = ({
  item,
  isLast,
  onPreview,
}: {
  item: ProjectLogViewModel;
  isLast: boolean;
  onPreview: (current: string, urls: string[]) => void;
}) => (
  <View className="progress-page__phase-log-item">
    <View className="progress-page__phase-log-axis">
      {!isLast ? <View className="progress-page__phase-log-line" /> : null}
      <View className="progress-page__phase-log-dot" />
    </View>

    <View className="progress-page__phase-log-main">
      <Text className="progress-page__phase-log-time">{formatCompactDateTime(item.timeLabel)}</Text>
      <Text className="progress-page__phase-log-title">{item.title}</Text>
      {item.description ? <Text className="progress-page__phase-log-description">{item.description}</Text> : null}
      {item.images.length > 0 ? (
        <ScrollView scrollX className="progress-page__phase-log-gallery" showScrollbar={false}>
          <View className="progress-page__phase-log-gallery-track">
            {item.images.slice(0, 3).map((image, index) => (
              <View
                key={`${item.id}-${image}-${index}`}
                className="progress-page__phase-log-thumb"
                onClick={() => onPreview(image, item.images)}
              >
                <Image className="progress-page__phase-log-thumb-image" src={image} mode="aspectFill" lazyLoad />
              </View>
            ))}
            <View className="progress-page__phase-log-gallery-tail" />
          </View>
        </ScrollView>
      ) : null}
    </View>
  </View>
);

const PhaseCard = ({
  item,
  focused,
  onPreview,
}: {
  item: ProgressPhaseSectionViewModel;
  focused?: boolean;
  onPreview: (current: string, urls: string[]) => void;
}) => (
  <View id={item.id} className={`progress-page__phase-card ${focused ? 'is-focused' : ''}`}>
    <View className="progress-page__phase-head">
      <View className="progress-page__phase-copy">
        <Text className="progress-page__phase-title">{item.name}</Text>
        <View className="progress-page__phase-date-row">
          <Icon name="history" size={16} color="#C4C7CC" />
          <Text className="progress-page__phase-date">{item.dateText.replace(' - ', ' ~ ').replace('时间待更新', '--')}</Text>
        </View>
      </View>
      <View className={`progress-page__phase-status ${toneClassMap[item.tone] || ''}`}>
        <Text className={`progress-page__phase-status-text ${toneClassMap[item.tone] || ''}`}>{item.statusLabel}</Text>
      </View>
    </View>

    {item.tasks.length > 0 ? (
      <View className="progress-page__task-panel">
        {item.tasks.map((task) => (
          <View key={task.id} className="progress-page__task-item">
            <View className={`progress-page__task-dot ${task.isCompleted ? 'is-done' : ''}`}>
              {task.isCompleted ? <View className="progress-page__task-dot-inner" /> : null}
            </View>
            <Text className={`progress-page__task-text ${task.isCompleted ? 'is-done' : ''}`}>{task.name}</Text>
          </View>
        ))}
      </View>
    ) : null}

    {item.logs.length > 0 ? (
      <View className="progress-page__phase-log-block">
        {item.logs.map((log) => (
          <PhaseLog key={log.id} item={log} isLast={log.id === item.logs[item.logs.length - 1]?.id} onPreview={onPreview} />
        ))}
      </View>
    ) : item.emptyText ? (
      <View className="progress-page__phase-empty">
        <Text className="progress-page__phase-empty-text">{item.emptyText}</Text>
      </View>
    ) : null}
  </View>
);

const ProjectSelectorSheet = ({
  visible,
  projects,
  currentProjectId,
  onClose,
  onSelect,
}: {
  visible: boolean;
  projects: ProjectItem[];
  currentProjectId: number | null;
  onClose: () => void;
  onSelect: (projectId: number) => void;
}) => {
  if (!visible) {
    return null;
  }

  return (
    <>
      <View className="progress-page__sheet-mask" onClick={onClose} />
      <View className="progress-page__sheet">
        <View className="progress-page__sheet-handle" />
        <Text className="progress-page__sheet-title">切换项目</Text>
        {projects.length <= 1 ? (
          <Text className="progress-page__sheet-note">
            {projects.length === 1 ? '当前只有一个项目，已为你选中。' : '暂无可切换项目。'}
          </Text>
        ) : null}
        <View className="progress-page__sheet-list">
          {projects.map((item) => {
            const active = item.id === currentProjectId;
            return (
              <View
                key={item.id}
                className={`progress-page__sheet-item ${active ? 'is-active' : ''}`}
                onClick={() => onSelect(item.id)}
              >
                <View className="progress-page__sheet-copy">
                  <Text className="progress-page__sheet-item-title">{item.name || item.address || `项目 ${item.id}`}</Text>
                  <Text className="progress-page__sheet-item-subtitle">{item.address || item.flowSummary || '项目地址待补充'}</Text>
                </View>
                {active ? <Icon name="success" size={20} color="#07C160" /> : null}
              </View>
            );
          })}
        </View>
      </View>
    </>
  );
};

const PendingQuoteState = ({
  quote,
  onOpen,
}: {
  quote: PendingQuoteViewModel;
  onOpen: () => void;
}) => (
  <View className="progress-page__content">
    <View className="progress-page__empty-card">
      <Text className="progress-page__empty-badge">待确认施工报价</Text>
      <Text className="progress-page__empty-title">{quote.title}</Text>
      <Text className="progress-page__empty-copy">{quote.subtitle}</Text>
      <Text className="progress-page__empty-note">当前状态：{quote.statusLabel}</Text>
      <Button className="progress-page__primary-button" onClick={onOpen}>
        去确认施工报价
      </Button>
    </View>
  </View>
);

const EmptyProjectState = () => (
  <View className="progress-page__content">
    <View className="progress-page__empty-card">
      <Text className="progress-page__empty-badge">暂无项目</Text>
      <Text className="progress-page__empty-title">还没有正在推进的项目</Text>
      <Text className="progress-page__empty-copy">确认施工报价后，这里会自动同步工程节点、施工日志和异常提醒。</Text>
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
  const [logs, setLogs] = useState<ProjectWorkLogRecord[]>([]);
  const [pendingQuoteTask, setPendingQuoteTask] = useState<QuoteTaskSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectorVisible, setSelectorVisible] = useState(false);
  const [switchFeedbackActive, setSwitchFeedbackActive] = useState(false);
  const [activeMilestoneId, setActiveMilestoneId] = useState('');
  const [focusedPhaseId, setFocusedPhaseId] = useState('');

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

  useEffect(() => {
    selectedProjectIdRef.current = selectedProjectId;
  }, [selectedProjectId]);

  useEffect(() => {
    return () => {
      if (redirectResetTimerRef.current) {
        clearTimeout(redirectResetTimerRef.current);
        redirectResetTimerRef.current = null;
      }
      setCustomTabBarHidden(false);
    };
  }, []);

  useEffect(() => {
    setCustomTabBarHidden(selectorVisible);

    return () => {
      setCustomTabBarHidden(false);
    };
  }, [selectorVisible]);

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
        setLogs([]);
        return;
      }
      setSelectedProjectId(current.id);

      const [projectDetail, phaseData, logData] = await Promise.all([
        getProjectDetail(current.id).catch(() => current as ProjectDetail),
        getProjectPhases(current.id).catch(() => ({ phases: [] as ProjectPhase[] })),
        getProjectLogs(current.id).catch(() => ({ list: [] as ProjectWorkLogRecord[], total: 0, page: 1, pageSize: 12 })),
      ]);

      setProject(projectDetail);
      setPhases(phaseData.phases || []);
      setLogs(Array.isArray(logData.list) ? (logData.list as ProjectWorkLogRecord[]).slice(0, 12) : []);
    } catch (err) {
      showErrorToast(err, '同步进度失败');
    } finally {
      setLoading(false);
    }
  }, [auth.token]);
  const { refreshStatus, drawerHeight, drawerProgress, bindPullToRefresh, runReload } = usePullToRefreshFeedback(() =>
    fetchProject(selectedProjectIdRef.current || undefined),
  );

  const handleProjectChange = useCallback((nextProjectId: number) => {
    if (!Number.isFinite(nextProjectId) || nextProjectId <= 0 || nextProjectId === selectedProjectIdRef.current) {
      setSelectorVisible(false);
      return;
    }
    setSelectedProjectId(nextProjectId);
    setSelectorVisible(false);
    void fetchProject(nextProjectId);
  }, [fetchProject]);

  const ownerScopeDisabled = Boolean(auth.user?.activeRole) && !['owner', 'homeowner'].includes(auth.user?.activeRole || '');
  const hero = useMemo(
    () => (project ? buildProgressHeroViewModel({ project, logs }) : null),
    [logs, project],
  );
  const milestoneItems = useMemo(() => buildMilestoneViewModels([], phases), [phases]);
  const phaseSections = useMemo(() => buildProgressPhaseSections(phases, logs), [phases, logs]);
  const pendingQuote = useMemo(
    () => (pendingQuoteTask ? buildPendingQuoteViewModel(pendingQuoteTask) : null),
    [pendingQuoteTask],
  );
  const riskSummary = project?.riskSummary;
  const hasRisk = Boolean(riskSummary?.pausedAt || riskSummary?.disputedAt || riskSummary?.escrowFrozen);

  const handlePreview = useCallback((current: string, urls: string[]) => {
    if (!current || urls.length === 0) return;
    void Taro.previewImage({ current, urls });
  }, []);

  useEffect(() => {
    if (!switchFeedbackActive) {
      return;
    }
    const timer = setTimeout(() => {
      setSwitchFeedbackActive(false);
    }, 260);
    return () => clearTimeout(timer);
  }, [switchFeedbackActive]);

  useEffect(() => {
    if (phaseSections.length === 0) {
      setActiveMilestoneId('');
      return;
    }
    setActiveMilestoneId((current) => {
      if (current && phaseSections.some((item) => item.id === current)) {
        return current;
      }
      return phaseSections.find((item) => item.tone === 'active')?.id || phaseSections[0].id;
    });
  }, [phaseSections]);

  useEffect(() => {
    if (!focusedPhaseId) {
      return;
    }
    const timer = setTimeout(() => {
      setFocusedPhaseId('');
    }, 1200);
    return () => clearTimeout(timer);
  }, [focusedPhaseId]);

  const handleOpenProjectSelector = useCallback(() => {
    setSwitchFeedbackActive(true);
    if (projects.length === 0) {
      Taro.showToast({ title: '暂无可切换项目', icon: 'none' });
      return;
    }
    setSelectorVisible(true);
  }, [projects.length]);

  const handleSelectMilestone = useCallback((phaseId: string) => {
    if (!phaseSections.some((item) => item.id === phaseId)) {
      return;
    }

    setActiveMilestoneId(phaseId);
    setFocusedPhaseId(phaseId);
    void Taro.pageScrollTo({
      selector: `#${phaseId}`,
      duration: 280,
      offsetTop: -(navMetrics.contentTop + 18),
    });
  }, [navMetrics.contentTop, phaseSections]);

  if (!auth.token) {
    return <View className="progress-page" />;
  }

  if (ownerScopeDisabled) {
    return (
      <View className="progress-page page-with-tabbar">
        <ProgressHeader
          insetStyle={headerInsetStyle}
          mainStyle={headerMainStyle}
          placeholderStyle={headerPlaceholderStyle}
          onOpenProjectSelector={handleOpenProjectSelector}
          switchFeedbackActive={switchFeedbackActive || selectorVisible}
        />
        <View className="progress-page__content">
          <View className="progress-page__empty-card">
            <Text className="progress-page__empty-badge">身份受限</Text>
            <Text className="progress-page__empty-title">当前身份暂不能查看业主项目</Text>
            <Text className="progress-page__empty-copy">请切换回业主身份后，再查看施工阶段、验收节点和施工日志。</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="progress-page page-with-tabbar" {...bindPullToRefresh}>
      <ProgressHeader
        insetStyle={headerInsetStyle}
        mainStyle={headerMainStyle}
        placeholderStyle={headerPlaceholderStyle}
        onOpenProjectSelector={handleOpenProjectSelector}
        switchFeedbackActive={switchFeedbackActive || selectorVisible}
      />
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
          <ProgressHeroCard hero={hero} />

          {hasRisk && riskSummary ? <RiskCard riskSummary={riskSummary} /> : null}

          <View className="progress-page__section-card">
            <SectionTitle title="节点总览" />
            {milestoneItems.length > 0 ? (
              <MilestoneStrip items={milestoneItems} activeId={activeMilestoneId} onSelect={handleSelectMilestone} />
            ) : (
              <View className="progress-page__phase-empty progress-page__phase-empty--section">
                <Text className="progress-page__phase-empty-text">节点创建后会显示在这里</Text>
              </View>
            )}
          </View>

          <View className="progress-page__phase-section">
            <Text className="progress-page__phase-section-title">施工进展</Text>
            {phaseSections.length > 0 ? (
              <View className="progress-page__phase-list">
                {phaseSections.map((item) => (
                  <PhaseCard key={item.id} item={item} focused={focusedPhaseId === item.id} onPreview={handlePreview} />
                ))}
              </View>
            ) : (
              <View className="progress-page__section-card">
                <View className="progress-page__phase-empty progress-page__phase-empty--section">
                  <Text className="progress-page__phase-empty-text">开工后会在这里持续同步施工进展</Text>
                </View>
              </View>
            )}
          </View>
        </View>
      ) : null}

      <ProjectSelectorSheet
        visible={selectorVisible}
        projects={projects}
        currentProjectId={selectedProjectId}
        onClose={() => setSelectorVisible(false)}
        onSelect={handleProjectChange}
      />
    </View>
  );
}
