import { useMemo } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';

import { EmptyBlock, ErrorBlock, LoadingBlock } from '../components/AsyncState';
import { TodoCard, type TodoCardAction } from '../components/TodoCard';
import { UserPageFrame } from '../components/UserPageFrame';
import shellStyles from '../components/UserWorkspaceShell.module.scss';
import { useAsyncData } from '../hooks/useAsyncData';
import { getProjectDetail, getProjectEscrow, listProjectLogs, listProjects } from '../services/projects';
import { listMyQuoteTasks, type QuoteTaskSummaryVM } from '../services/quoteTasks';
import type { ProjectDetailVM, ProjectListItemVM, ProjectPhaseVM } from '../types/viewModels';
import styles from './ProgressPage.module.scss';

const PROJECT_PAGE_SIZE = 20;

type ProjectTone = 'active' | 'acceptance' | 'done';
type ProjectStateTone = ProjectTone | 'waiting' | 'paused';
type PhaseTone = 'active' | 'pending' | 'done';
type TodoTone = 'urgent' | 'pending' | 'normal';

type FocusProjectVM = ProjectListItemVM & {
  progress: number;
  tone: ProjectTone;
  phaseLabel: string;
  action: {
    label: string;
    to: string;
  };
};

type ResolvedProjectState = {
  tone: ProjectStateTone;
  statusText: string;
  summary: string;
  badgeText: string;
};

type TodoItemVM = {
  id: string;
  title: string;
  description: string;
  amountText: string;
  tone: TodoTone;
  badgeText: string;
  actions: TodoCardAction[];
};

type TeamMemberVM = {
  id: string;
  name: string;
  role: string;
  phoneText: string;
  avatarSrc?: string;
  initial: string;
};

type PendingQuoteTaskVM = {
  id: number;
  title: string;
  statusText: string;
  summary: string;
};

function calcProgress(currentPhase: string) {
  if (currentPhase.includes('完工') || currentPhase.includes('竣工')) return 100;
  if (currentPhase.includes('验收')) return 92;
  if (currentPhase.includes('安装')) return 82;
  if (currentPhase.includes('油漆')) return 70;
  if (currentPhase.includes('泥木')) return 56;
  if (currentPhase.includes('水电')) return 42;
  if (currentPhase.includes('拆改')) return 24;
  if (currentPhase.includes('准备') || currentPhase.includes('待开工')) return 8;
  return 0;
}

function parseMoneyValue(text: string) {
  const normalized = text.replace(/,/g, '');
  const matched = normalized.match(/(\d+(?:\.\d+)?)/);
  return matched ? Number(matched[1]) : 0;
}

function formatMoney(value: number) {
  if (!value) return '预算待补充';
  return `¥${Math.round(value).toLocaleString('zh-CN')}`;
}

function getProjectTone(currentPhase: string): ProjectTone {
  if (currentPhase.includes('验收')) return 'acceptance';
  if (currentPhase.includes('完工') || currentPhase.includes('竣工')) return 'done';
  return 'active';
}

function getPrimaryAction(item: { id: number; href: string; currentPhase: string }) {
  if (item.currentPhase.includes('验收')) {
    return { label: '去验收', to: `/projects/${item.id}/acceptance` };
  }
  return { label: '查看项目', to: item.href };
}

function getPhaseLabel(currentPhase: string) {
  if (currentPhase.includes('验收')) return '验收阶段';
  if (currentPhase.includes('安装')) return '安装阶段';
  if (currentPhase.includes('油漆')) return '油漆阶段';
  if (currentPhase.includes('泥木')) return '泥木阶段';
  if (currentPhase.includes('水电')) return '水电阶段';
  if (currentPhase.includes('拆改')) return '拆改阶段';
  if (currentPhase.includes('准备')) return '开工准备';
  return currentPhase || '待同步';
}

function getPhaseTone(status: string): PhaseTone {
  if (status === 'completed') return 'done';
  if (status === 'in_progress') return 'active';
  return 'pending';
}

function parseTaskLine(task: string) {
  const [statusLabel, rawTitle] = task.split(' · ');
  const title = rawTitle || task;
  const done = statusLabel === '已完成';
  return {
    title,
    done,
    helper: done ? '已完成' : '待推进',
  };
}

