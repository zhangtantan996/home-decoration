import test from 'node:test';
import assert from 'node:assert/strict';
import { inferModulesForPaths, loadControlPlane, validateTaskRouting, validateVerifierIsolation } from '../../ops/lib/schema.mjs';

test('single-module task must stay inside module owner ownership', () => {
  const snapshot = loadControlPlane(process.cwd());
  const task = {
    id: 'server-slice',
    goal: 'touch only backend',
    status: 'queued',
    owner_role: 'backend',
    owned_paths: ['server/internal/service/example.go'],
    deps: [],
    risk: 'auth',
    verify_profile: 'server-test',
    outputs: ['server/internal/service/example.go'],
  };
  validateTaskRouting(task, snapshot.project, snapshot.agents);
});

test('cross-module task must be split or remain with coordinator only', () => {
  const snapshot = loadControlPlane(process.cwd());
  const task = {
    id: 'bad-cross-surface',
    goal: 'touch backend and admin in one go',
    status: 'queued',
    owner_role: 'backend',
    owned_paths: ['server/internal/service/example.go', 'admin/src/pages/Dashboard.tsx'],
    deps: [],
    risk: 'identity',
    verify_profile: 'server-test',
    outputs: [],
  };
  assert.throws(() => validateTaskRouting(task, snapshot.project, snapshot.agents), /must be split/i);
});

test('verifier write set cannot overlap implementation write sets', () => {
  const snapshot = loadControlPlane(process.cwd());
  const state = structuredClone(snapshot.state);
  state.tasks.push({
    id: 'impl-server-overlap',
    goal: 'implementation task owns backend path',
    status: 'queued',
    owner_role: 'backend',
    owned_paths: ['server/internal/service/example.go'],
    deps: [],
    risk: 'auth',
    verify_profile: 'server-test',
    outputs: [],
  });
  state.tasks.push({
    id: 'bad-verifier',
    goal: 'overlap backend path',
    status: 'queued',
    owner_role: 'verifier',
    owned_paths: ['server/internal/service/example.go'],
    deps: [],
    risk: 'deploy',
    verify_profile: 'ops-control-plane-tests',
    outputs: [],
  });
  assert.throws(() => validateVerifierIsolation(state), /overlaps/i);
});

test('module inference resolves module prefixes correctly', () => {
  const snapshot = loadControlPlane(process.cwd());
  const modules = inferModulesForPaths(snapshot.project, ['merchant/src/router/index.tsx']);
  assert.deepEqual(modules, ['merchant']);
});
