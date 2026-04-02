import test from 'node:test';
import assert from 'node:assert/strict';
import { loadControlPlane } from '../../ops/lib/schema.mjs';

test('control plane schemas load and cross references resolve', () => {
  const snapshot = loadControlPlane(process.cwd());
  assert.equal(snapshot.project.project.name, 'home-decoration');
  assert.ok(snapshot.project.modules.length >= 8);
  assert.ok(snapshot.agents.roles.some((role) => role.id === 'coordinator'));
  assert.ok(snapshot.events.length >= 4);
  assert.ok(snapshot.state.tasks.every((task) => task.verify_profile));
});
