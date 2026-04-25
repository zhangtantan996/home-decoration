import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/AsyncState';
import { useAsyncData } from '../../hooks/useAsyncData';
import { getProjectDetail, listProjects } from '../../services/projects';
import styles from './ProjectsPage.module.scss';

type ProjectCardTone = 'active' | 'acceptance' | 'done' | 'paused';
type DeliveryTone = 'normal' | 'overdue' | 'pending';
type ProjectFilterKey = 'all' | 'recent' | 'highBudget';

type ProjectOverviewCard = {
  id: number;
  href: string;
  name: string;
  address: string;
  areaText: string;
  statusText: string;
  currentPhase: string;
  budgetText: string;
  budgetValue: number;
  expectedEndText: string;
  responsiblePerson: string;
  completedDaysText: string;
  progress: number;
  tone: ProjectCardTone;
  deliveryTone: DeliveryTone;
  deliveryText: string;
  deliverySortValue: number | null;
};

const FILTER_TABS: Array<{ key: ProjectFilterKey; label: string }> = [
  { key: 'all', label: '全部项目' },
  { key: 'recent', label: '近期交付' },
  { key: 'highBudget', label: '高预算' },
];

function calcProgress(currentPhase: string, statusText?: string) {
  if (statusText?.includes('完工')) return 100;
  if (currentPhase.includes('验收')) return 96;
  if (currentPhase.includes('安装')) return 82;
  if (currentPhase.includes('油漆')) return 70;
  if (currentPhase.includes('泥木')) return 56;
  if (currentPhase.includes('水电')) return 42;
  if (currentPhase.includes('拆改')) return 24;
  if (currentPhase.includes('准备') || currentPhase.includes('待监理协调开工') || currentPhase.includes('协调开工')) return 8;
  return 12;
}

function calcCompletedDays(startDateText?: string) {
  if (!startDateText) return '待排期';
  const start = new Date(startDateText.replace(/-/g, '/'));
  if (Number.isNaN(start.getTime())) return '待排期';

  const today = new Date();
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const diff = Math.floor((todayDay - startDay) / (1000 * 60 * 60 * 24));
  if (diff < 0) return '待监理协调开工';
  return `${diff + 1} 天`;
}

function resolveResponsiblePerson(detail: Awaited<ReturnType<typeof getProjectDetail>>) {
  const activePhase = detail.phases.find((phase) => phase.status === 'in_progress');
  const lastStartedPhase = [...detail.phases].reverse().find((phase) => phase.status !== 'pending');
  return activePhase?.responsiblePerson || lastStartedPhase?.responsiblePerson || detail.providerName || '待分配';
}

function parseMoneyValue(text: string) {
  const normalized = text.replace(/,/g, '');
  const matched = normalized.match(/(\d+(?:\.\d+)?)/);
  return matched ? Number(matched[1]) : 0;
}

