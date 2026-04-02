import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from '../../ops/server.mjs';
import { executeTelegramCommand } from '../../ops/lib/telegram.mjs';
import { loadStateFile } from '../../ops/lib/state-store.mjs';

function copyOpsFixture() {
  const sourceRoot = process.cwd();
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ops-remote-'));
  fs.cpSync(path.join(sourceRoot, 'ops'), path.join(tmpRoot, 'ops'), { recursive: true });
  const projectPath = path.join(tmpRoot, 'ops', 'project.yaml');
  const project = JSON.parse(fs.readFileSync(projectPath, 'utf8'));
  project.verify_profiles.push({
    id: 'remote-smoke',
    description: 'Safe remote smoke command',
    cwd: '.',
    command: ['node', '-e', 'console.log("remote-ok")'],
    remote_allowed: true,
  });
  fs.writeFileSync(projectPath, `${JSON.stringify(project, null, 2)}\n`);
  const statePath = path.join(tmpRoot, 'ops', 'state.yaml');
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  state.tasks.push({
    id: 'remote-approval-task',
    goal: 'await remote approval',
    status: 'pending_approval',
    owner_role: 'coordinator',
    owned_paths: ['ops/project.yaml'],
    deps: [],
    risk: 'identity',
    verify_profile: 'remote-smoke',
    outputs: [],
  });
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
  return tmpRoot;
}

test('webui api exposes status and profile execution without arbitrary shell', async () => {
  const repoRoot = copyOpsFixture();
  const server = await startServer({ host: '127.0.0.1', port: 0, repoRoot });
  const { port } = server.address();
  try {
    const status = await fetch(`http://127.0.0.1:${port}/api/status`).then((response) => response.json());
    assert.match(status.summary, /home-decoration/);

    const run = await fetch(`http://127.0.0.1:${port}/api/profiles/remote-smoke/run`, { method: 'POST' }).then((response) => response.json());
    assert.equal(run.outcome, 'passed');
    assert.match(run.stdout, /remote-ok/);

    const approve = await fetch(`http://127.0.0.1:${port}/api/tasks/remote-approval-task/approve`, { method: 'POST' }).then((response) => response.json());
    assert.equal(approve.task.status, 'approved');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('webui api can create routed tasks', async () => {
  const repoRoot = copyOpsFixture();
  const server = await startServer({ host: '127.0.0.1', port: 0, repoRoot });
  const { port } = server.address();
  try {
    const created = await fetch(`http://127.0.0.1:${port}/api/tasks`, {
      body: JSON.stringify({ description: '修复 web 首页按钮样式问题' }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    }).then((response) => response.json());

    assert.equal(created.task.owner_role, 'web');
    assert.equal(created.task.status, 'queued');

    const state = loadStateFile(repoRoot);
    const task = state.tasks.find((item) => item.id === created.task.id);
    assert.ok(task);
    assert.equal(task.owner_role, 'web');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('telegram command handler allows only whitelist actions', async () => {
  const repoRoot = copyOpsFixture();
  const summary = await executeTelegramCommand({ repoRoot, text: '/summary' });
  assert.equal(summary.ok, true);
  assert.match(summary.text, /Project: home-decoration/);

  const run = await executeTelegramCommand({ repoRoot, text: '/run remote-smoke' });
  assert.equal(run.ok, true);
  assert.match(run.text, /remote-ok/);

  const denied = await executeTelegramCommand({ repoRoot, text: '/shell ls' });
  assert.equal(denied.ok, false);
  assert.match(denied.text, /Allowed actions/);
});

test('telegram task command creates a routed task for a single surface', async () => {
  const repoRoot = copyOpsFixture();
  const result = await executeTelegramCommand({
    actor: 'telegram:tester',
    repoRoot,
    text: '/task 修复商家端入驻表单必填校验',
  });

  assert.equal(result.ok, true);
  assert.match(result.text, /已创建任务/);
  assert.match(result.text, /负责人：merchant/);

  const state = loadStateFile(repoRoot);
  const task = state.tasks.find((item) => item.id.startsWith('telegram-merchant-'));
  assert.ok(task);
  assert.equal(task.owner_role, 'merchant');
  assert.equal(task.status, 'queued');
  assert.equal(task.verify_profile, 'merchant-build');
});

test('telegram task command sends cross-module risky work to coordinator pending approval', async () => {
  const repoRoot = copyOpsFixture();
  const result = await executeTelegramCommand({
    actor: 'telegram:tester',
    repoRoot,
    text: '/task 联调 server 和 web 的登录流程并处理部署风险',
  });

  assert.equal(result.ok, true);
  assert.match(result.text, /负责人：coordinator/);
  assert.match(result.text, /状态：pending_approval/);

  const state = loadStateFile(repoRoot);
  const task = state.tasks.find((item) => item.id.startsWith('telegram-coordinator-'));
  assert.ok(task);
  assert.equal(task.owner_role, 'coordinator');
  assert.equal(task.status, 'pending_approval');
  assert.equal(task.verify_profile, 'ops-validate');
});
