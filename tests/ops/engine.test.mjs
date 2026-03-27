import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { runEngineCycle } from '../../ops/engine.mjs';
import { loadStateFile } from '../../ops/lib/state-store.mjs';

function copyOpsFixture() {
  const sourceRoot = process.cwd();
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ops-engine-'));
  fs.cpSync(path.join(sourceRoot, 'ops'), path.join(tmpRoot, 'ops'), { recursive: true });
  const projectPath = path.join(tmpRoot, 'ops', 'project.yaml');
  const project = JSON.parse(fs.readFileSync(projectPath, 'utf8'));
  project.modules = project.modules.map((module) => ({
    ...module,
    verify_profiles: ['ops-validate'],
  }));
  fs.writeFileSync(projectPath, `${JSON.stringify(project, null, 2)}\n`);
  return tmpRoot;
}

test('engine splits coordinator task into bounded child tasks', async () => {
  const repoRoot = copyOpsFixture();
  const statePath = path.join(repoRoot, 'ops', 'state.yaml');
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  state.tasks.push({
    id: 'telegram-coordinator-split-test',
    goal: '联调 server 和 web 的登录流程并处理部署风险',
    status: 'approved',
    owner_role: 'coordinator',
    owned_paths: ['ops/'],
    deps: [],
    risk: 'deploy',
    verify_profile: 'ops-validate',
    outputs: [],
    intake: {
      requested_by: 'telegram:tester',
      requested_modules: ['server', 'web'],
      requested_via: 'telegram',
      routing_reason: 'manual test',
    },
  });
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);

  await runEngineCycle(repoRoot, {
    executor: async () => ({
      blockers: [],
      outputs: [],
      status: 'done',
      summary: 'noop',
      verification_notes: 'noop',
    }),
  });

  const nextState = loadStateFile(repoRoot);
  const parent = nextState.tasks.find((task) => task.id === 'telegram-coordinator-split-test');
  assert.ok(parent.children.length >= 2);
  assert.ok(nextState.tasks.some((task) => task.parent_task_id === parent.id && task.owner_role === 'backend'));
  assert.ok(nextState.tasks.some((task) => task.parent_task_id === parent.id && task.owner_role === 'web'));
});

test('engine executes runnable leaf tasks and marks them done with verification', async () => {
  const repoRoot = copyOpsFixture();
  const statePath = path.join(repoRoot, 'ops', 'state.yaml');
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  state.tasks.push({
    id: 'engine-web-leaf',
    goal: '修复 web 首页按钮样式问题',
    status: 'queued',
    owner_role: 'web',
    owned_paths: ['web/'],
    deps: [],
    risk: 'public-web',
    verify_profile: 'ops-validate',
    outputs: [],
  });
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);

  await runEngineCycle(repoRoot, {
    executor: async () => ({
      blockers: [],
      outputs: ['web/src/pages/Home.tsx'],
      status: 'done',
      summary: 'Updated the web home page button styles.',
      verification_notes: 'Worker finished cleanly.',
    }),
  });

  const nextState = loadStateFile(repoRoot);
  const task = nextState.tasks.find((item) => item.id === 'engine-web-leaf');
  assert.equal(task.status, 'done');
  assert.equal(task.phase, 'done');
  assert.deepEqual(task.outputs, ['web/src/pages/Home.tsx']);
  assert.equal(task.verification.status, 'passed');
});