function parseDateValue(text?: string) {
  if (!text) return null;
  const normalized = text.trim().replace(/-/g, '/');
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function formatDateText(text?: string) {
  if (!text) return '待排期';
  return text.replace(/-/g, '/');
}

function resolveProjectTone(statusText: string, currentPhase: string): ProjectCardTone {
  if (statusText.includes('暂停') || statusText.includes('关闭')) return 'paused';
  if (statusText.includes('完工')) return 'done';
  if (currentPhase.includes('验收')) return 'acceptance';
  return 'active';
}

function resolveDeliveryMeta(expectedEndText: string, statusText: string) {
  if (statusText.includes('完工')) {
    return {
      deliveryText: '已完工',
      deliveryTone: 'normal' as DeliveryTone,
      deliverySortValue: null,
    };
  }

  const parsed = parseDateValue(expectedEndText);
  if (!parsed) {
    return {
      deliveryText: '待排期',
      deliveryTone: 'pending' as DeliveryTone,
      deliverySortValue: null,
    };
  }

  const today = new Date();
  const todayValue = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const formatted = formatDateText(expectedEndText);
  if (parsed < todayValue) {
    return {
      deliveryText: `已逾期 ${formatted}`,
      deliveryTone: 'overdue' as DeliveryTone,
      deliverySortValue: parsed,
    };
  }

  return {
    deliveryText: `预计交付 ${formatted}`,
    deliveryTone: 'normal' as DeliveryTone,
    deliverySortValue: parsed,
  };
}

function matchesFilter(item: ProjectOverviewCard, filter: ProjectFilterKey) {
  if (filter === 'recent') {
    return item.deliverySortValue !== null;
  }

  if (filter === 'highBudget') {
    return item.budgetValue >= 150000;
  }

  return true;
}

function matchesSearch(item: ProjectOverviewCard, search: string) {
  if (!search) return true;
  const keyword = search.trim().toLowerCase();
  if (!keyword) return true;

  return [item.name, item.address, item.currentPhase, item.responsiblePerson, item.statusText]
    .join(' ')
    .toLowerCase()
    .includes(keyword);
}

export function ProjectsPage() {
  const [filterKey, setFilterKey] = useState<ProjectFilterKey>('all');
  const [searchValue, setSearchValue] = useState('');

  const { data, loading, error, reload } = useAsyncData(async () => {
    const result = await listProjects({ page: 1, pageSize: 12 });
    const details = await Promise.all(
      result.list.map(async (item) => {
        const detail = await getProjectDetail(item.id).catch(() => null);
        const currentPhase = detail?.currentPhase || item.currentPhase;
        const statusText = detail?.statusText || item.statusText;
        const expectedEndText = detail?.expectedEndText || '待排期';
        const deliveryMeta = resolveDeliveryMeta(expectedEndText, statusText);

        if (!detail) {
          return {
            id: item.id,
            href: item.href,
            name: item.name,
            address: item.address,
            areaText: '面积待确认',
            statusText,
            currentPhase,
            budgetText: item.budgetText,
            budgetValue: parseMoneyValue(item.budgetText),
            expectedEndText,
            responsiblePerson: '待分配',
            completedDaysText: '待排期',
            progress: calcProgress(currentPhase, statusText),
            tone: resolveProjectTone(statusText, currentPhase),
            deliveryTone: deliveryMeta.deliveryTone,
            deliveryText: deliveryMeta.deliveryText,
            deliverySortValue: deliveryMeta.deliverySortValue,
          } satisfies ProjectOverviewCard;
        }

        return {
          id: item.id,
          href: item.href,
          name: detail.name,
          address: detail.address,
          areaText: detail.areaText || '面积待确认',
          statusText,
          currentPhase,
          budgetText: detail.budgetText || item.budgetText,
          budgetValue: parseMoneyValue(detail.budgetText || item.budgetText),
          expectedEndText,
          responsiblePerson: resolveResponsiblePerson(detail),
          completedDaysText: calcCompletedDays(detail.startDateText || detail.plannedStartDate),
          progress: calcProgress(currentPhase, statusText),
          tone: resolveProjectTone(statusText, currentPhase),
          deliveryTone: deliveryMeta.deliveryTone,
          deliveryText: deliveryMeta.deliveryText,
          deliverySortValue: deliveryMeta.deliverySortValue,
        } satisfies ProjectOverviewCard;
      }),
    );

    return {
      ...result,
      list: details,
    };
  }, []);

  const projectStats = useMemo(() => {
    const list = data?.list || [];
    return {
      active: list.filter((item) => item.tone === 'active').length,
      acceptance: list.filter((item) => item.tone === 'acceptance').length,
      done: list.filter((item) => item.tone === 'done').length,
      pending: list.filter((item) => item.deliveryTone === 'pending').length,
    };
  }, [data?.list]);

  const visibleProjects = useMemo(() => {
    const list = data?.list || [];
    return list.filter((item) => matchesFilter(item, filterKey) && matchesSearch(item, searchValue));
  }, [data?.list, filterKey, searchValue]);

  if (loading) return <LoadingBlock title="加载项目列表" />;
  if (error || !data) return <ErrorBlock description={error || '项目列表加载失败'} onRetry={() => void reload()} />;

  return (
    <div className={styles.pageShell}>
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderMain}>
          <h1>我的项目</h1>
          <p>管理和追踪所有装修项目的进度与状态</p>
        </div>

        <div className={styles.pageHeaderActions}>
          <button className={styles.headerGhostAction} onClick={() => void reload()} type="button">
            <span className={styles.projectSymbol}>refresh</span>
            刷新
          </button>
          <Link className={styles.headerPrimaryAction} to="/providers">
            <span className={styles.projectSymbol}>add</span>
            去找服务商
          </Link>
        </div>
      </div>

      {data.list.length > 0 ? (
        <section className={styles.statsStrip}>
          <article className={`${styles.statCard} ${styles.statCardPrimary}`}>
            <div className={`${styles.statIcon} ${styles.statIconPrimary}`}>
              <span className={styles.projectSymbol}>progress_activity</span>
            </div>
            <div className={styles.statCopy}>
              <strong>{projectStats.active}</strong>
              <span>进行中</span>
            </div>
          </article>

          <article className={styles.statCard}>
            <div className={`${styles.statIcon} ${styles.statIconWarning}`}>
              <span className={styles.projectSymbol}>task_alt</span>
            </div>
            <div className={styles.statCopy}>
              <strong>{projectStats.acceptance}</strong>
              <span>待验收</span>
            </div>
          </article>

          <article className={styles.statCard}>
            <div className={`${styles.statIcon} ${styles.statIconSuccess}`}>
              <span className={styles.projectSymbol}>check_circle</span>
            </div>
            <div className={styles.statCopy}>
              <strong>{projectStats.done}</strong>
              <span>已完工</span>
            </div>
          </article>

          <article className={styles.statCard}>
            <div className={`${styles.statIcon} ${styles.statIconMuted}`}>
              <span className={styles.projectSymbol}>calendar_month</span>
            </div>
            <div className={styles.statCopy}>
              <strong>{projectStats.pending}</strong>
              <span>待排期</span>
            </div>
          </article>
        </section>
      ) : null}

      <section className={styles.toolbar}>
        <div className={styles.filterTabs} role="tablist" aria-label="项目筛选">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              className={`${styles.filterTab} ${filterKey === tab.key ? styles.filterTabActive : ''}`}
              onClick={() => setFilterKey(tab.key)}
              role="tab"
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>

        <label className={styles.searchField}>
          <span className={styles.projectSymbol}>search</span>
          <input
            aria-label="搜索项目"
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="搜索项目名称或地址..."
            type="search"
            value={searchValue}
          />
        </label>
      </section>

      {visibleProjects.length === 0 ? (
        <EmptyBlock title="暂无匹配项目" description="试试切换筛选条件或调整搜索关键词。" />
      ) : (
        <div className={styles.projectGrid}>
          {visibleProjects.map((item) => (
            <Link className={styles.projectCard} data-tone={item.tone} key={item.id} to={item.href}>
              <div className={styles.projectCardHead}>
                <span className={styles.projectStagePill}>{item.currentPhase || '待同步'}</span>
              </div>

              <h3 className={styles.projectTitle}>{item.name}</h3>

              <div className={styles.projectInfoGrid}>
                <div className={`${styles.projectInfoItem} ${styles.projectInfoItemWide}`}>
                  <span>项目地址</span>
                  <strong>{item.address || '待补充'}</strong>
                </div>
                <div className={styles.projectInfoItem}>
                  <span>项目面积</span>
                  <strong>{item.areaText}</strong>
                </div>
                <div className={styles.projectInfoItem}>
                  <span>项目预算</span>
                  <strong className={styles.projectBudget}>{item.budgetText}</strong>
                </div>
                <div className={styles.projectInfoItem}>
                  <span>当前阶段</span>
                  <strong>{item.currentPhase || item.statusText || '待同步'}</strong>
                </div>
              </div>

              <div className={styles.projectProgressBlock}>
                <div className={styles.projectProgressMeta}>
                  <span>整体进度</span>
                  <strong>{item.progress}%</strong>
                </div>
                <div className={styles.projectProgressTrack}>
                  <div className={styles.projectProgressFill} style={{ width: `${item.progress}%` }} />
                </div>
              </div>

              <div className={styles.projectCardFooter}>
                <div className={styles.projectOwner}>
                  <span className={styles.projectOwnerAvatar}>{item.responsiblePerson.slice(0, 1) || '项'}</span>
                  <div className={styles.projectOwnerMeta}>
                    <strong>{item.responsiblePerson}</strong>
                    <span>负责人</span>
                  </div>
                </div>

                <div className={`${styles.projectDelivery} ${item.deliveryTone === 'overdue' ? styles.projectDeliveryOverdue : ''}`}>
                  <span className={styles.projectSymbol}>{item.deliveryTone === 'overdue' ? 'warning' : 'calendar_today'}</span>
                  <span>{item.deliveryText}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
