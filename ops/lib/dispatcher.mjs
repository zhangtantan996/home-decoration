import { loadControlPlane, pathBelongsToPrefix } from './schema.mjs';
import { appendEvent, updateState } from './state-store.mjs';
import { depsSatisfied, hasFailedDep, isTaskTerminal } from './state-machine.mjs';

function tasksOverlap(leftTask, rightTask) {
  return (leftTask.owned_paths ?? []).some((leftPath) =>
    (rightTask.owned_paths ?? []).some(
      (rightPath) => pathBelongsToPrefix(leftPath, rightPath) || pathBelongsToPrefix(rightPath, leftPath),
    ),
  );
}

function getRunnableTasks(controlPlane) {
  const activeTasks = controlPlane.state.tasks.filter((task) => ['in_progress', 'verifying'].includes(task.status));
  return controlPlane.state.tasks
    .filter((task) => task.owner_role !== 'coordinator')
    .filter((task) => !isTaskTerminal(task))
    .filter((task) => !['blocked', 'pending_approval', 'planning'].includes(task.status))
    .filter((task) => !((task.children ?? []).length > 0))
    .filter((task) => ['queued', 'approved', 'ready'].includes(task.status))
    .filter((task) => depsSatisfied(task, controlPlane.state))
    .filter((task) => !activeTasks.some((activeTask) => activeTask.id !== task.id && tasksOverlap(activeTask, task)))
    .sort((left, right) => {
      const priorityDelta = (right.priority ?? 0) - (left.priority ?? 0);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }
      return `${left.created_at ?? ''}`.localeCompare(`${right.created_at ?? ''}`);
    });
}

function blockTasksWithFailedDeps(repoRoot, { actor = 'engine' } = {}) {
  const snapshot = updateState(repoRoot, (state) => {
    for (const task of state.tasks) {
      if (['done', 'failed', 'blocked', 'cancelled'].includes(task.status)) {
        continue;
      }
      if (!hasFailedDep(task, state)) {
        continue;
      }
      task.phase = 'blocked';
      task.status = 'blocked';
      task.summary = 'One or more dependencies failed or became blocked.';
    }
  });

  for (const task of snapshot.state.tasks.filter((candidate) => candidate.status === 'blocked' && candidate.summary === 'One or more dependencies failed or became blocked.')) {
    appendEvent(repoRoot, {
      actor,
      files: ['ops/state.yaml'],
      kind: 'blocker',
      result: 'blocked',
      summary: `Task ${task.id} blocked because a dependency failed`,
      task_id: task.id,
    });
  }
}

function loadRunnableTasks(repoRoot) {
  return getRunnableTasks(loadControlPlane(repoRoot));
}

export { blockTasksWithFailedDeps, getRunnableTasks, loadRunnableTasks, tasksOverlap };
