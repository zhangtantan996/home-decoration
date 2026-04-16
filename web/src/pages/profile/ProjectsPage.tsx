import { useMemo } from 'react';
import { Link } from 'react-router-dom';

import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/AsyncState';
import { useAsyncData } from '../../hooks/useAsyncData';
import { getProjectDetail, listProjects } from '../../services/projects';
import styles from './WorkspacePage.module.scss';

type ProjectOverviewCard = {
  id: number;
  href: string;
  name: string;
  address: string;
  areaText: string;
  statusText: string;
  currentPhase: string;
  budgetText: string;
  expectedEndText: string;
  summaryText: string;
  responsiblePerson: string;
  completedDaysText: string;
  progress: number;
  imageUrl: string;
  badgeTone: 'projectToneDone' | 'projectTonePaused' | 'projectToneActive';
};

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

function resolveSummaryText(detail: Awaited<ReturnType<typeof getProjectDetail>>) {
  if (
    detail.businessStage === 'ready_to_start'
    && (!detail.flowSummary || detail.flowSummary.trim() === '')
  ) {
    return detail.plannedStartDate
      ? `待监理协调开工，计划进场：${detail.plannedStartDate}`
      : '待监理协调开工，计划进场时间待同步';
  }
  return detail.flowSummary || '施工状态待同步';
}

function resolveBadgeTone(statusText: string): ProjectOverviewCard['badgeTone'] {
  if (statusText.includes('完工')) return 'projectToneDone';
  if (statusText.includes('暂停') || statusText.includes('关闭')) return 'projectTonePaused';
  return 'projectToneActive';
}

function resolveProjectImage(detail: Awaited<ReturnType<typeof getProjectDetail>> | null) {
  const photo = detail?.completedPhotos?.find((item) => typeof item === 'string' && item.trim() !== '');
  if (photo) return photo;
  return 'https://placehold.co/720x520/dce7ef/4e6478?text=%E9%A1%B9%E7%9B%AE%E5%AE%9E%E6%99%AF';
}

