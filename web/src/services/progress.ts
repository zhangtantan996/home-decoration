import type { ProgressPageVM } from '../types/viewModels';
import { getProjectDetail, listProjectLogs, listProjects } from './projects';

export async function getProgressPageData(): Promise<ProgressPageVM> {
  const projects = await listProjects({ page: 1, pageSize: 6 }).catch(() => ({ list: [], total: 0, page: 1, pageSize: 6 }));

  if (projects.list.length === 0) {
    return {
      projects: [],
      featuredProject: null,
      recentLogs: [],
      pendingMilestones: [],
    };
  }

  const featuredProject = await getProjectDetail(projects.list[0].id).catch(() => null);
  const logs = featuredProject ? await listProjectLogs(featuredProject.id, { page: 1, pageSize: 4 }).catch(() => ({ list: [], total: 0 })) : { list: [], total: 0 };
  const pendingMilestones = featuredProject ? featuredProject.milestones.filter((item) => item.status !== '3' && item.status !== '4').slice(0, 4) : [];

  return {
    projects: projects.list,
    featuredProject,
    recentLogs: logs.list,
    pendingMilestones,
  };
}
