import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';

const apiBaseUrl = process.env.E2E_API_BASE_URL || 'http://127.0.0.1:8080/api/v1';
const adminOrigin = process.env.E2E_ADMIN_ORIGIN || 'http://127.0.0.1:5175/admin';
const projectId = Number(process.env.E2E_ADMIN_PROJECT_ID || 3);
const DB_CONTAINER = process.env.USER_WEB_FIXTURE_DB_CONTAINER || 'home_decor_db_local';
const DB_NAME = process.env.USER_WEB_FIXTURE_DB_NAME || 'home_decoration';
const DB_USER = process.env.USER_WEB_FIXTURE_DB_USER || 'postgres';
const DB_URL = process.env.USER_WEB_FIXTURE_DB_URL || '';

type AdminSessionPayload = {
  token: string;
  admin: Record<string, unknown>;
  permissions: string[];
  menus: Array<Record<string, unknown>>;
};

async function loginAdminSession(request: Parameters<typeof test>[0]['request']) {
  const response = await request.post(`${apiBaseUrl}/admin/login`, {
    data: {
      username: process.env.E2E_ADMIN_USER || 'admin',
      password: process.env.E2E_ADMIN_PASS || 'admin123',
    },
  });
  expect(response.status()).toBe(200);
  const payload = await response.json();
  expect(payload.code).toBe(0);
  expect(payload.data?.token).toBeTruthy();
  return payload.data as AdminSessionPayload;
}

function queryScalar(sql: string) {
  if (DB_URL) {
    return execFileSync('psql', [DB_URL, '-v', 'ON_ERROR_STOP=1', '-t', '-A'], {
      input: sql,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  }
  return execFileSync('docker', ['exec', '-i', DB_CONTAINER, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', DB_USER, '-d', DB_NAME, '-t', '-A'], {
    input: sql,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}

function seedPendingProjectAudit(auditType: 'close' | 'refund' = 'close') {
  const runId = Date.now();
  const auditId = Number.parseInt(queryScalar(`
    INSERT INTO project_audits (
      project_id, audit_type, status, complaint_id, refund_application_id,
      audit_notes, conclusion, conclusion_reason, execution_plan, admin_id, created_at, updated_at
    ) VALUES (
      ${projectId}, '${auditType}', 'pending', 0, 0,
      'E2E admin smoke ${runId}', '', '', '{}'::jsonb, 1, NOW(), NOW()
    )
    RETURNING id;
  `), 10);
  const auditLogId = Number.parseInt(queryScalar(`
    INSERT INTO audit_logs (
      created_at, updated_at, record_kind, operator_type, operator_id, action,
      operation_type, resource, resource_type, resource_id, reason, result,
      before_state, after_state, metadata
    ) VALUES (
      NOW(), NOW(), 'business', 'admin', 1, 'create_project_audit',
      'create_project_audit', 'project', 'project', ${projectId}, 'E2E admin smoke', 'success',
      '{}'::jsonb, '{"projectAudit":{"id":${auditId},"projectId":${projectId},"auditType":"${auditType}"}}'::jsonb, '{"source":"playwright-admin-smoke"}'::jsonb
    )
    RETURNING id;
  `), 10);

  expect(auditId).toBeGreaterThan(0);
  expect(auditLogId).toBeGreaterThan(0);
  return { id: auditId, projectId, auditType, status: 'pending' as const };
}

function injectAdminSession(page: Parameters<typeof test>[0]['page'], session: AdminSessionPayload) {
  return page.addInitScript((storage) => {
    window.localStorage.setItem('admin_token', storage.token);
    window.localStorage.setItem('admin_user', JSON.stringify(storage.admin));
    window.localStorage.setItem('admin_permissions', JSON.stringify(storage.permissions));
    window.localStorage.setItem('admin_menus', JSON.stringify(storage.menus));
  }, session);
}

function pageTitle(page: Parameters<typeof test>[0]['page'], text: string) {
  return page.locator('.hz-page-title__heading').filter({ hasText: text }).first();
}

test.describe('admin p2 smoke', () => {
  test('project audit pages render list, detail and arbitrate form', async ({ page, request }, testInfo) => {
    testInfo.setTimeout(120_000);

    const session = await loginAdminSession(request);
    const audit = seedPendingProjectAudit('close');
    await injectAdminSession(page, session);

    await page.goto(`${adminOrigin}/project-audits`, { waitUntil: 'domcontentloaded' });
    await expect(pageTitle(page, '项目审计')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('cell', { name: String(audit.id) }).first()).toBeVisible({ timeout: 20_000 });

    await page.goto(`${adminOrigin}/project-audits/${audit.id}`, { waitUntil: 'domcontentloaded' });
    await expect(pageTitle(page, `项目审计详情 #${audit.id}`)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('审计类型')).toBeVisible();
    await expect(page.getByText('状态')).toBeVisible();

    await page.goto(`${adminOrigin}/project-audits/${audit.id}/arbitrate`, { waitUntil: 'domcontentloaded' });
    await expect(pageTitle(page, `提交仲裁 #${audit.id}`)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByLabel('仲裁结论')).toBeVisible();
    await expect(page.getByRole('button', { name: '提交仲裁' })).toBeVisible();
  });

  test('finance and audit log pages render with successful api responses', async ({ page, request }, testInfo) => {
    testInfo.setTimeout(120_000);

    const session = await loginAdminSession(request);
    seedPendingProjectAudit('refund');
    await injectAdminSession(page, session);

    const overviewResponse = page.waitForResponse((response) =>
      response.url().includes('/api/v1/admin/finance/overview') && response.status() === 200,
    );
    await page.goto(`${adminOrigin}/finance/overview`, { waitUntil: 'domcontentloaded' });
    await overviewResponse;
    await expect(pageTitle(page, '资金概览')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('托管总额')).toBeVisible();
    await expect(page.getByText('待放款金额')).toBeVisible();

    const transactionsResponse = page.waitForResponse((response) =>
      response.url().includes('/api/v1/admin/finance/transactions') && response.status() === 200,
    );
    await page.goto(`${adminOrigin}/finance/transactions`, { waitUntil: 'domcontentloaded' });
    await transactionsResponse;
    await expect(pageTitle(page, '交易流水')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.ant-table')).toBeVisible();

    const escrowResponse = page.waitForResponse((response) =>
      response.url().includes('/api/v1/admin/finance/escrow-accounts') && response.status() === 200,
    );
    await page.goto(`${adminOrigin}/finance/escrow`, { waitUntil: 'domcontentloaded' });
    await escrowResponse;
    await expect(pageTitle(page, '托管账户')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.hz-stat-card__label').filter({ hasText: '冻结金额' }).first()).toBeVisible();

    const auditLogResponse = page.waitForResponse((response) =>
      response.url().includes('/api/v1/admin/audit-logs') && response.status() === 200,
    );
    await page.goto(`${adminOrigin}/audit-logs`, { waitUntil: 'domcontentloaded' });
    await auditLogResponse;
    await expect(pageTitle(page, '审计留痕')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByPlaceholder('操作类型，如 freeze_funds')).toBeVisible();
    await expect(page.locator('.ant-table')).toBeVisible();
  });
});
