import { addTask, appendEvent, nowIso, updateState } from './state-store.mjs';
import { classifyRequestedModules, detectRisk } from './task-intake.mjs';
import { markTaskBlocked, markTaskPlanning } from './state-machine.mjs';

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function planCoordinatorTasks(repoRoot, { actor = 'engine' } = {}) {
  const snapshot = updateState(repoRoot, (state, controlPlane) => {
    const moduleMap = new Map(controlPlane.project.modules.map((module) => [module.id, module]));

    for (const task of state.tasks) {
      if (task.owner_role !== 'coordinator') {
        continue;
      }
      if (ensureArray(task.children).length > 0) {
        continue;
      }
      if (!['queued', 'approved', 'planning', 'in_progress'].includes(task.status)) {
        continue;
      }

      const matchedModules =
        ensureArray(task.intake?.requested_modules)
          .map((moduleId) => moduleMap.get(moduleId))
          .filter(Boolean)
          .map((module) => ({ hits: [module.id], module, score: 1 })) || [];

      const derivedMatches = matchedModules.length > 0 ? matchedModules : classifyRequestedModules(controlPlane, task.goal);
      if (derivedMatches.length === 0) {
        task.phase = 'blocked';
        task.status = 'blocked';
        task.summary = 'Planner could not map this task to a known module. Manual triage required.';
        continue;
      }

      if (derivedMatches.length === 1) {
        const [{ module, hits }] = derivedMatches;
        task.owner_role = module.owner_role;
        task.owned_paths = module.paths;
        task.verify_profile = module.verify_profiles[0] ?? task.verify_profile;
        task.phase = 'ready';
        if (!['approved', 'pending_approval'].includes(task.status)) {
          task.status = 'queued';
        }
        task.summary = `Planner rerouted coordinator task to ${module.owner_role} via signals: ${hits.join(', ')}`;
        continue;
      }

      const childIds = [];
      for (const { module } of derivedMatches) {
        const childId = `${task.id}--${module.id}`;
        if (state.tasks.some((candidate) => candidate.id === childId)) {
          childIds.push(childId);
          continue;
        }
        const riskDecision = detectRisk(controlPlane, `${task.goal} ${module.id}`, [{ module }]);
        state.tasks.push({
          approval: {
            inherited_from: task.id,
            required: false,
            status: 'not_required',
          },
          artifacts: [],
          assignee_session: null,
          attempt: 0,
          children: [],
          created_at: nowIso(),
          deps: [],
          done_when: `Complete the ${module.id} slice of parent task ${task.id} within: ${module.paths.join(', ')}`,
          finished_at: null,
          goal: task.goal,
          id: childId,
          intake: {
            parent_task_id: task.id,
            requested_by: task.intake?.requested_by ?? actor,
            requested_modules: [module.id],
            requested_via: task.intake?.requested_via ?? 'engine',
            routing_reason: `Planner split parent ${task.id} into module ${module.id}`,
          },
          outputs: [],
          owned_paths: module.paths,
          owner_role: module.owner_role,
          parent_task_id: task.id,
          phase: 'ready',
          priority: (task.priority ?? 1) + 1,
          risk: riskDecision.risk,
          started_at: null,
          status: 'queued',
          summary: '',
          verify_profile: module.verify_profiles[0] ?? 'ops-validate',
          verification: {
            profile: module.verify_profiles[0] ?? 'ops-validate',
            status: 'pending',
          },
        });
        childIds.push(childId);
      }

      task.children = childIds;
      task.phase = 'planning';
      task.status = 'in_progress';
      task.summary = `Planner split task into module children: ${childIds.join(', ')}`;
      task.started_at = task.started_at ?? nowIso();
    }
  });

  for (const task of snapshot.state.tasks.filter((item) => (item.children ?? []).length > 0 && item.owner_role === 'coordinator')) {
    appendEvent(repoRoot, {
      actor,
      files: ['ops/state.yaml'],
      kind: 'task_split',
      result: 'planned',
      summary: `Split task ${task.id} into ${task.children.length} child tasks`,
      task_id: task.id,
    });
  }

  for (const task of snapshot.state.tasks.filter((item) => item.owner_role !== 'coordinator' && item.intake?.parent_task_id)) {
    appendEvent(repoRoot, {
      actor,
      files: ['ops/state.yaml'],
      kind: 'progress',
      result: 'child-created',
      summary: `Planned child task ${task.id} for parent ${task.parent_task_id}`,
      task_id: task.id,
    });
  }

  return snapshot.state.tasks;
}

export { planCoordinatorTasks };