export function ProjectsPage() {
  const { data, loading, error, reload } = useAsyncData(async () => {
    const result = await listProjects({ page: 1, pageSize: 12 });
    const details = await Promise.all(
      result.list.map(async (item) => {
        const detail = await getProjectDetail(item.id).catch(() => null);
        if (!detail) {
          return {
            id: item.id,
            href: item.href,
            name: item.name,
            address: item.address,
            areaText: '面积待确认',
            statusText: item.statusText,
            currentPhase: item.currentPhase,
            budgetText: item.budgetText,
            expectedEndText: '待排期',
            summaryText: '项目状态待同步',
            responsiblePerson: '待分配',
            completedDaysText: '待排期',
            progress: calcProgress(item.currentPhase, item.statusText),
            imageUrl: resolveProjectImage(null),
            badgeTone: resolveBadgeTone(item.statusText),
          } satisfies ProjectOverviewCard;
        }

        return {
          id: item.id,
          href: item.href,
          name: detail.name,
          address: detail.address,
          areaText: detail.areaText || '面积待确认',
          statusText: detail.statusText,
          currentPhase: detail.currentPhase || item.currentPhase,
          budgetText: detail.budgetText || item.budgetText,
          expectedEndText: detail.expectedEndText || '待排期',
          summaryText: resolveSummaryText(detail),
          responsiblePerson: resolveResponsiblePerson(detail),
          completedDaysText: calcCompletedDays(detail.startDateText || detail.plannedStartDate),
          progress: calcProgress(detail.currentPhase || item.currentPhase, detail.statusText),
          imageUrl: resolveProjectImage(detail),
          badgeTone: resolveBadgeTone(detail.statusText),
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
      active: list.filter((item) => !item.statusText.includes('完工') && !item.currentPhase.includes('验收') && !item.statusText.includes('暂停')).length,
      acceptance: list.filter((item) => item.currentPhase.includes('验收')).length,
      done: list.filter((item) => item.statusText.includes('完工')).length,
      pending: list.filter((item) => item.completedDaysText === '待排期' || item.completedDaysText === '待监理协调开工').length,
    };
  }, [data?.list]);

  if (loading) return <LoadingBlock title="加载项目列表" />;
  if (error || !data) return <ErrorBlock description={error || '项目列表加载失败'} onRetry={() => void reload()} />;

  return (
    <div className={`${styles.pageContainer} ${styles.projectPageContainer}`.trim()}>
      {data.list.length > 0 ? (
        <section className={styles.projectSummaryStrip}>
          <article className={styles.projectSummaryMetric}>
            <span>进行中</span>
            <strong>{projectStats.active}</strong>
          </article>
          <article className={styles.projectSummaryMetric}>
            <span>待验收</span>
            <strong>{projectStats.acceptance}</strong>
          </article>
          <article className={styles.projectSummaryMetric}>
            <span>已完工</span>
            <strong>{projectStats.done}</strong>
          </article>
          <article className={styles.projectSummaryMetric}>
            <span>待排期</span>
            <strong>{projectStats.pending}</strong>
          </article>
        </section>
      ) : null}

      {data.list.length === 0 ? <EmptyBlock title="暂无项目" description="" /> : (
        <div className={styles.projectList}>
          {data.list.map((item) => {
            return (
              <Link className={styles.projectCard} key={item.id} to={item.href}>
                <div className={`${styles.projectOverview} ${styles[item.badgeTone]}`}>
                  <span className={styles.projectStatusBadge}>{item.statusText}</span>
                  <img className={styles.projectOverviewImage} src={item.imageUrl} alt={item.name} />
                  <div className={styles.projectOverviewMask} />
                  <div className={styles.projectOverviewFooter}>
                    <span className={styles.projectPhasePill}>{item.currentPhase || '待同步'}</span>
                    <span className={styles.projectDuration}>{item.completedDaysText}</span>
                  </div>
                </div>

                <div className={styles.projectMain}>
                  <div className={styles.projectMainTop}>
                    <div className={styles.projectHeading}>
                      <div className={styles.projectHeadingTop}>
                        <h3>{item.name}</h3>
                        <span className={styles.projectInlineBadge}>{item.statusText}</span>
                      </div>
                      <p className={styles.projectCode}>DM-{String(item.id).padStart(3, '0')}</p>
                    </div>
                    <div className={styles.projectEta}>
                      <span>预计交付</span>
                      <strong>{item.expectedEndText}</strong>
                    </div>
                  </div>

                  <p className={styles.projectSummary}>{item.summaryText}</p>

                  <div className={styles.projectInfo}>
                    <div className={styles.infoItem}>
                      <span>地址</span>
                      <strong>{item.address || '待补充'}</strong>
                    </div>
                    <div className={styles.infoItem}>
                      <span>面积</span>
                      <strong>{item.areaText}</strong>
                    </div>
                    <div className={styles.infoItem}>
                      <span>负责人</span>
                      <strong>{item.responsiblePerson}</strong>
                    </div>
                    <div className={styles.infoItem}>
                      <span>预算</span>
                      <strong>{item.budgetText}</strong>
                    </div>
                  </div>

                  <div className={styles.projectFooter}>
                    <div className={styles.projectProgress}>
                      <div className={styles.projectProgressHead}>
                        <span>{item.currentPhase || '待同步'}</span>
                        <strong>{item.progress}%</strong>
                      </div>
                      <div className={styles.projectProgressBar}>
                        <div className={styles.projectProgressFill} style={{ width: `${item.progress}%` }} />
                      </div>
                    </div>

                    <div className={styles.projectFooterMeta}>
                      <span className={styles.projectFooterDays}>已施工 {item.completedDaysText}</span>
                      <span className={styles.projectEntry}>进入项目</span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
