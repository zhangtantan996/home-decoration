import { appendEvent, nowIso, updateState } from './state-store.mjs';

const TERMINAL_STATUSES = new Set(['done', 'failed', 'cancelled']);

function isTerminalStatus(status) {
  return TERMINAL_STATUSES.has(status);
}

function isTaskTerminal(task) {
  return isTerminalStatus(task.status);
}

function getTaskById(state, taskId) {
  return state.tasks.find((task) => task.id === taskId);
}

function depsSatisfied(task, state) {
  return (task.deps ?? []).every((depId) => getTaskById(state, depId)?.status === 'done');
}

function hasFailedDep(task, state) {
  return (task.deps ?? []).some((depId) => {
    const dep = getTaskById(state, depId);
    return dep && ['failed', 'blocked', 'cancelled'].includes(dep.status);
  });
}

function patchTask(repoRoot, taskId, patcher) {
  return updateState(repoRoot, (state) => {
    const task = getTaskById(state, taskId);
    if (!task) {
      throw new Error(`Unknown task: ${taskId}`);
    }
    patcher(task, state);
  });
}

function markTaskPlanning(repoRoot, { actor, taskId, summary }) {
  patchTask(repoRoot, taskId, (task) => {
    task.phase = 'planning';
    task.status = task.status === 'pending_approval' ? task.status : 'planning';
    task.summary = summary;
  });
  appendEvent(repoRoot, {
    actor,
    files: ['ops/state.yaml'],
    kind: 'progress',
    result: 'planning',
    summary,
    task_id: taskId,
  });
}

function markTaskStarted(repoRoot, { actor, sessionId, taskId }) {
  patchTask(repoRoot, taskId, (task) => {
    task.assignee_session = sessionId;
    task.attempt = (task.attempt ?? 0) + 1;
    task.phase = 'execution';
    task.started_at = task.started_at ?? nowIso();
    task.status = 'in_progress';
  });
  appendEvent(repoRoot, {
    actor,
    files: ['ops/state.yaml'],
    kind: 'task_started',
    result: 'started',
    summary: `Started task ${taskId}`,
    task_id: taskId,
  });
}

function markTaskVerifying(repoRoot, { actor, profileId, taskId }) {
  patchTask(repoRoot, taskId, (task) => {
    task.phase = 'verification';
    task.status = 'verifying';
    task.verification = {
      ...(task.verification ?? {}),
      profile: profileId,
      started_at: nowIso(),
      status: 'running',
    };
  });
  appendEvent(repoRoot, {
    actor,
    files: ['ops/state.yaml'],
    kind: 'verification_started',
    result: 'started',
    summary: `Started verification ${profileId} for ${taskId}`,
    task_id: taskId,
  });
}

function markTaskCompleted(repoRoot, { actor, outputs = [], summary, taskId, verification }) {
  const completedAt = nowIso();
  patchTask(repoRoot, taskId, (task) => {
    task.finished_at = completedAt;
    task.outputs = outputs;
    task.phase = 'done';
    task.status = 'done';
    task.summary = summary;
    task.verification = {
      ...(task.verification ?? {}),
      ...(verification ?? {}),
      finished_at: completedAt,
      status: verification?.status ?? 'passed',
    };
  });
  appendEvent(repoRoot, {
    actor,
    files: ['ops/state.yaml', ...(outputs ?? [])],
    kind: 'verification_passed',
    result: 'passed',
    summary,
    task_id: taskId,
  });
}

function markTaskFailed(repoRoot, { actor, blockers = [], summary, taskId, verification }) {
  const failedAt = nowIso();
  patchTask(repoRoot, taskId, (task) => {
    task.finished_at = failedAt;
    task.phase = 'failed';
    task.status = 'failed';
    task.summary = summary;
    task.verification = {
      ...(task.verification ?? {}),
      ...(verification ?? {}),
      finished_at: failedAt,
      status: verification?.status ?? 'failed',
    };
    task.blockers = blockers;
  });
  appendEvent(repoRoot, {
    actor,
    files: ['ops/state.yaml'],
    kind: 'verification_failed',
    result: 'failed',
    summary,
    task_id: taskId,
  });
}

function markTaskBlocked(repoRoot, { actor, blockers = [], summary, taskId }) {
  patchTask(repoRoot, taskId, (task, state) => {
    task.phase = 'blocked';
    task.status = 'blocked';
    task.summary = summary;
    task.blockers = blockers;
    if (blockers.length > 0) {
      for (const blockerText of blockers) {
        state.blockers.push({
          id: `${taskId}-blocker-${state.blockers.length + 1}`,
          task_id: taskId,
          reason: blockerText,
          status: 'open',
          opened_at: nowIso(),
          resolved_at: null,
        });
      }
    }
  });
  appendEvent(repoRoot, {
    actor,
    files: ['ops/state.yaml'],
    kind: 'blocker',
    result: 'blocked',
    summary,
    task_id: taskId,
  });
}

function syncParentStatuses(repoRoot, { actor = 'engine' } = {}) {
  const snapshot = updateState(repoRoot, (state) => {
    for (const task of state.tasks) {
      const children = (task.children ?? []).map((childId) => getTaskById(state, childId)).filter(Boolean);
      if (children.length === 0) {
        continue;
      }
      if (children.every((child) => child.status === 'done')) {
        task.phase = 'done';
        task.status = 'done';
        task.finished_at = task.finished_at ?? nowIso();
        task.summary = task.summary || `All subtasks completed: ${children.map((child) => child.id).join(', ')}`;
        continue;
      }
      if (children.some((child) => ['failed', 'blocked'].includes(child.status))) {
        task.phase = 'blocked';
        task.status = 'blocked';
        task.summary = children
          .filter((child) => ['failed', 'blocked'].includes(child.status))
          .map((child) => `${child.id}: ${child.summary ?? child.status}`)
          .join(' | ');
        continue;
      }
      task.phase = 'execution';
      if (!['pending_approval', 'approved'].includes(task.status)) {
        task.status = 'in_progress';
      }
    }
  });

  for (const task of snapshot.state.tasks) {
    if (!(task.children ?? []).length) {
      continue;
    }
    appendEvent(repoRoot, {
      actor,
      files: ['ops/state.yaml'],
      kind: 'progress',
      result: task.status,
      summary: `Parent task ${task.id} synced to ${task.status}`,
      task_id: task.id,
    });
  }
}

export {
  depsSatisfied,
  getTaskById,
  hasFailedDep,
  isTaskTerminal,
  isTerminalStatus,
  markTaskBlocked,
  markTaskCompleted,
  markTaskFailed,
  markTaskPlanning,
  markTaskStarted,
  markTaskVerifying,
  patchTask,
  syncParentStatuses,
  TERMINAL_STATUSES,
};
