import { spawn } from 'node:child_process';
import path from 'node:path';
import {
  appendMarkdownSection,
  appendNdjson,
  readJsonYaml,
  readNdjson,
  readText,
  writeJsonYaml,
} from './file-format.mjs';
import { getControlPlanePaths, loadControlPlane, validateEventRecord, validateStateModel } from './schema.mjs';

function nowIso() {
  return new Date().toISOString();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function updateState(repoRoot, updater) {
  const snapshot = loadControlPlane(repoRoot);
  const nextState = clone(snapshot.state);
  updater(nextState, snapshot);
  nextState.updated_at = nowIso();
  validateStateModel(nextState);
  writeJsonYaml(snapshot.paths.state, nextState);
  return { ...snapshot, state: nextState };
}

function appendEvent(repoRoot, event) {
  const validated = validateEventRecord({
    ts: event.ts ?? nowIso(),
    actor: event.actor,
    task_id: event.task_id,
    kind: event.kind,
    summary: event.summary,
    files: event.files ?? [],
    commands: event.commands ?? [],
    result: event.result ?? 'ok',
    commit: event.commit ?? null,
  });
  const { paths } = loadControlPlane(repoRoot);
  appendNdjson(paths.events, validated);
  return validated;
}

function appendDecision(repoRoot, decision) {
  const { paths } = loadControlPlane(repoRoot);
  const body = [
    `- Date: ${decision.date ?? nowIso()}`,
    `- Actor: ${decision.actor}`,
    `- Task: ${decision.task_id}`,
    '',
    decision.summary,
  ].join('\n');
  appendMarkdownSection(paths.decisions, decision.title, body);
  appendEvent(repoRoot, {
    actor: decision.actor,
    commands: [],
    files: [path.relative(loadControlPlane(repoRoot).repoRoot, paths.decisions)],
    kind: 'decision',
    result: 'recorded',
    summary: decision.summary,
    task_id: decision.task_id,
  });
}

function getTask(state, taskId) {
  return state.tasks.find((task) => task.id === taskId);
}

function approveTask(repoRoot, { actor, taskId }) {
  const snapshot = updateState(repoRoot, (state) => {
    const task = getTask(state, taskId);
    if (!task) {
      throw new Error(`Unknown task: ${taskId}`);
    }
    if (task.status !== 'pending_approval') {
      throw new Error(`Task ${taskId} is not pending approval`);
    }
    task.status = 'approved';
  });

  appendEvent(repoRoot, {
    actor,
    files: ['ops/state.yaml'],
    kind: 'progress',
    result: 'approved',
    summary: `Approved task ${taskId}`,
    task_id: taskId,
  });
  return getTask(snapshot.state, taskId);
}

function handoffTask(repoRoot, { actor, reason = '', taskId, toRole }) {
  const snapshot = updateState(repoRoot, (state, controlPlane) => {
    const task = getTask(state, taskId);
    if (!task) {
      throw new Error(`Unknown task: ${taskId}`);
    }
    const hasRole = controlPlane.agents.roles.some((role) => role.id === toRole);
    if (!hasRole) {
      throw new Error(`Unknown role: ${toRole}`);
    }
    task.owner_role = toRole;
    if (task.status === 'blocked') {
      task.status = 'queued';
    }
  });

  appendEvent(repoRoot, {
    actor,
    files: ['ops/state.yaml'],
    kind: 'handoff',
    result: 'reassigned',
    summary: `Handed off task ${taskId} to ${toRole}${reason ? `: ${reason}` : ''}`,
    task_id: taskId,
  });
  return getTask(snapshot.state, taskId);
}

function setActiveSession(repoRoot, session) {
  const snapshot = updateState(repoRoot, (state) => {
    state.active_session = {
      id: session.id,
      role: session.role,
      started_at: session.started_at ?? nowIso(),
      summary: session.summary,
    };
  });
  appendEvent(repoRoot, {
    actor: session.role,
    files: ['ops/state.yaml'],
    kind: 'handoff',
    result: 'session-updated',
    summary: `Active session set to ${session.id}`,
    task_id: session.task_id ?? 'control-plane',
  });
  return snapshot.state.active_session;
}

function addTask(repoRoot, task, actor = 'coordinator') {
  const snapshot = updateState(repoRoot, (state) => {
    if (getTask(state, task.id)) {
      throw new Error(`Task ${task.id} already exists`);
    }
    state.tasks.push({
      attempt: 0,
      children: [],
      created_at: nowIso(),
      phase: task.status === 'done' ? 'done' : 'ready',
      priority: 0,
      started_at: null,
      finished_at: null,
      summary: '',
      verification: {
        profile: task.verify_profile,
        status: 'pending',
      },
      ...task,
    });
  });
  appendEvent(repoRoot, {
    actor,
    files: ['ops/state.yaml'],
    kind: 'progress',
    result: 'created',
    summary: `Created task ${task.id}`,
    task_id: task.id,
  });
  return getTask(snapshot.state, task.id);
}

function formatCommand(command) {
  return command.map((segment) => (segment.includes(' ') ? JSON.stringify(segment) : segment)).join(' ');
}

async function runVerifyProfile(repoRoot, { actor, profileId }) {
  const snapshot = loadControlPlane(repoRoot);
  const profile = snapshot.project.verify_profiles.find((candidate) => candidate.id === profileId);
  if (!profile) {
    throw new Error(`Unknown verify profile: ${profileId}`);
  }

  const [command, ...args] = profile.command;
  const cwd = path.resolve(snapshot.repoRoot, profile.cwd);

  const result = await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      resolve({ code: code ?? 1, stderr: stderr.trim(), stdout: stdout.trim() });
    });
  });

  const outcome = result.code === 0 ? 'passed' : 'failed';
  appendEvent(repoRoot, {
    actor,
    commands: [formatCommand(profile.command)],
    files: [],
    kind: 'verify',
    result: outcome,
    summary: `Ran verify profile ${profileId}`,
    task_id: 'control-plane',
  });

  return {
    ...result,
    cwd,
    id: profile.id,
    outcome,
  };
}

function loadDecisions(repoRoot) {
  const { paths } = loadControlPlane(repoRoot);
  return readText(paths.decisions);
}

function loadEvents(repoRoot) {
  const { paths } = loadControlPlane(repoRoot);
  return readNdjson(paths.events);
}

function loadStateFile(repoRoot) {
  const { paths } = loadControlPlane(repoRoot);
  return readJsonYaml(paths.state);
}

function replaceTask(repoRoot, taskId, nextTask) {
  return updateState(repoRoot, (state) => {
    const index = state.tasks.findIndex((task) => task.id === taskId);
    if (index < 0) {
      throw new Error(`Unknown task: ${taskId}`);
    }
    state.tasks[index] = nextTask;
  });
}

export {
  addTask,
  appendDecision,
  appendEvent,
  approveTask,
  handoffTask,
  loadDecisions,
  loadEvents,
  loadStateFile,
  nowIso,
  replaceTask,
  runVerifyProfile,
  setActiveSession,
  updateState,
};
