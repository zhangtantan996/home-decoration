import test from 'node:test';
import assert from 'node:assert/strict';
import { baseSchema, PROJECT_MODULES, RISK_DOMAINS, VERIFY_COMMANDS, summarizeSchema } from '../../scripts/feishu/bitable-schema.mjs';

test('feishu bitable schema includes expected tables and views', () => {
  const summary = summarizeSchema(baseSchema);
  assert.equal(summary.tableCount, 4);
  assert.deepEqual(summary.tables.map((table) => table.name), ['问题池', '项目协同', '成员目录', '验证记录']);

  const issues = summary.tables.find((table) => table.name === '问题池');
  assert.ok(issues);
  assert.ok(issues.fields.includes('标题'));
  assert.ok(issues.fields.includes('指派给'));
  assert.ok(issues.views.includes('按模块看板'));
});

test('feishu bitable schema project enums stay aligned with repo defaults', () => {
  assert.deepEqual(PROJECT_MODULES, ['server', 'admin', 'merchant', 'web', 'mobile', 'mini', 'deploy', 'tests/e2e', 'ops']);
  assert.deepEqual(RISK_DOMAINS, ['auth', 'identity', 'payment/escrow', 'im', 'public-web', 'deploy', 'other']);
  assert.deepEqual(VERIFY_COMMANDS, [
    'npm run verify:user-web',
    'npm run test:identity:acceptance',
    'npm run test:e2e:merchant:smoke',
    'cd server && make test',
  ]);
});

test('feishu bitable schema uses Chinese canonical table names for sync mode', () => {
  const canonicalTableNames = baseSchema.tables.map((table) => table.name);
  assert.ok(canonicalTableNames.includes('问题池'));
  assert.ok(canonicalTableNames.includes('项目协同'));
  assert.ok(canonicalTableNames.includes('成员目录'));
  assert.ok(canonicalTableNames.includes('验证记录'));
});