function getInitial(name: string) {
  const normalized = name.trim();
  return normalized ? normalized.slice(0, 1).toUpperCase() : '项';
}

function resolveProjectState(
  detail: ProjectDetailVM | null | undefined,
  focusProject: FocusProjectVM | null | undefined,
  hasPhases: boolean,
): ResolvedProjectState {
  const stage = detail?.businessStage || '';
  const actions = new Set(detail?.availableActions || []);
  const phaseLabel = focusProject?.phaseLabel || focusProject?.currentPhase || '待同步';

  if (actions.has('approve_milestone') || actions.has('reject_milestone') || stage.includes('acceptance')) {
    return {
      tone: 'acceptance',
      statusText: '待验收',
      summary: detail?.flowSummary || '当前节点已提交，等待业主验收。',
      badgeText: '待验收',
    };
  }

  if (stage === 'completed' || stage.includes('completion') || Boolean(detail?.completionSubmittedAt)) {
    return {
      tone: 'done',
      statusText: '已完工',
      summary: detail?.flowSummary || '项目已完成施工。',
      badgeText: '已完工',
    };
  }

  if (focusProject?.statusText.includes('暂停')) {
    return {
      tone: 'paused',
      statusText: '已暂停',
      summary: detail?.flowSummary || '项目当前暂停中。',
      badgeText: '已暂停',
    };
  }

  if (!hasPhases) {
    return {
      tone: 'waiting',
      statusText: '待开工',
      summary: detail?.flowSummary || '开工排期待同步。',
      badgeText: '待开工',
    };
  }

  return {
    tone: 'active',
    statusText: '进行中',
    summary: detail?.flowSummary || `当前处于 ${phaseLabel}。`,
    badgeText: `进行中 · ${phaseLabel}`,
  };
}

function buildTodoItems(detail: ProjectDetailVM | null | undefined, focusProject: FocusProjectVM | null | undefined) {
  if (!detail || !focusProject) return [] as TodoItemVM[];
  const billingPath = `/projects/${focusProject.id}/billing`;

  const items: TodoItemVM[] = [];

  if (detail.selectedQuoteTaskId) {
    items.push({
      id: `quote-task-${detail.selectedQuoteTaskId}`,
      title: '确认施工报价',
      description: detail.flowSummary || '施工报价已提交到用户侧，需先确认施工报价后再进入正式执行。',
      amountText: '待确认',
      tone: 'urgent',
      badgeText: '待确认',
      actions: [{ label: '去确认', to: `/quote-tasks/${detail.selectedQuoteTaskId}` }],
    });
  }

  detail.milestones.forEach((milestone) => {
    if (milestone.status === '2') {
      items.push({
        id: `milestone-${milestone.id}`,
        title: milestone.name,
        description: milestone.criteria,
        amountText: milestone.amountText,
        tone: 'urgent',
        badgeText: '待验收',
        actions: [
          { label: '去验收', to: `/projects/${focusProject.id}/acceptance` },
          { label: '查看详情', to: `/projects/${focusProject.id}` },
        ],
      });
      return;
    }

    if (milestone.status === '3') {
      items.push({
        id: `milestone-${milestone.id}`,
        title: milestone.name,
        description: '节点已通过验收，待进入下一笔费用处理。',
        amountText: milestone.amountText,
        tone: 'pending',
        badgeText: '待付款',
        actions: [{ label: '看费用', to: billingPath }],
      });
      return;
    }

    if (milestone.status === '5') {
      items.push({
        id: `milestone-${milestone.id}`,
        title: milestone.name,
        description: milestone.criteria,
        amountText: milestone.amountText,
        tone: 'urgent',
        badgeText: '待整改',
        actions: [{ label: '看整改', to: `/projects/${focusProject.id}/acceptance` }],
      });
    }
  });

  return items;
}

function pickPendingQuoteTask(tasks: QuoteTaskSummaryVM[]): PendingQuoteTaskVM | null {
  const task = tasks.find((item) => item.userConfirmationStatus === 'pending');
  if (!task) return null;
  return {
    id: task.id,
    title: task.title,
    statusText: task.statusText,
    summary: task.flowSummary || '施工报价已提交，请先确认施工报价，项目会在确认后创建。',
  };
}

