import type { IconName } from '@/components/Icon';
import type { QuoteTaskSummary } from '@/services/quoteTasks';
import type { Milestone, ProjectDetail, ProjectPhase } from '@/services/projects';
import { normalizeProviderMediaUrl, parseStringListValue } from '@/utils/providerMedia';
import {
  formatServerDate,
  formatServerDateTime,
  formatServerMonthDay,
  getServerTimeMs,
} from '@/utils/serverTime';
import { DEFAULT_PROGRESS_COVER } from './default-cover';

export type ProgressTone = 'default' | 'active' | 'success' | 'danger';
export type ProjectWorkLogRecord = Record<string, unknown>;

export interface MilestoneViewModel {
  id: string;
  name: string;
  statusLabel: string;
  dateText: string;
  tone: ProgressTone;
  isActive: boolean;
  isDone: boolean;
  iconName: IconName;
}

export interface PendingQuoteViewModel {
  title: string;
  subtitle: string;
  statusLabel: string;
}

export interface ProgressHeroViewModel {
  title: string;
  address: string;
  daysText: string;
  coverImage: string;
}

export interface ProgressTaskViewModel {
  id: string;
  name: string;
  isCompleted: boolean;
}

export interface ProjectLogViewModel {
  id: string;
  phaseId?: number;
  title: string;
  subtitle: string;
  description: string;
  timeLabel: string;
  images: string[];
}

export interface ProgressPhaseSectionViewModel {
  id: string;
  name: string;
  dateText: string;
  statusLabel: string;
  taskSummary: string;
  emptyText: string;
  tone: ProgressTone;
  tasks: ProgressTaskViewModel[];
  logs: ProjectLogViewModel[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toStringValue = (value: unknown, fallback = '') => {
  const normalized = typeof value === 'string' ? value.trim() : String(value ?? '').trim();
  return normalized || fallback;
};

const toStringList = (value: unknown) => {
  return parseStringListValue(value)
    .map((item) => normalizeProviderMediaUrl(item))
    .filter(Boolean);
};

const isMiniSafeImageUrl = (value?: string) => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return false;
  }
  return (
    /^https:\/\//i.test(normalized)
    || /^data:image\//i.test(normalized)
    || /^(\/|\.{1,2}\/)/.test(normalized)
    || /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(normalized)
  );
};

const resolveLogTime = (log: ProjectWorkLogRecord) => {
  return toStringValue(log.logDate) || toStringValue(log.createdAt) || toStringValue(log.updatedAt);
};

const resolveLogImages = (log: ProjectWorkLogRecord) => {
  return [
    ...toStringList(log.photos),
    ...toStringList(log.images),
  ].filter(Boolean);
};

const resolvePhaseStatusMeta = (status?: string) => {
  switch (status) {
    case 'completed':
      return { tone: 'success' as ProgressTone, label: '已完成' };
    case 'in_progress':
      return { tone: 'active' as ProgressTone, label: '施工中' };
    case 'rejected':
      return { tone: 'danger' as ProgressTone, label: '已驳回' };
    default:
      return { tone: 'default' as ProgressTone, label: '待开始' };
  }
};

const resolveMilestoneMeta = (status?: Milestone['status']) => {
  switch (status) {
    case 'paid':
      return {
        tone: 'success' as ProgressTone,
        label: '已支付',
        iconName: 'success' as IconName,
        isDone: true,
        isActive: false,
      };
    case 'completed':
      return {
        tone: 'success' as ProgressTone,
        label: '已验收',
        iconName: 'success' as IconName,
        isDone: true,
        isActive: false,
      };
    case 'rejected':
      return {
        tone: 'danger' as ProgressTone,
        label: '已驳回',
        iconName: 'notification' as IconName,
        isDone: false,
        isActive: false,
      };
    case 'in_progress':
      return {
        tone: 'active' as ProgressTone,
        label: '进行中',
        iconName: 'progress' as IconName,
        isDone: false,
        isActive: true,
      };
    default:
      return {
        tone: 'default' as ProgressTone,
        label: '待开始',
        iconName: 'pending' as IconName,
        isDone: false,
        isActive: false,
      };
  }
};

const buildPhaseDateText = (phase: ProjectPhase) => {
  if (phase.startDate && phase.endDate) {
    return `${formatServerDate(phase.startDate)} - ${formatServerDate(phase.endDate)}`;
  }
  if (phase.startDate) {
    return `开始于 ${formatServerDate(phase.startDate)}`;
  }
  if (phase.endDate) {
    return `计划完成 ${formatServerDate(phase.endDate)}`;
  }
  return '时间待更新';
};

const normalizeLog = (log: ProjectWorkLogRecord): ProjectLogViewModel => {
  const logTime = resolveLogTime(log);
  const phaseName = toStringValue(log.phaseName || log.phase_name);
  const title = toStringValue(log.title) || phaseName || '施工记录';
  const images = resolveLogImages(log);
  const description = toStringValue(log.description);

  return {
    id: String(log.id || `${logTime}-${title}`),
    phaseId: toNumber(log.phaseId || log.phase_id) || undefined,
    title,
    subtitle:
      phaseName && phaseName !== title
        ? phaseName
        : images.length > 0
          ? `现场图片 ${images.length} 张`
          : '',
    description,
    timeLabel: formatServerDateTime(logTime, '时间待更新'),
    images,
  };
};

