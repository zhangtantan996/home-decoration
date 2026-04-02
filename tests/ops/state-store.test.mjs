import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { appendDecision, approveTask, handoffTask, loadEvents, loadStateFile } from '../../ops/lib/state-store.mjs';

function copyOpsFixture() {
  const sourceRoot = process.cwd();
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ops-store-'));
  fs.cpSync(path.join(sourceRoot, 'ops'), path.join(tmpRoot, 'ops'), { recursive: true });
  fs.mkdirSync(path.join(tmpRoot, 'tests', 'ops'), { recursive: true });
  return tmpRoot;
}

test('approveTask transitions pending approval tasks and appends an event', () => {
  const repoRoot = copyOpsFixture();
  const statePath = path.join(repoRoot, 'ops', 'state.yaml');
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  state.tasks.push({
    id: 'needs-approval',
    goal: 'await approval',
    status: 'pending_approval',
    owner_role: 'coordinator',
    owned_paths: ['ops/project.yaml'],
    deps: [],
    risk: 'identity',
    verify_profile: 'ops-validate',
    outputs: [],
  });
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);

  const task = approveTask(repoRoot, { actor: 'test', taskId: 'needs-approval' });
  assert.equal(task.status, 'approved');

  const nextState = loadStateFile(repoRoot);
  assert.equal(nextState.tasks.find((item) => item.id === 'needs-approval').status, 'approved');
  const lastEvent = loadEvents(repoRoot).at(-1);
  assert.equal(lastEvent.kind, 'progress');
  assert.equal(lastEvent.result, 'approved');
});

test('handoffTask changes task owner and records a handoff event', () => {
  const repoRoot = copyOpsFixture();
  const task = handoffTask(repoRoot, {
    actor: 'test',
    reason: 'need frontend owner',
    taskId: 'ops-remote-surface-bootstrap',
    toRole: 'coordinator',
  });
  assert.equal(task.owner_role, 'coordinator');
  const lastEvent = loadEvents(repoRoot).at(-1);
  assert.equal(lastEvent.kind, 'handoff');
});

test('appendDecision appends markdown and emits decision event', () => {
  const repoRoot = copyOpsFixture();
  appendDecision(repoRoot, {
    actor: 'test',
    task_id: 'ops-control-plane-bootstrap',
    title: 'ADR-test',
    summary: 'Record a test decision.',
  });
  const decisions = fs.readFileSync(path.join(repoRoot, 'ops', 'decisions.md'), 'utf8');
  assert.match(decisions, /ADR-test/);
  const lastEvent = loadEvents(repoRoot).at(-1);
  assert.equal(lastEvent.kind, 'decision');
});