function buildTeamMembers(detail: ProjectDetailVM | null | undefined, currentPhase: { responsiblePerson?: string; id?: number } | null) {
  const members: TeamMemberVM[] = [];
  const pushMember = (member: TeamMemberVM | null) => {
    if (!member) return;
    const normalizedName = member.name.trim();
    if (!normalizedName) return;
    const existed = members.some((item) => item.name.trim() === normalizedName || item.id === member.id);
    if (!existed) {
      members.push(member);
    }
  };

  const providerName = detail?.providerName?.trim() || '';
  const hasRealProvider = providerName !== '' && providerName !== '服务商';
  const designerName = detail?.designerName?.trim() || '';

  if (designerName && designerName !== providerName) {
    pushMember({
      id: 'designer',
      name: designerName,
      role: '设计师',
      phoneText: detail?.designerPhoneHint || '电话待同步',
      avatarSrc: detail?.designerAvatar,
      initial: getInitial(designerName),
    });
  }

  if (hasRealProvider) {
    pushMember({
      id: 'provider',
      name: providerName,
      role: detail?.providerRoleText || '项目管家 / 交付专家',
      phoneText: detail?.providerPhoneHint || '电话待同步',
      avatarSrc: detail?.providerAvatar,
      initial: getInitial(providerName),
    });
  }

  if (currentPhase?.responsiblePerson && currentPhase.responsiblePerson !== providerName) {
    pushMember({
      id: `phase-${currentPhase.id}`,
      name: currentPhase.responsiblePerson,
      role: '当前施工负责人',
      phoneText: '联系方式待同步',
      initial: getInitial(currentPhase.responsiblePerson),
    });
  }

  return members;
}

function buildFocusProject(detail: ProjectDetailVM): FocusProjectVM {
  const currentPhase = detail.currentPhase || '待同步';
  return {
    id: detail.id,
    name: detail.name,
    address: detail.address,
    currentPhase,
    statusText: detail.statusText,
    budgetText: detail.budgetText,
    href: `/projects/${detail.id}`,
    progress: calcProgress(currentPhase),
    tone: getProjectTone(currentPhase),
    phaseLabel: getPhaseLabel(currentPhase),
    action: getPrimaryAction({ id: detail.id, href: `/projects/${detail.id}`, currentPhase }),
  };
}