const buildFallbackPhaseSection = (
  logs: ProjectWorkLogRecord[],
): ProgressPhaseSectionViewModel | null => {
  if (logs.length === 0) {
    return null;
  }

  return {
    id: 'phase-site-records',
    name: '现场记录',
    dateText: `共 ${logs.length} 条同步记录`,
    statusLabel: '持续更新',
    taskSummary: '历史施工日志未绑定阶段，已统一收口到现场记录中展示。',
    emptyText: '暂无现场施工日志。',
    tone: 'default',
    tasks: [],
    logs: logs.map(normalizeLog),
  };
};

export const buildMilestoneViewModels = (
  milestones: Milestone[],
  phases: ProjectPhase[],
): MilestoneViewModel[] => {
  if (milestones.length > 0) {
    return milestones.map((item) => {
      const meta = resolveMilestoneMeta(item.status);
      const dateSource = item.acceptedAt || item.updatedAt || item.createdAt;
      return {
        id: `milestone-${item.id}`,
        name: item.name || `节点 ${item.seq}`,
        statusLabel: meta.label,
        dateText: formatServerMonthDay(dateSource, '待定'),
        tone: meta.tone,
        isActive: meta.isActive,
        isDone: meta.isDone,
        iconName: meta.iconName,
      };
    });
  }

  return phases.map((phase) => {
    const meta = resolvePhaseStatusMeta(phase.status);
    return {
      id: `phase-${phase.id}`,
      name: phase.name || '未命名阶段',
      statusLabel: meta.label,
      dateText: formatServerMonthDay(phase.startDate || phase.endDate, '待定'),
      tone: meta.tone,
      isActive: meta.tone === 'active',
      isDone: meta.tone === 'success',
      iconName:
        meta.tone === 'success'
          ? 'success'
          : meta.tone === 'active'
            ? 'progress'
            : 'pending',
    };
  });
};

export const buildPendingQuoteViewModel = (
  task: QuoteTaskSummary,
): PendingQuoteViewModel => {
  return {
    title: task.title || `施工报价任务 #${task.id}`,
    subtitle:
      task.flowSummary
      || task.businessStage
      || '设计确认后不会直接创建项目，请先确认施工报价。',
    statusLabel: task.status || '待确认',
  };
};

export const buildProgressHeroViewModel = ({
  project,
  logs,
}: {
  project: ProjectDetail;
  logs: ProjectWorkLogRecord[];
}): ProgressHeroViewModel => {
  const startMs = getServerTimeMs(project.createdAt);
  const days = startMs > 0 ? Math.max(1, Math.ceil((Date.now() - startMs) / DAY_MS)) : 0;
  const coverImage =
    normalizeProviderMediaUrl(String(((project as unknown as Record<string, unknown>).coverImage) || ''))
    || logs.flatMap(resolveLogImages)[0]
    || DEFAULT_PROGRESS_COVER;

  return {
    title: project.name || '未命名项目',
    address: project.address || project.flowSummary || '项目地址待补充',
    daysText: days > 0 ? `第 ${days} 天` : '待排期',
    coverImage: isMiniSafeImageUrl(coverImage) ? coverImage : DEFAULT_PROGRESS_COVER,
  };
};

export const buildProgressPhaseSections = (
  phases: ProjectPhase[],
  logs: ProjectWorkLogRecord[],
): ProgressPhaseSectionViewModel[] => {
  const phaseLogsMap = new Map<number, ProjectWorkLogRecord[]>();
  const orphanLogs: ProjectWorkLogRecord[] = [];

  logs.forEach((item) => {
    const phaseId = toNumber(item.phaseId || item.phase_id);
    if (phaseId > 0) {
      const bucket = phaseLogsMap.get(phaseId) || [];
      bucket.push(item);
      phaseLogsMap.set(phaseId, bucket);
      return;
    }
    orphanLogs.push(item);
  });

  if (phases.length === 0) {
    const fallbackSection = buildFallbackPhaseSection(logs);
    return fallbackSection ? [fallbackSection] : [];
  }

  const activePhaseId = phases.find((item) => item.status === 'in_progress')?.id || phases[0]?.id;
  if (activePhaseId && orphanLogs.length > 0) {
    const merged = phaseLogsMap.get(activePhaseId) || [];
    phaseLogsMap.set(activePhaseId, [...orphanLogs, ...merged]);
  }

  return phases.map((phase) => {
    const meta = resolvePhaseStatusMeta(phase.status);
    const tasks = (phase.tasks || []).slice(0, 8).map((task) => ({
      id: String(task.id),
      name: task.name,
      isCompleted: Boolean(task.isCompleted),
    }));
    const completedTaskCount = tasks.filter((task) => task.isCompleted).length;
    const phaseLogs = (phaseLogsMap.get(phase.id) || []).sort(
      (left, right) => getServerTimeMs(resolveLogTime(right)) - getServerTimeMs(resolveLogTime(left)),
    );

    return {
      id: `phase-${phase.id}`,
      name: phase.name || '未命名阶段',
      dateText: buildPhaseDateText(phase),
      statusLabel: meta.label,
      taskSummary:
        tasks.length > 0
          ? meta.tone === 'default'
            ? `${tasks.length} 项任务待开始`
            : `已完成 ${completedTaskCount} / ${tasks.length} 项阶段任务`
          : '该阶段暂未配置任务清单。',
      emptyText:
        meta.tone === 'active'
          ? '施工日志待同步'
          : meta.tone === 'success'
            ? '暂无已同步日志'
            : '',
      tone: meta.tone,
      tasks,
      logs: phaseLogs.slice(0, 5).map(normalizeLog).map((log) => ({
        ...log,
        images: log.images.filter((image) => isMiniSafeImageUrl(image)),
      })),
    };
  });
};