export function ProgressPage() {
  const params = useParams();
  const rawProjectId = params.id;
  const hasProjectParam = typeof rawProjectId === 'string';
  const routeProjectId = Number(rawProjectId || 0);
  const hasRouteProjectId = Number.isFinite(routeProjectId) && routeProjectId > 0;

  const { data, loading, error, reload } = useAsyncData(async () => {
    const pendingQuoteTasks = pickPendingQuoteTask(await listMyQuoteTasks().catch(() => []));

    if (hasProjectParam && !hasRouteProjectId) {
      throw new Error('项目编号无效');
    }

    if (hasRouteProjectId) {
      const [detail, logResult, escrow] = await Promise.all([
        getProjectDetail(routeProjectId),
        listProjectLogs(routeProjectId, { page: 1, pageSize: 4 }).catch(() => ({ list: [], total: 0 })),
        getProjectEscrow(routeProjectId).catch(() => null),
      ]);

      const focusProject = buildFocusProject(detail);
      return { cards: [focusProject], focusProject, detail, logs: logResult.list, escrow, pendingQuoteTask: pendingQuoteTasks };
    }

    const result = await listProjects({ page: 1, pageSize: PROJECT_PAGE_SIZE });
    const cards = result.list.map((item) => {
      const progress = calcProgress(item.currentPhase);
      return {
        ...item,
        progress,
        tone: getProjectTone(item.currentPhase),
        phaseLabel: getPhaseLabel(item.currentPhase),
        action: getPrimaryAction(item),
      };
    });

    const focusProject = [...cards].sort((left, right) => {
      if (left.tone === 'acceptance' && right.tone !== 'acceptance') return -1;
      if (left.tone !== 'acceptance' && right.tone === 'acceptance') return 1;
      return right.progress - left.progress;
    })[0];

    if (!focusProject) {
      return { cards, focusProject: null, detail: null, logs: [], escrow: null, redirectToProjectId: null, pendingQuoteTask: pendingQuoteTasks };
    }

    return { cards, focusProject, detail: null, logs: [], escrow: null, redirectToProjectId: focusProject.id, pendingQuoteTask: pendingQuoteTasks };
  }, [hasProjectParam, hasRouteProjectId, routeProjectId]);

  const phaseItems = useMemo(() => {
    const detail = data?.detail;
    if (!detail) return [] as Array<ProjectPhaseVM & { tone: PhaseTone }>;

    return detail.phases.map((phase) => ({
      ...phase,
      tone: getPhaseTone(phase.status),
      tasks: phase.tasks.map(parseTaskLine),
    }));
  }, [data]);

  const currentPhase = useMemo(() => {
    if (phaseItems.length === 0) return null;
    return phaseItems.find((item) => item.tone === 'active') || phaseItems[phaseItems.length - 1];
  }, [phaseItems]);

  const projectState = useMemo(
    () => resolveProjectState(data?.detail, (data?.focusProject as FocusProjectVM | null | undefined) || null, phaseItems.length > 0),
    [data, phaseItems.length],
  );

  const progressValue = useMemo(() => {
    if (!data?.focusProject) return 0;
    if (projectState.tone === 'done') return 100;
    return calcProgress(data.focusProject.currentPhase);
  }, [data, projectState.tone]);

  const financeSummary = useMemo(() => {
    const focusProject = data?.focusProject;
    const escrow = data?.escrow;
    const total = parseMoneyValue(focusProject?.budgetText || '');
    const hasEscrow = Boolean(escrow);
    const escrowTotal = hasEscrow ? parseMoneyValue(escrow?.totalAmountText || '') : 0;
    const paid = hasEscrow ? parseMoneyValue(escrow?.releasedAmountText || '') : 0;
    const pending = hasEscrow ? parseMoneyValue(escrow?.balanceText || '') : 0;
    const pendingValue = hasEscrow ? pending : 0;
    const hasPaymentData = hasEscrow && (escrowTotal > 0 || paid > 0 || pending > 0 || (escrow?.transactions.length || 0) > 0);
    const paidRatio = hasPaymentData && total > 0 ? Math.max(0, Math.min(1, paid / total)) : 0;
    const radius = 64;
    const circumference = 2 * Math.PI * radius;
    const ringLength = circumference * 0.82;

    return {
      hasEscrow,
      hasPaymentData,
      totalText: focusProject?.budgetText || '预算待补充',
      paidText: hasPaymentData ? formatMoney(paid) : '待同步',
      pendingText: hasPaymentData ? formatMoney(pendingValue) : '待同步',
      paidPercent: Math.round(paidRatio * 100),
      radius,
      circumference,
      ringLength,
      paidLength: ringLength * paidRatio,
    };
  }, [data]);

  const todoItems = useMemo(
    () => buildTodoItems(data?.detail, (data?.focusProject as FocusProjectVM | null | undefined) || null),
    [data],
  );

  const phasePhotos = useMemo(() => {
    const photos = (data?.logs || []).find((item) => item.photos.length > 0)?.photos || [];
    if (photos.length > 0) return photos.slice(0, 3);
    return (data?.detail?.completedPhotos || []).slice(0, 3);
  }, [data]);

  const teamMembers = useMemo(() => buildTeamMembers(data?.detail, currentPhase), [currentPhase, data]);
  const expectedEndDate = data?.detail?.expectedEndText || '待排期';

  if (loading) {
    return (
      <UserPageFrame contentClassName={shellStyles.content} header={null} mainClassName={shellStyles.main} sidebar={null} wrapClassName={shellStyles.wrap}>
        <LoadingBlock title="加载项目看板" />
      </UserPageFrame>
    );
  }

  if (error || !data) {
    return (
      <UserPageFrame contentClassName={shellStyles.content} header={null} mainClassName={shellStyles.main} sidebar={null} wrapClassName={shellStyles.wrap}>
        <ErrorBlock description={error || '项目看板加载失败'} onRetry={() => void reload()} />
      </UserPageFrame>
    );
  }

  if (!hasRouteProjectId && data.redirectToProjectId) {
    return <Navigate to={`/projects/${data.redirectToProjectId}`} replace />;
  }

  return (
    <UserPageFrame
      contentClassName={shellStyles.content}
      header={null}
      mainClassName={shellStyles.main}
      sidebar={null}
      wrapClassName={shellStyles.wrap}
    >
      {!data.focusProject ? (
        data.pendingQuoteTask ? (
          <EmptyBlock
            title="待确认施工报价"
            description={`${data.pendingQuoteTask.summary}（当前状态：${data.pendingQuoteTask.statusText}）`}
            action={<Link className="button-secondary" to={`/quote-tasks/${data.pendingQuoteTask.id}`}>去确认施工报价</Link>}
          />
        ) : (
          <EmptyBlock
            title="暂无项目"
            description="当前还没有进行中的项目。"
            action={<Link className="button-secondary" to="/providers">去找服务商</Link>}
          />
        )
      ) : (
        <main className={styles.mainContainer}>
          {/* Row 1: Hero Layout (Full width) */}
          <section className={styles.heroCard}>
            <div className={styles.heroLeft}>
              {phasePhotos.length > 0 ? (
                <img src={phasePhotos[0]} alt="项目图片" className={styles.heroImage} />
              ) : (
                <div className={styles.heroImagePlaceholder}>
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                  </svg>
                  <span>暂无项目图片</span>
                </div>
              )}
              <span className={styles.heroBadge}>{projectState.statusText}</span>
            </div>

            <div className={styles.heroRight}>
              <div className={styles.heroRightTop}>
                <div>
                  <h1>{data.focusProject.name}</h1>
                  <p className={styles.projectId}>项目编号: DM-{String(data.focusProject.id).padStart(3, '0')}</p>
                </div>
                <div className={styles.heroDateInfo}>
                  <p>预计交付日期</p>
                  <strong>{expectedEndDate}</strong>
                </div>
              </div>

              <ul className={styles.heroMetaList}>
                <li>
                  <span>项目地址</span>
                  <b>{data.detail?.address || data.focusProject.address || '待补充'}</b>
                </li>
                <li>
                  <span>项目面积</span>
                  <b>{data.detail?.areaText || '面积待确认'}</b>
                </li>
                <li>
                  <span>当前阶段</span>
                  <b>{data.focusProject.phaseLabel || data.detail?.currentPhase || '待同步'}</b>
                </li>
                <li>
                  <span>当前状态</span>
                  <b>{projectState.summary}</b>
                </li>
              </ul>

              <div className={styles.heroProgressRow}>
                <div className={styles.heroProgressTop}>
                  <span className={styles.tag}>总体进度</span>
                  <span className={styles.val}>{progressValue}%</span>
                </div>
                <div className={styles.progressBar}>
                  <div className={styles.fill} style={{ width: `${progressValue}%` }} />
                </div>
              </div>
            </div>
          </section>

          <div className={styles.bentoGrid}>
            <div className={styles.col8}>
              {/* Left Column: Finance Card with built-in Donut split */}
              <section className={styles.cardBase}>
                <div className={styles.financeHeader}>
                  <div className={styles.iconBox}>
                    <span className={styles.materialIcon}>account_balance_wallet</span>
                  </div>
                  <h2>财务总览</h2>
                </div>

                <div className={styles.financeLayout}>
                  <div className={styles.financeLeft}>
                    <p className={styles.totalLabel}>项目总预算</p>
                    <p className={styles.totalVal}>{financeSummary.totalText}</p>

                    <div className={styles.financeSplit}>
                      <div className={styles.splitPair}>
                        <span>已支付</span>
                        <strong className={styles.blue}>{financeSummary.paidText}</strong>
                      </div>
                      <div className={styles.splitPair}>
                        <span>待支付</span>
                        <strong className={styles.gold}>{financeSummary.pendingText}</strong>
                      </div>
                    </div>

                    <Link to={`/projects/${data.focusProject.id}/billing`} className={styles.financeLink}>
                      查看费用明细
                      <span className={styles.materialIcon}>arrow_forward</span>
                    </Link>
                  </div>

                  <div className={styles.financeDonut}>
                    <svg viewBox="0 0 160 160">
                      <circle cx="80" cy="80" r={financeSummary.radius} fill="none" stroke="#f1f5f9" strokeWidth="16" />
                      <circle
                        cx="80"
                        cy="80"
                        r={financeSummary.radius}
                        fill="none"
                        stroke="#2563eb"
                        strokeWidth="16"
                        strokeDasharray={`${financeSummary.paidLength} ${financeSummary.circumference}`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className={styles.donutInner}>
                      <span className={styles.pct}>{financeSummary.hasPaymentData ? `${financeSummary.paidPercent}%` : '待同步'}</span>
                      <span className={styles.lbl}>{financeSummary.hasPaymentData ? '付款进度' : '付款数据'}</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Left Column: Progress Timeline */}
              <section className={styles.cardBase}>
                <div className={styles.progressHeader}>
                  <div className={styles.left}>
                    <div className={styles.iconBox}>
                      <span className={styles.materialIcon}>calendar_today</span>
                    </div>
                    <h2>施工进度</h2>
                  </div>
                  <div className={styles.right}>{projectState.badgeText}</div>
                </div>

                <div className={styles.timeline}>
                  {phaseItems.map((phase) => {
                    const isDone = phase.tone === 'done';
                    const isActive = phase.tone === 'active';
                    const isPending = phase.tone === 'pending';

                    return (
                      <div key={phase.id} className={`${styles.tlItem} ${isPending ? styles.pending : ''}`}>
                        <div className={`${styles.tlIcon} ${isDone ? styles.done : isActive ? styles.active : styles.pending}`}>
                          <div className={styles.tlDot} />
                        </div>
                        <h3>{phase.name}</h3>
                        <p>
                          {isDone ? (phase.endDate ? `已于 ${phase.endDate} 完成验收` : '已完成，时间待同步') : ''}
                          {isActive ? (phase.endDate ? `进行中，预计 ${phase.endDate} 完成` : '进行中，完工时间待同步') : ''}
                          {isPending ? (phase.startDate ? `预计 ${phase.startDate} 开始` : '待排期') : ''}
                        </p>

                        {isActive && (
                          <div className={styles.tlPhotos}>
                            {phasePhotos.map((url, i) => (
                              <img key={i} src={url} alt="现场图" />
                            ))}
                            {phasePhotos.length === 0 && (
                              <div className={styles.phaseEmpty}>当前阶段暂无现场图片</div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {phaseItems.length === 0 && (
                    <div className={styles.timelineEmpty}>
                      当前项目暂无施工阶段数据，请先补齐 `project_phases` 后再展示完整进度。
                    </div>
                  )}
                </div>
              </section>
            </div>

            <div className={styles.col4}>
              {/* Right Column: User Todo List */}
              <section className={styles.cardBase}>
                <div className={styles.todoHeader}>
                  <div className={styles.left}>
                    <div className={styles.iconBox}>
                      <span className={styles.materialIcon}>task_alt</span>
                    </div>
                    <h2>用户待办</h2>
                  </div>
                </div>

                <div className={styles.todoList}>
                  {todoItems.length === 0 ? (
                    <div style={{ color: '#64748b', fontSize: '14px', background: '#f8fafc', padding: '24px', borderRadius: '12px', textAlign: 'center', border: '1px dashed #cbd5e1' }}>
                      当前暂无待处理任务。
                    </div>
                  ) : todoItems.map((item) => (
                    <TodoCard key={item.id} {...item} />
                  ))}
                </div>
              </section>

              {/* Right Column: Team Card */}
              <section className={styles.cardBase}>
                <div className={styles.teamHeader}>
                  <div className={styles.iconBox}>
                    <span className={styles.materialIcon}>groups</span>
                  </div>
                  <h2>项目团队</h2>
                </div>

                <div className={styles.teamList}>
                  {teamMembers.length === 0 ? (
                    <div className={styles.teamEmpty}>当前项目暂无团队成员数据。</div>
                  ) : (
                    teamMembers.map((member) => (
                      <div key={member.id} className={styles.teamItem}>
                        <div className={styles.teamItemLeft}>
                          <div className={styles.avatar}>
                            {member.avatarSrc ? (
                              <img src={member.avatarSrc} alt={member.name} />
                            ) : (
                              <div className={styles.avatarFallback}>{member.initial}</div>
                            )}
                          </div>
                          <div className={styles.info}>
                            <h3>{member.name}</h3>
                            <p>{member.role}</p>
                          </div>
                        </div>
                        <div className={styles.teamActions}>
                          <div className={styles.phoneNumber}>{member.phoneText}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          </div>
        </main>
      )}
    </UserPageFrame>
  );
}
